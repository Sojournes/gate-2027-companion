// Frontend Application Controller for GATE 2027 ECE & FDE Study Companion

let appState = null;
let selectedDayIndex = 0;
let plannerMonthFilter = 'ALL';
let testCategoryFilter = 'ALL';
let fcSubjectFilter = 'ALL';
let currentFcIndex = 0;
let fcRevealed = false;

let quizSubjectFilter = 'ALL';
let currentQuizIndex = 0;
let quizSelectedOption = null;
let quizScore = { correct: 0, attempted: 0 };

// Pomodoro State
let pomoTotalSeconds = 45 * 60;
let pomoRemainingSeconds = 45 * 60;
let pomoRunning = false;
let pomoInterval = null;
let pomoCurrentLabel = '45m PW Lecture Sprint (1 Lec @ 2.25x)';

// Web Audio API Chime
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.36);
    });
  } catch (e) {
    // AudioContext optional
  }
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  appState = data;
  try {
    localStorage.setItem('gate2027_companion_backup', JSON.stringify(data));
  } catch (e) {}
  renderAll();
  return data;
}

// Live Countdown to Feb 6, 2027 09:30 IST (87 days from Nov 10/11, 2026)
function updateCountdowns() {
  const examTarget = new Date('2027-02-06T09:30:00+05:30');
  const now = new Date();
  const diffMs = examTarget - now;

  const daysEl = document.getElementById('examDaysLeft');
  const liveClockEl = document.getElementById('examLiveClock');

  if (diffMs > 0) {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    if (daysEl) daysEl.textContent = `${days}d`;
    if (liveClockEl) liveClockEl.textContent = `${days}d ${hours}h ${mins}m left`;
  } else {
    if (daysEl) daysEl.textContent = '87d';
    if (liveClockEl) liveClockEl.textContent = 'Target: 6 Feb 2027';
  }

  if (appState && appState.summary) {
    const bufCountEl = document.getElementById('bufferDaysCount');
    const bufDateEl = document.getElementById('bufferStartDateLabel');
    if (bufCountEl) bufCountEl.textContent = `${appState.summary.bufferDaysCount}d`;
    if (bufDateEl) bufDateEl.textContent = `From ${appState.summary.bufferStartDate}`;
  }
}

