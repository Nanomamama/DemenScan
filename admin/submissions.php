<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/admin_data.php';

$admin = require_admin();

if (empty($_SESSION['delete_submissions_token'])) {
    $_SESSION['delete_submissions_token'] = bin2hex(random_bytes(32));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete_selected') {
    $token = (string) ($_POST['csrf_token'] ?? '');
    if (!hash_equals((string) $_SESSION['delete_submissions_token'], $token)) {
        http_response_code(400);
        exit('Invalid request token');
    }

    $selectedIds = $_POST['submission_ids'] ?? [];
    if (!is_array($selectedIds) || !$selectedIds) {
        header('Location: submissions.php?' . filter_query_string(['delete_error' => 'none']));
        exit;
    }

    $deleted = delete_submissions_by_ids($selectedIds);
    $_SESSION['delete_submissions_token'] = bin2hex(random_bytes(32));

    header('Location: submissions.php?' . filter_query_string(['deleted' => $deleted]));
    exit;
}

$filters = collect_submission_filters($_GET);
$page = max(1, (int) ($_GET['page'] ?? 1));


$perPage = (int) ($_GET['per_page'] ?? 20);
if ($perPage !== 999999) {
    $perPage = min(100, max(10, $perPage));
}

$total = count_submissions($filters);
$answerTable = fetch_submission_answer_table($filters, $page, $perPage);
$rows = $answerTable['rows'];
$answerColumns = $answerTable['columns'];
$answersBySubmission = $answerTable['answers'];
$pages = max(1, (int) ceil($total / $perPage));
$title = 'ผลประเมิน | DemenScan Admin';
$active = 'submissions';
require __DIR__ . '/_header.php';
?>
<div class="page-title">
  <div>
    <h1>ผลประเมิน</h1>
    <p>ดูคำตอบทั้งหมดที่ผู้ใช้ทำแบบประเมิน ตั้งแต่ส่วนที่ 1 ถึงส่วนที่ 6</p>
  </div>
  <a class="btn btn-primary" href="export.php?<?= h(filter_query_string(['page' => null])) ?>">Export CSV</a>
</div>

