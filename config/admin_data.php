<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function collect_submission_filters(array $source): array
{
    return [
        'date_from' => trim((string) ($source['date_from'] ?? '')),
        'date_to' => trim((string) ($source['date_to'] ?? '')),
        'risk_level' => trim((string) ($source['risk_level'] ?? '')),
        'score_min' => trim((string) ($source['score_min'] ?? '')),
        'score_max' => trim((string) ($source['score_max'] ?? '')),
        'age_min' => trim((string) ($source['age_min'] ?? '')),
        'age_max' => trim((string) ($source['age_max'] ?? '')),
        'gender' => trim((string) ($source['gender'] ?? '')),
        'education' => trim((string) ($source['education'] ?? '')),
        'q' => trim((string) ($source['q'] ?? '')),
    ];
}

function submission_column(string $column, string $alias = ''): string
{
    return $alias !== '' ? $alias . '.' . $column : $column;
}

function build_submission_where(array $filters, string $alias = ''): array
{
    $where = [];
    $params = [];

    if ($filters['date_from'] !== '') {
        $where[] = submission_column('created_at', $alias) . ' >= ?';
        $params[] = $filters['date_from'] . ' 00:00:00';
    }
    if ($filters['date_to'] !== '') {
        $where[] = submission_column('created_at', $alias) . ' <= ?';
        $params[] = $filters['date_to'] . ' 23:59:59';
    }
    if (in_array($filters['risk_level'], ['low', 'moderate', 'high'], true)) {
        $where[] = submission_column('risk_level', $alias) . ' = ?';
        $params[] = $filters['risk_level'];
    }
    if ($filters['score_min'] !== '' && is_numeric($filters['score_min'])) {
        $where[] = submission_column('total_score', $alias) . ' >= ?';
        $params[] = (int) $filters['score_min'];
    }
    if ($filters['score_max'] !== '' && is_numeric($filters['score_max'])) {
        $where[] = submission_column('total_score', $alias) . ' <= ?';
        $params[] = (int) $filters['score_max'];
    }
    if ($filters['age_min'] !== '' && is_numeric($filters['age_min'])) {
        $where[] = submission_column('age', $alias) . ' >= ?';
        $params[] = (int) $filters['age_min'];
    }
    if ($filters['age_max'] !== '' && is_numeric($filters['age_max'])) {
        $where[] = submission_column('age', $alias) . ' <= ?';
        $params[] = (int) $filters['age_max'];
    }
    if ($filters['gender'] !== '') {
        $where[] = submission_column('gender', $alias) . ' = ?';
        $params[] = $filters['gender'];
    }
    if ($filters['education'] !== '') {
        $where[] = submission_column('education', $alias) . ' = ?';
        $params[] = $filters['education'];
    }
    if ($filters['q'] !== '') {
        $where[] = submission_column('submission_code', $alias) . ' LIKE ?';
        $params[] = '%' . $filters['q'] . '%';
    }

    return [$where ? 'WHERE ' . implode(' AND ', $where) : '', $params];
}

function count_submissions(array $filters): int
{
    [$where, $params] = build_submission_where($filters);
    $stmt = db()->prepare("SELECT COUNT(*) FROM assessment_submissions $where");
    $stmt->execute($params);
    return (int) $stmt->fetchColumn();
}

