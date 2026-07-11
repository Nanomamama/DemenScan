<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=UTF-8');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_string(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'error' => 'invalid_json']);
}

$totalScore = (int) ($payload['total_score'] ?? -1);
$maxScore = (int) ($payload['max_score'] ?? 97);
$riskLevel = (string) ($payload['risk_level'] ?? '');
$sectionScores = is_array($payload['section_scores'] ?? null) ? $payload['section_scores'] : [];
$profile = is_array($payload['profile'] ?? null) ? $payload['profile'] : [];
$answers = is_array($payload['answers'] ?? null) ? $payload['answers'] : [];

if ($totalScore < 0 || $maxScore <= 0 || !in_array($riskLevel, ['low', 'moderate', 'high'], true)) {
    respond(422, ['ok' => false, 'error' => 'invalid_score_payload']);
}

try {
    $pdo = db();
    $pdo->beginTransaction();

    $code = 'DS-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    $insert = $pdo->prepare(
        'INSERT INTO assessment_submissions (
            submission_code, total_score, max_score, risk_level,
            section4_score, section5_score, section6_score,
            age, gender, education, marital_status, monthly_income,
            family_dementia_history, sleep_time, wake_time, smoking, alcohol,
            exercise_frequency, diseases, feedback_json, user_agent, ip_address
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )'
    );

    $insert->execute([
        $code,
        $totalScore,
        $maxScore,
        $riskLevel,
        (int) ($sectionScores['4'] ?? 0),
        (int) ($sectionScores['5'] ?? 0),
        (int) ($sectionScores['6'] ?? 0),
        isset($profile['age']) && is_numeric($profile['age']) ? (int) $profile['age'] : null,
        $profile['gender'] ?? null,
        $profile['education'] ?? null,
        $profile['marital_status'] ?? null,
        $profile['monthly_income'] ?? null,
        $profile['family_dementia_history'] ?? null,
        $profile['sleep_time'] ?? null,
        $profile['wake_time'] ?? null,
        $profile['smoking'] ?? null,
        $profile['alcohol'] ?? null,
        $profile['exercise_frequency'] ?? null,
        json_string($profile['diseases'] ?? null),
        json_string($payload['feedback'] ?? []),
        $_SERVER['HTTP_USER_AGENT'] ?? null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ]);

    $submissionId = (int) $pdo->lastInsertId();
    $answerInsert = $pdo->prepare(
        'INSERT INTO assessment_answers (submission_id, section_id, question_id, question_text, answer_value, score)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    foreach ($answers as $answer) {
        if (!is_array($answer)) {
            continue;
        }
        $answerInsert->execute([
            $submissionId,
            (int) ($answer['section_id'] ?? 0),
            (string) ($answer['question_id'] ?? ''),
            (string) ($answer['question_text'] ?? ''),
            json_string($answer['answer_value'] ?? null),
            (int) ($answer['score'] ?? 0),
        ]);
    }

    $pdo->commit();
    respond(200, ['ok' => true, 'submission_code' => $code]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, ['ok' => false, 'error' => 'server_error']);
}

