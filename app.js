/* ==========================================================
   DemenScan app controller

   This file controls the assessment flow:
   - screen navigation
   - answer rendering
   - scoring
   - result feedback
   - text-to-speech
   - progress ring

   Question content lives in sections/section1.js through section6.js.
   Runtime state stays in memory only; nothing is saved to localStorage.
   ========================================================== */

/* ---------------------------------------------------------
   1) Section Data
   --------------------------------------------------------- */

const {
  RECALL_WORDS,
  THAI_DAYS,
  THAI_MONTHS,
  MATCH_PAIR_SETS,
  SEQUENCE_SETS,
  shuffleArray,
} = window.DemenScanData;

const SECTIONS = window.DemenScanSections;
if (!Array.isArray(SECTIONS) || SECTIONS.length !== 6) {
  throw new Error('DemenScan requires all 6 section files to load before app.js');
}

const LIKERT5_OPTIONS = ['เห็นด้วยอย่างยิ่ง','เห็นด้วย','เฉยๆ','ไม่เห็นด้วย','ไม่เห็นด้วยอย่างยิ่ง'];
const LIKERT5_POINTS  = [5,4,3,2,1];
const LIKERT3_OPTIONS = ['ดีมาก','ปานกลาง','ต้องปรับปรุง'];
const FREQ4_OPTIONS   = ['ไม่เคยเลย','นานๆ ครั้ง','บ่อยครั้ง','ประจำทุกวัน'];
const FREQ4_POINTS    = [4,3,2,1];

/* ---------------------------------------------------------
   2) STATE
   --------------------------------------------------------- */
const state = {
  screen: 'welcome',      // 'welcome' | 'question' | 'result'
  sectionIdx: 0,          // 0..5
  questionIdx: 0,         // index within section.questions
  answers: {},            // questionId -> raw value
  resultPopupShown: false,
};

function flatIndex() {
  let idx = 0;
  for (let i = 0; i < state.sectionIdx; i++) idx += SECTIONS[i].questions.length;
  return idx + state.questionIdx;
}
function totalQuestions() {
  return SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);
}

/* ---------------------------------------------------------
   3) DOM refs
   --------------------------------------------------------- */
const screenWelcome = document.getElementById('screen-welcome');
const screenQuestion = document.getElementById('screen-question');
const screenResult = document.getElementById('screen-result');
const progressWrap = document.getElementById('progress-wrap');
const sectionTabs = document.getElementById('section-tabs');

document.getElementById('btn-start').addEventListener('click', () => {
  state.screen = 'question';
  state.sectionIdx = 0;
  state.questionIdx = 0;
  state.resultPopupShown = false;
  render();
});
document.getElementById('btn-prev').addEventListener('click', goPrev);
document.getElementById('btn-next').addEventListener('click', goNext);
document.getElementById('btn-restart').addEventListener('click', () => {
  state.screen = 'welcome';
  state.sectionIdx = 0;
  state.questionIdx = 0;
  state.answers = {};
  state.resultPopupShown = false;
  render();
});

document.getElementById('font-larger').addEventListener('click', () => cycleFontSize(1));
document.getElementById('font-smaller').addEventListener('click', () => cycleFontSize(-1));
const FONT_CLASSES = ['', 'font-large', 'font-xlarge'];
let fontStep = 0;
function cycleFontSize(dir) {
  fontStep = Math.min(2, Math.max(0, fontStep + dir));
  document.body.classList.remove('font-large', 'font-xlarge');
  if (FONT_CLASSES[fontStep]) document.body.classList.add(FONT_CLASSES[fontStep]);
}

/* ---------------------------------------------------------
   4) Text To Speech (No backend)
   --------------------------------------------------------- */

// Backend removed: use browser Web Speech API only.
function speak(text, btnEl) {
  const cleanText = String(text ?? '').trim();
  if (!cleanText) return;
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech and start new utterance.
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    // ignore
  }

  const originalLabel = btnEl ? btnEl.innerHTML : null;
  setSpeakButtonLoading(btnEl, true);

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = 'th-TH';
  utter.rate = 0.95;
  utter.onend = () => setSpeakButtonLoading(btnEl, false, originalLabel);
  utter.onerror = () => setSpeakButtonLoading(btnEl, false, originalLabel);
  window.speechSynthesis.speak(utter);
}

