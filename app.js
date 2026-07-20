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
  throw new Error(
    "DemenScan requires all 6 section files to load before app.js",
  );
}

const LIKERT5_OPTIONS = [
  "เห็นด้วยอย่างยิ่ง",
  "เห็นด้วย",
  "เฉยๆ",
  "ไม่เห็นด้วย",
  "ไม่เห็นด้วยอย่างยิ่ง",
];
const LIKERT5_POINTS = [5, 4, 3, 2, 1];
const LIKERT3_OPTIONS = ["ดีมาก", "ปานกลาง", "ต้องปรับปรุง"];
const FREQ4_OPTIONS = ["ไม่เคยเลย", "นานๆ ครั้ง", "บ่อยครั้ง", "ประจำทุกวัน"];
const FREQ4_POINTS = [4, 3, 2, 1];

/* ---------------------------------------------------------
   2) STATE
   --------------------------------------------------------- */
const state = {
  screen: "welcome", // 'welcome' | 'question' | 'result'
  sectionIdx: 0, // 0..5
  questionIdx: 0, // index within section.questions
  answers: {}, // questionId -> raw value
  resultPopupShown: false,
  submissionSent: false,
  submissionStatus: "idle",
  submissionCode: "",
  submissionError: "",
};

const DRAFT_STORAGE_KEY = "demenscan.assessmentDraft.v1";

function draftSnapshot() {
  return {
    screen: state.screen,
    sectionIdx: state.sectionIdx,
    questionIdx: state.questionIdx,
    answers: state.answers,
    savedAt: new Date().toISOString(),
  };
}

function saveAssessmentDraft() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftSnapshot()));
  } catch (error) {
    // Ignore storage failures so the assessment can still continue.
  }
}

function clearAssessmentDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

function restoreAssessmentDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (
      !draft ||
      typeof draft !== "object" ||
      !draft.answers ||
      typeof draft.answers !== "object"
    ) {
      return false;
    }

    state.answers = draft.answers;
    state.screen = ["welcome", "question", "result"].includes(draft.screen)
      ? draft.screen
      : "welcome";
    state.sectionIdx = Math.min(
      Math.max(Number(draft.sectionIdx) || 0, 0),
      SECTIONS.length - 1,
    );
    state.questionIdx = Math.min(
      Math.max(Number(draft.questionIdx) || 0, 0),
      SECTIONS[state.sectionIdx].questions.length - 1,
    );
    state.resultPopupShown = state.screen === "result";
    state.submissionSent = false;
    state.submissionStatus = "idle";
    state.submissionCode = "";
    state.submissionError = "";
    return true;
  } catch (error) {
    return false;
  }
}

function scheduleAssessmentDraftSave() {
  setTimeout(saveAssessmentDraft, 0);
}

/* ---------------------------------------------------------
   3) DOM REFS & GLOBAL CONTROLS
   --------------------------------------------------------- */
const screenWelcome = document.getElementById("screen-welcome");
const screenQuestion = document.getElementById("screen-question");
const screenResult = document.getElementById("screen-result");
const progressWrap = document.getElementById("progress-wrap");
const sectionTabs = document.getElementById("section-tabs");
const questionCard = screenQuestion.querySelector(".question-card");
const answerArea = document.getElementById("q-answer-area");
const fontSmallerBtn = document.getElementById("font-smaller");
const fontLargerBtn = document.getElementById("font-larger");
const FONT_CLASSES = ["", "font-large", "font-xlarge"];
let lastRenderedQuestionKey = "";
let fontStep = 0;
const delayedRecallStarted = {};
const delayedRecallRevealed = {};
const delayedRecallTimers = {};

function resetDelayedRecallState() {
  Object.keys(delayedRecallStarted).forEach(
    (key) => delete delayedRecallStarted[key],
  );
  Object.keys(delayedRecallRevealed).forEach(
    (key) => delete delayedRecallRevealed[key],
  );
  Object.values(delayedRecallTimers).forEach((timer) => clearTimeout(timer));
  Object.keys(delayedRecallTimers).forEach(
    (key) => delete delayedRecallTimers[key],
  );
}

function resetSubmissionState() {
  state.resultPopupShown = false;
  state.submissionSent = false;
  state.submissionStatus = "idle";
  state.submissionCode = "";
  state.submissionError = "";
}

function bindGlobalEvents() {
  document.getElementById("btn-start").addEventListener("click", () => {
    state.screen = "question";
    state.sectionIdx = 0;
    state.questionIdx = 0;
    resetDelayedRecallState();
    resetSubmissionState();
    saveAssessmentDraft();
    render();
  });

  document.getElementById("btn-prev").addEventListener("click", goPrev);
  document.getElementById("btn-next").addEventListener("click", goNext);

  document.getElementById("btn-restart").addEventListener("click", () => {
    state.screen = "welcome";
    state.sectionIdx = 0;
    state.questionIdx = 0;
    state.answers = {};
    resetDelayedRecallState();
    resetSubmissionState();
    clearAssessmentDraft();
    render();
  });

  answerArea.addEventListener("input", scheduleAssessmentDraftSave);
  answerArea.addEventListener("change", scheduleAssessmentDraftSave);
  answerArea.addEventListener("click", scheduleAssessmentDraftSave);

  fontLargerBtn.addEventListener("click", () => cycleFontSize(1));
  fontSmallerBtn.addEventListener("click", () => cycleFontSize(-1));
}

function cycleFontSize(dir) {
  fontStep = Math.min(2, Math.max(0, fontStep + dir));
  document.documentElement.classList.remove("font-large", "font-xlarge");
  if (FONT_CLASSES[fontStep])
    document.documentElement.classList.add(FONT_CLASSES[fontStep]);
  updateFontSizeControls();
}

function updateFontSizeControls() {
  fontSmallerBtn.disabled = fontStep === 0;
  fontLargerBtn.disabled = fontStep === FONT_CLASSES.length - 1;
  fontSmallerBtn.setAttribute("aria-disabled", String(fontSmallerBtn.disabled));
  fontLargerBtn.setAttribute("aria-disabled", String(fontLargerBtn.disabled));
}

/* ---------------------------------------------------------
   4) Text To Speech (No backend)
   --------------------------------------------------------- */

// Backend removed: use browser Web Speech API only.
function speak(text, btnEl) {
  const cleanText = String(text ?? "").trim();
  if (!cleanText) return;
  if (!("speechSynthesis" in window)) return;

  // Cancel any ongoing speech and start new utterance.
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    // ignore
  }

  const originalLabel = btnEl ? btnEl.innerHTML : null;
  setSpeakButtonLoading(btnEl, true);

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.lang = "th-TH";
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
    btnEl.innerHTML = btnEl.classList.contains("btn-speak-small")
      ? "⏳"
      : "⏳ กำลังโหลดเสียง...";
  } else {
    btnEl.innerHTML = restoreLabel ?? btnEl.dataset.prevLabel ?? "🔊";
  }
}

