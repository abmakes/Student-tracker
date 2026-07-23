import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildCsv,
  buildOlderLmsRows,
  buildSessionReport,
  buildStudentsFromNames,
  clamp,
  computeReward,
  cycleQuality,
  cycleRange,
  defaultHomework,
  defaultSkillsOlder,
  ensureHomework,
  ensureSkillsOlder,
  formatReward,
  isOlderClass,
  lmsLabel,
  lmsLevelToStep,
  LMS_LABELS,
  makeStudent,
  OLDER_RANGE_KEYS,
  presentStudents,
  prepareRosterForUse,
  QUALITY_LABELS,
  rangeToLevel,
  resetRosterForNextClass,
  SKILL_DEFS,
  STAR_MILESTONE,
  stepLmsScore,
  stepQuality,
  stepRange,
  STUDENT_PALETTE,
  todayISO,
  uid,
} from './model';
import {
  appendReport,
  clearActiveClassId,
  deleteClassData,
  loadActiveClassId,
  loadClassesIndex,
  loadRoster,
  loadTheme,
  saveActiveClassId,
  saveClassesIndex,
  saveRoster,
  saveTheme,
} from './storage';
import './styles.css';

const EMPTY_FORM = { className: '', studentNames: '', ageGroup: 'kindergarten' };

function cloneRoster(roster) {
  return roster ? structuredClone(roster) : null;
}

function studentPillVars(student) {
  const color = STUDENT_PALETTE[((student.colorIndex || 0) % STUDENT_PALETTE.length + STUDENT_PALETTE.length) % STUDENT_PALETTE.length];
  return { '--pill-bg': color.bg, '--pill-ink': color.ink };
}

