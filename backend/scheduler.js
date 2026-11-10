// Intelligent Day-by-Day Study & Test Series Scheduler (Nov 10, 2026 -> Feb 6, 2027)
// Coordinates:
// 1) 164 PW Video Lectures across 11 GATE ECE Subjects (watched at 2x-3x speed)
// 2) All 56 PW GATE 2027 ECE Tests (21 TWT, 10 SWT, 8 MST, 5 PYQ, 12 GBG)
// 3) 22 Modules (21.5 hrs) of Ed Donner's FDE Udemy Course
// 4) Automated Spaced Repetition Refreshes (+3d, +7d, +14d, +25d after subject completion)
// 5) Anti-Burnout Gaming / Recharge Blocks + 12 AM - 1:30 AM Late-Night Flex Slots
// 6) Exactly 2.5 to 3 Weeks (19-20 Days) Buffer Window before Feb 6, 2027 GATE Exam

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getUTCDay(); // 0 = Sun, 6 = Sat
}

function formatDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[getDayOfWeek(dateStr)];
}

function generateFullSchedule({ subjects, lectures, tests, fdeModules, settings }) {
  const startDate = settings.startDate || '2026-11-10';
  const examDate = settings.examDate || '2027-02-06';
  const playbackSpeed = Number(settings.playbackSpeed) || 2.25;

  // Clone queues of unscheduled items in order
  const lectureQueue = [...lectures];
  const fdeQueue = [...fdeModules];

  // Track lecture progress per subject as we schedule them day by day
  const scheduledLecturesBySubject = {};
  const subjectCompletionDates = {};
  for (const sub of subjects) {
    scheduledLecturesBySubject[sub.id] = 0;
  }

  // Track which tests have been scheduled
  const scheduledTestIds = new Set();

  // Helper to check if a test's lecture prerequisites are met
  function isTestUnlocked(test) {
    if (scheduledTestIds.has(test.id)) return false;
    const reqs = test.unlockAfterLecture || {};
    const reqKeys = Object.keys(reqs);
    if (reqKeys.length === 0) return false; // PYQ & GBG handled separately
    for (const subId of reqKeys) {
      if ((scheduledLecturesBySubject[subId] || 0) < reqs[subId]) {
        return false;
      }
    }
    return true;
  }

  // Queue of unlocked TWT, SWT, MST tests ready to be taken
  const readyTwtQueue = [];
  const readySwtMstQueue = [];

  function checkAndEnqueueUnlockedTests() {
    for (const t of tests) {
      if (scheduledTestIds.has(t.id)) continue;
      if (t.category === 'TWT' && isTestUnlocked(t)) {
        if (!readyTwtQueue.find((x) => x.id === t.id)) {
          readyTwtQueue.push(t);
        }
      } else if ((t.category === 'SWT' || t.category === 'MST') && isTestUnlocked(t)) {
        if (!readySwtMstQueue.find((x) => x.id === t.id)) {
          readySwtMstQueue.push(t);
        }
      }
    }
  }

  // Separate queues for PYQ (5 tests) and GBG (12 full-length mocks)
  const pyqQueue = tests.filter((t) => t.category === 'PYQ');
  const gbgQueue = tests.filter((t) => t.category === 'GBG');

  // Spaced repetition events map: dateStr -> array of review objects
  const spacedRepetitionByDate = {};
  function scheduleSpacedReviewsForSubject(subject, completionDateStr) {
    const intervals = [
      { days: 3, label: 'Day +3 Active Recall Quiz & Formula Flashcards' },
      { days: 7, label: 'Day +7 Spaced Repetition Quiz & Rapid Drill' },
      { days: 14, label: 'Day +14 Memory Consolidation Flashcards & PYQ Sprint' },
      { days: 25, label: 'Day +25 Long-Term Retention Quiz & Mistake Review' }
    ];
    for (const item of intervals) {
      const targetDate = addDays(completionDateStr, item.days);
      if (targetDate < examDate) {
        if (!spacedRepetitionByDate[targetDate]) {
          spacedRepetitionByDate[targetDate] = [];
        }
        spacedRepetitionByDate[targetDate].push({
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          intervalDays: item.days,
          label: item.label
        });
      }
    }
  }

  const daysList = [];
  let cursorDate = startDate;
  let dayNumber = 1;
  const completedSubjectsList = [];

  while (cursorDate <= examDate) {
    const dow = getDayOfWeek(cursorDate);
    const isWeekend = dow === 0 || dow === 6;
    const isExamDay = cursorDate === examDate;
    const isBufferPhase = lectureQueue.length === 0 && cursorDate < examDate;

    const tasks = [];

    if (isExamDay) {
      tasks.push({
        id: `day-${dayNumber}-exam`,
        date: cursorDate,
        startTime: '09:00',
        endTime: '17:30',
        type: 'exam',
        title: 'GATE 2027 ECE Exam Day (1st Session)',
        subtitle: 'Trust your 87 days of preparation, stay calm, and conquer GATE!',
        durationMinutes: 180,
        completed: false,
        priority: 'critical'
      });
      daysList.push({
        dayNumber,
        date: cursorDate,
        dayName: formatDayName(cursorDate),
        isWeekend,
        phase: 'GATE Exam Day',
        burnoutRisk: 'Low',
        tasks
      });
      break;
    }

    // Helper to pop next lecture and update subject progress
    function popNextLecture() {
      if (lectureQueue.length === 0) return null;
      const lec = lectureQueue.shift();
      scheduledLecturesBySubject[lec.subjectId] =
        (scheduledLecturesBySubject[lec.subjectId] || 0) + 1;
      const subj = subjects.find((s) => s.id === lec.subjectId);
      if (subj && scheduledLecturesBySubject[subj.id] === subj.totalLectures) {
        subjectCompletionDates[subj.id] = cursorDate;
        completedSubjectsList.push(subj);
        scheduleSpacedReviewsForSubject(subj, cursorDate);
      }
      checkAndEnqueueUnlockedTests();
      return lec;
    }

    // Helper to get spaced repetition subject for today
    function getSpacedRepetitionTask(startTime, endTime, durationMinutes, slotIdx) {
      const dueList = spacedRepetitionByDate[cursorDate] || [];
      if (dueList.length > 0) {
        const sr = dueList.shift();
        return {
          id: `day-${dayNumber}-sr-${slotIdx}`,
          date: cursorDate,
          startTime,
          endTime,
          type: 'revision',
          subjectId: sr.subjectId,
          subjectCode: sr.subjectCode,
          title: `Spaced Repetition: ${sr.subjectName} (${sr.label})`,
          subtitle: 'Take a 5-question Active Recall Quiz + flip through high-yield Flashcards so you never forget.',
          durationMinutes,
          completed: false,
          priority: 'high'
        };
      }
      const pool = completedSubjectsList.length > 0 ? completedSubjectsList : [subjects[0]];
      const picked = pool[(dayNumber + slotIdx) % pool.length];
      return {
        id: `day-${dayNumber}-sr-${slotIdx}`,
        date: cursorDate,
        startTime,
        endTime,
        type: 'revision',
        subjectId: picked.id,
        subjectCode: picked.code,
        title: `Active Recall Flashcards & Quiz: ${picked.name}`,
        subtitle: 'Spaced repetition refresh of formulas, theorems, and mistake log.',
        durationMinutes,
        completed: false,
        priority: 'medium'
      };
    }

    if (!isWeekend) {
      // ==================== WEEKDAY SCHEDULE (18:30 - 00:00 + 00:00-01:30 Flex) ====================
      // Anti-burnout weekday pacing:
      // Mon, Tue, Thu, Fri -> 2 PW Lectures in Slot 1 (19:00-20:40)
      // Wed -> 1 PW Lecture + DPP Problem Solving (Mid-Week Breather so you never burn out!)
      if (lectureQueue.length > 0) {
        const isMidWeekLight = dow === 3; // Wednesday
        const l1 = popNextLecture();
        const l2 = isMidWeekLight ? null : popNextLecture();
        const bundled = [l1, l2].filter(Boolean);
        const rawMins = bundled.reduce((acc, x) => acc + x.rawDurationMinutes, 0);
        const effectiveMins = Math.round(rawMins / playbackSpeed);
        tasks.push({
          id: `day-${dayNumber}-slot-1`,
          date: cursorDate,
          startTime: '19:00',
          endTime: '20:40',
          type: 'lecture',
          subjectId: bundled[0].subjectId,
          subjectCode: bundled[0].subjectCode,
          lectureIds: bundled.map((x) => x.id),
          title:
            bundled.length === 2
              ? `${bundled[0].subjectName}: Lec ${bundled[0].lectureNumber} & Lec ${bundled[1].lectureNumber}`
              : `${bundled[0].subjectName}: ${bundled[0].title} + Practice Problems`,
          subtitle: `${bundled.map((x) => x.title).join(' + ')} • Source: ${bundled[0].source} • Watched at ${playbackSpeed}x (${rawMins}m raw → ~${effectiveMins}m + notes)`,
          durationMinutes: 100,
          completed: false,
          priority: 'high'
        });
      } else if (readySwtMstQueue.length > 0) {
        const t = readySwtMstQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-test-main`,
          date: cursorDate,
          startTime: '19:00',
          endTime: '20:40',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `${t.categoryName} (${t.durationMinutes}m test + error analysis) • Syllabus: ${t.syllabus}`,
          durationMinutes: 100,
          completed: false,
          priority: 'critical'
        });
      } else if (gbgQueue.length > 0 && (dow === 2 || dow === 4)) {
        const t = gbgQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-gbg`,
          date: cursorDate,
          startTime: '19:00',
          endTime: '22:00',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Full-Length 3-Hour GATE Mock Exam in 3-Week Buffer Window • ${t.syllabus}`,
          durationMinutes: 180,
          completed: false,
          priority: 'critical'
        });
      } else if (pyqQueue.length > 0) {
        const t = pyqQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-pyq`,
          date: cursorDate,
          startTime: '19:00',
          endTime: '22:00',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Full Previous Year GATE Paper Simulation • ${t.syllabus}`,
          durationMinutes: 180,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('19:00', '20:40', 100, 1));
      }

      // Slot 2: 20:40 - 21:05 (25 mins) -> Spaced Repetition Flashcard / Quiz Refresh
      tasks.push(getSpacedRepetitionTask('20:40', '21:05', 25, 2));

      // Slot 3: 21:05 - 21:50 (45 mins) -> Guilt-Free Gaming & Anti-Burnout Break
      tasks.push({
        id: `day-${dayNumber}-gaming`,
        date: cursorDate,
        startTime: '21:05',
        endTime: '21:50',
        type: 'gaming',
        title: '🎮 Guilt-Free Gaming & Recharge Break (45m)',
        subtitle: 'Play a game, relax your mind, and reset dopamine so you stay consistent for 87 days without burnout.',
        durationMinutes: 45,
        completed: false,
        priority: 'normal'
      });

      // Slot 4: 21:50 - 22:50 (60 mins) -> Priority 1: Unlocked TWT Test | Priority 2: Unlocked SWT/MST | Priority 3: Spaced Practice
      if (readyTwtQueue.length > 0) {
        const t = readyTwtQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-twt`,
          date: cursorDate,
          startTime: '21:50',
          endTime: '22:50',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Topicwise Test (${t.durationMinutes}m + 15m analysis) • ${t.syllabus}`,
          durationMinutes: 60,
          completed: false,
          priority: 'critical'
        });
      } else if (readySwtMstQueue.length > 0 && dow === 3) {
        const t = readySwtMstQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-swt-wk`,
          date: cursorDate,
          startTime: '21:50',
          endTime: '23:20',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `${t.categoryName} (90m) • ${t.syllabus}`,
          durationMinutes: 90,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('21:50', '22:50', 60, 4));
      }

      // Slot 5: 22:50 - 23:50 (60 mins) -> Ed Donner FDE Udemy Course (Tue/Thu) OR Formula/PYQ Drill
      if (fdeQueue.length > 0 && (dow === 2 || dow === 4) && dayNumber % 3 !== 0) {
        const fde = fdeQueue.shift();
        tasks.push({
          id: `day-${dayNumber}-fde`,
          date: cursorDate,
          startTime: '22:50',
          endTime: '23:50',
          type: 'fde',
          fdeModuleId: fde.id,
          title: `Udemy FDE Course (Ed Donner): Mod ${fde.moduleNumber} - ${fde.title}`,
          subtitle: `${fde.section} (${fde.durationMinutes} mins hands-on coding & LLM engineering)`,
          durationMinutes: fde.durationMinutes,
          completed: false,
          priority: 'medium'
        });
      } else {
        tasks.push({
          id: `day-${dayNumber}-wrap`,
          date: cursorDate,
          startTime: '22:50',
          endTime: '23:45',
          type: 'revision',
          title: 'Short Notes Consolidation & Mistake Notebook Review',
          subtitle: 'Summarize today\'s key formulas & review marked test questions before bed at 12:00 AM.',
          durationMinutes: 55,
          completed: false,
          priority: 'medium'
        });
      }

      // Optional Slot 6: 00:00 - 01:30 -> Late-Night Push Flex Window
      tasks.push({
        id: `day-${dayNumber}-flex`,
        date: cursorDate,
        startTime: '00:00',
        endTime: '01:30',
        type: 'flex',
        title: '🌙 Optional Late-Night Push Window (12:00 AM – 1:30 AM)',
        subtitle: 'Only use if work ran late or an evening task is unfinished. Prioritize 7h sleep whenever on track!',
        durationMinutes: 90,
        completed: false,
        isOptionalFlex: true,
        priority: 'low'
      });
    } else {
      // ==================== WEEKEND SCHEDULE (ALL DAY FREE: 09:00 - 00:00) ====================
      // Weekend Slot 1: 09:00 - 11:30 (150 mins) -> Sat: 3 PW Lectures, Sun: 2 PW Lectures at 2.25x OR Full-Length GBG/PYQ Mock in Buffer Phase
      if (lectureQueue.length > 0) {
        const l1 = popNextLecture();
        const l2 = popNextLecture();
        const l3 = dow === 6 ? popNextLecture() : null;
        const bundled = [l1, l2, l3].filter(Boolean);
        const rawMins = bundled.reduce((acc, x) => acc + x.rawDurationMinutes, 0);
        const effectiveMins = Math.round(rawMins / playbackSpeed);
        tasks.push({
          id: `day-${dayNumber}-wk-1`,
          date: cursorDate,
          startTime: '09:00',
          endTime: '11:30',
          type: 'lecture',
          subjectId: bundled[0].subjectId,
          subjectCode: bundled[0].subjectCode,
          lectureIds: bundled.map((x) => x.id),
          title: `${bundled[0].subjectName}: Morning Deep Block (${bundled.length} Lectures)`,
          subtitle: `${bundled.map((x) => `Lec ${x.lectureNumber}`).join(', ')} • Source: ${bundled[0].source} • At ${playbackSpeed}x (${rawMins}m raw → ~${effectiveMins}m + notes)`,
          durationMinutes: 150,
          completed: false,
          priority: 'high'
        });
      } else if (gbgQueue.length > 0) {
        const t = gbgQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-wk-gbg`,
          date: cursorDate,
          startTime: '09:00',
          endTime: '12:00',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Full 3-Hour GATE Simulation in exact morning exam slot (9:00 AM - 12:00 PM) • ${t.syllabus}`,
          durationMinutes: 180,
          completed: false,
          priority: 'critical'
        });
      } else if (pyqQueue.length > 0) {
        const t = pyqQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-wk-pyq`,
          date: cursorDate,
          startTime: '09:00',
          endTime: '12:00',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Official GATE PYQ Paper in 3-Hour Exam Window • ${t.syllabus}`,
          durationMinutes: 180,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('09:00', '11:15', 135, 1));
      }

      // Weekend Slot 2: 11:45 - 13:15 (90 mins) -> Test Series Slot (SWT / MST / TWT)
      const nextWeekendTest =
        readySwtMstQueue.shift() || readyTwtQueue.shift() || (isBufferPhase ? (gbgQueue.shift() || pyqQueue.shift()) : null);
      if (nextWeekendTest) {
        scheduledTestIds.add(nextWeekendTest.id);
        nextWeekendTest.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-wk-test-1`,
          date: cursorDate,
          startTime: '11:45',
          endTime: '13:15',
          type: 'test',
          testId: nextWeekendTest.id,
          testCategory: nextWeekendTest.category,
          title: `${nextWeekendTest.code}: ${nextWeekendTest.subjectLabel}`,
          subtitle: `${nextWeekendTest.categoryName} • ${nextWeekendTest.syllabus}`,
          durationMinutes: 90,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('11:45', '13:15', 90, 2));
      }

      // Weekend Slot 3: 14:45 - 16:15 (90 mins) -> Ed Donner FDE Udemy Course (After Lunch & Nap 13:15-14:45)
      if (fdeQueue.length > 0) {
        const fde = fdeQueue.shift();
        tasks.push({
          id: `day-${dayNumber}-wk-fde`,
          date: cursorDate,
          startTime: '14:45',
          endTime: '16:15',
          type: 'fde',
          fdeModuleId: fde.id,
          title: `Udemy FDE Course (Ed Donner): Mod ${fde.moduleNumber} - ${fde.title}`,
          subtitle: `${fde.section} • Hands-on project & LLM implementation`,
          durationMinutes: 90,
          completed: false,
          priority: 'medium'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('14:45', '16:15', 90, 3));
      }

      // Weekend Slot 4: 16:15 - 17:45 (90 mins) -> Weekend Gaming & Recharge Session
      tasks.push({
        id: `day-${dayNumber}-wk-gaming`,
        date: cursorDate,
        startTime: '16:15',
        endTime: '17:45',
        type: 'gaming',
        title: '🎮 Weekend Gaming & Recharge Session (90m)',
        subtitle: 'Extended weekend gaming session to keep morale high and prevent marathon fatigue.',
        durationMinutes: 90,
        completed: false,
        priority: 'normal'
      });

      // Weekend Slot 5: 18:00 - 19:50 (110 mins) -> Sat: 2 PW Lectures, Sun: 1 PW Lecture + Problem Solving
      if (lectureQueue.length > 0) {
        const isSunday = dow === 0;
        const l3 = popNextLecture();
        const l4 = isSunday ? null : popNextLecture();
        const bundled = [l3, l4].filter(Boolean);
        const rawMins = bundled.reduce((acc, x) => acc + x.rawDurationMinutes, 0);
        const effectiveMins = Math.round(rawMins / playbackSpeed);
        tasks.push({
          id: `day-${dayNumber}-wk-5`,
          date: cursorDate,
          startTime: '18:00',
          endTime: '19:50',
          type: 'lecture',
          subjectId: bundled[0].subjectId,
          subjectCode: bundled[0].subjectCode,
          lectureIds: bundled.map((x) => x.id),
          title:
            bundled.length === 2
              ? `${bundled[0].subjectName}: Lec ${bundled[0].lectureNumber} & Lec ${bundled[1].lectureNumber}`
              : `${bundled[0].subjectName}: ${bundled[0].title} + PYQ Drill`,
          subtitle: `${bundled.map((x) => x.title).join(' + ')} • Source: ${bundled[0].source} • At ${playbackSpeed}x (${rawMins}m raw → ~${effectiveMins}m)`,
          durationMinutes: 110,
          completed: false,
          priority: 'high'
        });
      } else {
        const secondTest =
          readyTwtQueue.shift() || readySwtMstQueue.shift() || pyqQueue.shift() || gbgQueue.shift();
        if (secondTest) {
          scheduledTestIds.add(secondTest.id);
          secondTest.scheduledDate = cursorDate;
          tasks.push({
            id: `day-${dayNumber}-wk-test-2`,
            date: cursorDate,
            startTime: '18:00',
            endTime: '19:50',
            type: 'test',
            testId: secondTest.id,
            testCategory: secondTest.category,
            title: `${secondTest.code}: ${secondTest.subjectLabel}`,
            subtitle: `${secondTest.categoryName} • ${secondTest.syllabus}`,
            durationMinutes: 110,
            completed: false,
            priority: 'critical'
          });
        } else {
          tasks.push(getSpacedRepetitionTask('18:00', '19:50', 110, 5));
        }
      }

      // Weekend Slot 6: 20:45 - 22:00 (75 mins) -> Spaced Repetition Quiz & Flashcards OR Ready TWT
      if (readyTwtQueue.length > 0) {
        const t = readyTwtQueue.shift();
        scheduledTestIds.add(t.id);
        t.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-wk-twt-eve`,
          date: cursorDate,
          startTime: '20:45',
          endTime: '22:00',
          type: 'test',
          testId: t.id,
          testCategory: t.category,
          title: `${t.code}: ${t.subjectLabel}`,
          subtitle: `Topicwise Test (${t.durationMinutes}m + 30m analysis) • ${t.syllabus}`,
          durationMinutes: 75,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push(getSpacedRepetitionTask('20:45', '22:00', 75, 6));
      }

      // Weekend Slot 7: 22:00 - 23:30 (90 mins) -> Weekly Review / Extra Test / Mistake Log
      const extraTest = readySwtMstQueue.shift();
      if (extraTest) {
        scheduledTestIds.add(extraTest.id);
        extraTest.scheduledDate = cursorDate;
        tasks.push({
          id: `day-${dayNumber}-wk-extra-test`,
          date: cursorDate,
          startTime: '22:00',
          endTime: '23:30',
          type: 'test',
          testId: extraTest.id,
          testCategory: extraTest.category,
          title: `${extraTest.code}: ${extraTest.subjectLabel}`,
          subtitle: `${extraTest.categoryName} • ${extraTest.syllabus}`,
          durationMinutes: 90,
          completed: false,
          priority: 'critical'
        });
      } else {
        tasks.push({
          id: `day-${dayNumber}-wk-review`,
          date: cursorDate,
          startTime: '22:00',
          endTime: '23:30',
          type: 'revision',
          title: 'Weekly Test Error Log & Formula Sheet Consolidation',
          subtitle: 'Re-solve incorrect test questions from this week and update 1-page subject formula sheets.',
          durationMinutes: 90,
          completed: false,
          priority: 'medium'
        });
      }
    }

    const phaseLabel = isBufferPhase
      ? 'Phase 2: 3-Week Buffer, Full-Length Mocks (GBG) & Final Revision'
      : 'Phase 1: Core Syllabus (2.25x PW Lectures) + TWT/SWT/MST + Udemy FDE';

    daysList.push({
      dayNumber,
      date: cursorDate,
      dayName: formatDayName(cursorDate),
      isWeekend,
      phase: phaseLabel,
      burnoutRisk: isWeekend ? 'Balanced (90m Gaming + Breaks)' : 'Low (45m Gaming + 12 AM Bedtime)',
      tasks
    });

    cursorDate = addDays(cursorDate, 1);
    dayNumber++;
  }

  // Ensure any remaining unscheduled tests are placed cleanly into buffer days
  const remainingTests = tests.filter((t) => !scheduledTestIds.has(t.id));
  if (remainingTests.length > 0) {
    const bufferDays = daysList.filter((d) => d.phase.startsWith('Phase 2'));
    let bIdx = 0;
    for (const remTest of remainingTests) {
      const targetDay = bufferDays[bIdx % Math.max(1, bufferDays.length)] || daysList[daysList.length - 2];
      if (targetDay) {
        remTest.scheduledDate = targetDay.date;
        scheduledTestIds.add(remTest.id);
        targetDay.tasks.unshift({
          id: `day-${targetDay.dayNumber}-forced-${remTest.id}`,
          date: targetDay.date,
          startTime: targetDay.isWeekend ? '13:30' : '21:50',
          endTime: targetDay.isWeekend ? '16:15' : '23:45',
          type: 'test',
          testId: remTest.id,
          testCategory: remTest.category,
          title: `${remTest.code}: ${remTest.subjectLabel}`,
          subtitle: `${remTest.categoryName} • ${remTest.syllabus}`,
          durationMinutes: remTest.durationMinutes,
          completed: false,
          priority: 'critical'
        });
        bIdx++;
      }
    }
  }

  return {
    days: daysList,
    subjectCompletionDates
  };
}

module.exports = {
  generateFullSchedule,
  addDays
};
