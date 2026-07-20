const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });

[
  'sections/shared-data.js',
  'sections/section1.js',
  'sections/section2.js',
  'sections/section3.js',
  'sections/section4.js',
  'sections/section5.js',
  'sections/section6.js',
].forEach((file) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, context, { filename: file });
});

const { DemenScanSections: sections } = context.window;
const questions = sections.flatMap((section) =>
  section.questions.map((question) => ({ section, question }))
);

assert.equal(sections.length, 6, 'ต้องโหลด section ครบ 6 ส่วน');

for (const { question } of questions) {
  assert.ok(question.id, 'ทุกข้อต้องมี id');
  assert.ok(question.text, `${question.id} ต้องมีข้อความคำถาม`);
  if (['choice', 'delayed-recall-choice', 'multi-choice-exact', 'multi-choice-info'].includes(question.type)) {
    assert.ok(Array.isArray(question.options), `${question.id} ต้องมี options`);
    assert.ok(question.options.length > 0, `${question.id} ต้องมี options อย่างน้อย 1 รายการ`);
  }
}

for (const { question } of questions) {
  if (Array.isArray(question.answer)) {
    assert.ok(
      ['multi-choice-exact', 'recall-three-inputs'].includes(question.type),
      `${question.id} มี answer เป็น array แต่ type เป็น ${question.type}`
    );
  }
}

const section4 = sections.find((section) => section.id === 4);
const section5 = sections.find((section) => section.id === 5);
const section6 = sections.find((section) => section.id === 6);
assert.equal(section4.questions.length, section4.maxPoints, 'section 4 maxPoints ต้องตรงกับจำนวนข้อ');
assert.equal(section5.questions.length, section5.maxPoints, 'section 5 maxPoints ต้องตรงกับจำนวนข้อ');
assert.equal(section6.questions.length * 4, section6.maxPoints, 'section 6 maxPoints ต้องเท่ากับ 4 คะแนนต่อข้อ');

const chronicDiseaseQuestion = questions.find(({ question }) => question.id === 's1q16').question;
assert.equal(chronicDiseaseQuestion.type, 'multi-choice-info', 's1q16 ต้องเลือกได้หลายโรคเพื่อส่ง diseases เป็น array');

const songkranQuestion = questions.find(({ question }) => question.id === 's4q9').question;
assert.equal(songkranQuestion.answer, 'ใช่', 's4q9 ข้อสงกรานต์ต้องเฉลยว่าใช่');

console.log('form-audit: passed');