function renderDashboard() {
  if (!appState) return;
  const { summary, settings, subjects, schedule } = appState;
  const speed = Number(settings.playbackSpeed) || 2.25;

  const totalRawHrs = subjects.reduce((acc, s) => acc + s.rawHours, 0).toFixed(0);
  const totalEffHrs = (totalRawHrs / speed).toFixed(0);
  const batch2027Count = subjects.filter((s) => s.batch2027Available).length;
  const yt2026Count = subjects.length - batch2027Count;

  const kpiGrid = document.getElementById('dashboardKpiGrid');
  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">📺 PW ECE Video Series (11 Subjects)</span>
        <span class="badge-pill">${speed}x Speed</span>
      </div>
      <div class="kpi-value">${summary.completedLectures} / ${summary.totalLectures} <span style="font-size:0.95rem; font-weight:600; color:var(--text-secondary);">Lectures (${summary.lectureProgressPercent}%)</span></div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${summary.lectureProgressPercent}%;"></div>
      </div>
      <div class="kpi-sub">
        ~${totalRawHrs}h raw → <strong>~${totalEffHrs}h at ${speed}x</strong> • ${batch2027Count} in 2027 Batch + ${yt2026Count} on 2026 YouTube
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">📝 PW Test Series (56 Tests)</span>
        <span class="badge-pill">TWT • SWT • MST • PYQ • GBG</span>
      </div>
      <div class="kpi-value">${summary.completedTests} / ${summary.totalTests} <span style="font-size:0.95rem; font-weight:600; color:var(--text-secondary);">Tests (${summary.testProgressPercent}%)</span></div>
      <div class="progress-track">
        <div class="progress-fill emerald" style="width:${summary.testProgressPercent}%;"></div>
      </div>
      <div class="kpi-sub">
        21 TWT + 10 SWT + 8 MST + 5 PYQ + 12 GBG Full-Length Mocks
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">🤖 Ed Donner FDE Course (Udemy)</span>
        <span class="badge-pill">21.5 Hours</span>
      </div>
      <div class="kpi-value">${summary.completedFdeHours} / ${summary.totalFdeHours} <span style="font-size:0.95rem; font-weight:600; color:var(--text-secondary);">Hrs (${summary.fdeProgressPercent}%)</span></div>
      <div class="progress-track">
        <div class="progress-fill purple" style="width:${summary.fdeProgressPercent}%;"></div>
      </div>
      <div class="kpi-sub">
        ${summary.completedFdeModules} / ${summary.totalFdeModules} Hands-On LLM &amp; AI Engineering Modules
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">🛡️ Pre-Exam Buffer &amp; Burnout Shield</span>
        <span class="badge-pill" style="background:rgba(16,185,129,0.2); color:#6ee7b7;">${summary.bufferDaysCount} Days Buffer</span>
      </div>
      <div class="kpi-value">17 Jan – 5 Feb <span style="font-size:0.95rem; font-weight:600; color:#6ee7b7;">(~3 Wks)</span></div>
      <div class="progress-track">
        <div class="progress-fill amber" style="width:100%;"></div>
      </div>
      <div class="kpi-sub">
        Daily 45m Weekday / 90m Weekend Gaming Break 🎮 + 12–1:30 AM Flex
      </div>
    </div>
  `;

  // Render active day tasks on Dashboard
  const activeDay = schedule[selectedDayIndex] || schedule[0];
  if (activeDay) {
    document.getElementById('todayCardTitle').textContent =
      `📅 Day ${activeDay.dayNumber} Mission Plan (${activeDay.dayName}, ${activeDay.date})`;
    document.getElementById('todayCardSubtitle').textContent =
      `${activeDay.phase} • Burnout Risk: ${activeDay.burnoutRisk}`;

    const taskContainer = document.getElementById('dashboardTodayTasks');
    taskContainer.innerHTML = activeDay.tasks
      .map((t) => renderTaskItemHtml(t))
      .join('');
  }

  // Render 11-Subject Completion Milestones
  const milestoneContainer = document.getElementById('dashboardSubjectMilestones');
  milestoneContainer.innerHTML = subjects
    .map(
      (s) => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.65rem; padding:0.45rem 0.65rem; background:rgba(15,23,42,0.55); border-radius:8px; border-left:3px solid ${s.color};">
        <div style="flex:1;">
          <div style="font-size:0.83rem; font-weight:700;">
            ${s.order}. ${s.name}
            <span style="font-size:0.7rem; color:var(--text-secondary); font-weight:500;">(${s.completedLectures}/${s.totalLectures} Lecs • ${s.gateWeightageMarks}M)</span>
          </div>
          <div style="font-size:0.72rem; color:var(--text-secondary);">
            Source: <strong style="color:${s.batch2027Available ? '#6ee7b7' : '#fcd34d'};">${s.batch2027Available ? 'PW 2027 Batch' : 'PW 2026 YouTube'}</strong>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.74rem; font-weight:700; color:#93c5fd;">Target: ${s.targetCompletionDate}</div>
          <div style="font-size:0.7rem; color:var(--text-secondary);">${s.progressPercent}% Done</div>
        </div>
      </div>
    `
    )
    .join('');
}

function renderTaskItemHtml(t) {
  const typeIcons = {
    lecture: '📺',
    test: '📝',
    fde: '🤖',
    revision: '🧠',
    gaming: '🎮',
    flex: '🌙',
    exam: '🏆'
  };
  const icon = typeIcons[t.type] || '📌';
  return `
    <div class="task-item type-${t.type} ${t.completed ? 'completed' : ''}">
      <div class="task-left">
        <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.completed ? 'checked' : ''} />
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="task-time-badge">${t.startTime} – ${t.endTime}</span>
            <span class="task-title">${icon} ${t.title}</span>
          </div>
          <div class="task-subtitle">${t.subtitle || ''}</div>
        </div>
      </div>
      <div class="task-actions">
        ${
          !t.completed && t.type !== 'flex' && t.type !== 'gaming'
            ? `<button class="btn btn-sm" data-push-flex="${t.id}" title="Move to 12:00 AM - 1:30 AM Late-Night Slot">🌙 12AM</button>`
            : ''
        }
        <button class="btn btn-sm" data-start-pomo="${t.durationMinutes || 45}" data-pomo-title="${(t.title || '').replace(/"/g, '&quot;')}" title="Start Timer for this task">⏱️ ${t.durationMinutes || 45}m</button>
      </div>
    </div>
  `;
}