function setSpeakButtonLoading(btnEl, isLoading, restoreLabel) {
  if (!btnEl) return;
  btnEl.disabled = isLoading;
  if (isLoading) {
    btnEl.dataset.prevLabel = btnEl.innerHTML;
    btnEl.innerHTML = btnEl.classList.contains('btn-speak-small') ? '⏳' : '⏳ กำลังโหลดเสียง...';
  } else {
    btnEl.innerHTML = restoreLabel ?? btnEl.dataset.prevLabel ?? '🔊';
  }
}

// สำรอง: Web Speech API ของเบราว์เซอร์ เป็น fallback สำหรับการเล่นเสียง
function speakFallback(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'th-TH';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

document.querySelectorAll('.btn-speak[data-speak-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.speakTarget);
    if (target) speak(target.textContent, btn);
  });
});
document.getElementById('btn-speak-question').addEventListener('click', (e) => {
  const q = currentQuestion();
  if (q) speak(q.text + (q.options ? '. ตัวเลือก: ' + (q.options.join(', ')) : ''), e.currentTarget);
});

/* ---------------------------------------------------------
   5) NAVIGATION
   --------------------------------------------------------- */
function currentSection() { return SECTIONS[state.sectionIdx]; }
function currentQuestion() { return currentSection().questions[state.questionIdx]; }

function goNext() {
  const section = currentSection();
  if (state.questionIdx < section.questions.length - 1) {
    state.questionIdx++;
  } else if (state.sectionIdx < SECTIONS.length - 1) {
    state.sectionIdx++;
    state.questionIdx = 0;
  } else {
    state.screen = 'result';
    state.resultPopupShown = false;
  }
  render();
}
function goPrev() {
  if (state.questionIdx > 0) {
    state.questionIdx--;
  } else if (state.sectionIdx > 0) {
    state.sectionIdx--;
    state.questionIdx = SECTIONS[state.sectionIdx].questions.length - 1;
  } else {
    state.screen = 'welcome';
  }
  render();
}

/* ---------------------------------------------------------
   6) RENDERING
   --------------------------------------------------------- */
function render() {
  screenWelcome.hidden = state.screen !== 'welcome';
  screenQuestion.hidden = state.screen !== 'question';
  screenResult.hidden = state.screen !== 'result';
  progressWrap.hidden = state.screen === 'welcome';
  sectionTabs.hidden = state.screen !== 'question';

  if (state.screen === 'question') renderQuestion();
  if (state.screen === 'result') renderResult();
  if (state.screen !== 'welcome') renderProgressRing();
  window.scrollTo(0, 0);
}

function renderQuestion() {
  const section = currentSection();
  const q = currentQuestion();

  document.getElementById('progress-section-name').textContent = `ส่วนที่ ${section.id}: ${section.title}`;
  document.getElementById('progress-fraction').textContent = `${state.sectionIdx + 1} / ${SECTIONS.length}`;
  document.getElementById('q-index').textContent = `ข้อ ${state.questionIdx + 1} จาก ${section.questions.length}`;
  document.getElementById('q-text').textContent = q.text;

  const hintEl = document.getElementById('q-hint');
  if (q.hint) { hintEl.hidden = false; hintEl.textContent = q.hint; }
  else { hintEl.hidden = true; }

  const area = document.getElementById('q-answer-area');
  area.innerHTML = '';
  area.appendChild(buildAnswerControl(q));

  document.getElementById('btn-prev').disabled = false;
  const isLastQuestion = state.sectionIdx === SECTIONS.length - 1 &&
    state.questionIdx === section.questions.length - 1;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.setAttribute('aria-label', isLastQuestion ? 'ดูผลลัพธ์' : 'ถัดไป');
  nextBtn.innerHTML = isLastQuestion
    ? '<span class="btn-label">ดูผลลัพธ์</span><span class="btn-icon" aria-hidden="true">✓</span>'
    : '<span class="btn-label">ถัดไป</span><span class="btn-icon" aria-hidden="true">→</span>';

  document.getElementById('skip-warning').hidden = isAnswered(q);
  renderSectionTabs();
}

