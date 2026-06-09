/**
 * db.js — Data layer (Repository pattern)
 *
 * Native conversion guide:
 *   React Native  → replace localStorage with AsyncStorage (@react-native-async-storage)
 *   Flutter       → replace with Hive or SharedPreferences
 *   Each DB object → a Repository class with async methods
 */

// ── Default subjects ─────────────────────────────────────────────────────────

const DEFAULT_SUBJECTS = [
  {
    id: 'english',
    label: '영어',
    color: '#F97316',
    color2: '#FBBF24',
    icon: '📖',
    subTypes: ['책', '단어', 'Reading Gate'],
    builtIn: true,
  },
  {
    id: 'dictation',
    label: '받아쓰기',
    color: '#7C6FD6',
    color2: '#A78BFA',
    icon: '✏️',
    subTypes: [],
    builtIn: true,
  },
  {
    id: 'violin',
    label: '바이올린',
    color: '#0D9488',
    color2: '#34D399',
    icon: '🎻',
    subTypes: [],
    builtIn: true,
  },
];

// ── SubjectDB ────────────────────────────────────────────────────────────────

const SubjectDB = (() => {
  const KEY = 'hw_subjects';

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function getAll() {
    const stored = _load();
    if (!stored || stored.length === 0) {
      _save(DEFAULT_SUBJECTS);
      return [...DEFAULT_SUBJECTS];
    }
    return stored;
  }

  function getById(id) {
    return getAll().find(s => s.id === id) || null;
  }

  function add(subject) {
    const list = getAll();
    list.push(subject);
    _save(list);
  }

  function remove(id) {
    _save(getAll().filter(s => s.id !== id));
  }

  function updateSubTypes(id, subTypes) {
    _save(getAll().map(s => s.id === id ? { ...s, subTypes } : s));
  }

  // Fetch remote custom subjects and add any that don't exist locally
  async function syncFromGitHub() {
    try {
      const url = `https://raw.githubusercontent.com/jeromeyoon/homework/main/data/subjects.json?t=${Date.now()}`;
      const res  = await fetch(url);
      if (!res.ok) return;
      const remote = await res.json();
      const local  = getAll();
      const localIds = new Set(local.map(s => s.id));
      let changed = false;
      for (const s of remote) {
        if (!localIds.has(s.id)) {
          local.push(s);
          changed = true;
        }
      }
      if (changed) _save(local);
    } catch (_) { /* offline or no data file yet */ }
  }

  return { getAll, getById, add, remove, updateSubTypes, syncFromGitHub };
})();

// ── HomeworkDB ───────────────────────────────────────────────────────────────

const HomeworkDB = (() => {
  const KEY = 'hw_items';

  function _todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function add(item) {
    const list = getAll();
    const start = Number(item.progressStart) || 0;
    list.push({
      id: Date.now(),
      subjectId: item.subjectId,
      subType: item.subType || '',
      detail: item.detail || '',
      dueDate: item.dueDate,
      done: false,
      // progress tracking (null = binary done/not-done)
      progressType:    item.progressType    || null,   // 'count' | 'page' | null
      progressTarget:  Number(item.progressTarget) || 0,
      progressStart:   start,
      progressCurrent: start,
      createdAt: _todayStr(),
    });
    _save(list);
  }

  function update(id, changes) {
    _save(getAll().map(h => h.id === id ? { ...h, ...changes } : h));
  }

  function toggle(id) {
    _save(getAll().map(h => h.id === id ? { ...h, done: !h.done } : h));
  }

  // Increment / decrement progressCurrent; auto-complete when target reached
  function stepProgress(id, delta) {
    _save(getAll().map(h => {
      if (h.id !== id) return h;
      const next = Math.max(h.progressStart || 0,
                   Math.min(h.progressTarget, (h.progressCurrent || 0) + delta));
      return { ...h, progressCurrent: next, done: next >= h.progressTarget };
    }));
  }

  // Set progressCurrent to an arbitrary value
  function setProgress(id, value) {
    _save(getAll().map(h => {
      if (h.id !== id) return h;
      const clamped = Math.max(h.progressStart || 0,
                      Math.min(h.progressTarget, Number(value) || 0));
      return { ...h, progressCurrent: clamped, done: clamped >= h.progressTarget };
    }));
  }

  function remove(id) {
    _save(getAll().filter(h => h.id !== id));
  }

  function removeBySubjectId(subjectId) {
    _save(getAll().filter(h => h.subjectId !== subjectId));
  }

  // Fetch remote homework items and add any that don't exist locally
  async function syncFromGitHub() {
    try {
      const url = `https://raw.githubusercontent.com/jeromeyoon/homework/main/data/items.json?t=${Date.now()}`;
      const res  = await fetch(url);
      if (!res.ok) return;
      const remote = await res.json();
      const local  = getAll();
      const localIds = new Set(local.map(h => String(h.id)));
      let changed = false;
      for (const h of remote) {
        if (!localIds.has(String(h.id))) {
          local.push(h);
          changed = true;
        }
      }
      if (changed) _save(local);
    } catch (_) { /* offline or no data file yet */ }
  }

  return { getAll, add, update, toggle, stepProgress, setProgress, remove, removeBySubjectId, syncFromGitHub };
})();
