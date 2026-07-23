const LS_PREFIX = 'classTracker::';

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

async function storeGet(key) {
  if (typeof window !== 'undefined' && window.storage) {
    try {
      const result = await window.storage.get(key, false);
      if (result) return result.value;
    } catch {
      // Fall back to localStorage below.
    }
  }

  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(`${LS_PREFIX}${key}`);
  } catch {
    return null;
  }
}

async function storeSet(key, value) {
  if (typeof window !== 'undefined' && window.storage) {
    try {
      const result = await window.storage.set(key, value, false);
      if (result) return true;
    } catch {
      // Fall back to localStorage below.
    }
  }

  if (!canUseLocalStorage()) return false;
  try {
    window.localStorage.setItem(`${LS_PREFIX}${key}`, value);
    return true;
  } catch {
    return false;
  }
}

async function storeDelete(key) {
  if (typeof window !== 'undefined' && window.storage) {
    try {
      await window.storage.delete(key, false);
    } catch {
      // Fall back to localStorage below.
    }
  }

  if (!canUseLocalStorage()) return true;
  try {
    window.localStorage.removeItem(`${LS_PREFIX}${key}`);
  } catch {
    // Ignore storage errors.
  }
  return true;
}

export async function loadClassesIndex() {
  const raw = await storeGet('classes-index');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveClassesIndex(list) {
  return storeSet('classes-index', JSON.stringify(list));
}

export async function loadRoster(classId) {
  const raw = await storeGet(`class-roster:${classId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveRoster(classId, roster) {
  return storeSet(`class-roster:${classId}`, JSON.stringify(roster));
}

export async function deleteClassData(classId) {
  await storeDelete(`class-roster:${classId}`);
  await storeDelete(`reports:${classId}`);
}

export async function loadReports(classId) {
  const raw = await storeGet(`reports:${classId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendReport(classId, report) {
  const reports = await loadReports(classId);
  reports.push(report);
  return storeSet(`reports:${classId}`, JSON.stringify(reports));
}

export async function loadActiveClassId() {
  return storeGet('active-class-id');
}

export async function saveActiveClassId(classId) {
  return storeSet('active-class-id', classId);
}

export async function clearActiveClassId() {
  return storeDelete('active-class-id');
}

export async function loadTheme() {
  return storeGet('ui-theme');
}

export async function saveTheme(theme) {
  return storeSet('ui-theme', theme);
}
