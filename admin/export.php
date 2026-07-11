<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

require_admin();
$filters = collect_submission_filters($_GET);
$answerTable = fetch_submission_answer_table($filters, 1, 100000);
$rows = $answerTable['rows'];
$answerColumns = $answerTable['columns'];
$answersBySubmission = $answerTable['answers'];
$filename = 'demenscan-assessment-answers-' . date('Y-m-d') . '.csv';

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");

$headers = [
    'วันที่',
    'รหัสอ้างอิง',
    'คะแนนรวม',
    'คะแนนเต็ม',
    'ระดับความเสี่ยง',
];

foreach ($answerColumns as $column) {
    $headers[] = $column['question_text'];
}

fputcsv($out, $headers);

foreach ($rows as $row) {
    $rowAnswers = $answersBySubmission[(int) $row['id']] ?? [];
    $csvRow = [
        $row['created_at'],
        $row['submission_code'],
        $row['total_score'],
        $row['max_score'],
        risk_label($row['risk_level']),
    ];

    foreach ($answerColumns as $column) {
        $csvRow[] = $rowAnswers[$column['key']] ?? '';
    }

    fputcsv($out, $csvRow);
}

fclose($out);
exit;