<section class="panel">
  <form method="get" class="filter-grid">
    <label>วันที่เริ่มต้น<input type="date" name="date_from" value="<?= h($filters['date_from']) ?>"></label>
    <label>วันที่สิ้นสุด<input type="date" name="date_to" value="<?= h($filters['date_to']) ?>"></label>
    <label>ระดับความเสี่ยง
      <select name="risk_level">
        <option value="">ทั้งหมด</option>
        <?php foreach (['low' => 'ต่ำ', 'moderate' => 'ปานกลาง', 'high' => 'สูง'] as $value => $label): ?>
          <option value="<?= h($value) ?>" <?= $filters['risk_level'] === $value ? 'selected' : '' ?>><?= h($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>คะแนนต่ำสุด<input type="number" name="score_min" value="<?= h($filters['score_min']) ?>" min="0" max="97"></label>
    <label>คะแนนสูงสุด<input type="number" name="score_max" value="<?= h($filters['score_max']) ?>" min="0" max="97"></label>
    <label>อายุต่ำสุด<input type="number" name="age_min" value="<?= h($filters['age_min']) ?>" min="0"></label>
    <label>อายุสูงสุด<input type="number" name="age_max" value="<?= h($filters['age_max']) ?>" min="0"></label>
    <label>เพศ<input type="text" name="gender" value="<?= h($filters['gender']) ?>"></label>
    <label>การศึกษา<input type="text" name="education" value="<?= h($filters['education']) ?>"></label>
    <label>รหัสอ้างอิง<input type="search" name="q" value="<?= h($filters['q']) ?>"></label>
    <div class="filter-actions">
      <button class="btn-primary" type="submit">กรองข้อมูล</button>
      <a class="btn btn-secondary" href="submissions.php">ล้าง</a>
    </div>
  </form>
</section>

<?php if (isset($_GET['deleted'])): ?>
  <div class="alert alert-success">ลบข้อมูลแล้ว <?= h((int) $_GET['deleted']) ?> รายการ</div>
<?php elseif (($_GET['delete_error'] ?? '') === 'none'): ?>
  <div class="alert">กรุณาเลือกรายการที่ต้องการลบก่อน</div>
<?php endif; ?>

<section class="panel">
  <div class="panel-header">
    <h2>รายการผลประเมิน <?= h($total) ?>  รายการ</h2>
    <form method="get">
      <?php foreach ($filters as $key => $value): ?>
        <?php // ป้องกันไม่ให้ค่า page และ per_page ตัวเก่าไปทับค่าที่กำลังจะเลือกใหม่ ?>
        <?php if ($key !== 'per_page' && $key !== 'page'): ?>
          <input type="hidden" name="<?= h($key) ?>" value="<?= h($value) ?>">
        <?php endif; ?>
      <?php endforeach; ?>
      
      <select name="per_page" onchange="this.form.submit()">
        <?php foreach ([20, 50, 100] as $size): ?>
          <option value="<?= $size ?>" <?= $perPage === $size ? 'selected' : '' ?>><?= $size ?> รายการ</option>
        <?php endforeach; ?>
        
        <!-- เพิ่มตัวเลือก "ทั้งหมด" โดยกำหนดค่าเป็นจำนวนเยอะๆ (เช่น 999999) -->
        <option value="999999" <?= $perPage === 999999 ? 'selected' : '' ?>>ทั้งหมด</option>
      </select>
    </form>
</div>
  <form method="post" action="submissions.php?<?= h(filter_query_string()) ?>" class="bulk-delete-form" data-bulk-delete-form>
    <input type="hidden" name="action" value="delete_selected">
    <input type="hidden" name="csrf_token" value="<?= h($_SESSION['delete_submissions_token']) ?>">
    <div class="bulk-actions">
      <button class="btn-danger" type="submit">ลบข้อมูลที่เลือก</button>
      <span>เลือกช่องติกหน้ารายการที่ต้องการลบได้หลายรายการ</span>
    </div>
  <div class="table-wrap wide-table-wrap">
    <table class="answer-matrix-table">
      <thead>
        <tr>
          <th class="select-cell"><input type="checkbox" data-select-all aria-label="เลือกรายการทั้งหมดในหน้านี้"></th>
          <th>วันที่</th>
          <th>รหัส</th>
          <th>คะแนนรวม</th>
          <th>ระดับ</th>
          <?php foreach ($answerColumns as $column): ?>
            <th class="question-heading"><?= h($column['question_text']) ?></th>
          <?php endforeach; ?>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($rows as $row): ?>
          <?php $rowAnswers = $answersBySubmission[(int) $row['id']] ?? []; ?>
          <tr>
            <td class="select-cell"><input type="checkbox" name="submission_ids[]" value="<?= h($row['id']) ?>" aria-label="เลือก <?= h($row['submission_code']) ?>"></td>
            <td><?= h($row['created_at']) ?></td>
            <td><?= h($row['submission_code']) ?></td>
            <td><strong><?= h($row['total_score']) ?>/<?= h($row['max_score']) ?></strong></td>
            <td><span class="badge <?= h($row['risk_level']) ?>"><?= h(risk_label($row['risk_level'])) ?></span></td>
            <?php foreach ($answerColumns as $column): ?>
              <td class="answer-cell"><?= h($rowAnswers[$column['key']] ?? '-') ?></td>
            <?php endforeach; ?>
            <td><a class="btn btn-secondary" href="submission-detail.php?id=<?= h($row['id']) ?>">ดู</a></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <?php if (!$rows): ?>
      <div class="empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
    <?php endif; ?>
  </div>
  </form>
  <div class="pagination">
    <span>หน้า <?= h($page) ?> / <?= h($pages) ?></span>
    <div>
      <?php if ($page > 1): ?>
        <a class="btn btn-secondary" href="submissions.php?<?= h(filter_query_string(['page' => $page - 1])) ?>">ก่อนหน้า</a>
      <?php endif; ?>
      <?php if ($page < $pages): ?>
        <a class="btn btn-secondary" href="submissions.php?<?= h(filter_query_string(['page' => $page + 1])) ?>">ถัดไป</a>
      <?php endif; ?>
    </div>
  </div>          
</section>
<script>
  (() => {
    const form = document.querySelector('[data-bulk-delete-form]');
    if (!form) return;

    const selectAll = form.querySelector('[data-select-all]');
    const rowChecks = [...form.querySelectorAll('input[name="submission_ids[]"]')];

    const syncSelectAll = () => {
      if (!selectAll) return;
      const selectedCount = rowChecks.filter((checkbox) => checkbox.checked).length;
      selectAll.checked = rowChecks.length > 0 && selectedCount === rowChecks.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < rowChecks.length;
    };

    selectAll?.addEventListener('change', () => {
      rowChecks.forEach((checkbox) => {
        checkbox.checked = selectAll.checked;
      });
      syncSelectAll();
    });

    rowChecks.forEach((checkbox) => checkbox.addEventListener('change', syncSelectAll));

    form.addEventListener('submit', (event) => {
      const selectedCount = rowChecks.filter((checkbox) => checkbox.checked).length;
      if (selectedCount === 0) {
        event.preventDefault();
        alert('กรุณาเลือกรายการที่ต้องการลบก่อน');
        return;
      }

      if (!confirm(`ยืนยันลบข้อมูล ${selectedCount} รายการ?`)) {
        event.preventDefault();
      }
    });
  })();
</script>
<?php require __DIR__ . '/_footer.php'; ?>