function renderPlanner() {
  if (!appState) return;
  const { schedule } = appState;
  const filteredDays =
    plannerMonthFilter === 'ALL'
      ? schedule
      : schedule.filter((d) => d.date.startsWith(plannerMonthFilter));

  const strip = document.getElementById('plannerDayStrip');
  strip.innerHTML = filteredDays
    .map((d) => {
      const realIdx = schedule.findIndex((x) => x.date === d.date);
      const nonFlexTasks = d.tasks.filter((t) => !t.isOptionalFlex);
      const doneCount = nonFlexTasks.filter((t) => t.completed).length;
      const isBuffer = d.phase && d.phase.startsWith('Phase 2');
      return `
        <div class="day-pill ${realIdx === selectedDayIndex ? 'selected' : ''} ${d.isWeekend ? 'weekend' : ''} ${isBuffer ? 'buffer-day' : ''}" data-day-idx="${realIdx}">
          <div style="font-size:0.68rem; color:var(--text-secondary); font-weight:600;">Day ${d.dayNumber} • ${d.dayName.slice(0, 3)}</div>
          <div style="font-size:0.84rem; font-weight:800; margin:0.15rem 0;">${d.date.slice(5)}</div>
          <div style="font-size:0.68rem; color:${doneCount === nonFlexTasks.length && nonFlexTasks.length > 0 ? '#6ee7b7' : '#93c5fd'};">
            ${doneCount}/${nonFlexTasks.length} tasks
          </div>
        </div>
      `;
    })
    .join('');

  const selDay = schedule[selectedDayIndex] || schedule[0];
  if (selDay) {
    document.getElementById('plannerSelectedDayTitle').textContent =
      `Day ${selDay.dayNumber}: ${selDay.dayName}, ${selDay.date}`;
    document.getElementById('plannerSelectedDayMeta').textContent =
      `${selDay.phase} • ${selDay.isWeekend ? 'Weekend All-Day Schedule (09:00 - 00:00)' : 'Weekday After-Work Schedule (18:30 - 00:00 + 12:00-01:30 Flex)'}`;
    document.getElementById('plannerSelectedDayTasks').innerHTML = selDay.tasks
      .map((t) => renderTaskItemHtml(t))
      .join('');
  }
}

function renderSubjects() {
  if (!appState) return;
  const { subjects, lectures, settings } = appState;
  const speed = Number(settings.playbackSpeed) || 2.25;

  const container = document.getElementById('subjectsGridContainer');
  container.innerHTML = subjects
    .map((sub) => {
      const subLectures = lectures.filter((l) => l.subjectId === sub.id);
      return `
        <div class="subject-card" style="border-top: 3px solid ${sub.color};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                <span class="badge-pill" style="background:${sub.color}25; border-color:${sub.color}; color:#fff;">#${sub.order} ${sub.code}</span>
                <h3 style="font-size:1.05rem; font-weight:700;">${sub.name}</h3>
              </div>
              <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:0.2rem;">
                GATE Weightage: <strong>~${sub.gateWeightageMarks} Marks</strong> • Target Finish: <strong>${sub.targetCompletionDate}</strong>
              </div>
            </div>
            <span class="source-badge ${sub.batch2027Available ? 'source-2027' : 'source-2026-yt'}">
              ${sub.batch2027Available ? '✅ PW 2027 Batch' : '▶️ PW 2026 YouTube'}
            </span>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:0.25rem;">
              <span><strong>${sub.completedLectures} / ${sub.totalLectures}</strong> Lectures Completed (${sub.progressPercent}%)</span>
              <span>${sub.rawHours}h raw → <strong>${(sub.rawHours / speed).toFixed(1)}h @ ${speed}x</strong></span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${sub.progressPercent}%; background:${sub.color};"></div>
            </div>
          </div>

          <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
            <a href="${sub.pwBatchUrl}" target="_blank" class="btn btn-sm btn-primary">🔗 Open PW 2027 Batch</a>
            <a href="${sub.youtube2026Url}" target="_blank" class="btn btn-sm btn-amber">▶️ PW 2026 YouTube Series</a>
            <button class="btn btn-sm" data-toggle-source="${sub.id}" data-current-avail="${sub.batch2027Available}">
              ⇄ Switch to ${sub.batch2027Available ? '2026 YT' : '2027 Batch'}
            </button>
          </div>

          <details>
            <summary style="cursor:pointer; font-size:0.8rem; font-weight:600; color:#93c5fd;">
              📋 View &amp; Check Off All ${sub.totalLectures} Lectures
            </summary>
            <div class="lecture-drawer">
              ${subLectures
                .map((lec) => {
                  const effMins = Math.round(lec.rawDurationMinutes / speed);
                  return `
                    <label class="lecture-row ${lec.completed ? 'done' : ''}">
                      <span style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="checkbox" data-lec-id="${lec.id}" ${lec.completed ? 'checked' : ''} />
                        <span>${lec.title}</span>
                      </span>
                      <span style="white-space:nowrap; font-size:0.72rem; color:var(--text-secondary);">
                        ${lec.rawDurationMinutes}m → <strong>${effMins}m</strong>
                      </span>
                    </label>
                  `;
                })
                .join('')}
            </div>
          </details>
        </div>
      `;
    })
    .join('');
}

