<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

$admin = require_admin();
$detail = fetch_submission_detail((int) ($_GET['id'] ?? 0));
if (!$detail) {
    http_response_code(404);
    exit('ไม่พบข้อมูลผลประเมิน');
}

$submission = $detail['submission'];
$answers = $detail['answers'];
$title = 'รายละเอียดผลประเมิน | DemenScan Admin';
$active = 'submissions';
require __DIR__ . '/_header.php';
?>
<div class="page-title">
  <div>
    <h1><?= h($submission['submission_code']) ?></h1>
    <p>รายละเอียดผลประเมินวันที่ <?= h($submission['created_at']) ?></p>
  </div>
  <a class="btn btn-secondary" href="submissions.php">กลับไปหน้ารายการ</a>
</div>

<section class="panel">
  <div class="detail-grid">
    <div class="detail-item"><span>คะแนนรวม</span><strong><?= h($submission['total_score']) ?>/<?= h($submission['max_score']) ?></strong></div>
    <div class="detail-item"><span>ระดับความเสี่ยง</span><strong><span class="badge <?= h($submission['risk_level']) ?>"><?= h(risk_label($submission['risk_level'])) ?></span></strong></div>
    <div class="detail-item"><span>อายุ / เพศ</span><strong><?= h($submission['age'] ?? '-') ?> / <?= h($submission['gender'] ?? '-') ?></strong></div>
    <div class="detail-item"><span>ส่วนที่ 4</span><strong><?= h($submission['section4_score']) ?></strong></div>
    <div class="detail-item"><span>ส่วนที่ 5</span><strong><?= h($submission['section5_score']) ?></strong></div>
    <div class="detail-item"><span>ส่วนที่ 6</span><strong><?= h($submission['section6_score']) ?></strong></div>
    <div class="detail-item"><span>การศึกษา</span><strong><?= h($submission['education'] ?? '-') ?></strong></div>
    <div class="detail-item"><span>สถานภาพ</span><strong><?= h($submission['marital_status'] ?? '-') ?></strong></div>
    <div class="detail-item"><span>โรคประจำตัว</span><strong><?= h(format_json_value($submission['diseases'] ?? null)) ?></strong></div>
  </div>
</section>

<section class="panel">
  <div class="panel-header">
    <h2>คำตอบทั้งหมด</h2>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>ส่วน</th>
          <th>คำถาม</th>
          <th>คำตอบ</th>
          <th>คะแนน</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($answers as $answer): ?>
          <tr>
            <td><?= h($answer['section_id']) ?></td>
            <td class="answer-value"><?= h($answer['question_text']) ?></td>
            <td class="answer-value"><?= h(format_json_value($answer['answer_value'])) ?></td>
            <td><?= h($answer['score']) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php require __DIR__ . '/_footer.php'; ?>
