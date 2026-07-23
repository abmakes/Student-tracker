export const RANGE_STEPS = [50, 75, 100];
export const QUALITY_LEVELS = [2, 3, 4];
export const QUALITY_LABELS = { 2: 'Fair', 3: 'Good', 4: 'Excellent' };
export const LMS_LEVELS = [1, 2, 3, 4];
export const LMS_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Excellent' };
export const OLDER_RANGE_KEYS = ['vocabulary', 'understanding', 'interaction'];
export const STAR_MILESTONE = 5;

export const SKILL_DEFS = [
  { key: 'songs', label: 'Songs & Chants', shortLabel: 'Songs', icon: '🎵' },
  { key: 'stories', label: 'Stories & Chants', shortLabel: 'Stories', icon: '📖' },
  { key: 'phonics', label: 'Phonics', shortLabel: 'Phonics', icon: '🔤' },
  { key: 'blending', label: 'Blending', shortLabel: 'Blending', icon: '🗣️' },
];

export const STUDENT_PALETTE = [
  { bg: '#ffb3a8', ink: '#64251f' },
  { bg: '#ffd27f', ink: '#5c3b00' },
  { bg: '#fff08a', ink: '#514500' },
  { bg: '#afeab7', ink: '#174d29' },
  { bg: '#9de3df', ink: '#07504c' },
  { bg: '#a9d4ff', ink: '#123c63' },
  { bg: '#ffc0da', ink: '#66213d' },
  { bg: '#c7f0a0', ink: '#315210' },
];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeLmsScore(value) {
  const n = Number(value);
  return LMS_LEVELS.includes(n) ? n : 2;
}

export function stepLmsScore(value) {
  const current = LMS_LEVELS.indexOf(normalizeLmsScore(value));
  return LMS_LEVELS[(current + 1) % LMS_LEVELS.length];
}

export function lmsLabel(value) {
  return LMS_LABELS[normalizeLmsScore(value)];
}

export function defaultHomework() {
  return { complete: 2, effort: 2, quality: 2 };
}

export function ensureHomework(student) {
  if (!student.homework || typeof student.homework !== 'object') {
    student.homework = defaultHomework();
  }
  student.homework.complete = normalizeLmsScore(student.homework.complete);
  student.homework.effort = normalizeLmsScore(student.homework.effort);
  student.homework.quality = normalizeLmsScore(student.homework.quality);
  delete student.homework.status;
  return student.homework;
}

export function isOlderClass(cls) {
  return Boolean(cls && cls.ageGroup === 'older');
}

export function defaultSkillsOlder() {
  return { vocabulary: 50, understanding: 50, quality: 3, interaction: 50 };
}

export function normalizeRangePct(value) {
  const n = Number(value);
  if (n >= 100) return 100;
  if (n >= 75) return 75;
  return 50;
}

export function normalizeQuality(value) {
  const n = Number(value);
  if (n === 2 || n === 4) return n;
  return 3;
}

export function ensureSkillsOlder(student) {
  if (!student.skillsOlder || typeof student.skillsOlder !== 'object') {
    student.skillsOlder = defaultSkillsOlder();
  }
  student.skillsOlder.vocabulary = normalizeRangePct(student.skillsOlder.vocabulary);
  student.skillsOlder.understanding = normalizeRangePct(student.skillsOlder.understanding);
  student.skillsOlder.interaction = normalizeRangePct(student.skillsOlder.interaction);
  student.skillsOlder.quality = normalizeQuality(student.skillsOlder.quality);
  return student.skillsOlder;
}

export function stepRange(value, dir) {
  const index = RANGE_STEPS.indexOf(normalizeRangePct(value));
  return RANGE_STEPS[clamp(index + dir, 0, RANGE_STEPS.length - 1)];
}

export function cycleRange(value) {
  const index = RANGE_STEPS.indexOf(normalizeRangePct(value));
  return RANGE_STEPS[(index + 1) % RANGE_STEPS.length];
}

export function cycleQuality(value) {
  const index = QUALITY_LEVELS.indexOf(normalizeQuality(value));
  return QUALITY_LEVELS[(index + 1) % QUALITY_LEVELS.length];
}

export function stepQuality(value, dir) {
  const index = QUALITY_LEVELS.indexOf(normalizeQuality(value));
  return QUALITY_LEVELS[clamp(index + dir, 0, QUALITY_LEVELS.length - 1)];
}

