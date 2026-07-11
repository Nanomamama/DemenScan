<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

$admin = require_admin();
$stats = dashboard_stats();
$title = 'Dashboard | DemenScan Admin';
$active = 'dashboard';
require __DIR__ . '/_header.php';
?>
<section class="overview-shell">
  <div class="page-title overview-title">
    <div>
      <h1>ภาพรวมผลแบบประเมิน</h1>
      <p>สรุปจำนวนผลประเมิน คะแนนเฉลี่ย และระดับความเสี่ยงของผู้ใช้งาน DemenScan</p>
    </div>
    <a class="btn btn-primary" href="submissions.php">ดูข้อมูลทั้งหมด</a>
  </div>

  <section class="stats-grid">
    <div class="stat-card"><span>ผลประเมินทั้งหมด</span><strong><?= h($stats['total']) ?></strong></div>
    <div class="stat-card"><span>วันนี้</span><strong><?= h($stats['today']) ?></strong></div>
    <div class="stat-card"><span>คะแนนเฉลี่ย</span><strong><?= h($stats['average_score']) ?></strong></div>
  </section>

  <section class="stats-grid">
    <div class="stat-card"><span>ความเสี่ยงต่ำ</span><strong><?= h($stats['low_count']) ?></strong></div>
    <div class="stat-card"><span>ความเสี่ยงปานกลาง</span><strong><?= h($stats['moderate_count']) ?></strong></div>
    <div class="stat-card"><span>ความเสี่ยงสูง</span><strong><?= h($stats['high_count']) ?></strong></div>
  </section>
</section>

<section class="panel">
  <div class="panel-header">
    <h2>ผลประเมินล่าสุด</h2>
    <a class="btn btn-secondary" href="export.php">Export CSV</a>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>วันที่</th>
          <th>รหัส</th>
          <th>อายุ</th>
          <th>เพศ</th>
          <th>คะแนน</th>
          <th>ระดับ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($stats['latest'] as $row): ?>
          <tr>
            <td><?= h($row['created_at']) ?></td>
            <td><?= h($row['submission_code']) ?></td>
            <td><?= h($row['age'] ?? '-') ?></td>
            <td><?= h($row['gender'] ?? '-') ?></td>
            <td><strong><?= h($row['total_score']) ?>/<?= h($row['max_score']) ?></strong></td>
            <td><span class="badge <?= h($row['risk_level']) ?>"><?= h(risk_label($row['risk_level'])) ?></span></td>
            <td><a class="btn btn-secondary" href="submission-detail.php?id=<?= h($row['id']) ?>">รายละเอียด</a></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php if (!$stats['latest']): ?>
      <div class="empty">ยังไม่มีข้อมูลผลประเมิน</div>
    <?php endif; ?>
  </div>
</section>
<?php require __DIR__ . '/_footer.php'; ?>