document.querySelectorAll(".btn-speak[data-speak-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.speakTarget);
    if (target) speak(target.textContent, btn);
  });
});
document.getElementById("btn-speak-question").addEventListener("click", (e) => {
  const q = currentQuestion();
  if (!q) return;
  if (isDelayedRecallIntro(q)) {
    speak(
      "วิธีทำข้อนี้: กดเริ่มเพื่อดูชุดคำศัพท์เป็นเวลา 3 วินาที จากนั้นเลือกคำตอบที่เรียงย้อนหลังจากคำสุดท้ายไปคำแรก",
      e.currentTarget,
    );
    return;
  }
  if (isWaitingForDelayedRecall(q)) {
    speak(
      "จำชุดคำศัพท์นี้: " + (Array.isArray(q.words) ? q.words.join(", ") : ""),
      e.currentTarget,
    );
    return;
  }
  speak(
    q.text + (q.options ? ". ตัวเลือก: " + q.options.join(", ") : ""),
    e.currentTarget,
  );
});

/* ---------------------------------------------------------
   5) NAVIGATION
   --------------------------------------------------------- */
function currentSection() {
  return SECTIONS[state.sectionIdx];
}
function currentQuestion() {
  return currentSection().questions[state.questionIdx];
}
const SINGLE_PAGE_SECTION_IDS = [1, 2, 3];
function isSinglePageSection(section = currentSection()) {
  return SINGLE_PAGE_SECTION_IDS.includes(section.id);
}

function goNext() {
  const section = currentSection();
  if (isSinglePageSection(section)) {
    if (state.sectionIdx < SECTIONS.length - 1) {
      state.sectionIdx++;
      state.questionIdx = 0;
    } else {
      state.screen = "result";
      state.resultPopupShown = false;
    }
  } else if (state.questionIdx < section.questions.length - 1) {
    state.questionIdx++;
  } else if (state.sectionIdx < SECTIONS.length - 1) {
    state.sectionIdx++;
    state.questionIdx = 0;
  } else {
    state.screen = "result";
    state.resultPopupShown = false;
  }
  saveAssessmentDraft();
  render();
}
function goPrev() {
  if (isSinglePageSection() && state.sectionIdx > 0) {
    state.sectionIdx--;
    state.questionIdx = isSinglePageSection(SECTIONS[state.sectionIdx])
      ? 0
      : SECTIONS[state.sectionIdx].questions.length - 1;
  } else if (isSinglePageSection()) {
    state.screen = "welcome";
  } else if (state.questionIdx > 0) {
    state.questionIdx--;
  } else if (state.sectionIdx > 0) {
    state.sectionIdx--;
    state.questionIdx = isSinglePageSection(SECTIONS[state.sectionIdx])
      ? 0
      : SECTIONS[state.sectionIdx].questions.length - 1;
  } else {
    state.screen = "welcome";
  }
  saveAssessmentDraft();
  render();
}

/* ---------------------------------------------------------
   6) RENDERING
   --------------------------------------------------------- */
function render() {
  screenWelcome.hidden = state.screen !== "welcome";
  screenQuestion.hidden = state.screen !== "question";
  screenResult.hidden = state.screen !== "result";
  progressWrap.hidden = state.screen === "welcome";
  sectionTabs.hidden = state.screen !== "question";

  if (state.screen === "question") renderQuestion();
  if (state.screen === "result") renderResult();
  if (state.screen !== "welcome") renderProgressRing();
  window.scrollTo(0, 0);
}

function renderQuestion() {
  const section = currentSection();
  const q = currentQuestion();
  const usesSinglePageLayout = isSinglePageSection(section);
  questionCard.classList.toggle("single-page-card-shell", usesSinglePageLayout);
  const questionKey = `${section.id}-${q.id}-${state.questionIdx}`;
  const isSameQuestion = questionKey === lastRenderedQuestionKey;

  document.getElementById("progress-section-name").textContent =
    `ส่วนที่ ${section.id}: ${section.title}`;
  document.getElementById("progress-fraction").textContent =
    `${state.sectionIdx + 1} / ${SECTIONS.length}`;
  document.getElementById("q-index").textContent =
    `ข้อ ${state.questionIdx + 1} จาก ${section.questions.length}`;
  document.getElementById("q-text").textContent = q.text;
  if (usesSinglePageLayout) {
    document.getElementById("q-index").textContent =
      `ข้อ 1-${section.questions.length} จาก ${section.questions.length}`;
    document.getElementById("q-text").textContent =
      `ส่วนที่ ${section.id}: ${section.title}`;
  }
  document.getElementById("btn-speak-question").hidden = usesSinglePageLayout;

  const hintEl = document.getElementById("q-hint");
  if (q.hint) {
    hintEl.hidden = false;
    hintEl.textContent = q.hint;
  } else {
    hintEl.hidden = true;
  }
  if (usesSinglePageLayout) hintEl.hidden = true;

  const area = document.getElementById("q-answer-area");
  area.classList.toggle("single-page-list", usesSinglePageLayout);
  area.classList.toggle("answers-static", isSameQuestion);
  area.innerHTML = "";
  let recallNeedsStart = false;
  let waitingForRecall = false;
  if (usesSinglePageLayout) {
    area.appendChild(buildSinglePageQuestionList(section));
  } else {
    if (q.image) area.appendChild(buildQuestionImage(q.image));
    recallNeedsStart = isDelayedRecallIntro(q);
    waitingForRecall = isWaitingForDelayedRecall(q);
    if (recallNeedsStart) {
      area.appendChild(buildDelayedRecallStartPrompt(q));
    } else if (waitingForRecall) {
      area.appendChild(buildDelayedRecallPrompt(q));
      startDelayedRecallTimer(q);
    } else {
      area.appendChild(buildAnswerControl(q));
    }
  }
  animateQuestionCard(questionKey);

  document.getElementById("btn-prev").disabled = false;
  const isLastQuestion =
    state.sectionIdx === SECTIONS.length - 1 &&
    state.questionIdx === section.questions.length - 1;
  const nextBtn = document.getElementById("btn-next");
  nextBtn.setAttribute("aria-label", isLastQuestion ? "ดูผลลัพธ์" : "ถัดไป");
  nextBtn.innerHTML = isLastQuestion
    ? '<span class="btn-label">ดูผลลัพธ์</span><span class="btn-icon" aria-hidden="true">✓</span>'
    : '<span class="btn-label">ถัดไป</span><span class="btn-icon" aria-hidden="true">→</span>';
  nextBtn.disabled = recallNeedsStart || waitingForRecall;

  document.getElementById("skip-warning").hidden =
    usesSinglePageLayout ||
    recallNeedsStart ||
    waitingForRecall ||
    isAnswered(q);
  renderSectionTabs();
}