function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('home');
  const [theme, setTheme] = useState('light');
  const [classesIndex, setClassesIndex] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingClassId, setEditingClassId] = useState(null);
  const [managingRoster, setManagingRoster] = useState(null);
  const [manageMode, setManageMode] = useState('edit');
  const [currentClass, setCurrentClass] = useState(null);
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [skillsBulkOpen, setSkillsBulkOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(true);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [lmsReport, setLmsReport] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let active = true;
    async function boot() {
      const [savedTheme, savedIndex, activeClassId] = await Promise.all([loadTheme(), loadClassesIndex(), loadActiveClassId()]);
      if (!active) return;
      setTheme(savedTheme === 'dark' ? 'dark' : 'light');
      setClassesIndex(savedIndex);
      if (activeClassId) {
        const roster = prepareRosterForUse(await loadRoster(activeClassId));
        if (roster) {
          setCurrentClass(roster);
        } else {
          await clearActiveClassId();
        }
      }
      setReady(true);
    }
    boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
      });
    }
  }, []);

  function showToast(message) {
    setToast(message);
  }

  async function persistCurrent(nextClass = currentClass) {
    if (!nextClass) return;
    prepareRosterForUse(nextClass);
    await saveRoster(nextClass.id, nextClass);
    await saveActiveClassId(nextClass.id);
  }

  async function persistManaged(nextRoster = managingRoster) {
    if (!nextRoster) return;
    prepareRosterForUse(nextRoster);
    await saveRoster(nextRoster.id, nextRoster);
    const nextIndex = classesIndex.map((entry) =>
      entry.id === nextRoster.id ? { ...entry, className: nextRoster.className, ageGroup: nextRoster.ageGroup, studentCount: nextRoster.students.length } : entry,
    );
    setClassesIndex(nextIndex);
    await saveClassesIndex(nextIndex);
    if (currentClass?.id === nextRoster.id) setCurrentClass(nextRoster);
  }

  async function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await saveTheme(next);
  }

  async function startTracking() {
    const className = form.className.trim();
    const rawNames = form.studentNames
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);

    if (!className) {
      showToast('Give the class a name first.');
      return;
    }
    if (rawNames.length === 0) {
      showToast('Paste at least one student name.');
      return;
    }
    if (!editingClassId && classesIndex.length >= 15) {
      showToast('15 class limit reached. Delete one first.');
      return;
    }

    const existingRoster = editingClassId ? prepareRosterForUse(await loadRoster(editingClassId)) : null;
    const id = editingClassId || uid('cls');
    const students = buildStudentsFromNames(rawNames, existingRoster);
    if (form.ageGroup === 'older') students.forEach(ensureSkillsOlder);
    const roster = prepareRosterForUse({
      id,
      className,
      ageGroup: form.ageGroup,
      students,
      negativeEnabled:
        existingRoster && typeof existingRoster.negativeEnabled === 'boolean' ? existingRoster.negativeEnabled : form.ageGroup !== 'older',
    });

    await saveRoster(id, roster);
    const nextIndex = editingClassId
      ? classesIndex.map((entry) =>
          entry.id === editingClassId
            ? {
                id,
                className,
                ageGroup: form.ageGroup,
                studentCount: students.length,
                dateCreated: entry.dateCreated || new Date().toISOString(),
              }
            : entry,
        )
      : [
          ...classesIndex,
          { id, className, ageGroup: form.ageGroup, studentCount: students.length, dateCreated: new Date().toISOString() },
        ];

    setClassesIndex(nextIndex);
    await saveClassesIndex(nextIndex);
    await saveActiveClassId(id);
    setEditingClassId(null);
    setCurrentClass(roster);
    setManagingRoster(cloneRoster(roster));
    setManageMode('start');
    setSkillsVisible(false);
    setSkillsBulkOpen(false);
    setScreen('manage');
  }

  async function loadClassIntoForm(id) {
    const roster = prepareRosterForUse(await loadRoster(id));
    if (!roster) {
      showToast('Could not load that class.');
      return;
    }
    setForm({
      className: roster.className || '',
      studentNames: roster.students.map((student) => student.name).join('\n'),
      ageGroup: roster.ageGroup === 'older' ? 'older' : 'kindergarten',
    });
    setEditingClassId(id);
    setScreen('home');
    showToast('Class loaded. Edit the roster, then start tracking.');
  }

  async function openManage(id, mode = 'edit') {
    const roster = prepareRosterForUse(await loadRoster(id));
    if (!roster) {
      showToast('Class not found.');
      return;
    }
    setManagingRoster(cloneRoster(roster));
    setManageMode(mode);
    setScreen('manage');
  }

  async function deleteClass(id) {
    const entry = classesIndex.find((item) => item.id === id);
    if (!window.confirm(`Delete "${entry?.className || 'this class'}" and all saved data? This cannot be undone.`)) return;
    const activeId = await loadActiveClassId();
    if (activeId === id) await clearActiveClassId();
    if (currentClass?.id === id) setCurrentClass(null);
    const nextIndex = classesIndex.filter((item) => item.id !== id);
    setClassesIndex(nextIndex);
    await saveClassesIndex(nextIndex);
    await deleteClassData(id);
    showToast('Class deleted.');
  }

  function resumeSession() {
    if (!currentClass) return;
    setSkillsVisible(false);
    setSkillsBulkOpen(false);
    setAchievementsOpen(true);
    setScreen('tracker');
  }

  function goHome() {
    setRewardsOpen(false);
    setTimerOpen(false);
    setScreen('home');
  }

  async function updateCurrentClass(updater) {
    if (!currentClass) return;
    const next = cloneRoster(currentClass);
    updater(next);
    prepareRosterForUse(next);
    setCurrentClass(next);
    await persistCurrent(next);
  }

  async function applyBulk(action) {
    await updateCurrentClass((cls) => {
      presentStudents(cls).forEach((student) => {
        if (action === 'neg+') student.negative = clamp(student.negative + 1, 0, 3);
        if (action === 'neg-') student.negative = clamp(student.negative - 1, 0, 3);
        if (action === 'pos+') student.positive += 1;
        if (action === 'pos-') student.positive = clamp(student.positive - 1, 0, 999999);
      });
    });
  }

  async function exportCsv() {
    if (!currentClass) return;
    const blob = new Blob([buildCsv(currentClass)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_behavior_Tracker_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV exported.');
  }

  async function finishEndClass(reportClass, report) {
    const resetClass = resetRosterForNextClass(cloneRoster(reportClass));
    await appendReport(resetClass.id, report);
    await saveRoster(resetClass.id, resetClass);
    await clearActiveClassId();
    setCurrentClass(null);
    setLmsReport(null);
    setRewardsOpen(false);
    setTimerOpen(false);
    setScreen('home');
    showToast('Session archived. Fresh start for next class!');
  }

  async function endClass() {
    if (!currentClass) return;
    if (!window.confirm("End this class session? Today's scores will be saved to history and reset to zero for next time.")) return;
    const snapshot = cloneRoster(currentClass);
    const report = buildSessionReport(snapshot);
    if (isOlderClass(snapshot)) {
      setLmsReport({ rows: buildOlderLmsRows(snapshot), report, cls: snapshot });
      return;
    }
    await finishEndClass(snapshot, report);
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="sun-loader">☀️</div>
        <p>Opening classroom...</p>
      </main>
    );
  }

  return (
    <>
      {screen === 'home' && (
        <HomeScreen
          classesIndex={classesIndex}
          currentClass={currentClass}
          editingClassId={editingClassId}
          form={form}
          setForm={setForm}
          onStart={startTracking}
          onLoadClass={loadClassIntoForm}
          onManage={openManage}
          onDelete={deleteClass}
          onResume={resumeSession}
          onTheme={toggleTheme}
          theme={theme}
        />
      )}
      {screen === 'manage' && managingRoster && (
        <ManageScreen
          roster={managingRoster}
          mode={manageMode}
          onRosterChange={async (nextRoster) => {
            setManagingRoster(nextRoster);
            await persistManaged(nextRoster);
          }}
          onBack={() => {
            setManagingRoster(null);
            setScreen('home');
          }}
          onContinue={async () => {
            await persistManaged(managingRoster);
            setCurrentClass(managingRoster);
            await saveActiveClassId(managingRoster.id);
            setManagingRoster(null);
            setSkillsVisible(false);
            setSkillsBulkOpen(false);
            setScreen('tracker');
          }}
          showToast={showToast}
        />
      )}
      {screen === 'tracker' && currentClass && (
        <TrackerScreen
          cls={currentClass}
          theme={theme}
          skillsVisible={skillsVisible}
          setSkillsVisible={setSkillsVisible}
          skillsBulkOpen={skillsBulkOpen}
          setSkillsBulkOpen={setSkillsBulkOpen}
          achievementsOpen={achievementsOpen}
          setAchievementsOpen={setAchievementsOpen}
          onBack={goHome}
          onTheme={toggleTheme}
          onBulk={applyBulk}
          onExport={exportCsv}
          onRewards={() => setRewardsOpen(true)}
          onTimer={() => setTimerOpen(true)}
          onEndClass={endClass}
          updateCurrentClass={updateCurrentClass}
        />
      )}
      {rewardsOpen && currentClass && <RewardsModal cls={currentClass} onClose={() => setRewardsOpen(false)} />}
      {timerOpen && <TimerOverlay onClose={() => setTimerOpen(false)} showToast={showToast} />}
      {lmsReport && (
        <LmsReportModal
          rows={lmsReport.rows}
          onFinish={() => finishEndClass(lmsReport.cls, lmsReport.report)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function HomeScreen({
  classesIndex,
  currentClass,
  editingClassId,
  form,
  setForm,
  onStart,
  onLoadClass,
  onManage,
  onDelete,
  onResume,
  onTheme,
  theme,
}) {
  const atLimit = classesIndex.length >= 15 && !editingClassId;
  return (
    <main className="home-screen">
      <section className="home-shell">
        <header className="home-hero card">
          <div className="hero-orbit" aria-hidden="true">
            ☀️
          </div>
          <div>
            <p className="eyebrow">Sunny classroom dashboard</p>
            <h1>Student Class Tracker</h1>
            <p className="hero-copy">Tap-friendly behavior, homework, skills, rewards, and end-of-class reports.</p>
          </div>
          <button className="theme-toggle" type="button" onClick={onTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>

        {currentClass && (
          <button className="primary-btn resume-btn" type="button" onClick={onResume}>
            Resume active session: {currentClass.className}
          </button>
        )}

        <section className="card form-card">
          <div className="field-block">
            <label htmlFor="classNameInput">Class name</label>
            <input
              id="classNameInput"
              type="text"
              maxLength={60}
              placeholder="e.g. Kindergarten - Section A"
              value={form.className}
              onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
            />
          </div>
          <div className="field-block">
            <label htmlFor="studentNamesInput">Student names (one per line)</label>
            <textarea
              id="studentNamesInput"
              placeholder={'Alex Johnson\nBen Smith\nChloe Davis'}
              value={form.studentNames}
              onChange={(event) => setForm((current) => ({ ...current, studentNames: event.target.value }))}
            />
          </div>
          <div className="field-block">
            <label>Age bracket</label>
            <div className="age-toggle">
              <button
                className={form.ageGroup === 'kindergarten' ? 'selected' : ''}
                type="button"
                onClick={() => setForm((current) => ({ ...current, ageGroup: 'kindergarten' }))}
              >
                🧸 Kindergarten
              </button>
              <button
                className={form.ageGroup === 'older' ? 'selected' : ''}
                type="button"
                onClick={() => setForm((current) => ({ ...current, ageGroup: 'older' }))}
              >
                🎒 Older Class
              </button>
            </div>
          </div>
          <button className="primary-btn" type="button" disabled={atLimit} onClick={onStart}>
            {editingClassId ? 'Update & Start Tracking' : 'Start Tracking'}
          </button>
          {atLimit && <p className="limit-note">You have reached the 15 saved class limit. Delete one below to add a new class.</p>}
        </section>

        <section className="saved-section">
          <div className="section-heading">
            <span>📚 Saved Classes</span>
            <small>{classesIndex.length}/15</small>
          </div>
          {classesIndex.length === 0 ? (
            <div className="empty-state card">No saved classes yet. Add names above to start your first session.</div>
          ) : (
            <div className="saved-grid">
              {classesIndex.map((entry) => (
                <article className="class-card card" key={entry.id}>
                  <button className="delete-chip" type="button" onClick={() => onDelete(entry.id)} aria-label={`Delete ${entry.className}`}>
                    ×
                  </button>
                  <button className="class-open" type="button" onClick={() => onLoadClass(entry.id)}>
                    <span className="class-emoji">{entry.ageGroup === 'older' ? '🎒' : '🧸'}</span>
                    <span>
                      <strong>{entry.className}</strong>
                      <small>{entry.studentCount} students</small>
                    </span>
                  </button>
                  <button className="secondary-btn compact" type="button" onClick={() => onManage(entry.id, 'edit')}>
                    Manage
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function ManageScreen({ roster, mode, onRosterChange, onBack, onContinue, showToast }) {
  const isStart = mode === 'start';

  function updateStudent(studentId, updater) {
    const next = cloneRoster(roster);
    const student = next.students.find((item) => item.id === studentId);
    if (!student) return;
    updater(student);
    onRosterChange(next);
  }

  function addStudent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('studentName') || '').trim();
    if (!name) {
      showToast('Enter a student name.');
      return;
    }
    const next = cloneRoster(roster);
    next.students.push(makeStudent(name, next.students.length));
    event.currentTarget.reset();
    onRosterChange(next);
    showToast(`${name} added.`);
  }

  function removeStudent(studentId) {
    const student = roster.students.find((item) => item.id === studentId);
    if (!student || !window.confirm(`Permanently remove ${student.name} from this class?`)) return;
    const next = cloneRoster(roster);
    next.students = next.students.filter((item) => item.id !== studentId);
    onRosterChange(next);
    showToast(`${student.name} removed.`);
  }

  return (
    <main className="manage-screen">
      <header className="topbar">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="topbar-title">{isStart ? 'Start of class' : 'Manage'} · {roster.className}</div>
        <span className="topbar-spacer" />
      </header>
      {isStart && <p className="manage-hint">Mark who is present, set homework Complete / Effort / Quality, then continue.</p>}
      <section className="manage-table">
        {roster.students.length > 0 && (
          <div className="manage-head">
            <span>Name</span>
            <span>Present</span>
            <span>Complete</span>
            <span>Effort</span>
            <span>Quality</span>
            <span />
          </div>
        )}
        {roster.students.length === 0 ? (
          <div className="empty-state card">No students yet. Add one below.</div>
        ) : (
          roster.students.map((student) => {
            const homework = ensureHomework(student);
            return (
              <div className={`manage-row ${student.absent ? 'is-absent' : ''}`} key={student.id}>
                <div className="name-wrap">
                  <button
                    className="name-pill"
                    style={studentPillVars(student)}
                    type="button"
                    onClick={() =>
                      updateStudent(student.id, (draft) => {
                        draft.colorIndex = (draft.colorIndex + 1) % STUDENT_PALETTE.length;
                      })
                    }
                  >
                    {student.name}
                  </button>
                </div>
                <button
                  className={`cycle-chip attendance ${student.absent ? 'absent' : 'present'}`}
                  type="button"
                  onClick={() =>
                    updateStudent(student.id, (draft) => {
                      draft.absent = !draft.absent;
                    })
                  }
                >
                  {student.absent ? 'Absent' : 'Present'}
                </button>
                {['complete', 'effort', 'quality'].map((key) => (
                  <button
                    className={`cycle-chip score-${homework[key]}`}
                    type="button"
                    key={key}
                    onClick={() =>
                      updateStudent(student.id, (draft) => {
                        const hw = ensureHomework(draft);
                        hw[key] = stepLmsScore(hw[key]);
                      })
                    }
                  >
                    {lmsLabel(homework[key])}
                  </button>
                ))}
                <button className="remove-btn" type="button" onClick={() => removeStudent(student.id)}>
                  ×
                </button>
              </div>
            );
          })
        )}
        <form className="manage-add card" onSubmit={addStudent}>
          <input name="studentName" type="text" maxLength={60} placeholder="New student name" autoComplete="off" />
          <button className="secondary-btn" type="submit">Add</button>
        </form>
      </section>
      {isStart && (
        <footer className="sticky-footer">
          <button className="primary-btn" type="button" onClick={onContinue}>
            Continue to tracker
          </button>
        </footer>
      )}
    </main>
  );
}

function TrackerScreen({
  cls,
  theme,
  skillsVisible,
  setSkillsVisible,
  skillsBulkOpen,
  setSkillsBulkOpen,
  achievementsOpen,
  setAchievementsOpen,
  onBack,
  onTheme,
  onBulk,
  onExport,
  onRewards,
  onTimer,
  onEndClass,
  updateCurrentClass,
}) {
  const older = isOlderClass(cls);
  const students = presentStudents(cls);
  const showKgBehavior = !older && cls.negativeEnabled;

  async function updateStudent(studentId, updater) {
    await updateCurrentClass((draft) => {
      const student = draft.students.find((item) => item.id === studentId);
      if (student) updater(student);
    });
  }

  async function bulkSkill(key) {
    await updateCurrentClass((draft) => {
      const live = presentStudents(draft);
      const anyOff = live.some((student) => !student.skills[key]);
      live.forEach((student) => {
        student.skills[key] = anyOff;
      });
    });
  }

  async function bulkRange(key, dir) {
    if (!OLDER_RANGE_KEYS.includes(key)) return;
    await updateCurrentClass((draft) => {
      presentStudents(draft).forEach((student) => {
        const skills = ensureSkillsOlder(student);
        skills[key] = stepRange(skills[key], dir);
      });
    });
  }

  async function bulkQuality(dir) {
    await updateCurrentClass((draft) => {
      presentStudents(draft).forEach((student) => {
        const skills = ensureSkillsOlder(student);
        skills.quality = stepQuality(skills.quality, dir);
      });
    });
  }

  return (
    <main className={`tracker-screen ${older ? 'older' : 'kg'} ${skillsVisible ? 'skills-open' : ''}`}>
      <header className="topbar tracker-topbar">
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back home">
          ←
        </button>
        <div className="topbar-title">{cls.className}</div>
        <button className="icon-btn" type="button" onClick={onTheme} aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>

      <section className="bulk-ribbon">
        <div className="ribbon-group">
          {!older && cls.negativeEnabled && (
            <>
              <button className="ribbon-btn" type="button" onClick={() => onBulk('neg+')} aria-label="Add behavior mark to all">
                :( +1
              </button>
              <button className="ribbon-btn" type="button" onClick={() => onBulk('neg-')} aria-label="Remove behavior mark from all">
                :( -1
              </button>
            </>
          )}
        </div>
        <div className="ribbon-center">
          <button className={`ribbon-btn ${skillsVisible ? 'active' : ''}`} type="button" onClick={() => setSkillsVisible(!skillsVisible)}>
            Toggle Skills
          </button>
          {!older && (
            <button
              className={`ribbon-btn ${cls.negativeEnabled ? '' : 'muted'}`}
              type="button"
              onClick={() =>
                updateCurrentClass((draft) => {
                  draft.negativeEnabled = !draft.negativeEnabled;
                })
              }
            >
              Behavior: {cls.negativeEnabled ? 'On' : 'Off'}
            </button>
          )}
        </div>
        <div className="ribbon-group right">
          <button className="ribbon-btn" type="button" onClick={() => onBulk('pos+')}>
            ☆ +1
          </button>
          <button className="ribbon-btn" type="button" onClick={() => onBulk('pos-')}>
            ☆ -1
          </button>
        </div>
      </section>

      {skillsVisible && (
        <section className="accordion-panel">
          <button className="accordion-toggle" type="button" onClick={() => setSkillsBulkOpen(!skillsBulkOpen)}>
            {skillsBulkOpen ? '▾' : '▸'} Bulk actions
          </button>
          {skillsBulkOpen && (
            <div className={`skill-bulk ${older ? 'older-bulk' : ''}`}>
              {older ? (
                <>
                  <button type="button" onClick={() => bulkRange('vocabulary', 1)}>Vocab +</button>
                  <button type="button" onClick={() => bulkRange('vocabulary', -1)}>Vocab -</button>
                  <button type="button" onClick={() => bulkRange('understanding', 1)}>Und +</button>
                  <button type="button" onClick={() => bulkRange('understanding', -1)}>Und -</button>
                  <button type="button" onClick={() => bulkQuality(1)}>Qual +</button>
                  <button type="button" onClick={() => bulkQuality(-1)}>Qual -</button>
                  <button type="button" onClick={() => bulkRange('interaction', 1)}>Active +</button>
                  <button type="button" onClick={() => bulkRange('interaction', -1)}>Active -</button>
                  <button type="button" onClick={() => onBulk('neg+')}>Disc +</button>
                  <button type="button" onClick={() => onBulk('neg-')}>Disc -</button>
                </>
              ) : (
                SKILL_DEFS.map((skill) => {
                  const allOn = students.length > 0 && students.every((student) => student.skills[skill.key]);
                  return (
                    <button className={allOn ? 'all-on' : ''} type="button" key={skill.key} onClick={() => bulkSkill(skill.key)}>
                      {skill.icon} {skill.shortLabel}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>
      )}

      <section className="tracker-list">
        {students.length === 0 ? (
          <div className="empty-state card">Everyone is marked absent. Go home, Manage, or start a new session to adjust attendance.</div>
        ) : (
          <>
            {older && skillsVisible && <OlderSkillHeader />}
            {students.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                older={older}
                showKgBehavior={showKgBehavior}
                skillsVisible={skillsVisible}
                onUpdate={updateStudent}
              />
            ))}
          </>
        )}
      </section>

      <Achievements cls={cls} open={achievementsOpen} setOpen={setAchievementsOpen} />

      <footer className="footer-bar">
        <button type="button" onClick={onExport}>Export CSV</button>
        <button type="button" onClick={onRewards}>Rewards</button>
        <button type="button" onClick={onTimer}>Timer</button>
        <button className="end-btn" type="button" onClick={onEndClass}>End Class</button>
      </footer>
    </main>
  );
}

function StudentRow({ student, older, showKgBehavior, skillsVisible, onUpdate }) {
  return (
    <article className={`student-row ${older ? 'older-row' : ''}`}>
      {showKgBehavior && (
        <div className={`behavior-zone ${student.negative >= 3 ? 'maxed' : ''}`}>
          <button
            className="face-btn"
            type="button"
            onClick={() => onUpdate(student.id, (draft) => {
              draft.negative = clamp(draft.negative + 1, 0, 3);
            })}
          >
            {['😊', '😐', '🙁', '😢'][clamp(student.negative, 0, 3)]}
          </button>
          <button
            className="strike-dots"
            type="button"
            onClick={() => onUpdate(student.id, (draft) => {
              draft.negative = clamp(draft.negative - 1, 0, 3);
            })}
          >
            {[0, 1, 2].map((index) => (
              <span className={index < student.negative ? 'filled' : ''} key={index}>×</span>
            ))}
          </button>
          {student.negative >= 3 && <span className="out-tag">OUT</span>}
        </div>
      )}
      <div className="name-wrap">
        <button
          className="name-pill"
          style={studentPillVars(student)}
          type="button"
          onClick={() => onUpdate(student.id, (draft) => {
            draft.colorIndex = (draft.colorIndex + 1) % STUDENT_PALETTE.length;
          })}
        >
          {student.name}
        </button>
      </div>
      {older ? (
        <OlderStars student={student} onUpdate={onUpdate} />
      ) : (
        <KgStars student={student} onUpdate={onUpdate} />
      )}
      {older ? (
        <OlderSkills student={student} visible={skillsVisible} onUpdate={onUpdate} />
      ) : (
        skillsVisible && <KgSkills student={student} onUpdate={onUpdate} />
      )}
    </article>
  );
}

function KgStars({ student, onUpdate }) {
  const slots = student.positive < STAR_MILESTONE ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
  return (
    <div className="kg-stars">
      {slots.map((index) => (
        <button
          className={student.positive > index ? 'filled' : ''}
          type="button"
          key={index}
          onClick={() => onUpdate(student.id, (draft) => {
            draft.positive = clamp(draft.positive - 1, 0, 999999);
          })}
          aria-label="Remove star"
        >
          ★
        </button>
      ))}
      {student.positive >= STAR_MILESTONE && (
        <button
          className="star-badge"
          type="button"
          onClick={() => onUpdate(student.id, (draft) => {
            draft.positive += 1;
          })}
          aria-label="Add star"
        >
          {student.positive > 99 ? '99+' : student.positive}
        </button>
      )}
      {student.positive < STAR_MILESTONE && (
        <button
          className="add-star"
          type="button"
          onClick={() => onUpdate(student.id, (draft) => {
            draft.positive += 1;
          })}
          aria-label="Add star"
        >
          +
        </button>
      )}
    </div>
  );
}

function OlderStars({ student, onUpdate }) {
  const progress = student.positive >= STAR_MILESTONE ? 100 : ((student.positive % STAR_MILESTONE) / STAR_MILESTONE) * 100;
  return (
    <div className="older-stars">
      <button
        className="older-progress"
        type="button"
        onClick={() => onUpdate(student.id, (draft) => {
          draft.positive = clamp(draft.positive - 1, 0, 999999);
        })}
      >
        <span style={{ width: `${progress}%` }} />
      </button>
      <button
        className={`older-star-badge ${student.positive > 0 ? 'has-star' : ''}`}
        type="button"
        onClick={() => onUpdate(student.id, (draft) => {
          draft.positive += 1;
        })}
      >
        {student.positive > 99 ? '99+' : student.positive}
      </button>
    </div>
  );
}

function KgSkills({ student, onUpdate }) {
  return (
    <div className="skill-zone kg-skill-zone">
      {SKILL_DEFS.map((skill) => (
        <button
          className={student.skills[skill.key] ? 'skill-chip on' : 'skill-chip'}
          type="button"
          key={skill.key}
          title={skill.label}
          onClick={() => onUpdate(student.id, (draft) => {
            draft.skills[skill.key] = !draft.skills[skill.key];
          })}
        >
          {skill.icon}
        </button>
      ))}
    </div>
  );
}

function OlderSkills({ student, visible, onUpdate }) {
  const skills = ensureSkillsOlder(student);
  return (
    <div className="skill-zone older-skill-zone">
      {visible && (
        <>
          <OlderGauge label="Vocabulary" value={rangeToLevel(skills.vocabulary)} onClick={() => onUpdate(student.id, (draft) => {
            ensureSkillsOlder(draft).vocabulary = cycleRange(draft.skillsOlder.vocabulary);
          })} />
          <OlderGauge label="Understanding" value={rangeToLevel(skills.understanding)} onClick={() => onUpdate(student.id, (draft) => {
            ensureSkillsOlder(draft).understanding = cycleRange(draft.skillsOlder.understanding);
          })} />
          <OlderGauge label="Quality" value={skills.quality} onClick={() => onUpdate(student.id, (draft) => {
            ensureSkillsOlder(draft).quality = cycleQuality(draft.skillsOlder.quality);
          })} />
          <OlderGauge label="Active" value={rangeToLevel(skills.interaction)} onClick={() => onUpdate(student.id, (draft) => {
            ensureSkillsOlder(draft).interaction = cycleRange(draft.skillsOlder.interaction);
          })} />
        </>
      )}
      <button
        className="older-face-chip"
        type="button"
        title="Discipline - tap to cycle"
        onClick={() => onUpdate(student.id, (draft) => {
          draft.negative = (clamp(draft.negative, 0, 3) + 1) % 4;
        })}
      >
        :(
      </button>
    </div>
  );
}

function OlderGauge({ value, label, onClick }) {
  const step = lmsLevelToStep(value);
  return (
    <button className="older-gauge" data-step={step} type="button" title={label} onClick={onClick}>
      {step}
    </button>
  );
}

function OlderSkillHeader() {
  return (
    <div className="older-skill-header" aria-hidden="true">
      <span />
      <span />
      <span>Voc</span>
      <span>Und</span>
      <span>Qual</span>
      <span>Act</span>
      <span>Disc</span>
    </div>
  );
}

function Achievements({ cls, open, setOpen }) {
  const older = isOlderClass(cls);
  const students = presentStudents(cls);
  const cards = [];
  const starStudents = students.filter((student) => student.positive >= STAR_MILESTONE);
  if (starStudents.length) {
    cards.push({ icon: '🌟', title: 'Star Sprouts', names: starStudents.map((student) => `${student.name}: ${student.positive}`) });
  }

  if (older) {
    const excellentQuality = students.filter((student) => ensureSkillsOlder(student).quality === 4).map((student) => student.name);
    const fullUnderstanding = students.filter((student) => ensureSkillsOlder(student).understanding === 100).map((student) => student.name);
    if (excellentQuality.length) cards.push({ icon: '✨', title: 'Excellent Quality', names: excellentQuality });
    if (fullUnderstanding.length) cards.push({ icon: '🧠', title: 'Full Understanding', names: fullUnderstanding });
  } else {
    SKILL_DEFS.forEach((skill) => {
      const names = students.filter((student) => student.skills[skill.key]).map((student) => student.name);
      if (names.length) cards.push({ icon: skill.icon, title: skill.label, names });
    });
  }

  if (!cards.length) return null;

  return (
    <section className="accordion-panel achievements">
      <button className="accordion-toggle" type="button" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Achievements
      </button>
      {open && (
        <div className="achievement-grid">
          {cards.map((card) => (
            <article className="achievement-card" key={card.title}>
              <span>{card.icon}</span>
              <div>
                <strong>{card.title}</strong>
                <p>{card.names.join(', ')}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RewardsModal({ cls, onClose }) {
  const older = isOlderClass(cls);
  const students = presentStudents(cls);
  return (
    <Modal title="🎁 Rewards" onClose={onClose}>
      {students.length === 0 ? (
        <p className="modal-empty">No present students.</p>
      ) : (
        <div className="reward-list">
          {students.map((student) => (
            <div className="reward-row" key={student.id}>
              <span>{student.name}</span>
              <strong>{formatReward(computeReward(student, older))}</strong>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function LmsReportModal({ rows, onFinish }) {
  return (
    <Modal title="LMS scores" onClose={onFinish} wide>
      <p className="lms-hint">
        Copy these into the school LMS (Attitude, Active, Understand, Quality, Discipline). Scale: 2 Fair, 3 Good, 4 Excellent.
        Discipline may be 1 Poor.
      </p>
      <div className="lms-table-wrap">
        <table className="lms-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Attitude</th>
              <th>Active</th>
              <th>Understand</th>
              <th>Quality</th>
              <th>Discipline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentName}>
                <td>{row.studentName}</td>
                <td>{formatLmsCell(row.attitude)}</td>
                <td>{formatLmsCell(row.active)}</td>
                <td>{formatLmsCell(row.understand)}</td>
                <td>{formatLmsCell(row.quality)}</td>
                <td>{formatLmsCell(row.discipline)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="primary-btn" type="button" onClick={onFinish}>Done - reset class</button>
    </Modal>
  );
}

function formatLmsCell(score) {
  return `${LMS_LABELS[score]} (${score})`;
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

const TIMER_PRESETS = [
  { label: '5 min', seconds: 300 },
  { label: '3 min', seconds: 180 },
  { label: '2 min', seconds: 120 },
  { label: '1 min', seconds: 60 },
  { label: '30s', seconds: 30 },
  { label: '10s', seconds: 10 },
];

function TimerOverlay({ onClose, showToast }) {
  const [presetSeconds, setPresetSeconds] = useState(60);
  const [remainingMs, setRemainingMs] = useState(60000);
  const [running, setRunning] = useState(false);
  const lastTickRef = useRef(null);
  const rafRef = useRef(null);
  const lastSecondRef = useRef(null);

  const totalMs = presetSeconds * 1000;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const ratio = totalMs > 0 ? clamp(remainingMs / totalMs, 0, 1) : 0;
  const circumference = 2 * Math.PI * 54;

  useEffect(() => {
    if (!running) return undefined;
    function frame(timestamp) {
      if (!lastTickRef.current) lastTickRef.current = timestamp;
      const delta = timestamp - lastTickRef.current;
      lastTickRef.current = timestamp;
      setRemainingMs((current) => {
        const next = Math.max(0, current - delta);
        const nextSecond = Math.ceil(next / 1000);
        if (nextSecond > 0 && nextSecond <= 15 && nextSecond !== lastSecondRef.current) {
          lastSecondRef.current = nextSecond;
        }
        if (next <= 0) {
          setRunning(false);
          showToast('Time!');
        }
        return next;
      });
      rafRef.current = window.requestAnimationFrame(frame);
    }
    rafRef.current = window.requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [running, showToast]);

  function choosePreset(seconds) {
    setRunning(false);
    setPresetSeconds(seconds);
    setRemainingMs(seconds * 1000);
    lastSecondRef.current = null;
  }

  function reset() {
    setRunning(false);
    setRemainingMs(totalMs);
    lastSecondRef.current = null;
  }

  return (
    <div className={`timer-overlay ${secondsLeft <= 15 && secondsLeft > 0 ? 'urgent' : ''}`}>
      <header className="timer-top">
        <button type="button" onClick={onClose} aria-label="Close timer">×</button>
        <div className="timer-presets">
          {TIMER_PRESETS.map((preset) => (
            <button
              className={preset.seconds === presetSeconds ? 'active' : ''}
              type="button"
              key={preset.seconds}
              onClick={() => choosePreset(preset.seconds)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span />
      </header>
      <div className="timer-stage">
        <div className="timer-ring-wrap">
          <svg className="timer-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle className="timer-ring-track" cx="60" cy="60" r="54" />
            <circle
              className="timer-ring-progress"
              cx="60"
              cy="60"
              r="54"
              style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - ratio) }}
            />
          </svg>
          <div className="timer-center">
            {secondsLeft <= 15 && secondsLeft > 0 && <div className="timer-sun">☀️</div>}
            <div className="timer-time">{formatTimer(remainingMs)}</div>
          </div>
        </div>
      </div>
      <div className="timer-controls">
        <button type="button" onClick={() => setRunning((current) => !current)}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button className="primary" type="button" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
