const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const {
  SUBJECTS,
  buildLecturesForSubjects,
  TEST_SERIES,
  FDE_COURSE_MODULES,
  FLASHCARDS,
  QUIZ_QUESTIONS,
  DEFAULT_SETTINGS
} = require('./data/seedData');
const { generateFullSchedule, addDays } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Initialize or load database
function createInitialDatabase() {
  const subjects = JSON.parse(JSON.stringify(SUBJECTS));
  const lectures = buildLecturesForSubjects(subjects);
  const tests = JSON.parse(JSON.stringify(TEST_SERIES));
  const fdeModules = JSON.parse(JSON.stringify(FDE_COURSE_MODULES));
  const flashcards = JSON.parse(JSON.stringify(FLASHCARDS));
  const quizQuestions = JSON.parse(JSON.stringify(QUIZ_QUESTIONS));
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  const { days, subjectCompletionDates } = generateFullSchedule({
    subjects,
    lectures,
    tests,
    fdeModules,
    settings
  });

  for (const sub of subjects) {
    sub.targetCompletionDate = subjectCompletionDates[sub.id] || settings.bufferStartDate;
  }

  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    settings,
    subjects,
    lectures,
    tests,
    fdeModules,
    flashcards,
    quizQuestions,
    schedule: days,
    pomodoroLogs: [],
    quizHistory: []
  };
}

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading db.json, recreating initial DB:', err.message);
  }
  const initial = createInitialDatabase();
  saveDb(initial);
  return initial;
}

function saveDb(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save db.json:', err.message);
  }
}

let db = loadDb();

// Compute enriched state with summary statistics
function buildEnrichedState(currentDb) {
  const totalLectures = currentDb.lectures.length;
  const completedLectures = currentDb.lectures.filter((l) => l.completed).length;

  const totalTests = currentDb.tests.length;
  const completedTests = currentDb.tests.filter((t) => t.completed).length;

  const totalFdeModules = currentDb.fdeModules.length;
  const completedFdeModules = currentDb.fdeModules.filter((m) => m.completed).length;
  const totalFdeMinutes = currentDb.fdeModules.reduce((acc, m) => acc + m.durationMinutes, 0);
  const completedFdeMinutes = currentDb.fdeModules
    .filter((m) => m.completed)
    .reduce((acc, m) => acc + m.durationMinutes, 0);

  const subjectsWithStats = currentDb.subjects.map((sub) => {
    const subLecs = currentDb.lectures.filter((l) => l.subjectId === sub.id);
    const doneLecs = subLecs.filter((l) => l.completed).length;
    const rawHours = subLecs.reduce((acc, l) => acc + l.rawDurationMinutes, 0) / 60;
    const effectiveHours = rawHours / (Number(currentDb.settings.playbackSpeed) || 2.25);
    const subTests = currentDb.tests.filter((t) => (t.subjectIds || []).includes(sub.id));
    const doneSubTests = subTests.filter((t) => t.completed).length;
    return {
      ...sub,
      completedLectures: doneLecs,
      totalLectures: subLecs.length,
      progressPercent: subLecs.length ? Math.round((doneLecs / subLecs.length) * 100) : 0,
      rawHours: Number(rawHours.toFixed(1)),
      effectiveHours: Number(effectiveHours.toFixed(1)),
      relatedTestsTotal: subTests.length,
      relatedTestsCompleted: doneSubTests
    };
  });

  // Identify buffer start date (first day of Phase 2)
  const firstBufferDay = currentDb.schedule.find((d) => d.phase && d.phase.startsWith('Phase 2'));
  const bufferStartDate = firstBufferDay ? firstBufferDay.date : currentDb.settings.bufferStartDate;
  const bufferDaysCount = currentDb.schedule.filter(
    (d) => d.phase && d.phase.startsWith('Phase 2')
  ).length;

  return {
    ...currentDb,
    subjects: subjectsWithStats,
    summary: {
      totalLectures,
      completedLectures,
      lectureProgressPercent: totalLectures ? Math.round((completedLectures / totalLectures) * 100) : 0,
      totalTests,
      completedTests,
      testProgressPercent: totalTests ? Math.round((completedTests / totalTests) * 100) : 0,
      totalFdeModules,
      completedFdeModules,
      totalFdeHours: Number((totalFdeMinutes / 60).toFixed(1)),
      completedFdeHours: Number((completedFdeMinutes / 60).toFixed(1)),
      fdeProgressPercent: totalFdeMinutes ? Math.round((completedFdeMinutes / totalFdeMinutes) * 100) : 0,
      bufferStartDate,
      bufferDaysCount
    }
  };
}