function buildSinglePageQuestionList(section) {
  const list = document.createElement("div");
  list.className = "single-page-question-list";

  section.questions.forEach((question, index) => {
    const item = document.createElement("section");
    item.className = "single-page-question-item";
    addStagger(item, index);

    const header = document.createElement("div");
    header.className = "single-page-question-header";

    const number = document.createElement("span");
    number.className = "single-page-question-number";
    number.textContent = `ข้อ ${index + 1}`;
    header.appendChild(number);

    const title = document.createElement("h3");
    title.textContent = question.text;
    header.appendChild(title);

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.className = "btn-speak btn-speak-small single-page-speak";
    speakBtn.setAttribute("aria-label", `ฟังข้อ ${index + 1}`);
    speakBtn.innerHTML = "🔊";
    speakBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const optionText =
        Array.isArray(question.options) && question.options.length
          ? `. ตัวเลือก: ${question.options.join(", ")}`
          : "";
      speak(`${question.text}${optionText}`, event.currentTarget);
    });
    header.appendChild(speakBtn);

    item.appendChild(header);

    if (question.hint) {
      const hint = document.createElement("p");
      hint.className = "q-hint";
      hint.textContent = question.hint;
      item.appendChild(hint);
    }

    if (question.image) item.appendChild(buildQuestionImage(question.image));
    item.appendChild(buildAnswerControl(question));
    list.appendChild(item);
  });

  return list;
}

function isDelayedRecallQuestion(q) {
  return q.type === "delayed-recall-choice";
}

function isDelayedRecallIntro(q) {
  return (
    isDelayedRecallQuestion(q) &&
    !delayedRecallStarted[q.id] &&
    !delayedRecallRevealed[q.id]
  );
}

function isWaitingForDelayedRecall(q) {
  return (
    isDelayedRecallQuestion(q) &&
    delayedRecallStarted[q.id] &&
    !delayedRecallRevealed[q.id]
  );
}

function startDelayedRecall(q) {
  delayedRecallStarted[q.id] = true;
  delayedRecallRevealed[q.id] = false;
  if (delayedRecallTimers[q.id]) {
    clearTimeout(delayedRecallTimers[q.id]);
    delete delayedRecallTimers[q.id];
  }
  lastRenderedQuestionKey = "";
  renderQuestion();
}

function startDelayedRecallTimer(q) {
  if (delayedRecallTimers[q.id]) return;
  delayedRecallTimers[q.id] = setTimeout(() => {
    delayedRecallRevealed[q.id] = true;
    delete delayedRecallTimers[q.id];
    const current = currentQuestion();
    if (state.screen === "question" && current && current.id === q.id) {
      lastRenderedQuestionKey = "";
      renderQuestion();
    }
  }, q.delayMs || 3000);
}

function buildDelayedRecallStartPrompt(q) {
  const card = document.createElement("div");
  card.className = "delayed-recall-card delayed-recall-ready-card";
  addStagger(card, 0);

  const label = document.createElement("p");
  label.className = "delayed-recall-label";
  label.textContent = "วิธีทำข้อนี้";
  card.appendChild(label);

  const title = document.createElement("h3");
  title.className = "delayed-recall-title";
  title.textContent = "จำคำศัพท์ แล้วเลือกคำตอบที่เรียงย้อนหลังให้ถูกต้อง";
  card.appendChild(title);

  const instruction = document.createElement("p");
  instruction.className = "delayed-recall-instruction";
  instruction.textContent =
    "เมื่อกดเริ่ม ระบบจะแสดงชุดคำศัพท์เป็นเวลา 3 วินาที แล้วซ่อนคำศัพท์ก่อนแสดงตัวเลือก ให้เลือกคำตอบที่เรียงจากคำสุดท้ายย้อนกลับไปคำแรก";
  card.appendChild(instruction);

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "btn-primary delayed-recall-start-btn";
  startBtn.textContent = "เริ่ม";
  startBtn.addEventListener("click", () => startDelayedRecall(q));
  card.appendChild(startBtn);

  return card;
}

function buildDelayedRecallPrompt(q) {
  const card = document.createElement("div");
  card.className = "delayed-recall-card";
  addStagger(card, 0);

  const label = document.createElement("p");
  label.className = "delayed-recall-label";
  label.textContent = "จำชุดคำศัพท์นี้";
  card.appendChild(label);

  const words = document.createElement("div");
  words.className = "delayed-recall-words";
  words.textContent = Array.isArray(q.words) ? q.words.join(" - ") : "";
  card.appendChild(words);

  const countdown = document.createElement("p");
  countdown.className = "delayed-recall-countdown";
  countdown.textContent = "ระบบจะแสดงคำตอบให้เลือกหลังจาก 3 วินาที";
  card.appendChild(countdown);

  return card;
}

function buildQuestionImage(image) {
  const figure = document.createElement("figure");
  figure.className = "question-image-slot";
  const imageList = Array.isArray(image.images) ? image.images : null;

  if (imageList && imageList.length) {
    const gallery = document.createElement("div");
    gallery.className = "question-image-gallery";
    imageList.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "question-image-thumb";
      button.setAttribute("aria-label", `ซูมดูรูปภาพที่ ${index + 1}`);
      addStagger(button, index);
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || image.alt || "";
      img.loading = "lazy";
      button.appendChild(img);
      const zoom = document.createElement("span");
      zoom.className = "question-image-zoom-label";
      zoom.textContent = "ซูม";
      button.appendChild(zoom);
      button.addEventListener("click", () =>
        openImageZoom(item.src, item.alt || image.alt || ""),
      );
      gallery.appendChild(button);
    });
    figure.appendChild(gallery);
  } else if (image.src) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-image-single";
    button.setAttribute("aria-label", "ซูมดูรูปภาพ");
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = image.alt || "";
    img.loading = "lazy";
    button.appendChild(img);
    const zoom = document.createElement("span");
    zoom.className = "question-image-zoom-label";
    zoom.textContent = "ซูม";
    button.appendChild(zoom);
    button.addEventListener("click", () =>
      openImageZoom(image.src, image.alt || ""),
    );
    figure.appendChild(button);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "question-image-placeholder";
    placeholder.innerHTML = `
      <span aria-hidden="true">+</span>
      <strong>${image.placeholder || "วางรูปภาพที่นี่"}</strong>
      <small>ใส่ path รูปใน section5.js ที่ image.src</small>
    `;
    figure.appendChild(placeholder);
  }

  if (image.caption) {
    const caption = document.createElement("figcaption");
    caption.textContent = image.caption;
    figure.appendChild(caption);
  }

  return figure;
}