function renderSectionTabs() {
  sectionTabs.innerHTML = '';

  SECTIONS.forEach((section, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'section-tab';
    tab.setAttribute('aria-label', `ไปยังส่วนที่ ${section.id}: ${section.title}`);

    if (index < state.sectionIdx) tab.classList.add('completed');
    if (index === state.sectionIdx) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'step');
    }

    tab.innerHTML = `
      <span class="section-tab-number" aria-hidden="true">${section.id}</span>
      <span class="section-tab-text">
        <span class="section-tab-kicker">ส่วนที่ ${section.id}</span>
        <span class="section-tab-title">${section.title}</span>
      </span>
    `;

    tab.addEventListener('click', () => {
      state.screen = 'question';
      state.sectionIdx = index;
      state.questionIdx = 0;
      render();
    });

    sectionTabs.appendChild(tab);
  });

  const activeTab = sectionTabs.querySelector('.section-tab.active');
  if (activeTab) {
    requestAnimationFrame(() => {
      activeTab.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }
}

function buildAnswerControl(q) {
  const wrap = document.createElement('div');

  const makeChoiceButtons = (options, pointsMap) => {
    options.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      if (state.answers[q.id] === label) btn.classList.add('selected');
      btn.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      btn.addEventListener('click', () => {
        state.answers[q.id] = label;
        if (pointsMap) state.answers[q.id + '__points'] = pointsMap[i];
        renderQuestion();
      });
      wrap.appendChild(btn);
    });
  };

  const makeMultiChoiceButtons = (options) => {
    const selected = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
    const grid = document.createElement('div');
    grid.className = 'multi-choice-grid';

    options.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn multi-choice-btn';
      if (selected.includes(label)) btn.classList.add('selected');
      btn.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      btn.addEventListener('click', () => {
        const current = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
        state.answers[q.id] = current.includes(label)
          ? current.filter(item => item !== label)
          : [...current, label];
        renderQuestion();
      });
      grid.appendChild(btn);
    });

    wrap.appendChild(grid);
  };

  const makeThreeTextInputs = () => {
    const values = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : ['', '', ''];
    const grid = document.createElement('div');
    grid.className = 'multi-input-grid';

    [0, 1, 2].forEach((index) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'text-input';
      input.placeholder = `คำที่ ${index + 1}`;
      input.value = values[index] ?? '';
      input.addEventListener('input', () => {
        const next = Array.isArray(state.answers[q.id]) ? [...state.answers[q.id]] : ['', '', ''];
        next[index] = input.value;
        state.answers[q.id] = next;
      });
      grid.appendChild(input);
    });

    wrap.appendChild(grid);
  };

  switch (q.type) {
    case 'choice':
      makeChoiceButtons(q.options);
      break;
    case 'multi-choice-exact':
      makeMultiChoiceButtons(q.options);
      break;
    case 'multi-choice-info':
      makeMultiChoiceButtons(q.options);
      break;
    case 'likert5':
      makeChoiceButtons(LIKERT5_OPTIONS, LIKERT5_POINTS);
      break;
    case 'likert3':
      makeChoiceButtons(LIKERT3_OPTIONS);
      break;
    case 'freq4':
      makeChoiceButtons(FREQ4_OPTIONS, FREQ4_POINTS);
      break;
    case 'boolean':
      makeChoiceButtons(['ถูก', 'ผิด']);
      break;
    case 'number':
    case 'number-info': {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'number-input';
      input.value = state.answers[q.id] ?? '';
      input.addEventListener('input', () => { state.answers[q.id] = input.value; });
      wrap.appendChild(input);
      break;
    }
    case 'time-info': {
      const input = document.createElement('input');
      input.type = 'time';
      input.className = 'text-input';
      input.value = state.answers[q.id] ?? '';
      input.addEventListener('input', () => { state.answers[q.id] = input.value; });
      wrap.appendChild(input);
      break;
    }
    case 'text-exact':
    case 'text-presence':
    case 'recall-match': {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'text-input';
      input.value = state.answers[q.id] ?? '';
      input.addEventListener('input', () => { state.answers[q.id] = input.value; });
      wrap.appendChild(input);
      break;
    }
    case 'recall-three-inputs':
      makeThreeTextInputs();
      break;
    case 'dynamic-day': {
      makeChoiceButtons(THAI_DAYS.map(day => `วัน${day}`));
      break;
    }
    case 'dynamic-month': {
      makeChoiceButtons(THAI_MONTHS);
      break;
    }
    case 'find-occluded': {
      const grid = document.createElement('div');
      grid.className = 'image-choice-grid';
      q.icons.forEach((icon, i) => {
        const box = document.createElement('button');
        box.type = 'button';
        box.className = 'image-choice-box';
        if (state.answers[q.id] === i) box.classList.add('selected');
        box.setAttribute('aria-label', `ตัวเลือกภาพที่ ${i + 1}`);
        box.innerHTML = `<span class="image-emoji">${icon.emoji}</span>`;
        if (i === q.occludedIndex) {
          const patch = document.createElement('span');
          patch.className = 'occlusion-patch';
          patch.setAttribute('aria-hidden', 'true');
          if (q.occlusion) {
            ['top', 'right', 'bottom', 'left', 'width', 'height'].forEach((key) => {
              if (q.occlusion[key]) patch.style[key] = q.occlusion[key];
            });
            if (q.occlusion.rotate) patch.style.setProperty('--patch-rotate', q.occlusion.rotate);
          }
          box.appendChild(patch);
        }
        box.addEventListener('click', () => {
          state.answers[q.id] = i;
          renderQuestion();
        });
        grid.appendChild(box);
      });
      wrap.appendChild(grid);
      break;
    }
    case 'match-pair': {
      const set = MATCH_PAIR_SETS[q.matchSetIdx];
      if (!state.answers[q.id]) {
        state.answers[q.id] = {
          order: shuffleArray(set.right.map((item, index) => index)),
          pairs: set.left.map(() => null),
          selectedLeft: null,
        };
      }
      const answer = state.answers[q.id];
      const leftCol = document.createElement('div');
      const rightCol = document.createElement('div');
      leftCol.className = 'match-pair-column';
      rightCol.className = 'match-pair-column';

      const instructions = document.createElement('p');
      instructions.className = 'q-hint';
      instructions.textContent = 'ลากหรือแตะขวาแล้ววางไว้ที่ซ้ายเพื่อจับคู่ภาพที่เกี่ยวข้องกัน';
      wrap.appendChild(instructions);

      set.left.forEach((item, leftIndex) => {
        const leftCard = document.createElement('button');
        leftCard.type = 'button';
        leftCard.className = 'match-pair-item';
        if (answer.selectedLeft === leftIndex) leftCard.classList.add('selected');
        leftCard.setAttribute('aria-label', `จับคู่อย่างกับ ${item.label}`);
        leftCard.innerHTML = `<span class="image-emoji">${item.emoji}</span><span>${item.label}</span>`;
        leftCard.addEventListener('click', () => {
          answer.selectedLeft = answer.selectedLeft === leftIndex ? null : leftIndex;
          state.answers[q.id] = answer;
          renderQuestion();
        });
        leftCard.addEventListener('dragover', (event) => {
          event.preventDefault();
        });
        leftCard.addEventListener('drop', (event) => {
          event.preventDefault();
          const rightIndex = Number(event.dataTransfer.getData('text/plain'));
          if (Number.isFinite(rightIndex)) {
            answer.pairs[leftIndex] = rightIndex;
            answer.selectedLeft = null;
            state.answers[q.id] = answer;
            renderQuestion();
          }
        });
        if (answer.pairs[leftIndex] !== null) {
          const paired = set.right[answer.pairs[leftIndex]];
          const pairedLabel = document.createElement('div');
          pairedLabel.className = 'match-pair-label';
          pairedLabel.textContent = `จับคู่กับ ${paired.label}`;
          leftCard.appendChild(pairedLabel);
        }
        leftCol.appendChild(leftCard);
      });

      answer.order.forEach((rightIndex) => {
        const item = set.right[rightIndex];
        const rightCard = document.createElement('button');
        rightCard.type = 'button';
        rightCard.className = 'match-pair-item match-pair-right';
        rightCard.draggable = true;
        const matchedLeft = answer.pairs.findIndex(pair => pair === rightIndex);
        if (matchedLeft !== -1) rightCard.classList.add('matched');
        rightCard.setAttribute('aria-label', `${item.label} ${matchedLeft !== -1 ? 'จับคู่แล้ว' : 'ยังไม่จับคู่'}`);
        rightCard.innerHTML = `<span class="image-emoji">${item.emoji}</span><span>${item.label}</span>`;
        rightCard.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', String(rightIndex));
          event.dataTransfer.effectAllowed = 'move';
        });
        rightCard.addEventListener('click', () => {
          if (answer.selectedLeft !== null) {
            answer.pairs[answer.selectedLeft] = rightIndex;
            answer.selectedLeft = null;
            state.answers[q.id] = answer;
            renderQuestion();
          } else if (matchedLeft !== -1) {
            answer.pairs[matchedLeft] = null;
            state.answers[q.id] = answer;
            renderQuestion();
          }
        });
        rightCol.appendChild(rightCard);
      });

      const container = document.createElement('div');
      container.className = 'match-pair-wrap';
      container.appendChild(leftCol);
      container.appendChild(rightCol);
      wrap.appendChild(container);
      break;
    }
    case 'sequence-order': {
      const set = SEQUENCE_SETS[q.sequenceSetIdx];
      if (!state.answers[q.id]) {
        state.answers[q.id] = { order: shuffleArray(set.steps.map(step => step.id)) };
      }
      const answer = state.answers[q.id];
      const list = document.createElement('ol');
      list.className = 'sequence-list';
      list.setAttribute('aria-label', 'รายการขั้นตอนที่สามารถลากเพื่อจัดลำดับ');

      const moveItem = (fromIndex, toIndex) => {
        const nextOrder = [...answer.order];
        const [item] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, item);
        answer.order = nextOrder;
        state.answers[q.id] = answer;
        renderQuestion();
      };

      answer.order.forEach((stepId, index) => {
        const step = set.steps.find(s => s.id === stepId);
        const item = document.createElement('li');
        item.className = 'sequence-item';
        item.draggable = true;
        item.dataset.stepId = stepId;
        item.innerHTML = `<span class="drag-handle" aria-hidden="true">⋮⋮</span><span>${step.label}</span>`;

        item.addEventListener('dragstart', (event) => {
          event.dataTransfer.setData('text/plain', stepId);
          event.dataTransfer.effectAllowed = 'move';
          item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (event) => {
          event.preventDefault();
          item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (event) => {
          event.preventDefault();
          item.classList.remove('drag-over');
          const draggedId = event.dataTransfer.getData('text/plain');
          if (!draggedId || draggedId === stepId) return;
          const fromIndex = answer.order.indexOf(draggedId);
          const toIndex = answer.order.indexOf(stepId);
          if (fromIndex !== -1 && toIndex !== -1) {
            moveItem(fromIndex, toIndex);
          }
        });

        const controls = document.createElement('div');
        controls.className = 'sequence-controls';
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'sequence-control-btn';
        upBtn.textContent = '↑';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => moveItem(index, index - 1));
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'sequence-control-btn';
        downBtn.textContent = '↓';
        downBtn.disabled = index === answer.order.length - 1;
        downBtn.addEventListener('click', () => moveItem(index, index + 1));
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        item.appendChild(controls);

        list.appendChild(item);
      });

      const note = document.createElement('p');
      note.className = 'q-hint';
      note.textContent = 'เรียงจากสิ่งที่ควรทำก่อน ไปจนถึงสิ่งที่ควรทำหลังสุด';
      wrap.appendChild(note);
      wrap.appendChild(list);
      break;
    }
    case 'self-check': {
      const box = document.createElement('label');
      box.className = 'self-check-box';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state.answers[q.id];
      cb.addEventListener('change', () => { state.answers[q.id] = cb.checked; });
      box.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = 'ตอบแล้ว / ตอบได้ถูกต้อง (ยืนยันโดยตนเองหรือผู้ดูแล)';
      box.appendChild(span);
      wrap.appendChild(box);
      break;
    }
    default:
      wrap.textContent = '(ยังไม่รองรับประเภทคำถามนี้)';
  }
  return wrap;
}

