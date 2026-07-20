<?php
declare(strict_types=1);

// เช็กว่าเป็น localhost (XAMPP) หรือไม่
$isLocalhost = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true) 
               || ($_SERVER['REMOTE_ADDR'] ?? '') === '127.0.0.1' 
               || ($_SERVER['REMOTE_ADDR'] ?? '') === '::1';

if ($isLocalhost) {
    // --- ตั้งค่าสำหรับ XAMPP (Localhost) 
    define('DB_HOST', 'localhost');
    define('DB_PORT', 3307);
    define('DB_NAME', 'demenscan');
    define('DB_USER', 'root');               
    define('DB_PASS', '');                
} else {
    // --- ตั้งค่าสำหรับ InfinityFree (Hosting) ---
    define('DB_HOST', 'sql106.infinityfree.com');
    define('DB_PORT', 3306);
    define('DB_NAME', 'if0_42393494_demenscan');
    define('DB_USER', 'if0_42393494');
    define('DB_PASS', 'BP5hayMMIqVseYx');
}

const DB_CHARSET = 'utf8mb4';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}