function openImageZoom(src, alt) {
  const existing = document.getElementById("image-zoom-modal");
  if (existing) existing.remove();
  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const modal = document.createElement("div");
  modal.id = "image-zoom-modal";
  modal.className = "image-zoom-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "ดูรูปภาพขนาดใหญ่");

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "image-zoom-backdrop";
  backdrop.setAttribute("aria-label", "ปิดรูปภาพขนาดใหญ่");
  modal.appendChild(backdrop);

  const panel = document.createElement("div");
  panel.className = "image-zoom-panel";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "image-zoom-close";
  close.setAttribute("aria-label", "ปิดรูปภาพขนาดใหญ่");
  close.textContent = "×";
  panel.appendChild(close);

  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  panel.appendChild(img);
  modal.appendChild(panel);

  const closeModal = () => {
    document.body.style.overflow = previousBodyOverflow;
    modal.remove();
  };
  backdrop.addEventListener("click", closeModal);
  close.addEventListener("click", closeModal);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  document.body.appendChild(modal);
  close.focus();
}

function animateQuestionCard(questionKey) {
  if (!questionCard || questionKey === lastRenderedQuestionKey) return;
  lastRenderedQuestionKey = questionKey;
  questionCard.classList.remove("question-card-enter");
  void questionCard.offsetWidth;
  questionCard.classList.add("question-card-enter");
}

function addStagger(el, index) {
  el.style.setProperty("--stagger-index", index);
  return el;
}

function renderSectionTabs() {
  sectionTabs.innerHTML = "";

  SECTIONS.forEach((section, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "section-tab";
    tab.setAttribute(
      "aria-label",
      `ไปยังส่วนที่ ${section.id}: ${section.title}`,
    );

    if (index < state.sectionIdx) tab.classList.add("completed");
    if (index === state.sectionIdx) {
      tab.classList.add("active");
      tab.setAttribute("aria-current", "step");
    }

    tab.innerHTML = `
      <span class="section-tab-number" aria-hidden="true">${section.id}</span>
      <span class="section-tab-text">
        <span class="section-tab-kicker">ส่วนที่ ${section.id}</span>
        <span class="section-tab-title">${section.title}</span>
      </span>
    `;

    tab.addEventListener("click", () => {
      state.screen = "question";
      state.sectionIdx = index;
      state.questionIdx = 0;
      saveAssessmentDraft();
      render();
    });

    sectionTabs.appendChild(tab);
  });

  const activeTab = sectionTabs.querySelector(".section-tab.active");
  if (activeTab) {
    requestAnimationFrame(() => {
      activeTab.scrollIntoView({ inline: "center", block: "nearest" });
    });
  }
}

