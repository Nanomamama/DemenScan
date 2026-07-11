<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

header('Content-Type: application/json; charset=UTF-8');
require_admin();

$filters = collect_submission_filters($_GET);
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
$total = count_submissions($filters);
$rows = fetch_submissions($filters, $page, $perPage);

echo json_encode([
    'ok' => true,
    'data' => $rows,
    'pagination' => [
        'page' => $page,
        'per_page' => $perPage,
        'total' => $total,
    ],
], JSON_UNESCAPED_UNICODE);