/* ---------------------------------------------------------
   7) SCORING
   --------------------------------------------------------- */
function normalize(str) {
  return String(str ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function isAnswered(q) {
  const raw = state.answers[q.id];
  if (Array.isArray(raw)) return raw.some(value => normalize(value));
  if (typeof raw === 'boolean') return raw === true;
  return raw !== undefined && raw !== '' && raw !== null;
}

function scoreQuestion(q) {
  const raw = state.answers[q.id];
  if (raw === undefined || raw === '' || raw === null) return 0;

  switch (q.type) {
    case 'freq4':
      return state.answers[q.id + '__points'] ?? 0;
    case 'number':
      return Number(raw) === q.answer ? 1 : 0;
    case 'boolean': {
      const boolVal = raw === 'ถูก';
      return boolVal === q.answer ? 1 : 0;
    }
    case 'text-exact':
      return normalize(raw).includes(normalize(q.answer)) || normalize(q.answer).includes(normalize(raw)) ? 1 : 0;
    case 'text-presence':
      return normalize(raw) ? 1 : 0;
    case 'choice':
      return q.answer ? (raw === q.answer ? 1 : 0) : 0;
    case 'multi-choice-exact': {
      if (!Array.isArray(raw) || !Array.isArray(q.answer)) return 0;
      const given = raw.map(normalize).filter(Boolean).sort();
      const expected = q.answer.map(normalize).sort();
      return given.length === expected.length &&
        given.every((value, index) => value === expected[index])
        ? 1 : 0;
    }
    case 'recall-match': {
      const given = normalize(raw);
      const hits = RECALL_WORDS.filter(w => given.includes(normalize(w))).length;
      return hits === RECALL_WORDS.length ? 1 : 0;
    }
    case 'recall-three-inputs': {
      const given = Array.isArray(raw) ? normalize(raw.join(' ')) : normalize(raw);
      const answers = Array.isArray(q.answer) ? q.answer : RECALL_WORDS;
      const hits = answers.filter(word => given.includes(normalize(word))).length;
      return hits === answers.length ? 1 : 0;
    }
    case 'dynamic-day': {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = THAI_DAYS[yesterday.getDay()];
      return normalize(raw).includes(normalize(expected)) ? 1 : 0;
    }
    case 'dynamic-month': {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const expected = THAI_MONTHS[nextMonth.getMonth()];
      return normalize(raw).includes(normalize(expected)) ? 1 : 0;
    }
    case 'match-pair': {
      if (!raw || !Array.isArray(raw.pairs)) return 0;
      const set = MATCH_PAIR_SETS[q.matchSetIdx];
      return raw.pairs.length === set.left.length &&
        raw.pairs.every((rightIndex, leftIndex) => rightIndex === leftIndex)
        ? 1 : 0;
    }
    case 'sequence-order': {
      if (!raw || !Array.isArray(raw.order)) return 0;
      const set = SEQUENCE_SETS[q.sequenceSetIdx];
      return raw.order.length === set.correctOrder.length &&
        raw.order.every((stepId, index) => stepId === set.correctOrder[index])
        ? 1 : 0;
    }
    case 'self-check':
      return raw === true ? 1 : 0;
    case 'find-occluded':
      return raw === q.occludedIndex ? 1 : 0;
    default:
      return 0;
  }
}

function computeCognitiveScore() {
  let total = 0;
  const bySection = {};
  [4, 5, 6].forEach(sectionId => {
    const section = SECTIONS.find(s => s.id === sectionId);
    const pts = section.questions.reduce((sum, q) => sum + scoreQuestion(q), 0);
    bySection[sectionId] = pts;
    total += pts;
  });
  return { total, bySection };
}

const RISK_PROFILES = {
  low: {
    label: 'ความเสี่ยงต่ำ (Low Risk)',
    range: '78 - 97 คะแนน',
    status: 'การทำงานของสมองอยู่ในเกณฑ์ดีเยี่ยม',
    recommendation: 'ให้รักษาพฤติกรรมสุขภาพปัจจุบันไว้',
  },
  moderate: {
    label: 'ความเสี่ยงปานกลาง / เฝ้าระวัง (Moderate Risk)',
    range: '59 - 77 คะแนน',
    status: 'การทำงานของสมองเริ่มมีสัญญาณถดถอยเล็กน้อย แต่ยังไม่เข้าเกณฑ์อันตราย',
    recommendation: 'ควรปรับเปลี่ยนพฤติกรรมการใช้ชีวิตและเริ่มฝึกบริหารสมองอย่างจริงจัง',
  },
  high: {
    label: 'ความเสี่ยงสูง (High Risk)',
    range: '58 คะแนน หรือน้อยกว่า',
    status: 'มีความเสี่ยงสูงที่จะเกิดภาวะสมองเสื่อม (ตามเกณฑ์ Cut-off ≤ 58)',
    recommendation: 'ควรนำผลการประเมินนี้ไปปรึกษาแพทย์เฉพาะทางด้านระบบประสาทหรืออายุรกรรมผู้สูงอายุเพื่อรับการตรวจวินิจฉัยเชิงลึก',
  },
};

function riskLevel(score) {
  if (score >= 78 && score <= 97) return 'low';
  if (score >= 59) return 'moderate';
  return 'high';
}

function maxScoreForSection(sectionId) {
  const section = SECTIONS.find(s => s.id === sectionId);
  if (!section) return 0;
  if (Number.isFinite(section.maxPoints)) return section.maxPoints;
  return section.questions.length;
}

/* ---------------------------------------------------------
   8) PERSONALIZED FEEDBACK (from Section 1 answers)
   --------------------------------------------------------- */
function sleepHours() {
  const sleep = state.answers['s1q11'];
  const wake = state.answers['s1q12'];
  if (!sleep || !wake) return null;
  const [sh, sm] = sleep.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function buildFeedbackCards(level) {
  const cards = [];
  const hrs = sleepHours();

  if (hrs !== null && hrs < 7) {
    cards.push({
      title: '💤 การนอนหลับ',
      knowledge: 'การนอนหลับน้อยกว่า 7 ชั่วโมง เพิ่มความเสี่ยงสมองเสื่อมได้ถึง 44% เมื่อเทียบกับคนที่นอนเพียงพอ',
      literacy: 'แนะนำให้ใช้ฟีเจอร์ "Bedtime" หรือแอปพลิเคชันเสียงธรรมชาติ (White Noise) ในสมาร์ทโฟนเพื่อช่วยให้ผ่อนคลายก่อนนอน และตั้งโหมด "ห้ามรบกวน (Do Not Disturb)" ในเวลากลางคืน',
    });
  }
  const activity = state.answers['s1q8'];
  const exercise = state.answers['s1q15'];
  if (activity === 'ดูทีวี' || activity === 'เล่นมือถือ' ||
      exercise === 'ไม่ได้ออกกำลังกาย' || exercise === '1 วัน/สัปดาห์') {
    cards.push({
      title: '🚶 การเคลื่อนไหวร่างกาย',
      knowledge: 'การเพิ่มการขยับร่างกายหรือออกกำลังกายเพียง 1 วัน/สัปดาห์ ช่วยลดความเสี่ยงสมองเสื่อมได้ถึง 26%',
      literacy: 'แนะนำให้ใช้แอปนับก้าวเดิน (Pedometer) ที่มีอยู่ในเครื่อง หรือเปิด YouTube เพื่อค้นหาคลิป "เต้นบาสโลบ" หรือ "บริหารร่างกายสำหรับผู้สูงวัย" เพื่อทำตามที่บ้าน',
    });
  }
  const diseases = Array.isArray(state.answers['s1q16']) ? state.answers['s1q16'] : [];
  if (diseases.includes('เบาหวาน') || diseases.includes('ความดันโลหิตสูง')) {
    cards.push({
      title: '🩺 โรคประจำตัว',
      knowledge: 'โรคความดันโลหิตสูงและเบาหวานที่ไม่ควบคุม จะเร่งให้หลอดเลือดสมองเสื่อมสภาพเร็วขึ้น 2-3 เท่า',
      literacy: 'สอนการใช้แอปพลิเคชันสำหรับบันทึกค่าน้ำตาลและค่าความดัน (Health tracking apps) หรือตั้งนาฬิกาปลุกในมือถือเพื่อเตือนการรับประทานยาให้ตรงเวลา',
    });
  }
  const alcohol = state.answers['s1q14'];
  if (alcohol === 'ดื่มประจำ' || alcohol === 'ดื่มเฉพาะงานสังคม') {
    cards.push({
      title: '🍶 พฤติกรรมการดื่มแอลกอฮอล์',
      knowledge: 'การดื่มแอลกอฮอล์เพิ่มความเสี่ยงสมองเสื่อมถึง 89%',
      literacy: 'แนะนำสื่อออนไลน์หรือพอดแคสต์ (Podcast) ของกรมอนามัยที่ให้ความรู้เรื่องการเลิกเหล้า และช่องทางการแอด LINE Official Account ของสายด่วนเลิกสุราเพื่อรับคำปรึกษา',
    });
  }

  if (level === 'high') {
    cards.push({
      title: '👪 สำหรับญาติผู้ดูแล',
      knowledge: RISK_PROFILES.high.status,
      literacy: 'แนะนำให้ติดตั้งแอปติดตามตำแหน่ง เช่น การแชร์ตำแหน่งใน Google Maps ตั้งค่า "Emergency Contact" และนำผลประเมินนี้ไปปรึกษาแพทย์เฉพาะทางระบบประสาทหรืออายุรกรรมผู้สูงอายุ',
      urgent: true,
    });
  }
  if (!cards.length) {
    cards.push({
      title: '🌿 การดูแลต่อเนื่อง',
      knowledge: 'ยังไม่พบปัจจัยเสี่ยงเด่นจากข้อมูลทั่วไปที่ตอบไว้',
      literacy: 'สามารถใช้ปฏิทินหรือแอปเตือนความจำในมือถือเพื่อวางแผนนอน ออกกำลังกาย ตรวจสุขภาพ และทบทวนกิจกรรมฝึกสมองเป็นประจำ',
    });
  }
  return cards;
}

/* ---------------------------------------------------------
   9) RESULT SCREEN
   --------------------------------------------------------- */
function renderResult() {
  const { total, bySection } = computeCognitiveScore();
  const level = riskLevel(total);
  const profile = RISK_PROFILES[level];

  document.getElementById('result-score-number').textContent = total;

  const levelEl = document.getElementById('result-level');
  levelEl.className = `result-level ${level}`;
  levelEl.textContent = profile.label;
  document.getElementById('result-message').textContent =
    `ช่วงคะแนน: ${profile.range} | สถานะ: ${profile.status} | คำแนะนำ: ${profile.recommendation}`;

  const feedbackWrap = document.getElementById('result-feedback');
  feedbackWrap.innerHTML = '';
  const sectionScores = document.createElement('div');
  sectionScores.className = 'section-score-list';
  [4, 5, 6].forEach(sectionId => {
    const section = SECTIONS.find(s => s.id === sectionId);
    const item = document.createElement('div');
    item.className = 'section-score-item';
    item.innerHTML = `
      <span>ส่วนที่ ${sectionId}: ${section.title}</span>
      <strong>${bySection[sectionId] ?? 0} / ${maxScoreForSection(sectionId)} คะแนน</strong>
    `;
    sectionScores.appendChild(item);
  });
  feedbackWrap.appendChild(sectionScores);

  const feedbackCards = buildFeedbackCards(level);
  const popupBtn = document.createElement('button');
  popupBtn.type = 'button';
  popupBtn.className = 'btn-secondary btn-large';
  popupBtn.textContent = 'ดูคำแนะนำ Digital Literacy เฉพาะบุคคล';
  popupBtn.addEventListener('click', () => openFeedbackModal(feedbackCards));
  feedbackWrap.appendChild(popupBtn);

  feedbackCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'feedback-card' + (card.urgent ? ' urgent' : '');
    div.innerHTML = `<h3>${card.title}</h3><p><strong>ความรู้:</strong> ${card.knowledge}</p><p><strong>Digital Literacy:</strong> ${card.literacy}</p>`;
    feedbackWrap.appendChild(div);
  });

  if (!state.resultPopupShown) {
    state.resultPopupShown = true;
    setTimeout(() => openFeedbackModal(feedbackCards), 250);
  }

  renderMarigoldRing(document.getElementById('marigold-ring-full'), 6, 6, level);
}

function openFeedbackModal(cards) {
  const existing = document.getElementById('feedback-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'feedback-modal';
  modal.className = 'feedback-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'feedback-modal-title');
  modal.innerHTML = `
    <div class="feedback-modal-backdrop" data-close-feedback></div>
    <div class="feedback-modal-panel">
      <div class="feedback-modal-header">
        <h2 id="feedback-modal-title">คำแนะนำ Digital Literacy เฉพาะบุคคล</h2>
        <button type="button" class="feedback-modal-close" data-close-feedback aria-label="ปิดคำแนะนำ">×</button>
      </div>
      <div class="feedback-modal-body">
        ${cards.map(card => `
          <section class="feedback-modal-item${card.urgent ? ' urgent' : ''}">
            <h3>${card.title}</h3>
            <p><strong>ความรู้:</strong> ${card.knowledge}</p>
            <p><strong>Digital Literacy:</strong> ${card.literacy}</p>
          </section>
        `).join('')}
      </div>
    </div>
  `;

  modal.querySelectorAll('[data-close-feedback]').forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });
  document.addEventListener('keydown', function handleEsc(event) {
    if (event.key === 'Escape' && document.getElementById('feedback-modal')) {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  });
  document.body.appendChild(modal);
  modal.querySelector('.feedback-modal-close').focus();
}

/* ---------------------------------------------------------
   10) MARIGOLD PROGRESS RING (signature visual element)
   วาดกลีบดอกดาวเรือง 6 กลีบ = 6 ส่วนของแบบประเมิน
   --------------------------------------------------------- */
function petalPath(cx, cy, r, angleDeg, size) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  return { x, y };
}

function renderProgressRing() {
  const svg = document.getElementById('marigold-ring');
  renderMarigoldRing(svg, state.sectionIdx + (state.screen === 'result' ? 1 : 0), 6, riskLevel(computeCognitiveScore().total), 60, 60, 44);
}

function renderMarigoldRing(svg, filledCount, totalCount, level, cx = 100, cy = 100, r = 70) {
  if (!svg) return;
  svg.innerHTML = '';
  const petalR = r * 0.32;
  for (let i = 0; i < totalCount; i++) {
    const angle = (360 / totalCount) * i - 90;
    const { x, y } = petalPath(cx, cy, r * 0.62, angle, petalR);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', petalR);
    circle.setAttribute('class', 'petal' + (i < filledCount ? ' filled' : ''));
    svg.appendChild(circle);
  }
  const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  center.setAttribute('cx', cx);
  center.setAttribute('cy', cy);
  center.setAttribute('r', r * 0.22);
  center.setAttribute('fill', filledCount >= totalCount ? 'var(--forest)' : 'var(--sand-deep)');
  center.setAttribute('stroke', 'var(--forest)');
  center.setAttribute('stroke-width', '2');
  svg.appendChild(center);
}

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
render();