// GET /api/state
app.get('/api/state', (req, res) => {
  res.json(buildEnrichedState(db));
});

// PATCH /api/schedule/task/:taskId -> toggle completion, edit, or push to late-night flex
app.patch('/api/schedule/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { completed, moveToFlex, startTime, endTime, title } = req.body;

  let foundTask = null;
  let foundDay = null;

  for (const day of db.schedule) {
    const t = day.tasks.find((item) => item.id === taskId);
    if (t) {
      foundTask = t;
      foundDay = day;
      break;
    }
  }

  if (!foundTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (typeof completed === 'boolean') {
    foundTask.completed = completed;

    // Sync with linked lectures
    if (Array.isArray(foundTask.lectureIds)) {
      for (const lecId of foundTask.lectureIds) {
        const lec = db.lectures.find((l) => l.id === lecId);
        if (lec) {
          lec.completed = completed;
          lec.completedAt = completed ? new Date().toISOString() : null;
        }
      }
    }

    // Sync with linked test
    if (foundTask.testId) {
      const testObj = db.tests.find((t) => t.id === foundTask.testId);
      if (testObj) {
        testObj.completed = completed;
      }
    }

    // Sync with linked FDE module
    if (foundTask.fdeModuleId) {
      const modObj = db.fdeModules.find((m) => m.id === foundTask.fdeModuleId);
      if (modObj) {
        modObj.completed = completed;
      }
    }
  }

  if (moveToFlex) {
    foundTask.startTime = '00:00';
    foundTask.endTime = '01:30';
    foundTask.movedToLateNight = true;
    foundDay.burnoutRisk = 'Elevated (Using 12:00 AM - 1:30 AM Late-Night Push Slot)';
  }

  if (startTime) foundTask.startTime = startTime;
  if (endTime) foundTask.endTime = endTime;
  if (title) foundTask.title = title;

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/schedule/task -> add custom task on a specific date
app.post('/api/schedule/task', (req, res) => {
  const { date, startTime, endTime, type, title, subtitle, durationMinutes } = req.body;
  const day = db.schedule.find((d) => d.date === date);
  if (!day) {
    return res.status(404).json({ error: 'Date not found in schedule' });
  }

  const newTask = {
    id: `custom-${Date.now()}`,
    date,
    startTime: startTime || '21:50',
    endTime: endTime || '22:50',
    type: type || 'revision',
    title: title || 'Custom Study Task',
    subtitle: subtitle || 'Added manually to daily schedule',
    durationMinutes: Number(durationMinutes) || 60,
    completed: false,
    priority: 'high'
  };

  day.tasks.push(newTask);
  day.tasks.sort((a, b) => {
    const aKey = a.startTime.startsWith('00:') || a.startTime.startsWith('01:') ? `24:${a.startTime}` : a.startTime;
    const bKey = b.startTime.startsWith('00:') || b.startTime.startsWith('01:') ? `24:${b.startTime}` : b.startTime;
    return aKey.localeCompare(bKey);
  });

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/schedule/rebalance -> Move unfinished tasks from a date to Late-Night Flex or Next Day
app.post('/api/schedule/rebalance', (req, res) => {
  const { date, mode } = req.body; // mode: 'late-night' | 'next-day'
  const dayIdx = db.schedule.findIndex((d) => d.date === date);
  if (dayIdx === -1) {
    return res.status(404).json({ error: 'Date not found in schedule' });
  }

  const day = db.schedule[dayIdx];
  const pendingCoreTasks = day.tasks.filter(
    (t) => !t.completed && t.type !== 'gaming' && t.type !== 'flex'
  );

  if (pendingCoreTasks.length === 0) {
    return res.json(buildEnrichedState(db));
  }

  if (mode === 'late-night') {
    const taskToPush = pendingCoreTasks[0];
    taskToPush.startTime = '00:00';
    taskToPush.endTime = '01:30';
    taskToPush.movedToLateNight = true;
    taskToPush.subtitle = `[Late-Night Push 12 AM - 1:30 AM] ${taskToPush.subtitle || ''}`;
    day.burnoutRisk = 'Elevated (Late-Night 1:30 AM Push Active)';
  } else if (mode === 'next-day' && dayIdx + 1 < db.schedule.length) {
    const nextDay = db.schedule[dayIdx + 1];
    const taskToMove = pendingCoreTasks[0];
    day.tasks = day.tasks.filter((t) => t.id !== taskToMove.id);
    taskToMove.date = nextDay.date;
    taskToMove.startTime = nextDay.isWeekend ? '22:00' : '00:00';
    taskToMove.endTime = nextDay.isWeekend ? '23:30' : '01:15';
    taskToMove.subtitle = `[Carried over from ${date}] ${taskToMove.subtitle || ''}`;
    nextDay.tasks.push(taskToMove);
  }

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// PATCH /api/lectures/:lectureId -> toggle lecture completion or update notes/source
app.patch('/api/lectures/:lectureId', (req, res) => {
  const { lectureId } = req.params;
  const { completed, notes, source } = req.body;
  const lec = db.lectures.find((l) => l.id === lectureId);
  if (!lec) {
    return res.status(404).json({ error: 'Lecture not found' });
  }

  if (typeof completed === 'boolean') {
    lec.completed = completed;
    lec.completedAt = completed ? new Date().toISOString() : null;

    // Also update daily schedule tasks that reference this lecture
    for (const day of db.schedule) {
      for (const task of day.tasks) {
        if (Array.isArray(task.lectureIds) && task.lectureIds.includes(lectureId)) {
          const allDone = task.lectureIds.every((id) => {
            const item = db.lectures.find((x) => x.id === id);
            return item && item.completed;
          });
          task.completed = allDone;
        }
      }
    }
  }

  if (typeof notes === 'string') lec.notes = notes;
  if (typeof source === 'string') lec.source = source;

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// PATCH /api/subjects/:subjectId -> switch batch source (PW 2027 Batch vs PW 2026 YouTube)
app.patch('/api/subjects/:subjectId', (req, res) => {
  const { subjectId } = req.params;
  const { batch2027Available, preferredSource } = req.body;
  const sub = db.subjects.find((s) => s.id === subjectId);
  if (!sub) {
    return res.status(404).json({ error: 'Subject not found' });
  }

  if (typeof batch2027Available === 'boolean') {
    sub.batch2027Available = batch2027Available;
    const newSource = batch2027Available ? 'PW 2027 Batch' : 'PW 2026 YouTube';
    sub.recommendedSource = batch2027Available
      ? `PW 2027 Batch (${sub.name})`
      : 'PW 2026 YouTube Batch (Fallback Active)';
    for (const lec of db.lectures) {
      if (lec.subjectId === subjectId) {
        lec.source = newSource;
      }
    }
  }

  if (preferredSource) {
    sub.recommendedSource = preferredSource;
  }

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// PATCH /api/tests/:testId -> update test completion, score, accuracy, notes
app.patch('/api/tests/:testId', (req, res) => {
  const { testId } = req.params;
  const { completed, score, accuracy, notes } = req.body;
  const testObj = db.tests.find((t) => t.id === testId);
  if (!testObj) {
    return res.status(404).json({ error: 'Test not found' });
  }

  if (typeof completed === 'boolean') {
    testObj.completed = completed;
    for (const day of db.schedule) {
      for (const task of day.tasks) {
        if (task.testId === testId) {
          task.completed = completed;
        }
      }
    }
  }

  if (score !== undefined) testObj.score = score === '' || score === null ? null : Number(score);
  if (accuracy !== undefined) testObj.accuracy = accuracy === '' || accuracy === null ? null : Number(accuracy);
  if (typeof notes === 'string') testObj.notes = notes;

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// PATCH /api/fde/:moduleId -> update Ed Donner FDE Udemy module
app.patch('/api/fde/:moduleId', (req, res) => {
  const { moduleId } = req.params;
  const { completed, notes } = req.body;
  const mod = db.fdeModules.find((m) => m.id === moduleId);
  if (!mod) {
    return res.status(404).json({ error: 'FDE module not found' });
  }

  if (typeof completed === 'boolean') {
    mod.completed = completed;
    for (const day of db.schedule) {
      for (const task of day.tasks) {
        if (task.fdeModuleId === moduleId) {
          task.completed = completed;
        }
      }
    }
  }
  if (typeof notes === 'string') mod.notes = notes;

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/flashcards/:cardId/review -> SM-2 Spaced Repetition Update
app.post('/api/flashcards/:cardId/review', (req, res) => {
  const { cardId } = req.params;
  const { rating, currentDate } = req.body; // 'again' | 'hard' | 'good' | 'easy'
  const card = db.flashcards.find((c) => c.id === cardId);
  if (!card) {
    return res.status(404).json({ error: 'Flashcard not found' });
  }

  const baseDate = currentDate || '2026-11-10';
  let { interval, easeFactor, repetitions } = card;

  if (rating === 'again') {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 'hard') {
    repetitions += 1;
    interval = Math.max(2, Math.round(interval * 1.2));
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 'good') {
    repetitions += 1;
    interval = repetitions === 1 ? 3 : repetitions === 2 ? 7 : Math.round(interval * easeFactor);
  } else if (rating === 'easy') {
    repetitions += 1;
    interval = repetitions === 1 ? 5 : repetitions === 2 ? 12 : Math.round(interval * easeFactor * 1.3);
    easeFactor += 0.15;
  }

  card.interval = interval;
  card.easeFactor = Number(easeFactor.toFixed(2));
  card.repetitions = repetitions;
  card.nextReviewDate = addDays(baseDate, interval);
  card.lastReviewedAt = new Date().toISOString();

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/flashcards -> create custom flashcard
app.post('/api/flashcards', (req, res) => {
  const { subjectId, front, back } = req.body;
  const sub = db.subjects.find((s) => s.id === subjectId) || db.subjects[0];
  const newCard = {
    id: `fc-custom-${Date.now()}`,
    subjectId: sub.id,
    subjectCode: sub.code,
    front: front || 'New GATE Concept / Formula',
    back: back || 'Explanation / Formula Details',
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewDate: '2026-11-10'
  };
  db.flashcards.unshift(newCard);
  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/pomodoro/log -> record completed timer session
app.post('/api/pomodoro/log', (req, res) => {
  const { mode, durationMinutes, label } = req.body;
  db.pomodoroLogs.unshift({
    id: `pomo-${Date.now()}`,
    mode: mode || 'focus',
    durationMinutes: Number(durationMinutes) || 45,
    label: label || 'GATE Deep Study Session',
    completedAt: new Date().toISOString()
  });
  saveDb(db);
  res.json(buildEnrichedState(db));
});

// PATCH /api/settings -> update playback speed, work hours, or regenerate schedule
app.patch('/api/settings', (req, res) => {
  const { playbackSpeed, weekdayWorkEndTime, lateNightPushEnabled, regenerate } = req.body;
  if (playbackSpeed !== undefined) db.settings.playbackSpeed = Number(playbackSpeed);
  if (weekdayWorkEndTime !== undefined) db.settings.weekdayWorkEndTime = weekdayWorkEndTime;
  if (typeof lateNightPushEnabled === 'boolean') db.settings.lateNightPushEnabled = lateNightPushEnabled;

  if (regenerate) {
    const { days, subjectCompletionDates } = generateFullSchedule({
      subjects: db.subjects,
      lectures: db.lectures,
      tests: db.tests,
      fdeModules: db.fdeModules,
      settings: db.settings
    });
    db.schedule = days;
    for (const sub of db.subjects) {
      sub.targetCompletionDate = subjectCompletionDates[sub.id] || db.settings.bufferStartDate;
    }
  }

  saveDb(db);
  res.json(buildEnrichedState(db));
});

// POST /api/reset -> reset to fresh seed state
app.post('/api/reset', (req, res) => {
  db = createInitialDatabase();
  saveDb(db);
  res.json(buildEnrichedState(db));
});

// Serve Frontend Static Assets
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GATE 2027 Study Companion Server running on http://localhost:${PORT}`);
});
