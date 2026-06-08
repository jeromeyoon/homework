/**
 * app.js — Presentation layer
 *
 * Native conversion guide:
 *   Each render*() fn  → a Screen component (RN) or Widget build() (Flutter)
 *   state object       → useState hooks (RN) / StatefulWidget state (Flutter)
 *   navigate()         → navigation.navigate() (RN) / Navigator.push() (Flutter)
 *   HomeworkDB calls   → await repository.method() with async/await
 */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    screen: 'home',
    editingId: null,
    selSubjectId: null,
    selSubType: null,
    selColor: '#EF4444',
    selColor2: '#F87171',
    selProgressType: 'none',   // 'none' | 'count' | 'page'
    filter: 'all',
    doneOpen: false,
  };

  // ── Sheet state ───────────────────────────────────────────────────────────
  const sheet = { id: null, value: 0, start: 0, target: 0, type: 'count', color: '' };

  // ── Color palette ──────────────────────────────────────────────────────────
  const PALETTE = [
    { color: '#EF4444', color2: '#F87171' },
    { color: '#3B82F6', color2: '#60A5FA' },
    { color: '#EC4899', color2: '#F472B6' },
    { color: '#6366F1', color2: '#818CF8' },
    { color: '#F97316', color2: '#FBBF24' },
    { color: '#14B8A6', color2: '#34D399' },
  ];

  // ── Utils ──────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function tomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return `${m}/${d} (${labels[dow]})`;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;

  const CHEVRON_SVG = `<svg class="done-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigate(screen) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    $('screen-' + screen).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });
    state.screen = screen;

    if (screen === 'home')     renderHome();
    if (screen === 'schedule') renderSchedule();
    if (screen === 'subjects') renderSubjects();
  }

  // ── HOME SCREEN ────────────────────────────────────────────────────────────

  function renderHome() {
    _renderHero();
    _renderProgress();
    _renderHomeSubjectCards();
    _renderTimeline('home-timeline', HomeworkDB.getAll());
  }

  // ── PROGRESS SECTION ──────────────────────────────────────────────────────

  // Returns a 0–1 completion ratio for a single homework item
  function _itemRatio(h) {
    if (!h.progressType || h.progressType === 'none') {
      return h.done ? 1 : 0;
    }
    const range = h.progressTarget - (h.progressStart || 0);
    if (range <= 0) return h.done ? 1 : 0;
    return Math.min(1, ((h.progressCurrent || 0) - (h.progressStart || 0)) / range);
  }

  function _renderProgress() {
    const all      = HomeworkDB.getAll();
    const subjects = SubjectDB.getAll();

    // Active = due today/future, OR overdue+undone (exclude old completed items)
    const today  = todayStr();
    const active = all.filter(h => h.dueDate >= today || !h.done);

    if (active.length === 0) {
      $('progress-fraction').textContent = '';
      $('progress-fill').style.width     = '0%';
      $('progress-pct').textContent      = '';
      $('progress-subjects').innerHTML   =
        `<p style="font-size:13px;color:var(--clr-text-3);text-align:center;padding:8px 0">
           숙제를 추가하면 여기에 표시돼요
         </p>`;
      return;
    }

    // Overall: average of per-item ratios
    const totalRatio = active.reduce((sum, h) => sum + _itemRatio(h), 0);
    const pct        = Math.round((totalRatio / active.length) * 100);
    const doneCount  = active.filter(h => h.done).length;

    $('progress-fraction').textContent = `${doneCount} / ${active.length}`;
    $('progress-fill').style.width     = pct + '%';
    $('progress-pct').textContent      = `${pct}%`;

    // Per-subject rows
    const rows = subjects.map(s => {
      const items = active.filter(h => h.subjectId === s.id);
      if (items.length === 0) return null;

      const subRatio  = items.reduce((sum, h) => sum + _itemRatio(h), 0) / items.length;
      const subPct    = Math.round(subRatio * 100);
      const allDone   = items.every(h => h.done);

      // Detail label: show individual item progress inline
      const detailParts = items.map(h => {
        const label = h.subType || h.detail || '';
        if (!h.progressType || h.progressType === 'none') return null;
        if (h.progressType === 'count') return `${label ? label + ' ' : ''}${h.progressCurrent || 0}/${h.progressTarget}번`;
        if (h.progressType === 'page')  return `${label ? label + ' ' : ''}p.${h.progressCurrent || h.progressStart || 0}/${h.progressTarget}`;
        return null;
      }).filter(Boolean);

      return `
        <div class="progress-row">
          <span class="progress-row-icon">${esc(s.icon || '📚')}</span>
          <span class="progress-row-name">${esc(s.label)}</span>
          <div class="progress-row-track">
            <div class="progress-row-fill"
                 style="width:${subPct}%; background:${esc(s.color)}"></div>
          </div>
          <span class="progress-row-count ${allDone ? 'all-done' : ''}">
            ${allDone ? '✓' : `${subPct}%`}
          </span>
        </div>
        ${detailParts.length > 0
          ? `<div style="padding:0 0 4px 32px; font-size:11px; color:var(--clr-text-3)">
               ${detailParts.map(d => esc(d)).join(' &nbsp;·&nbsp; ')}
             </div>`
          : ''}`;
    }).filter(Boolean);

    $('progress-subjects').innerHTML = rows.join('');
  }

  function _renderHero() {
    const now = new Date();
    const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const days   = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    $('hero-date').textContent =
      `${now.getFullYear()}년 ${months[now.getMonth()]} ${now.getDate()}일 ${days[now.getDay()]}`;

    const today = todayStr();
    const all   = HomeworkDB.getAll();
    const overdue = all.filter(h => !h.done && h.dueDate < today).length;
    const pending = all.filter(h => !h.done && h.dueDate >= today).length;

    if (overdue > 0) {
      $('hero-stat').textContent = `⚠️ 밀린 숙제 ${overdue}개  ·  미완료 ${pending}개`;
    } else if (pending > 0) {
      $('hero-stat').textContent = `미완료 숙제 ${pending}개`;
    } else {
      $('hero-stat').textContent = '모든 숙제 완료! 🎉';
    }
  }

  function _renderHomeSubjectCards() {
    const subjects = SubjectDB.getAll();
    const all      = HomeworkDB.getAll();
    const today    = todayStr();

    $('home-subject-cards').innerHTML = subjects.map(s => {
      const count = all.filter(h => h.subjectId === s.id && !h.done && h.dueDate >= today).length;
      return `
        <button class="subject-card"
          style="background: linear-gradient(140deg, ${esc(s.color)}, ${esc(s.color2 || s.color)})"
          onclick="App.navigate('schedule')">
          <span class="subject-card-icon">${esc(s.icon || '📚')}</span>
          <div>
            <div class="subject-card-name">${esc(s.label)}</div>
            <div class="subject-card-count">${count}개 남음</div>
          </div>
        </button>`;
    }).join('');
  }

  // ── SCHEDULE SCREEN ────────────────────────────────────────────────────────

  function renderSchedule() {
    _renderWeekStrip();
    _renderScheduleTimeline();
  }

  function _renderWeekStrip() {
    const today    = new Date();
    const todayStr_ = todayStr();
    const all      = HomeworkDB.getAll();
    const dayLabels = ['일','월','화','수','목','금','토'];

    // Start from Sunday of this week
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    $('week-strip').innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d    = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const isToday   = dStr === todayStr_;
      const hasPending = all.some(h => h.dueDate === dStr && !h.done);
      return `
        <div class="week-day ${isToday ? 'today' : ''}">
          <span class="week-day-label">${dayLabels[d.getDay()]}</span>
          <span class="week-day-num">${d.getDate()}</span>
          <span class="week-day-dot ${hasPending ? 'has-hw' : ''}"></span>
        </div>`;
    }).join('');
  }

  function _renderScheduleTimeline() {
    let items = HomeworkDB.getAll();
    if (state.filter === 'todo') items = items.filter(h => !h.done);
    if (state.filter === 'done') items = items.filter(h =>  h.done);
    _renderTimeline('schedule-timeline', items);
  }

  function toggleFilterBar() {
    $('filter-bar').classList.toggle('hidden');
  }

  function setFilter(f) {
    state.filter = f;
    document.querySelectorAll('.filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === f);
    });
    _renderScheduleTimeline();
  }

  // ── SHARED TIMELINE RENDERER ───────────────────────────────────────────────

  function _renderTimeline(containerId, items) {
    const today    = todayStr();
    const tomorrow = tomorrowStr();
    const pending  = items.filter(h => !h.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const done     = items.filter(h =>  h.done).sort((a, b) => b.dueDate.localeCompare(a.dueDate));

    if (pending.length === 0 && done.length === 0) {
      $(containerId).innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-text">숙제가 없어요!</div>
          <div class="empty-sub">+ 버튼으로 숙제를 추가해 보세요</div>
        </div>`;
      return;
    }

    // Group pending by date
    const groups = {};
    pending.forEach(h => {
      (groups[h.dueDate] = groups[h.dueDate] || []).push(h);
    });

    let html = '';

    // ── Overdue group (all past-due items merged) ──
    const overdueDates   = Object.keys(groups).filter(d => d < today).sort();
    const upcomingDates  = Object.keys(groups).filter(d => d >= today).sort();

    if (overdueDates.length > 0) {
      html += `<div class="date-group">
        <div class="date-header"><span>⚠️</span><span>밀린 숙제</span></div>`;
      overdueDates.forEach(date =>
        groups[date].forEach(h => { html += _hwCardHTML(h, true); })
      );
      html += '</div>';
    }

    // ── Upcoming groups ──
    upcomingDates.forEach(date => {
      let icon, label;
      if      (date === today)    { icon = '🔴'; label = `오늘 (${formatDateLabel(date)})`; }
      else if (date === tomorrow) { icon = '🟡'; label = `내일 (${formatDateLabel(date)})`; }
      else                        { icon = '📅'; label = formatDateLabel(date); }

      html += `<div class="date-group">
        <div class="date-header"><span>${icon}</span><span>${label}</span></div>`;
      groups[date].forEach(h => { html += _hwCardHTML(h, false); });
      html += '</div>';
    });

    // ── Completed section (collapsible) ──
    if (done.length > 0) {
      const open = state.doneOpen;
      html += `
        <button class="done-section-toggle" onclick="App.toggleDoneSection()">
          <span>✅ 완료된 숙제 (${done.length}개)</span>
          <span class="${'done-chevron' + (open ? ' open' : '')}">${CHEVRON_SVG.replace('class="done-chevron"', '')}</span>
        </button>
        <div class="done-list ${open ? 'open' : ''}">
          ${done.map(h => _hwCardHTML(h, false)).join('')}
        </div>`;
    }

    $(containerId).innerHTML = html;
  }

  function _hwCardHTML(h, isOverdue) {
    const subject    = SubjectDB.getById(h.subjectId) || { label: h.subjectId, color: '#999', icon: '📚' };
    const titleLabel = h.subType ? `${subject.label} · ${h.subType}` : subject.label;
    const overdueClass = (isOverdue && !h.done) ? ' overdue' : '';
    const doneClass    = h.done ? ' done' : '';
    const checkedClass = h.done ? ' checked' : '';

    // Build inline progress section
    const progressHTML = _hwProgressHTML(h, subject.color);

    return `
      <button class="hw-card${doneClass}${overdueClass}" onclick="App.openEdit(${h.id})">
        <div class="hw-dot" style="background:${esc(subject.color)}"></div>
        <div class="hw-body">
          <div class="hw-title">${esc(titleLabel)}</div>
          ${h.detail ? `<div class="hw-detail">${esc(h.detail)}</div>` : ''}
          ${progressHTML}
          <div class="hw-due">📅 ${formatDateLabel(h.dueDate)}</div>
        </div>
        <button class="btn-done${checkedClass}"
                onclick="event.stopPropagation(); App.toggleItem(${h.id})"
                aria-label="${h.done ? '완료 취소' : '완료 표시'}">
          ${CHECK_SVG}
        </button>
      </button>`;
  }

  function _hwProgressHTML(h, color) {
    if (!h.progressType || h.progressType === 'none') return '';

    const ratio    = _itemRatio(h);
    const pct      = Math.round(ratio * 100);
    const complete = ratio >= 1;

    const cur   = h.progressCurrent || h.progressStart || 0;
    const tgt   = h.progressTarget  || 0;
    const label = h.progressType === 'count'
      ? (complete ? '✓ 완료!' : `${cur} / ${tgt}번`)
      : (complete ? '✓ 완료!' : `p.${cur} / p.${tgt}`);

    return `
      <div class="hw-progress" onclick="event.stopPropagation()">
        <div class="hw-progress-track">
          <div class="hw-progress-bar" style="width:${pct}%; background:${esc(color)}"></div>
        </div>
        <div class="hw-progress-info">
          <span class="hw-progress-label ${complete ? 'complete' : ''}">${label}</span>
          ${!complete
            ? `<button class="hw-update-btn" onclick="App.openSheet(${h.id})">업데이트</button>`
            : ''}
        </div>
      </div>`;
  }

  // ── Progress bottom sheet ─────────────────────────────────────────────────

  function openSheet(id) {
    const h = HomeworkDB.getAll().find(item => item.id === id);
    if (!h) return;
    const subject = SubjectDB.getById(h.subjectId) || {};

    sheet.id     = id;
    sheet.value  = h.progressCurrent ?? h.progressStart ?? 0;
    sheet.start  = h.progressStart  ?? 0;
    sheet.target = h.progressTarget ?? 0;
    sheet.type   = h.progressType;
    sheet.color  = subject.color || 'var(--clr-primary)';

    const titleParts = [subject.label || ''];
    if (h.subType) titleParts.push(h.subType);
    $('sheet-subject').textContent = titleParts.join(' · ');
    $('sheet-unit').textContent    = h.progressType === 'count' ? '번' : '페이지';

    // Quick buttons only for page type
    $('sheet-quick').classList.toggle('hidden', h.progressType !== 'page');

    _updateSheetUI();

    $('sheet-backdrop').classList.remove('hidden');
    $('progress-sheet').classList.remove('hidden');
    requestAnimationFrame(() => $('progress-sheet').classList.add('open'));
    setTimeout(() => $('sheet-value').focus(), 320);
  }

  function _updateSheetUI() {
    const { value, start, target, color } = sheet;
    const range = target - start;
    const pct   = range > 0 ? Math.min(100, Math.round(((value - start) / range) * 100)) : 0;

    $('sheet-value').value             = value;
    $('sheet-progress-fill').style.width      = pct + '%';
    $('sheet-progress-fill').style.background = color;
    $('sheet-progress-pct').textContent       = pct + '%';

    const unit = sheet.type === 'count' ? '번' : '페이지';
    $('sheet-progress-detail').textContent =
      `목표: ${target}${unit}  ·  ${pct}% 완료`;
  }

  function sheetStep(delta) {
    sheet.value = Math.max(sheet.start, Math.min(sheet.target, sheet.value + delta));
    _updateSheetUI();
  }

  function closeSheet() {
    $('progress-sheet').classList.remove('open');
    setTimeout(() => {
      $('progress-sheet').classList.add('hidden');
      $('sheet-backdrop').classList.add('hidden');
    }, 300);
  }

  function confirmSheet() {
    const typed = parseInt($('sheet-value').value, 10);
    if (!isNaN(typed)) sheet.value = typed;
    HomeworkDB.setProgress(sheet.id, sheet.value);
    closeSheet();
    _refreshCurrentScreen();
  }

  function _refreshCurrentScreen() {
    if (state.screen === 'home') renderHome();
    else renderSchedule();
  }

  function toggleDoneSection() {
    state.doneOpen = !state.doneOpen;
    const listEl   = document.querySelector('.done-list');
    const chevron  = document.querySelector('.done-section-toggle .done-chevron');
    if (listEl)  listEl.classList.toggle('open', state.doneOpen);
    if (chevron) chevron.classList.toggle('open', state.doneOpen);
  }

  function toggleItem(id) {
    HomeworkDB.toggle(id);
    if (state.screen === 'home')     renderHome();
    else                             renderSchedule();
  }

  // ── ADD / EDIT SCREEN ──────────────────────────────────────────────────────

  function openAdd() {
    state.editingId      = null;
    state.selSubjectId   = null;
    state.selSubType     = null;
    state.selProgressType = 'none';

    $('add-screen-title').textContent = '숙제 추가';
    $('add-detail').value = '';
    $('add-due').value    = todayStr();
    $('btn-delete').classList.add('hidden');
    $('subtype-group').classList.add('hidden');

    _renderSubjectPicker(null);
    _renderSubtypePicker(null, null);
    _applyProgressType('none');

    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    $('screen-add').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  }

  function openEdit(id) {
    const h = HomeworkDB.getAll().find(item => item.id === id);
    if (!h) return;

    state.editingId       = id;
    state.selSubjectId    = h.subjectId;
    state.selSubType      = h.subType || null;
    state.selProgressType = h.progressType || 'none';

    $('add-screen-title').textContent = '숙제 수정';
    $('add-detail').value = h.detail || '';
    $('add-due').value    = h.dueDate;
    $('btn-delete').classList.remove('hidden');

    _renderSubjectPicker(h.subjectId);
    _renderSubtypePicker(h.subjectId, h.subType);
    _applyProgressType(h.progressType || 'none', h);

    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    $('screen-add').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  }

  function closeAdd() {
    navigate(state.screen);
  }

  function _renderSubjectPicker(selectedId) {
    const subjects = SubjectDB.getAll();
    $('subject-picker').innerHTML = subjects.map(s => `
      <button class="picker-chip ${s.id === selectedId ? 'selected' : ''}"
              data-id="${esc(s.id)}"
              onclick="App.selectSubject('${esc(s.id)}')">
        ${esc(s.icon || '')} ${esc(s.label)}
      </button>`).join('');
  }

  function _renderSubtypePicker(subjectId, selectedSubType) {
    const subject = subjectId ? SubjectDB.getById(subjectId) : null;
    const group   = $('subtype-group');
    if (!subject || !subject.subTypes || subject.subTypes.length === 0) {
      group.classList.add('hidden');
      return;
    }
    group.classList.remove('hidden');
    $('subtype-picker').innerHTML = subject.subTypes.map(st => `
      <button class="picker-chip ${st === selectedSubType ? 'selected' : ''}"
              data-type="${esc(st)}"
              onclick="App.selectSubType('${esc(st)}')">
        ${esc(st)}
      </button>`).join('');
  }

  function selectSubject(id) {
    state.selSubjectId = id;
    state.selSubType   = null;
    document.querySelectorAll('#subject-picker .picker-chip').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.id === id);
    });
    _renderSubtypePicker(id, null);
  }

  function selectSubType(st) {
    state.selSubType = st;
    document.querySelectorAll('#subtype-picker .picker-chip').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.type === st);
    });
  }

  function selectProgressType(ptype) {
    state.selProgressType = ptype;
    _applyProgressType(ptype);
  }

  function _applyProgressType(ptype, existing) {
    // Update picker chips
    document.querySelectorAll('#progress-type-picker .picker-chip').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.ptype === ptype);
    });
    // Show/hide sub-forms
    $('progress-count-group').classList.toggle('hidden', ptype !== 'count');
    $('progress-page-group').classList.toggle('hidden',  ptype !== 'page');

    // Pre-fill values when editing
    if (existing) {
      if (ptype === 'count') {
        $('progress-target-count').value = existing.progressTarget || '';
      }
      if (ptype === 'page') {
        $('progress-start-page').value  = existing.progressStart  || '';
        $('progress-target-page').value = existing.progressTarget || '';
      }
    } else {
      $('progress-target-count').value = '';
      $('progress-start-page').value   = '';
      $('progress-target-page').value  = '';
    }
  }

  function saveHomework() {
    if (!state.selSubjectId) { alert('과목을 선택해 주세요.'); return; }
    const dueDate = $('add-due').value;
    if (!dueDate) { alert('마감일을 선택해 주세요.'); return; }

    const ptype = state.selProgressType;
    let progressType = null, progressTarget = 0, progressStart = 0;

    if (ptype === 'count') {
      const t = parseInt($('progress-target-count').value, 10);
      if (!t || t < 1) { alert('목표 횟수를 입력해 주세요.'); return; }
      progressType   = 'count';
      progressTarget = t;
      progressStart  = 0;
    } else if (ptype === 'page') {
      const s = parseInt($('progress-start-page').value, 10) || 1;
      const t = parseInt($('progress-target-page').value, 10);
      if (!t || t < s) { alert('목표 페이지를 바르게 입력해 주세요.'); return; }
      progressType   = 'page';
      progressTarget = t;
      progressStart  = s;
    }

    const data = {
      subjectId:      state.selSubjectId,
      subType:        state.selSubType || '',
      detail:         $('add-detail').value.trim(),
      dueDate,
      done:           false,
      progressType,
      progressTarget,
      progressStart,
    };

    if (state.editingId !== null) {
      // Keep progressCurrent as-is when editing (don't reset)
      const keep = { progressCurrent: undefined };
      const existing = HomeworkDB.getAll().find(h => h.id === state.editingId);
      if (existing && progressType === existing.progressType) {
        keep.progressCurrent = existing.progressCurrent;
      } else {
        keep.progressCurrent = progressStart;
      }
      HomeworkDB.update(state.editingId, { ...data, ...keep });
    } else {
      HomeworkDB.add(data);
    }

    closeAdd();
  }

  function deleteHomework() {
    if (state.editingId === null) return;
    if (!confirm('이 숙제를 삭제할까요?')) return;
    HomeworkDB.remove(state.editingId);
    closeAdd();
  }

  // ── SUBJECTS SCREEN ────────────────────────────────────────────────────────

  function renderSubjects() {
    const subjects = SubjectDB.getAll();
    $('subjects-list').innerHTML = subjects.map(s => `
      <div class="subject-row">
        <div class="subject-row-icon"
             style="background: linear-gradient(135deg, ${esc(s.color)}, ${esc(s.color2 || s.color)})">
          ${esc(s.icon || '📚')}
        </div>
        <span class="subject-row-name">${esc(s.label)}</span>
        ${s.builtIn
          ? `<span class="subject-row-lock">🔒</span>`
          : `<button class="btn-del-subject" onclick="App.removeSubject('${esc(s.id)}')" aria-label="삭제">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <polyline points="3 6 5 6 21 6"/>
                 <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                 <path d="M10 11v6M14 11v6"/>
               </svg>
             </button>`
        }
      </div>`).join('');

    _renderColorPalette();
  }

  function _renderColorPalette() {
    $('color-palette').innerHTML = PALETTE.map((p, i) => `
      <div class="color-swatch ${state.selColor === p.color ? 'selected' : ''}"
           style="background:${p.color}"
           data-idx="${i}"
           onclick="App.selectColor(${i})"></div>`).join('');
  }

  function selectColor(idx) {
    state.selColor  = PALETTE[idx].color;
    state.selColor2 = PALETTE[idx].color2;
    _renderColorPalette();
  }

  function saveSubject() {
    const name = $('new-subject-name').value.trim();
    const icon = $('new-subject-icon').value.trim() || '📚';
    if (!name) { alert('과목 이름을 입력해 주세요.'); return; }

    SubjectDB.add({
      id:      Date.now().toString(),
      label:   name,
      color:   state.selColor,
      color2:  state.selColor2,
      icon,
      subTypes: [],
      builtIn: false,
    });

    $('new-subject-name').value = '';
    $('new-subject-icon').value = '';
    renderSubjects();
  }

  function removeSubject(id) {
    if (!confirm('이 과목을 삭제할까요?\n해당 과목의 숙제도 함께 삭제됩니다.')) return;
    SubjectDB.remove(id);
    HomeworkDB.removeBySubjectId(id);
    renderSubjects();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    state.selColor  = PALETTE[0].color;
    state.selColor2 = PALETTE[0].color2;

    // Sync sheet value when user types directly in the input
    $('sheet-value').addEventListener('input', () => {
      const v = parseInt($('sheet-value').value, 10);
      if (!isNaN(v)) {
        sheet.value = Math.max(sheet.start, Math.min(sheet.target, v));
        // Update bar without overwriting the input field
        const range = sheet.target - sheet.start;
        const pct   = range > 0 ? Math.min(100, Math.round(((sheet.value - sheet.start) / range) * 100)) : 0;
        $('sheet-progress-fill').style.width      = pct + '%';
        $('sheet-progress-pct').textContent       = pct + '%';
        const unit = sheet.type === 'count' ? '번' : '페이지';
        $('sheet-progress-detail').textContent    = `목표: ${sheet.target}${unit}  ·  ${pct}% 완료`;
      }
    });

    Promise.all([SubjectDB.syncFromGitHub(), HomeworkDB.syncFromGitHub()])
      .finally(() => navigate('home'));
  });

  // Public API — only expose what HTML needs to call
  return {
    navigate,
    openAdd, openEdit, closeAdd,
    saveHomework, deleteHomework,
    selectSubject, selectSubType,
    selectProgressType,
    openSheet, sheetStep, closeSheet, confirmSheet,
    toggleFilterBar, setFilter,
    toggleDoneSection, toggleItem,
    renderSubjects, saveSubject, removeSubject, selectColor,
  };
})();
