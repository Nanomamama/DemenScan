<?php
$admin = $admin ?? require_admin();
$active = $active ?? '';
?>
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= h($title ?? 'DemenScan Admin') ?></title>
  <link rel="stylesheet" href="admin.css">
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand" aria-label="DemenScan Admin">
        <span class="brand-mark" aria-hidden="true">D</span>
        <span class="brand-label">DemenScan Admin</span>
      </div>
      <nav class="nav" aria-label="Admin navigation">
        <a class="<?= $active === 'dashboard' ? 'active' : '' ?>" href="index.php" aria-label="Dashboard" title="Dashboard">
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img"><path d="M3 13h8V3H3v10Zm10 8h8V3h-8v18ZM3 21h8v-6H3v6Z"/></svg>
          </span>
          <span class="nav-label">Dashboard</span>
        </a>
        <a class="<?= $active === 'submissions' ? 'active' : '' ?>" href="submissions.php" aria-label="ผลประเมิน" title="ผลประเมิน">
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img"><path d="M8 3h8l1 2h3v16H4V5h3l1-2Zm1.2 4 1-2h3.6l1 2H18v12H6V7h3.2ZM8 10h8v2H8v-2Zm0 4h8v2H8v-2Z"/></svg>
          </span>
          <span class="nav-label">ผลประเมิน</span>
        </a>
        <a href="logout.php" aria-label="ออกจากระบบ" title="ออกจากระบบ">
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img"><path d="M5 3h8v2H7v14h6v2H5V3Zm11.6 5.4L20.2 12l-3.6 3.6-1.4-1.4 1.2-1.2H11v-2h5.4l-1.2-1.2 1.4-1.4Z"/></svg>
          </span>
          <span class="nav-label">ออกจากระบบ</span>
        </a>
      </nav>
      <div class="sidebar-user">
        <span>เข้าสู่ระบบโดย</span>
        <strong><?= h($admin['display_name'] ?? $admin['username'] ?? 'Admin') ?></strong>
      </div>
    </aside>
    <main class="workspace">