function renderTests() {
  if (!appState) return;
  const { tests } = appState;
  const filtered =
    testCategoryFilter === 'ALL'
      ? tests
      : tests.filter((t) => t.category === testCategoryFilter);

  const grid = document.getElementById('testsGridContainer');
  grid.innerHTML = filtered
    .map(
      (t) => `
      <div class="test-card ${t.completed ? 'completed' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
          <div>
            <span class="badge-pill">${t.categoryName}</span>
            <h4 style="font-size:0.98rem; font-weight:700; margin-top:0.3rem;">${t.code}: ${t.subjectLabel}</h4>
          </div>
          <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.78rem; font-weight:700; cursor:pointer; color:${t.completed ? '#6ee7b7' : '#94a3b8'};">
            <input type="checkbox" data-test-toggle="${t.id}" ${t.completed ? 'checked' : ''} style="width:18px; height:18px;" />
            ${t.completed ? 'Completed' : 'Mark Done'}
          </label>
        </div>

        <div style="font-size:0.76rem; color:var(--text-secondary); line-height:1.4;">
          ${t.syllabus}
        </div>

        <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:#93c5fd; background:rgba(15,23,42,0.6); padding:0.35rem 0.6rem; border-radius:6px;">
          <span>📅 Planned: <strong>${t.scheduledDate || 'Buffer Window'}</strong></span>
          <span>⏱️ ${t.durationMinutes}m (${t.maxMarks}M)</span>
          <span style="color:var(--text-muted);">PDF: ${t.originalPdfDate}</span>
        </div>

        <div class="test-inputs">
          <input type="number" class="input-sm" style="width:95px;" placeholder="Marks / ${t.maxMarks}" value="${t.score !== null && t.score !== undefined ? t.score : ''}" data-test-score="${t.id}" />
          <input type="number" class="input-sm" style="width:95px;" placeholder="Accuracy %" value="${t.accuracy !== null && t.accuracy !== undefined ? t.accuracy : ''}" data-test-acc="${t.id}" />
          <input type="text" class="input-sm" style="flex:1; min-width:130px;" placeholder="Mistake notes / weak topics..." value="${(t.notes || '').replace(/"/g, '&quot;')}" data-test-notes="${t.id}" />
        </div>
      </div>
    `
    )
    .join('');
}

