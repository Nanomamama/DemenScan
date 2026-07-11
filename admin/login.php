<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';

if (current_admin()) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if ($username !== '' && $password !== '' && login_admin($username, $password)) {
        header('Location: index.php');
        exit;
    }

    $error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
}
?>
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>เข้าสู่ระบบ Admin | DemenScan</title>
  <link rel="stylesheet" href="admin.css">
</head>
<body class="login-page">
  <main class="login-card">
    <h1>DemenScan Admin</h1>
    <p>เข้าสู่ระบบเพื่อดูผลแบบประเมินและส่งออกข้อมูล</p>

    <?php if ($error !== ''): ?>
      <div class="alert"><?= h($error) ?></div>
    <?php endif; ?>

    <form class="form-stack" method="post" autocomplete="off">
      <label>
        Username
        <input type="text" name="username" required autofocus>
      </label>
      <label>
        Password
        <input type="password" name="password" required>
      </label>
      <button class="btn-primary" type="submit">เข้าสู่ระบบ</button>
    </form>
  </main>
</body>
</html>