function fetch_submissions(array $filters, int $page = 1, int $perPage = 20): array
{
    [$where, $params] = build_submission_where($filters);
    $offset = max(0, ($page - 1) * $perPage);

    $sql = "SELECT * FROM assessment_submissions $where ORDER BY created_at DESC, id DESC LIMIT $perPage OFFSET $offset";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function answer_column_key(array $answer): string
{
    return (string) $answer['section_id'] . ':' . (string) $answer['question_id'];
}

function fetch_answer_columns(array $filters): array
{
    [$where, $params] = build_submission_where($filters, 's');
    $sql = "
        SELECT
            aa.section_id,
            aa.question_id,
            SUBSTRING_INDEX(GROUP_CONCAT(aa.question_text ORDER BY aa.id DESC SEPARATOR '\n'), '\n', 1) AS question_text,
            MIN(aa.id) AS sort_order
        FROM assessment_answers aa
        INNER JOIN assessment_submissions s ON s.id = aa.submission_id
        $where
        GROUP BY aa.section_id, aa.question_id
        ORDER BY aa.section_id ASC, sort_order ASC
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $columns = $stmt->fetchAll();

    foreach ($columns as &$column) {
        $column['key'] = answer_column_key($column);
    }
    unset($column);

    return $columns;
}

function fetch_submission_answer_table(array $filters, int $page = 1, int $perPage = 20): array
{
    $rows = fetch_submissions($filters, $page, $perPage);
    $columns = fetch_answer_columns($filters);
    $answersBySubmission = [];

    if ($rows) {
        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare(
            "SELECT submission_id, section_id, question_id, answer_value
             FROM assessment_answers
             WHERE submission_id IN ($placeholders)
             ORDER BY section_id ASC, id ASC"
        );
        $stmt->execute($ids);

        foreach ($stmt->fetchAll() as $answer) {
            $submissionId = (int) $answer['submission_id'];
            $answersBySubmission[$submissionId][answer_column_key($answer)] = format_json_value($answer['answer_value']);
        }
    }

    return [
        'rows' => $rows,
        'columns' => $columns,
        'answers' => $answersBySubmission,
    ];
}

function dashboard_stats(): array
{
    $pdo = db();
    $summary = $pdo->query(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
            AVG(total_score) AS average_score,
            SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) AS low_count,
            SUM(CASE WHEN risk_level = 'moderate' THEN 1 ELSE 0 END) AS moderate_count,
            SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_count
        FROM assessment_submissions"
    )->fetch() ?: [];

    $latest = $pdo->query('SELECT * FROM assessment_submissions ORDER BY created_at DESC, id DESC LIMIT 10')->fetchAll();

    return [
        'total' => (int) ($summary['total'] ?? 0),
        'today' => (int) ($summary['today'] ?? 0),
        'average_score' => $summary['average_score'] !== null ? round((float) $summary['average_score'], 1) : 0,
        'low_count' => (int) ($summary['low_count'] ?? 0),
        'moderate_count' => (int) ($summary['moderate_count'] ?? 0),
        'high_count' => (int) ($summary['high_count'] ?? 0),
        'latest' => $latest,
    ];
}

function fetch_submission_detail(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM assessment_submissions WHERE id = ?');
    $stmt->execute([$id]);
    $submission = $stmt->fetch();
    if (!$submission) {
        return null;
    }

    $answers = db()->prepare('SELECT * FROM assessment_answers WHERE submission_id = ? ORDER BY section_id ASC, id ASC');
    $answers->execute([$id]);

    return [
        'submission' => $submission,
        'answers' => $answers->fetchAll(),
    ];
}

function delete_submissions_by_ids(array $ids): int
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0)));
    if (!$ids) {
        return 0;
    }

    $pdo = db();
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $pdo->beginTransaction();
    try {
        $answers = $pdo->prepare("DELETE FROM assessment_answers WHERE submission_id IN ($placeholders)");
        $answers->execute($ids);

        $submissions = $pdo->prepare("DELETE FROM assessment_submissions WHERE id IN ($placeholders)");
        $submissions->execute($ids);
        $deleted = $submissions->rowCount();

        $pdo->commit();
        return $deleted;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function filter_query_string(array $overrides = []): string
{
    $query = array_merge($_GET, $overrides);
    if (!array_key_exists('deleted', $overrides)) {
        unset($query['deleted']);
    }
    if (!array_key_exists('delete_error', $overrides)) {
        unset($query['delete_error']);
    }
    foreach ($query as $key => $value) {
        if ($value === '' || $value === null) {
            unset($query[$key]);
        }
    }
    return http_build_query($query);
}

function format_json_value(mixed $value): string
{
    if ($value === null || $value === '') {
        return '-';
    }

    $decoded = json_decode((string) $value, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return (string) $value;
    }

    if (is_array($decoded)) {
        $flat = [];
        array_walk_recursive($decoded, static function ($item) use (&$flat): void {
            $flat[] = (string) $item;
        });
        return $flat ? implode(', ', $flat) : '-';
    }

    if (is_bool($decoded)) {
        return $decoded ? 'ใช่' : 'ไม่ใช่';
    }

    return (string) $decoded;
}
