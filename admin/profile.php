<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';

$admin = require_admin();

if (empty($_SESSION['profile_token'])) {
    $_SESSION['profile_token'] = bin2hex(random_bytes(32));
}

$profileMessage = '';
$profileError = '';
$passwordMessage = '';
$passwordError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = (string) ($_POST['csrf_token'] ?? '');
    if (!hash_equals((string) $_SESSION['profile_token'], $token)) {
        http_response_code(400);
        exit('Invalid request token');
    }

    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'update_profile') {
        $username = trim((string) ($_POST['username'] ?? ''));
        $displayName = trim((string) ($_POST['display_name'] ?? ''));

        if ($username === '' || $displayName === '') {
            $profileError = 'กรุณากรอกชื่อผู้ใช้และชื่อที่แสดง';
        } elseif (strlen($username) > 100 || strlen($displayName) > 150) {
            $profileError = 'ข้อมูลยาวเกินกว่าที่ระบบกำหนด';
        } elseif (admin_username_exists($username, (int) $admin['id'])) {
            $profileError = 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว';
        } else {
            update_admin_profile((int) $admin['id'], $username, $displayName);
            $admin = require_admin();
            $profileMessage = 'บันทึกข้อมูลโปรไฟล์แล้ว';
        }
    }

    if ($action === 'change_password') {
        $currentPassword = (string) ($_POST['current_password'] ?? '');
        $newPassword = (string) ($_POST['new_password'] ?? '');
        $confirmPassword = (string) ($_POST['confirm_password'] ?? '');

        if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
            $passwordError = 'กรุณากรอกรหัสผ่านให้ครบ';
        } elseif (strlen($newPassword) < 8) {
            $passwordError = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร';
        } elseif ($newPassword !== $confirmPassword) {
            $passwordError = 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน';
        } elseif (!change_admin_password((int) $admin['id'], $currentPassword, $newPassword)) {
            $passwordError = 'รหัสผ่านเดิมไม่ถูกต้อง';
        } else {
            $_SESSION['profile_token'] = bin2hex(random_bytes(32));
            $passwordMessage = 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว';
        }
    }
}

$title = 'โปรไฟล์ Admin | DemenScan Admin';
$active = 'profile';
require __DIR__ . '/_header.php';
?>
<div class="page-title">
  <div>
    <h1>โปรไฟล์ Admin</h1>
    <p>แก้ไขข้อมูลบัญชีและเปลี่ยนรหัสผ่านสำหรับผู้ดูแลระบบที่กำลังใช้งานอยู่</p>
  </div>
</div>

<div class="profile-grid">
  <section class="panel">
    <div class="panel-header">
      <h2>ข้อมูลบัญชี</h2>
    </div>
    <form class="form-stack admin-form" method="post" autocomplete="off">
      <input type="hidden" name="action" value="update_profile">
      <input type="hidden" name="csrf_token" value="<?= h($_SESSION['profile_token']) ?>">

      <?php if ($profileMessage !== ''): ?>
        <div class="alert alert-success"><?= h($profileMessage) ?></div>
      <?php endif; ?>
      <?php if ($profileError !== ''): ?>
        <div class="alert"><?= h($profileError) ?></div>
      <?php endif; ?>

      <label>
        Username
        <input type="text" name="username" value="<?= h($admin['username'] ?? '') ?>" maxlength="100" required>
      </label>
      <label>
        ชื่อที่แสดง
        <input type="text" name="display_name" value="<?= h($admin['display_name'] ?? '') ?>" maxlength="150" required>
      </label>
      <label>
        สิทธิ์
        <input type="text" value="<?= h($admin['role'] ?? '-') ?>" disabled>
      </label>
      <button class="btn-primary" type="submit">บันทึกโปรไฟล์</button>
    </form>
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2>เปลี่ยนรหัสผ่าน</h2>
    </div>
    <form class="form-stack admin-form" method="post" autocomplete="off">
      <input type="hidden" name="action" value="change_password">
      <input type="hidden" name="csrf_token" value="<?= h($_SESSION['profile_token']) ?>">

      <?php if ($passwordMessage !== ''): ?>
        <div class="alert alert-success"><?= h($passwordMessage) ?></div>
      <?php endif; ?>
      <?php if ($passwordError !== ''): ?>
        <div class="alert"><?= h($passwordError) ?></div>
      <?php endif; ?>

      <label>
        รหัสผ่านเดิม
        <input type="password" name="current_password" required>
      </label>
      <label>
        รหัสผ่านใหม่
        <input type="password" name="new_password" minlength="8" required>
      </label>
      <label>
        ยืนยันรหัสผ่านใหม่
        <input type="password" name="confirm_password" minlength="8" required>
      </label>
      <button class="btn-primary" type="submit">เปลี่ยนรหัสผ่าน</button>
    </form>
  </section>
</div>
<?php require __DIR__ . '/_footer.php'; ?>