export function makeStudent(name, index = 0) {
  return {
    id: uid('stu'),
    name,
    positive: 0,
    negative: 0,
    absent: false,
    colorIndex: index % STUDENT_PALETTE.length,
    homework: defaultHomework(),
    skills: { songs: false, stories: false, phonics: false, blending: false },
    skillsOlder: defaultSkillsOlder(),
  };
}

export function presentStudents(cls) {
  return (cls?.students || []).filter((student) => !student.absent);
}

export function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

export function buildStudentsFromNames(rawNames, existingRoster) {
  const existingByName = {};
  if (existingRoster?.students) {
    existingRoster.students.forEach((student) => {
      const key = normalizeName(student.name);
      existingByName[key] ||= [];
      existingByName[key].push(student);
    });
  }

  return rawNames.map((name, index) => {
    const previous = existingByName[normalizeName(name)]?.shift();
    const student = makeStudent(name, index);
    if (!previous) return student;

    student.id = previous.id || student.id;
    student.colorIndex = typeof previous.colorIndex === 'number' ? previous.colorIndex : student.colorIndex;
    student.absent = Boolean(previous.absent);
    if (previous.homework) {
      student.homework = {
        complete: normalizeLmsScore(previous.homework.complete),
        effort: normalizeLmsScore(previous.homework.effort),
        quality: normalizeLmsScore(previous.homework.quality),
      };
    }
    if (previous.skillsOlder) {
      student.skillsOlder = {
        vocabulary: normalizeRangePct(previous.skillsOlder.vocabulary),
        understanding: normalizeRangePct(previous.skillsOlder.understanding),
        interaction: normalizeRangePct(previous.skillsOlder.interaction),
        quality: normalizeQuality(previous.skillsOlder.quality),
      };
    }
    if (previous.skills) {
      student.skills = {
        songs: Boolean(previous.skills.songs),
        stories: Boolean(previous.skills.stories),
        phonics: Boolean(previous.skills.phonics),
        blending: Boolean(previous.skills.blending),
      };
    }
    return student;
  });
}

export function prepareRosterForUse(roster) {
  if (!roster || !Array.isArray(roster.students)) return roster;
  const older = isOlderClass(roster);
  roster.students.forEach((student, index) => {
    if (typeof student.positive !== 'number') student.positive = 0;
    if (typeof student.negative !== 'number') student.negative = 0;
    if (typeof student.absent !== 'boolean') student.absent = false;
    if (typeof student.colorIndex !== 'number') student.colorIndex = index % STUDENT_PALETTE.length;
    ensureHomework(student);
    student.skills = {
      songs: Boolean(student.skills?.songs),
      stories: Boolean(student.skills?.stories),
      phonics: Boolean(student.skills?.phonics),
      blending: Boolean(student.skills?.blending),
    };
    if (older) ensureSkillsOlder(student);
    delete student.expanded;
  });
  if (typeof roster.negativeEnabled !== 'boolean') {
    roster.negativeEnabled = older ? false : true;
  }
  return roster;
}

export function rangeToLevel(pct) {
  const n = normalizeRangePct(pct);
  if (n >= 100) return 4;
  if (n >= 75) return 3;
  return 2;
}

export function lmsLevelToStep(level) {
  const n = Number(level);
  if (n >= 4) return 3;
  if (n >= 3) return 2;
  return 1;
}

export function pctToLms(pct) {
  return rangeToLevel(pct);
}

export function mapActiveFromStars(positive) {
  if (positive >= 5) return 4;
  if (positive >= 3) return 3;
  return 2;
}

export function mapAttitude(student) {
  if (student.positive === 0 && student.negative >= 1) return 2;
  if (student.positive >= 5 && student.negative === 0) return 4;
  return 3;
}

export function mapDiscipline(negative) {
  const n = clamp(negative, 0, 3);
  if (n === 0) return 4;
  if (n === 1) return 3;
  if (n === 2) return 2;
  return 1;
}

export function buildOlderLmsRows(cls) {
  return cls.students.map((student) => {
    const skills = ensureSkillsOlder(student);
    return {
      studentName: student.name,
      attitude: mapAttitude(student),
      active: mapActiveFromStars(student.positive),
      understand: pctToLms(skills.understanding),
      quality: normalizeQuality(skills.quality),
      discipline: mapDiscipline(student.negative),
    };
  });
}