function buildAnswerControl(q) {
  const wrap = document.createElement("div");
  wrap.className = `answer-control answer-${q.type}`;

  const makeChoiceButtons = (options, pointsMap) => {
    options.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      addStagger(btn, i);
      if (state.answers[q.id] === label) btn.classList.add("selected");
      btn.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      btn.addEventListener("click", () => {
        state.answers[q.id] = label;
        if (pointsMap) state.answers[q.id + "__points"] = pointsMap[i];
        if (isSinglePageSection()) {
          wrap
            .querySelectorAll(".choice-btn")
            .forEach((choice) => choice.classList.remove("selected"));
          btn.classList.add("selected");
          return;
        }
        renderQuestion();
      });
      wrap.appendChild(btn);
    });
  };

  const makeMultiChoiceButtons = (options) => {
    const selected = Array.isArray(state.answers[q.id])
      ? state.answers[q.id]
      : [];
    const grid = document.createElement("div");
    grid.className = "multi-choice-grid";

    options.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn multi-choice-btn";
      addStagger(btn, grid.children.length);
      if (selected.includes(label)) btn.classList.add("selected");
      btn.innerHTML = `<span class="dot"></span><span>${label}</span>`;
      btn.addEventListener("click", () => {
        const current = Array.isArray(state.answers[q.id])
          ? state.answers[q.id]
          : [];
        if (label === "ไม่มี") {
          state.answers[q.id] = current.includes(label) ? [] : [label];
        } else {
          const withoutNone = current.filter((item) => item !== "ไม่มี");
          state.answers[q.id] = withoutNone.includes(label)
            ? withoutNone.filter((item) => item !== label)
            : [...withoutNone, label];
        }
        if (isSinglePageSection()) {
          const nextSelected = Array.isArray(state.answers[q.id])
            ? state.answers[q.id]
            : [];
          wrap.querySelectorAll(".multi-choice-btn").forEach((choice) => {
            choice.classList.toggle(
              "selected",
              nextSelected.includes(choice.textContent.trim()),
            );
          });
          return;
        }
        renderQuestion();
      });
      grid.appendChild(btn);
    });

    wrap.appendChild(grid);
  };

  const makeThreeTextInputs = () => {
    const values = Array.isArray(state.answers[q.id])
      ? state.answers[q.id]
      : ["", "", ""];
    const grid = document.createElement("div");
    grid.className = "multi-input-grid";

    [0, 1, 2].forEach((index) => {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      addStagger(input, index);
      input.placeholder = `คำที่ ${index + 1}`;
      input.value = values[index] ?? "";
      input.addEventListener("input", () => {
        const next = Array.isArray(state.answers[q.id])
          ? [...state.answers[q.id]]
          : ["", "", ""];
        next[index] = input.value;
        state.answers[q.id] = next;
      });
      grid.appendChild(input);
    });

    wrap.appendChild(grid);
  };

  switch (q.type) {
    case "choice":
    case "delayed-recall-choice":
      makeChoiceButtons(q.options);
      break;
    case "multi-choice-exact":
      makeMultiChoiceButtons(q.options);
      break;
    case "multi-choice-info":
      makeMultiChoiceButtons(q.options);
      break;
    case "likert5":
      makeChoiceButtons(LIKERT5_OPTIONS, LIKERT5_POINTS);
      break;
    case "likert3":
      makeChoiceButtons(LIKERT3_OPTIONS);
      break;
    case "freq4":
      makeChoiceButtons(FREQ4_OPTIONS, FREQ4_POINTS);
      break;
    case "boolean":
      makeChoiceButtons(["ถูก", "ผิด"]);
      break;
    case "number":
    case "number-info": {
      const input = document.createElement("input");
      input.type = "number";
      input.className = "number-input";
      addStagger(input, 0);
      input.value = state.answers[q.id] ?? "";
      input.addEventListener("input", () => {
        state.answers[q.id] = input.value;
      });
      wrap.appendChild(input);
      break;
    }
    case "time-info": {
      const input = document.createElement("input");
      input.type = "time";
      input.className = "text-input";
      addStagger(input, 0);
      input.value = state.answers[q.id] ?? "";
      input.addEventListener("input", () => {
        state.answers[q.id] = input.value;
      });
      wrap.appendChild(input);
      break;
    }
    case "text-exact":
    case "text-presence":
    case "recall-match": {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      addStagger(input, 0);
      input.value = state.answers[q.id] ?? "";
      input.addEventListener("input", () => {
        state.answers[q.id] = input.value;
      });
      wrap.appendChild(input);
      break;
    }
    case "recall-three-inputs":
      makeThreeTextInputs();
      break;
    case "dynamic-day": {
      makeChoiceButtons(THAI_DAYS.map((day) => `วัน${day}`));
      break;
    }
    case "dynamic-month": {
      makeChoiceButtons(THAI_MONTHS);
      break;
    }
    case "find-occluded": {
      const grid = document.createElement("div");
      grid.className = "image-choice-grid";
      q.icons.forEach((icon, i) => {
        const box = document.createElement("button");
        box.type = "button";
        box.className = "image-choice-box";
        addStagger(box, i);
        if (state.answers[q.id] === i) box.classList.add("selected");
        box.setAttribute("aria-label", `ตัวเลือกภาพที่ ${i + 1}`);
        box.innerHTML = `<span class="image-emoji">${icon.emoji}</span>`;
        if (i === q.occludedIndex) {
          const patch = document.createElement("span");
          patch.className = "occlusion-patch";
          patch.setAttribute("aria-hidden", "true");
          if (q.occlusion) {
            ["top", "right", "bottom", "left", "width", "height"].forEach(
              (key) => {
                if (q.occlusion[key]) patch.style[key] = q.occlusion[key];
              },
            );
            if (q.occlusion.rotate)
              patch.style.setProperty("--patch-rotate", q.occlusion.rotate);
          }
          box.appendChild(patch);
        }
        box.addEventListener("click", () => {
          state.answers[q.id] = i;
          renderQuestion();
        });
        grid.appendChild(box);
      });
      wrap.appendChild(grid);
      break;
    }
    case "match-pair": {
      const set = MATCH_PAIR_SETS[q.matchSetIdx];
      if (!state.answers[q.id]) {
        state.answers[q.id] = {
          order: shuffleArray(set.right.map((item, index) => index)),
          pairs: set.left.map(() => null),
          selectedLeft: null,
        };
      }
      const answer = state.answers[q.id];
      const leftCol = document.createElement("div");
      const rightCol = document.createElement("div");
      leftCol.className = "match-pair-column";
      rightCol.className = "match-pair-column";

      const instructions = document.createElement("p");
      instructions.className = "q-hint";
      instructions.textContent =
        "ลากหรือแตะขวาแล้ววางไว้ที่ซ้ายเพื่อจับคู่ภาพที่เกี่ยวข้องกัน";
      wrap.appendChild(instructions);

      set.left.forEach((item, leftIndex) => {
        const leftCard = document.createElement("button");
        leftCard.type = "button";
        leftCard.className = "match-pair-item";
        addStagger(leftCard, leftIndex);
        if (answer.selectedLeft === leftIndex)
          leftCard.classList.add("selected");
        leftCard.setAttribute("aria-label", `จับคู่อย่างกับ ${item.label}`);
        leftCard.innerHTML = `<span class="image-emoji">${item.emoji}</span><span>${item.label}</span>`;
        leftCard.addEventListener("click", () => {
          answer.selectedLeft =
            answer.selectedLeft === leftIndex ? null : leftIndex;
          state.answers[q.id] = answer;
          renderQuestion();
        });
        leftCard.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        leftCard.addEventListener("drop", (event) => {
          event.preventDefault();
          const rightIndex = Number(event.dataTransfer.getData("text/plain"));
          if (Number.isFinite(rightIndex)) {
            answer.pairs[leftIndex] = rightIndex;
            answer.selectedLeft = null;
            state.answers[q.id] = answer;
            renderQuestion();
          }
        });
        if (answer.pairs[leftIndex] !== null) {
          const paired = set.right[answer.pairs[leftIndex]];
          const pairedLabel = document.createElement("div");
          pairedLabel.className = "match-pair-label";
          pairedLabel.textContent = `จับคู่กับ ${paired.label}`;
          leftCard.appendChild(pairedLabel);
        }
        leftCol.appendChild(leftCard);
      });

      answer.order.forEach((rightIndex) => {
        const item = set.right[rightIndex];
        const rightCard = document.createElement("button");
        rightCard.type = "button";
        rightCard.className = "match-pair-item match-pair-right";
        addStagger(rightCard, rightCol.children.length + 2);
        rightCard.draggable = true;
        const matchedLeft = answer.pairs.findIndex(
          (pair) => pair === rightIndex,
        );
        if (matchedLeft !== -1) rightCard.classList.add("matched");
        rightCard.setAttribute(
          "aria-label",
          `${item.label} ${matchedLeft !== -1 ? "จับคู่แล้ว" : "ยังไม่จับคู่"}`,
        );
        rightCard.innerHTML = `<span class="image-emoji">${item.emoji}</span><span>${item.label}</span>`;
        rightCard.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", String(rightIndex));
          event.dataTransfer.effectAllowed = "move";
        });
        rightCard.addEventListener("click", () => {
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

      const container = document.createElement("div");
      container.className = "match-pair-wrap";
      container.appendChild(leftCol);
      container.appendChild(rightCol);
      wrap.appendChild(container);
      break;
    }
    case "sequence-order": {
      const set = SEQUENCE_SETS[q.sequenceSetIdx];
      if (!state.answers[q.id]) {
        state.answers[q.id] = {
          order: shuffleArray(set.steps.map((step) => step.id)),
        };
      }
      const answer = state.answers[q.id];
      const list = document.createElement("ol");
      list.className = "sequence-list";
      list.setAttribute("aria-label", "รายการขั้นตอนที่สามารถลากเพื่อจัดลำดับ");

      const moveItem = (fromIndex, toIndex) => {
        const nextOrder = [...answer.order];
        const [item] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, item);
        answer.order = nextOrder;
        state.answers[q.id] = answer;
        renderQuestion();
      };

      answer.order.forEach((stepId, index) => {
        const step = set.steps.find((s) => s.id === stepId);
        const item = document.createElement("li");
        item.className = "sequence-item";
        addStagger(item, index);
        item.draggable = true;
        item.dataset.stepId = stepId;
        item.innerHTML = `<span class="drag-handle" aria-hidden="true">⋮⋮</span><span>${step.label}</span>`;

        item.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", stepId);
          event.dataTransfer.effectAllowed = "move";
          item.classList.add("dragging");
        });

        item.addEventListener("dragend", () => {
          item.classList.remove("dragging");
        });

        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          item.classList.add("drag-over");
        });

        item.addEventListener("dragleave", () => {
          item.classList.remove("drag-over");
        });

        item.addEventListener("drop", (event) => {
          event.preventDefault();
          item.classList.remove("drag-over");
          const draggedId = event.dataTransfer.getData("text/plain");
          if (!draggedId || draggedId === stepId) return;
          const fromIndex = answer.order.indexOf(draggedId);
          const toIndex = answer.order.indexOf(stepId);
          if (fromIndex !== -1 && toIndex !== -1) {
            moveItem(fromIndex, toIndex);
          }
        });

        const controls = document.createElement("div");
        controls.className = "sequence-controls";
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "sequence-control-btn";
        upBtn.textContent = "↑";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", () => moveItem(index, index - 1));
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "sequence-control-btn";
        downBtn.textContent = "↓";
        downBtn.disabled = index === answer.order.length - 1;
        downBtn.addEventListener("click", () => moveItem(index, index + 1));
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        item.appendChild(controls);

        list.appendChild(item);
      });

      const note = document.createElement("p");
      note.className = "q-hint";
      note.textContent = "เรียงจากสิ่งที่ควรทำก่อน ไปจนถึงสิ่งที่ควรทำหลังสุด";
      wrap.appendChild(note);
      wrap.appendChild(list);
      break;
    }
    case "self-check": {
      const box = document.createElement("label");
      box.className = "self-check-box";
      addStagger(box, 0);
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state.answers[q.id];
      cb.addEventListener("change", () => {
        state.answers[q.id] = cb.checked;
      });
      box.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = "ตอบแล้ว / ตอบได้ถูกต้อง (ยืนยันโดยตนเองหรือผู้ดูแล)";
      box.appendChild(span);
      wrap.appendChild(box);
      break;
    }
    default:
      wrap.textContent = "(ยังไม่รองรับประเภทคำถามนี้)";
  }
  return wrap;
}

