<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

header('Content-Type: application/json; charset=UTF-8');
require_admin();

$detail = fetch_submission_detail((int) ($_GET['id'] ?? 0));
if (!$detail) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'not_found'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);