function renderRecallArena() {
  if (!appState) return;
  const { flashcards, quizQuestions, subjects } = appState;

  // Populate subject filters once
  const fcFilterEl = document.getElementById('flashcardSubjectFilter');
  const quizFilterEl = document.getElementById('quizSubjectFilter');
  const newFcSubEl = document.getElementById('newFcSubject');
  if (fcFilterEl && fcFilterEl.options.length <= 1) {
    subjects.forEach((s) => {
      fcFilterEl.insertAdjacentHTML('beforeend', `<option value="${s.id}">${s.code} - ${s.name}</option>`);
      quizFilterEl.insertAdjacentHTML('beforeend', `<option value="${s.id}">${s.code} - ${s.name}</option>`);
      newFcSubEl.insertAdjacentHTML('beforeend', `<option value="${s.id}">${s.code} - ${s.name}</option>`);
    });
  }

  // Filter Flashcards
  const filteredCards =
    fcSubjectFilter === 'ALL'
      ? flashcards
      : flashcards.filter((c) => c.subjectId === fcSubjectFilter);

  if (filteredCards.length > 0) {
    if (currentFcIndex >= filteredCards.length) currentFcIndex = 0;
    const card = filteredCards[currentFcIndex];
    document.getElementById('fcBadge').textContent =
      `${card.subjectCode} • Card ${currentFcIndex + 1}/${filteredCards.length} • Next Review: ${card.nextReviewDate} (Interval: ${card.interval}d)`;
    document.getElementById('fcFrontText').textContent = card.front;
    const backEl = document.getElementById('fcBackText');
    backEl.textContent = card.back;
    backEl.style.display = fcRevealed ? 'block' : 'none';
    document.getElementById('fcFlipHint').textContent = fcRevealed
      ? 'Rate your recall below to schedule next SM-2 Spaced Repetition review'
      : '👆 Click card or "Flip Answer" to reveal formula & solution';
  }

  // Filter Quiz Questions
  const filteredQuiz =
    quizSubjectFilter === 'ALL'
      ? quizQuestions
      : quizQuestions.filter((q) => q.subjectId === quizSubjectFilter);

  const quizBox = document.getElementById('quizContainer');
  if (filteredQuiz.length > 0) {
    if (currentQuizIndex >= filteredQuiz.length) currentQuizIndex = 0;
    const q = filteredQuiz[currentQuizIndex];
    quizBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <span class="badge-pill">${q.subjectCode} • Question ${currentQuizIndex + 1} of ${filteredQuiz.length}</span>
        <span style="font-size:0.8rem; color:#6ee7b7; font-weight:700;">Session Score: ${quizScore.correct} / ${quizScore.attempted}</span>
      </div>
      <div style="font-size:0.98rem; font-weight:600; margin-bottom:1rem; color:#f8fafc;">
        ${q.question}
      </div>
      <div>
        ${q.options
          .map((opt, idx) => {
            let cls = 'quiz-option';
            if (quizSelectedOption !== null) {
              if (idx === q.correctIndex) cls += ' correct';
              else if (idx === quizSelectedOption) cls += ' wrong';
            }
            return `<button class="${cls}" data-quiz-opt="${idx}">${String.fromCharCode(65 + idx)}. ${opt}</button>`;
          })
          .join('')}
      </div>
      ${
        quizSelectedOption !== null
          ? `<div style="margin-top:0.85rem; padding:0.85rem; border-radius:10px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.35); font-size:0.83rem; color:#d1fae5;">
               <strong>✅ Solution Explanation:</strong> ${q.explanation}
             </div>`
          : ''
      }
      <div style="display:flex; justify-content:space-between; margin-top:1rem;">
        <button class="btn btn-sm" id="quizPrevBtn">◀ Previous Question</button>
        <button class="btn btn-sm btn-primary" id="quizNextBtn">Next Question ▶</button>
      </div>
    `;
  }
}

function renderFdeCourse() {
  if (!appState) return;
  const { fdeModules, summary } = appState;

  document.getElementById('fdeSummaryBadge').textContent =
    `${summary.completedFdeHours} / ${summary.totalFdeHours} hrs (${summary.fdeProgressPercent}%)`;
  document.getElementById('fdeOverallBar').style.width = `${summary.fdeProgressPercent}%`;

  const grid = document.getElementById('fdeModulesGrid');
  grid.innerHTML = fdeModules
    .map(
      (m) => `
      <div class="test-card ${m.completed ? 'completed' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
          <div>
            <span class="badge-pill">${m.section}</span>
            <h4 style="font-size:0.95rem; font-weight:700; margin-top:0.35rem;">Module ${m.moduleNumber}: ${m.title}</h4>
          </div>
          <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.78rem; font-weight:700; cursor:pointer;">
            <input type="checkbox" data-fde-toggle="${m.id}" ${m.completed ? 'checked' : ''} style="width:18px; height:18px;" />
            ${m.durationMinutes}m
          </label>
        </div>
        <input type="text" class="input-sm" style="width:100%; margin-top:0.35rem;" placeholder="Project repo link / key takeaways..." value="${(m.notes || '').replace(/"/g, '&quot;')}" data-fde-notes="${m.id}" />
      </div>
    `
    )
    .join('');
}

function renderPomodoroLogs() {
  if (!appState) return;
  const listEl = document.getElementById('pomoHistoryList');
  const logs = appState.pomodoroLogs || [];
  if (logs.length === 0) {
    listEl.innerHTML = `<div>No sessions logged yet today. Start a 45m Lecture Sprint or 25m Pomodoro above!</div>`;
    return;
  }
  listEl.innerHTML = logs
    .slice(0, 8)
    .map(
      (l) => `
      <div style="display:flex; justify-content:space-between; padding:0.35rem 0.6rem; background:rgba(15,23,42,0.55); border-radius:6px;">
        <span><strong>${l.label}</strong> (${l.durationMinutes} mins)</span>
        <span>${new Date(l.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `
    )
    .join('');
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updatePomoDisplays() {
  const formatted = formatSeconds(pomoRemainingSeconds);
  const hEl = document.getElementById('headerPomoDisplay');
  const mEl = document.getElementById('mainPomoDisplay');
  const btnEl = document.getElementById('headerPomoToggleBtn');
  if (hEl) hEl.textContent = formatted;
  if (mEl) mEl.textContent = formatted;
  if (btnEl) btnEl.textContent = pomoRunning ? 'Pause' : 'Start';
}

function togglePomodoro() {
  if (pomoRunning) {
    clearInterval(pomoInterval);
    pomoRunning = false;
  } else {
    pomoRunning = true;
    pomoInterval = setInterval(() => {
      if (pomoRemainingSeconds > 0) {
        pomoRemainingSeconds--;
        updatePomoDisplays();
      } else {
        clearInterval(pomoInterval);
        pomoRunning = false;
        playChime();
        updatePomoDisplays();
        apiRequest('/api/pomodoro/log', {
          method: 'POST',
          body: JSON.stringify({
            mode: 'focus',
            durationMinutes: Math.round(pomoTotalSeconds / 60),
            label: pomoCurrentLabel
          })
        });
      }
    }, 1000);
  }
  updatePomoDisplays();
}

function resetPomodoro() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoRemainingSeconds = pomoTotalSeconds;
  updatePomoDisplays();
}

function renderAll() {
  updateCountdowns();
  renderDashboard();
  renderPlanner();
  renderSubjects();
  renderTests();
  renderRecallArena();
  renderFdeCourse();
  renderPomodoroLogs();
}

// Event Delegation & Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Load initial state from backend
  await apiRequest('/api/state');
  setInterval(updateCountdowns, 30000);

  // Sync speed selector
  const speedSelect = document.getElementById('globalSpeedSelect');
  if (appState && appState.settings) {
    speedSelect.value = String(appState.settings.playbackSpeed || 2.25);
  }
  speedSelect.addEventListener('change', async (e) => {
    await apiRequest('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        playbackSpeed: Number(e.target.value),
        regenerate: true
      })
    });
  });

  // Tab Switching
  document.getElementById('mainNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-tab');
    if (!btn) return;
    document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`tab-${btn.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });

  // Quick Prev / Next Day on Dashboard
  document.getElementById('prevDayQuickBtn').addEventListener('click', () => {
    if (selectedDayIndex > 0) {
      selectedDayIndex--;
      renderAll();
    }
  });
  document.getElementById('nextDayQuickBtn').addEventListener('click', () => {
    if (appState && selectedDayIndex < appState.schedule.length - 1) {
      selectedDayIndex++;
      renderAll();
    }
  });

  // Push Unfinished to 12:00 - 1:30 AM Late-Night Slot or Tomorrow
  async function handleRebalance(mode) {
    const day = appState.schedule[selectedDayIndex];
    if (!day) return;
    await apiRequest('/api/schedule/rebalance', {
      method: 'POST',
      body: JSON.stringify({ date: day.date, mode })
    });
  }
  document.getElementById('pushLateNightBtn').addEventListener('click', () => handleRebalance('late-night'));
  document.getElementById('moveTomorrowBtn').addEventListener('click', () => handleRebalance('next-day'));
  document.getElementById('plannerPushLateBtn').addEventListener('click', () => handleRebalance('late-night'));
  document.getElementById('plannerDeferNextBtn').addEventListener('click', () => handleRebalance('next-day'));

  // Planner Month Filter
  document.getElementById('plannerMonthFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-month]');
    if (!btn) return;
    plannerMonthFilter = btn.dataset.month;
    document.querySelectorAll('#plannerMonthFilter button').forEach((b) => b.classList.remove('btn-primary'));
    btn.classList.add('btn-primary');
    renderPlanner();
  });

  // Planner Day Strip Selection
  document.getElementById('plannerDayStrip').addEventListener('click', (e) => {
    const pill = e.target.closest('.day-pill');
    if (!pill) return;
    selectedDayIndex = Number(pill.dataset.dayIdx);
    renderAll();
  });

  // Add Custom Task Form
  document.getElementById('addCustomTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const day = appState.schedule[selectedDayIndex];
    if (!day) return;
    await apiRequest('/api/schedule/task', {
      method: 'POST',
      body: JSON.stringify({
        date: day.date,
        title: document.getElementById('customTaskTitle').value,
        startTime: document.getElementById('customTaskStart').value,
        endTime: document.getElementById('customTaskEnd').value,
        type: document.getElementById('customTaskType').value,
        subtitle: document.getElementById('customTaskSub').value
      })
    });
    e.target.reset();
  });

  // Test Category Filter Bar
  document.getElementById('testCategoryFilterBar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    testCategoryFilter = btn.dataset.cat;
    document.querySelectorAll('#testCategoryFilterBar button').forEach((b) => b.classList.remove('btn-primary'));
    btn.classList.add('btn-primary');
    renderTests();
  });

  // Flashcard Controls
  document.getElementById('flashcardStage').addEventListener('click', () => {
    fcRevealed = !fcRevealed;
    renderRecallArena();
  });
  document.getElementById('fcFlipBtn').addEventListener('click', () => {
    fcRevealed = !fcRevealed;
    renderRecallArena();
  });
  document.getElementById('fcPrevBtn').addEventListener('click', () => {
    currentFcIndex = Math.max(0, currentFcIndex - 1);
    fcRevealed = false;
    renderRecallArena();
  });
  document.getElementById('fcNextBtn').addEventListener('click', () => {
    currentFcIndex++;
    fcRevealed = false;
    renderRecallArena();
  });
  document.getElementById('flashcardSubjectFilter').addEventListener('change', (e) => {
    fcSubjectFilter = e.target.value;
    currentFcIndex = 0;
    fcRevealed = false;
    renderRecallArena();
  });

  document.querySelectorAll('button[data-rating]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const filteredCards =
        fcSubjectFilter === 'ALL'
          ? appState.flashcards
          : appState.flashcards.filter((c) => c.subjectId === fcSubjectFilter);
      const card = filteredCards[currentFcIndex];
      if (!card) return;
      fcRevealed = false;
      currentFcIndex = (currentFcIndex + 1) % filteredCards.length;
      await apiRequest(`/api/flashcards/${card.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating: btn.dataset.rating, currentDate: '2026-11-10' })
      });
    });
  });

  document.getElementById('newFlashcardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await apiRequest('/api/flashcards', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: document.getElementById('newFcSubject').value,
        front: document.getElementById('newFcFront').value,
        back: document.getElementById('newFcBack').value
      })
    });
    e.target.reset();
  });

  // Quiz Subject Filter
  document.getElementById('quizSubjectFilter').addEventListener('change', (e) => {
    quizSubjectFilter = e.target.value;
    currentQuizIndex = 0;
    quizSelectedOption = null;
    renderRecallArena();
  });

  // Pomodoro Controls
  document.getElementById('headerPomoToggleBtn').addEventListener('click', togglePomodoro);
  document.getElementById('headerPomoResetBtn').addEventListener('click', resetPomodoro);
  document.getElementById('mainPomoStartBtn').addEventListener('click', togglePomodoro);
  document.getElementById('mainPomoResetBtn').addEventListener('click', resetPomodoro);
  document.getElementById('mainPomoLogBtn').addEventListener('click', async () => {
    playChime();
    await apiRequest('/api/pomodoro/log', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        durationMinutes: Math.round(pomoTotalSeconds / 60),
        label: pomoCurrentLabel
      })
    });
  });

  document.getElementById('pomoPresetButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mins]');
    if (!btn) return;
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoTotalSeconds = Number(btn.dataset.mins) * 60;
    pomoRemainingSeconds = pomoTotalSeconds;
    pomoCurrentLabel = btn.dataset.label;
    document.getElementById('pomoCurrentModeBadge').textContent = pomoCurrentLabel;
    updatePomoDisplays();
  });

  // Export & Reset Backup Buttons
  document.getElementById('exportBackupBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate-2027-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  document.getElementById('resetSeedBtn').addEventListener('click', async () => {
    await apiRequest('/api/reset', { method: 'POST' });
  });

  // Global Delegated Clicks & Changes (Tasks, Lectures, Tests, FDE, Quiz)
  document.body.addEventListener('change', async (e) => {
    const tCheck = e.target.closest('input[data-task-id]');
    if (tCheck) {
      await apiRequest(`/api/schedule/task/${tCheck.dataset.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: tCheck.checked })
      });
      return;
    }

    const lCheck = e.target.closest('input[data-lec-id]');
    if (lCheck) {
      await apiRequest(`/api/lectures/${lCheck.dataset.lecId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: lCheck.checked })
      });
      return;
    }

    const testCheck = e.target.closest('input[data-test-toggle]');
    if (testCheck) {
      await apiRequest(`/api/tests/${testCheck.dataset.testToggle}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: testCheck.checked })
      });
      return;
    }

    const testScore = e.target.closest('input[data-test-score]');
    if (testScore) {
      await apiRequest(`/api/tests/${testScore.dataset.testScore}`, {
        method: 'PATCH',
        body: JSON.stringify({ score: testScore.value })
      });
      return;
    }

    const testAcc = e.target.closest('input[data-test-acc]');
    if (testAcc) {
      await apiRequest(`/api/tests/${testAcc.dataset.testAcc}`, {
        method: 'PATCH',
        body: JSON.stringify({ accuracy: testAcc.value })
      });
      return;
    }

    const testNotes = e.target.closest('input[data-test-notes]');
    if (testNotes) {
      await apiRequest(`/api/tests/${testNotes.dataset.testNotes}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: testNotes.value })
      });
      return;
    }

    const fdeCheck = e.target.closest('input[data-fde-toggle]');
    if (fdeCheck) {
      await apiRequest(`/api/fde/${fdeCheck.dataset.fdeToggle}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: fdeCheck.checked })
      });
      return;
    }

    const fdeNotes = e.target.closest('input[data-fde-notes]');
    if (fdeNotes) {
      await apiRequest(`/api/fde/${fdeNotes.dataset.fdeNotes}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: fdeNotes.value })
      });
      return;
    }
  });

  document.body.addEventListener('click', async (e) => {
    const pushBtn = e.target.closest('button[data-push-flex]');
    if (pushBtn) {
      await apiRequest(`/api/schedule/task/${pushBtn.dataset.pushFlex}`, {
        method: 'PATCH',
        body: JSON.stringify({ moveToFlex: true })
      });
      return;
    }

    const startPomoBtn = e.target.closest('button[data-start-pomo]');
    if (startPomoBtn) {
      clearInterval(pomoInterval);
      pomoTotalSeconds = Number(startPomoBtn.dataset.startPomo) * 60;
      pomoRemainingSeconds = pomoTotalSeconds;
      pomoCurrentLabel = startPomoBtn.dataset.pomoTitle || 'GATE Study Session';
      document.getElementById('pomoCurrentModeBadge').textContent = pomoCurrentLabel;
      pomoRunning = false;
      togglePomodoro();
      return;
    }

    const toggleSourceBtn = e.target.closest('button[data-toggle-source]');
    if (toggleSourceBtn) {
      const cur = toggleSourceBtn.dataset.currentAvail === 'true';
      await apiRequest(`/api/subjects/${toggleSourceBtn.dataset.toggleSource}`, {
        method: 'PATCH',
        body: JSON.stringify({ batch2027Available: !cur })
      });
      return;
    }

    const quizOpt = e.target.closest('button[data-quiz-opt]');
    if (quizOpt && quizSelectedOption === null) {
      const idx = Number(quizOpt.dataset.quizOpt);
      quizSelectedOption = idx;
      const filteredQuiz =
        quizSubjectFilter === 'ALL'
          ? appState.quizQuestions
          : appState.quizQuestions.filter((q) => q.subjectId === quizSubjectFilter);
      const q = filteredQuiz[currentQuizIndex];
      quizScore.attempted++;
      if (q && idx === q.correctIndex) {
        quizScore.correct++;
      }
      renderRecallArena();
      return;
    }

    if (e.target.id === 'quizPrevBtn') {
      currentQuizIndex = Math.max(0, currentQuizIndex - 1);
      quizSelectedOption = null;
      renderRecallArena();
    } else if (e.target.id === 'quizNextBtn') {
      currentQuizIndex++;
      quizSelectedOption = null;
      renderRecallArena();
    }
  });
});