/* ---------------------------------------------------------
   7) SCORING & RISK
   --------------------------------------------------------- */
function normalize(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isAnswered(q) {
  const raw = state.answers[q.id];
  if (Array.isArray(raw)) return raw.some((value) => normalize(value));
  if (typeof raw === "boolean") return raw === true;
  return raw !== undefined && raw !== "" && raw !== null;
}

function scoreQuestion(q) {
  const raw = state.answers[q.id];
  if (raw === undefined || raw === "" || raw === null) return 0;

  switch (q.type) {
    case "freq4":
      return state.answers[q.id + "__points"] ?? 0;
    case "number":
      return Number(raw) === q.answer ? 1 : 0;
    case "boolean": {
      const boolVal = raw === "ถูก";
      return boolVal === q.answer ? 1 : 0;
    }
    case "text-exact":
      return normalize(raw).includes(normalize(q.answer)) ||
        normalize(q.answer).includes(normalize(raw))
        ? 1
        : 0;
    case "text-presence":
      return normalize(raw) ? 1 : 0;
    case "choice":
    case "delayed-recall-choice":
      return q.answer ? (raw === q.answer ? 1 : 0) : 0;
    case "multi-choice-exact": {
      if (!Array.isArray(raw) || !Array.isArray(q.answer)) return 0;
      const given = raw.map(normalize).filter(Boolean).sort();
      const expected = q.answer.map(normalize).sort();
      return given.length === expected.length &&
        given.every((value, index) => value === expected[index])
        ? 1
        : 0;
    }
    case "recall-match": {
      const given = normalize(raw);
      const hits = RECALL_WORDS.filter((w) =>
        given.includes(normalize(w)),
      ).length;
      return hits === RECALL_WORDS.length ? 1 : 0;
    }
    case "recall-three-inputs": {
      const given = Array.isArray(raw)
        ? normalize(raw.join(" "))
        : normalize(raw);
      const answers = Array.isArray(q.answer) ? q.answer : RECALL_WORDS;
      const hits = answers.filter((word) =>
        given.includes(normalize(word)),
      ).length;
      return hits === answers.length ? 1 : 0;
    }
    case "dynamic-day": {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = THAI_DAYS[yesterday.getDay()];
      return normalize(raw).includes(normalize(expected)) ? 1 : 0;
    }
    case "dynamic-month": {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const expected = THAI_MONTHS[nextMonth.getMonth()];
      return normalize(raw).includes(normalize(expected)) ? 1 : 0;
    }
    case "match-pair": {
      if (!raw || !Array.isArray(raw.pairs)) return 0;
      const set = MATCH_PAIR_SETS[q.matchSetIdx];
      return raw.pairs.length === set.left.length &&
        raw.pairs.every((rightIndex, leftIndex) => rightIndex === leftIndex)
        ? 1
        : 0;
    }
    case "sequence-order": {
      if (!raw || !Array.isArray(raw.order)) return 0;
      const set = SEQUENCE_SETS[q.sequenceSetIdx];
      return raw.order.length === set.correctOrder.length &&
        raw.order.every((stepId, index) => stepId === set.correctOrder[index])
        ? 1
        : 0;
    }
    case "self-check":
      return raw === true ? 1 : 0;
    case "find-occluded":
      return raw === q.occludedIndex ? 1 : 0;
    default:
      return 0;
  }
}

function computeCognitiveScore() {
  let total = 0;
  const bySection = {};
  [4, 5, 6].forEach((sectionId) => {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const pts = section.questions.reduce((sum, q) => sum + scoreQuestion(q), 0);
    bySection[sectionId] = pts;
    total += pts;
  });
  return { total, bySection };
}

const RISK_PROFILES = {
  low: {
    label: "ความเสี่ยงต่ำ (Low Risk)",
    range: "78 - 97 คะแนน",
    status: "การทำงานของสมองอยู่ในเกณฑ์ดีเยี่ยม",
    recommendation: "ให้รักษาพฤติกรรมสุขภาพปัจจุบันไว้",
  },
  moderate: {
    label: "ความเสี่ยงปานกลาง / เฝ้าระวัง (Moderate Risk)",
    range: "59 - 77 คะแนน",
    status:
      "การทำงานของสมองเริ่มมีสัญญาณถดถอยเล็กน้อย แต่ยังไม่เข้าเกณฑ์อันตราย",
    recommendation:
      "ควรปรับเปลี่ยนพฤติกรรมการใช้ชีวิตและเริ่มฝึกบริหารสมองอย่างจริงจัง",
  },
  high: {
    label: "ความเสี่ยงสูง (High Risk)",
    range: "58 คะแนน หรือน้อยกว่า",
    status: "มีความเสี่ยงสูงที่จะเกิดภาวะสมองเสื่อม (ตามเกณฑ์ Cut-off ≤ 58)",
    recommendation:
      "ควรนำผลการประเมินนี้ไปปรึกษาแพทย์เฉพาะทางด้านระบบประสาทหรืออายุรกรรมผู้สูงอายุเพื่อรับการตรวจวินิจฉัยเชิงลึก",
  },
};

function riskLevel(score) {
  if (score >= 78 && score <= 97) return "low";
  if (score >= 59) return "moderate";
  return "high";
}

function maxScoreForSection(sectionId) {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return 0;
  if (Number.isFinite(section.maxPoints)) return section.maxPoints;
  return section.questions.length;
}

/* ---------------------------------------------------------
   8) SUBMISSION
   --------------------------------------------------------- */
function buildAnswerRows() {
  return SECTIONS.flatMap((section) =>
    section.questions.map((q) => ({
      section_id: section.id,
      question_id: q.id,
      question_text: q.text,
      answer_value: state.answers[q.id] ?? null,
      score: scoreQuestion(q),
    })),
  );
}

function buildAssessmentPayload(feedbackCards) {
  const { total, bySection } = computeCognitiveScore();
  return {
    total_score: total,
    max_score: 97,
    risk_level: riskLevel(total),
    section_scores: {
      4: bySection[4] ?? 0,
      5: bySection[5] ?? 0,
      6: bySection[6] ?? 0,
    },
    profile: {
      gender: state.answers.s1q1 ?? null,
      age: state.answers.s1q2 ?? null,
      education: state.answers.s1q6 ?? null,
      marital_status: state.answers.s1q7 ?? null,
      monthly_income: state.answers.s1q9 ?? null,
      family_dementia_history: state.answers.s1q10 ?? null,
      sleep_time: state.answers.s1q11 ?? null,
      wake_time: state.answers.s1q12 ?? null,
      smoking: state.answers.s1q13 ?? null,
      alcohol: state.answers.s1q14 ?? null,
      exercise_frequency: state.answers.s1q15 ?? null,
      diseases: Array.isArray(state.answers.s1q16) ? state.answers.s1q16 : [],
    },
    answers: buildAnswerRows(),
    feedback: feedbackCards,
  };
}

function updateSubmissionStatus() {
  const statusEl = document.getElementById("submission-status");
  if (!statusEl) return;

  statusEl.hidden = false;
  statusEl.className = `submission-status ${state.submissionStatus}`;

  if (state.submissionStatus === "saving") {
    statusEl.textContent = "กำลังบันทึกผลประเมิน...";
  } else if (state.submissionStatus === "saved") {
    statusEl.textContent = `บันทึกผลประเมินแล้ว รหัสอ้างอิง: ${state.submissionCode}`;
  } else if (state.submissionStatus === "error") {
    statusEl.textContent = `บันทึกผลไม่สำเร็จ: ${state.submissionError || "กรุณาตรวจสอบการเชื่อมต่อระบบ"}`;
    statusEl.appendChild(document.createTextNode(" "));
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "submission-retry-btn";
    retryBtn.textContent = "ลองบันทึกอีกครั้ง";
    retryBtn.addEventListener("click", () => {
      const feedbackCards = buildFeedbackCards(
        riskLevel(computeCognitiveScore().total),
      );
      submitAssessmentResult(feedbackCards);
    });
    statusEl.appendChild(retryBtn);
  } else {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }
}

async function submitAssessmentResult(feedbackCards) {
  if (state.submissionSent || state.submissionStatus === "saving") return;

  state.submissionSent = true;
  state.submissionStatus = "saving";
  state.submissionError = "";
  updateSubmissionStatus();

  try {
    const response = await fetch("api/assessment-submit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAssessmentPayload(feedbackCards)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "server_error");
    }
    state.submissionStatus = "saved";
    state.submissionCode = data.submission_code || "";
    clearAssessmentDraft();
  } catch (error) {
    state.submissionStatus = "error";
    state.submissionError = error.message;
    state.submissionSent = false;
    saveAssessmentDraft();
  }

  updateSubmissionStatus();
}

/* ---------------------------------------------------------
   9) PERSONALIZED FEEDBACK (from Section 1 answers)
   --------------------------------------------------------- */
function sleepHours() {
  const sleep = state.answers["s1q11"];
  const wake = state.answers["s1q12"];
  if (!sleep || !wake) return null;
  const [sh, sm] = sleep.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  if ([sh, sm, wh, wm].some((value) => Number.isNaN(value))) return null;
  const sleepMins = sh * 60 + sm;
  const wakeMins = wh * 60 + wm;
  const mins = (wakeMins - sleepMins + 24 * 60) % (24 * 60);
  return mins / 60;
}

function buildFeedbackCards(level) {
  const cards = [];
  const hrs = sleepHours();

  if (hrs !== null && hrs < 7) {
    cards.push({
      title: "💤 การนอนหลับ",
      knowledge:
        "การนอนหลับน้อยกว่า 7 ชั่วโมง เพิ่มความเสี่ยงสมองเสื่อมได้ถึง 44% เมื่อเทียบกับคนที่นอนเพียงพอ",
      literacy:
        'แนะนำให้ใช้ฟีเจอร์ "Bedtime" หรือแอปพลิเคชันเสียงธรรมชาติ (White Noise) ในสมาร์ทโฟนเพื่อช่วยให้ผ่อนคลายก่อนนอน และสอนวิธีตั้งโหมด "ห้ามรบกวน (Do Not Disturb)" ในเวลากลางคืน เพื่อไม่ให้เสียงแจ้งเตือนมือถือรบกวนการนอน',
    });
  }
  const activity = state.answers["s1q8"];
  const exercise = state.answers["s1q15"];
  if (
    activity === "ดูทีวี" ||
    activity === "เล่นมือถือ" ||
    exercise === "ไม่ได้ออกกำลังกาย" ||
    exercise === "1 วัน/สัปดาห์"
  ) {
    cards.push({
      title: "🚶 การเคลื่อนไหวร่างกาย",
      knowledge:
        "การเพิ่มการขยับร่างกายหรือออกกำลังกายเพียง 1 วัน/สัปดาห์ ช่วยลดความเสี่ยงสมองเสื่อมได้ถึง 26%",
      literacy:
        'แนะนำให้ใช้แอปนับก้าวเดิน (Pedometer) ที่มีอยู่ในเครื่อง หรือเปิด YouTube เพื่อค้นหาคลิป "เต้นบาสโลบ" หรือ "บริหารร่างกายสำหรับผู้สูงวัย" เพื่อทำตามที่บ้าน',
    });
  }
  const diseases = Array.isArray(state.answers["s1q16"])
    ? state.answers["s1q16"]
    : [];
  if (diseases.includes("เบาหวาน") || diseases.includes("ความดันโลหิตสูง")) {
    cards.push({
      title: "🩺 โรคประจำตัว",
      knowledge:
        "โรคความดันโลหิตสูงและเบาหวานที่ไม่ควบคุม จะเร่งให้หลอดเลือดสมองเสื่อมสภาพเร็วขึ้น 2-3 เท่า",
      literacy:
        "สอนการใช้แอปพลิเคชันสำหรับบันทึกค่าน้ำตาลและค่าความดัน (Health tracking apps) หรือตั้งนาฬิกาปลุกในมือถือเพื่อเตือนการรับประทานยาให้ตรงเวลา",
    });
  }
  const alcohol = state.answers["s1q14"];
  if (alcohol === "ดื่มประจำ" || alcohol === "ดื่มเฉพาะงานสังคม") {
    cards.push({
      title: "🍶 พฤติกรรมการดื่มแอลกอฮอล์",
      knowledge: "การดื่มแอลกอฮอล์เพิ่มความเสี่ยงสมองเสื่อมถึง 89%",
      literacy:
        "แนะนำสื่อออนไลน์หรือพอดแคสต์ (Podcast) ของกรมอนามัยที่ให้ความรู้เรื่องการเลิกเหล้า และช่องทางการแอด LINE Official Account ของสายด่วนเลิกสุราเพื่อรับคำปรึกษา",
    });
  }

  if (level === "high") {
    cards.push({
      title: "👪 สำหรับญาติผู้ดูแล",
      knowledge: RISK_PROFILES.high.status,
      literacy:
        'แนะนำให้ติดตั้งแอปติดตามตำแหน่ง เช่น การแชร์ตำแหน่งใน Google Maps ตั้งค่า "Emergency Contact" และนำผลประเมินนี้ไปปรึกษาแพทย์เฉพาะทางระบบประสาทหรืออายุรกรรมผู้สูงอายุ',
      urgent: true,
    });
  }
  if (!cards.length) {
    cards.push({
      title: "🌿 การดูแลต่อเนื่อง",
      knowledge: "ยังไม่พบปัจจัยเสี่ยงเด่นจากข้อมูลทั่วไปที่ตอบไว้",
      literacy:
        "สามารถใช้ปฏิทินหรือแอปเตือนความจำในมือถือเพื่อวางแผนนอน ออกกำลังกาย ตรวจสุขภาพ และทบทวนกิจกรรมฝึกสมองเป็นประจำ",
    });
  }
  return cards;
}

/* ---------------------------------------------------------
   10) RESULT SCREEN
   --------------------------------------------------------- */
function renderResult() {
  const { total, bySection } = computeCognitiveScore();
  const level = riskLevel(total);
  const profile = RISK_PROFILES[level];

  document.getElementById("result-score-number").textContent = total;

  const levelEl = document.getElementById("result-level");
  levelEl.className = `result-level ${level}`;
  levelEl.textContent = profile.label;
  document.getElementById("result-message").textContent =
    `ช่วงคะแนน: ${profile.range} | สถานะ: ${profile.status} | คำแนะนำ: ${profile.recommendation}`;

  const feedbackWrap = document.getElementById("result-feedback");
  feedbackWrap.innerHTML = "";
  const sectionScores = document.createElement("div");
  sectionScores.className = "section-score-list";
  [4, 5, 6].forEach((sectionId) => {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const item = document.createElement("div");
    item.className = "section-score-item";
    item.innerHTML = `
      <span>ส่วนที่ ${sectionId}: ${section.title}</span>
      <strong>${bySection[sectionId] ?? 0} / ${maxScoreForSection(sectionId)} คะแนน</strong>
    `;
    sectionScores.appendChild(item);
  });
  feedbackWrap.appendChild(sectionScores);

  const feedbackCards = buildFeedbackCards(level);
  const popupBtn = document.createElement("button");
  popupBtn.type = "button";
  popupBtn.className = "btn-secondary btn-large";
  popupBtn.textContent = "ดูคำแนะนำ Digital Literacy เฉพาะบุคคล";
  popupBtn.addEventListener("click", () => openFeedbackModal(feedbackCards));
  feedbackWrap.appendChild(popupBtn);

  feedbackCards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "feedback-card" + (card.urgent ? " urgent" : "");
    div.innerHTML = `<h3>${card.title}</h3><p><strong>ความรู้:</strong> ${card.knowledge}</p><p><strong>Digital Literacy:</strong> ${card.literacy}</p>`;
    feedbackWrap.appendChild(div);
  });

  if (!state.resultPopupShown) {
    state.resultPopupShown = true;
    setTimeout(() => openFeedbackModal(feedbackCards), 250);
  }

  updateSubmissionStatus();
  submitAssessmentResult(feedbackCards);
  renderMarigoldRing(
    document.getElementById("marigold-ring-full"),
    6,
    6,
    level,
  );
}