export function computeReward(student, older) {
  const stickers = Math.floor(student.positive / STAR_MILESTONE);
  const leftoverStars = student.positive % STAR_MILESTONE;
  const starStamps = stickers + leftoverStars;
  let skillCount = 0;

  if (older) {
    const skills = ensureSkillsOlder(student);
    if (skills.vocabulary >= 75) skillCount += 1;
    if (skills.understanding >= 75) skillCount += 1;
    if (skills.interaction >= 75) skillCount += 1;
    if (skills.quality >= 3) skillCount += 1;
  } else {
    skillCount = SKILL_DEFS.filter(({ key }) => student.skills?.[key]).length;
  }

  return { stickers, stamps: Math.max(0, starStamps + skillCount - student.negative) };
}

export function formatReward(reward) {
  const parts = [];
  if (reward.stickers > 0) parts.push(`${reward.stickers} ${reward.stickers === 1 ? 'sticker' : 'stickers'}`);
  if (reward.stamps > 0) parts.push(`${reward.stamps} ${reward.stamps === 1 ? 'stamp' : 'stamps'}`);
  return parts.length ? parts.join(' and ') : 'No reward yet';
}

export function buildSessionReport(cls) {
  const older = isOlderClass(cls);
  const lmsRows = older ? buildOlderLmsRows(cls) : null;
  return {
    reportId: `rep_${todayISO().replace(/-/g, '')}_${Date.now().toString(36)}`,
    classId: cls.id,
    timestamp: new Date().toISOString(),
    studentMetrics: cls.students.map((student) => {
      const homework = ensureHomework(student);
      const base = {
        studentName: student.name,
        absent: Boolean(student.absent),
        homework: {
          complete: homework.complete,
          effort: homework.effort,
          quality: homework.quality,
          completeLabel: lmsLabel(homework.complete),
          effortLabel: lmsLabel(homework.effort),
          qualityLabel: lmsLabel(homework.quality),
        },
        behavior: {
          positiveStars: student.positive,
          negativeDots: student.negative,
          maxStarsTriggered: student.positive >= STAR_MILESTONE,
        },
        skillsAttained: {
          songsAndChants: Boolean(student.skills?.songs),
          storiesAndChants: Boolean(student.skills?.stories),
          phonics: Boolean(student.skills?.phonics),
          blending: Boolean(student.skills?.blending),
        },
      };

      if (older) {
        const skills = ensureSkillsOlder(student);
        base.skillsOlder = {
          vocabulary: skills.vocabulary,
          understanding: skills.understanding,
          quality: skills.quality,
          interaction: skills.interaction,
        };
        base.lmsScores = lmsRows.find((row) => row.studentName === student.name) || null;
      }
      return base;
    }),
  };
}

export function resetRosterForNextClass(cls) {
  cls.students.forEach((student) => {
    student.positive = 0;
    student.negative = 0;
    student.absent = false;
    student.homework = defaultHomework();
    student.skills = { songs: false, stories: false, phonics: false, blending: false };
    if (isOlderClass(cls)) student.skillsOlder = defaultSkillsOlder();
  });
  return cls;
}

export function csvEscape(value) {
  let str = String(value);
  if (/[",\n]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildCsv(cls) {
  const older = isOlderClass(cls);
  const students = presentStudents(cls);
  const header = older
    ? ['Student Name', 'Positive Score', 'Negative Score', 'Vocabulary', 'Understanding', 'Quality', 'Interaction', 'Complete', 'Effort', 'HW Quality']
    : ['Student Name', 'Positive Score', 'Negative Score', 'Songs & Chants', 'Stories & Chants', 'Phonics', 'Blending', 'Complete', 'Effort', 'HW Quality'];

  const rows = students.map((student) => {
    const homework = ensureHomework(student);
    if (older) {
      const skills = ensureSkillsOlder(student);
      return [
        csvEscape(student.name),
        student.positive,
        student.negative,
        skills.vocabulary,
        skills.understanding,
        QUALITY_LABELS[skills.quality],
        skills.interaction,
        lmsLabel(homework.complete),
        lmsLabel(homework.effort),
        lmsLabel(homework.quality),
      ].join(',');
    }

    return [
      csvEscape(student.name),
      student.positive,
      student.negative,
      student.skills.songs ? 'TRUE' : 'FALSE',
      student.skills.stories ? 'TRUE' : 'FALSE',
      student.skills.phonics ? 'TRUE' : 'FALSE',
      student.skills.blending ? 'TRUE' : 'FALSE',
      lmsLabel(homework.complete),
      lmsLabel(homework.effort),
      lmsLabel(homework.quality),
    ].join(',');
  });

  return `${header.join(',')}\n${rows.join('\n')}`;
}