function openFeedbackModal(cards) {
  const existing = document.getElementById("feedback-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "feedback-modal";
  modal.className = "feedback-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "feedback-modal-title");
  modal.innerHTML = `
    <div class="feedback-modal-backdrop" data-close-feedback></div>
    <div class="feedback-modal-panel">
      <div class="feedback-modal-header">
        <h2 id="feedback-modal-title">คำแนะนำ Digital Literacy เฉพาะบุคคล</h2>
        <button type="button" class="feedback-modal-close" data-close-feedback aria-label="ปิดคำแนะนำ">×</button>
      </div>
      <div class="feedback-modal-body">
        ${cards
          .map(
            (card) => `
          <section class="feedback-modal-item${card.urgent ? " urgent" : ""}">
            <h3>${card.title}</h3>
            <p><strong>ความรู้:</strong> ${card.knowledge}</p>
            <p><strong>Digital Literacy:</strong> ${card.literacy}</p>
          </section>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  modal.querySelectorAll("[data-close-feedback]").forEach((btn) => {
    btn.addEventListener("click", () => modal.remove());
  });
  document.addEventListener("keydown", function handleEsc(event) {
    if (event.key === "Escape" && document.getElementById("feedback-modal")) {
      modal.remove();
      document.removeEventListener("keydown", handleEsc);
    }
  });
  document.body.appendChild(modal);
  modal.querySelector(".feedback-modal-close").focus();
}

/* ---------------------------------------------------------
   11) MARIGOLD PROGRESS RING (signature visual element)
   วาดกลีบดอกดาวเรือง 6 กลีบ = 6 ส่วนของแบบประเมิน
   --------------------------------------------------------- */
function petalPath(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  return { x, y };
}

function renderProgressRing() {
  const svg = document.getElementById("marigold-ring");
  renderMarigoldRing(
    svg,
    state.sectionIdx + (state.screen === "result" ? 1 : 0),
    6,
    riskLevel(computeCognitiveScore().total),
    60,
    60,
    44,
  );
}

function renderMarigoldRing(
  svg,
  filledCount,
  totalCount,
  level,
  cx = 100,
  cy = 100,
  r = 70,
) {
  if (!svg) return;
  svg.innerHTML = "";
  const petalR = r * 0.32;
  for (let i = 0; i < totalCount; i++) {
    const angle = (360 / totalCount) * i - 90;
    const { x, y } = petalPath(cx, cy, r * 0.62, angle);
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", petalR);
    circle.setAttribute("class", "petal" + (i < filledCount ? " filled" : ""));
    svg.appendChild(circle);
  }
  const center = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  center.setAttribute("cx", cx);
  center.setAttribute("cy", cy);
  center.setAttribute("r", r * 0.22);
  center.setAttribute(
    "fill",
    filledCount >= totalCount ? "var(--forest)" : "var(--sand-deep)",
  );
  center.setAttribute("stroke", "var(--forest)");
  center.setAttribute("stroke-width", "2");
  svg.appendChild(center);
}

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
bindGlobalEvents();
updateFontSizeControls();
restoreAssessmentDraft();
render();
