/* ============ Portia — Progress tab ============ */

const pgState = {
  range: '3M',
  hoverIdx: null,
  modal: null, // { key, kind, label, unit, current, target, date, error, phase }
};

function setPgState(patch) {
  const next = typeof patch === 'function' ? patch(pgState) : patch;
  Object.assign(pgState, next);
  renderProgress();
}

function fmtPg(n) {
  return n.toLocaleString('en-US');
}
function fmtDatePg(d) {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

/* ============ Weight series ============ */

function fullWeightSeries() {
  return Data.getWeightEntries().map((e) => ({ w: e.value, date: new Date(e.date + 'T00:00:00') }));
}
function visibleWeightSeries() {
  const all = fullWeightSeries();
  const r = pgState.range;
  if (r === 'All') return all;
  if (r === '3M') return all.slice(-7);
  return all.slice(-3);
}
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
function setRangePg(r) {
  setPgState({ range: r, hoverIdx: null });
}

/* ============ Modal ============ */

function metricData(key) {
  const goals = Data.getGoals();
  if (key === 'weight') {
    const all = fullWeightSeries();
    const current = all.length ? all[all.length - 1].w : null;
    return { label: 'Weight', kind: 'measure', unit: 'kg', current, target: goals.weightTarget, start: goals.weightStart };
  }
  if (key === 'protein') return { label: 'Protein goal', kind: 'goal', unit: 'g', current: null, target: goals.proteinTarget };
  if (key === 'calorie') return { label: 'Calorie limit', kind: 'goal', unit: 'kcal', current: null, target: goals.calorieTarget };
  if (key === 'waist') {
    const all = Data.getWaistEntries();
    const current = all.length ? all[all.length - 1].value : null;
    return { label: 'Waist', kind: 'measure', unit: 'cm', current, target: goals.waistTarget, start: goals.waistStart };
  }
  if (key === 'water') return { label: 'Water', kind: 'goal', unit: 'ml', current: null, target: goals.waterTarget };
  const hipsAll = Data.getHipsEntries();
  const hipsCurrent = hipsAll.length ? hipsAll[hipsAll.length - 1].value : null;
  return { label: 'Hips', kind: 'measure', unit: 'cm', current: hipsCurrent, target: goals.hipsTarget, start: goals.hipsStart };
}
function todayIsoPg() {
  return new Date().toISOString().slice(0, 10);
}
function openModalPg(key) {
  const m = metricData(key);
  setPgState({
    modal: {
      key, kind: m.kind, label: m.label, unit: m.unit,
      start: m.start != null ? String(m.start) : '',
      startLocked: m.start != null,
      current: m.current != null ? String(m.current) : '',
      target: m.target != null ? String(m.target) : '',
      date: todayIsoPg(),
      error: '', phase: 'idle',
    },
  });
}
function closeModalPg() {
  setPgState({ modal: null });
}
function setModalField(field, v) {
  setPgState((s) => ({ modal: { ...s.modal, [field]: v, error: '' } }));
}
function validNumPg(v) {
  return v.trim() !== '' && /^[0-9]+(\.[0-9]+)?$/.test(v.trim()) && Number(v) > 0;
}
function validDatePg(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') && v <= todayIsoPg();
}
function saveModalPg() {
  const md = pgState.modal;
  if (!md || md.phase !== 'idle') return;
  if (md.kind === 'measure' && !md.startLocked && !validNumPg(md.start)) {
    setPgState((s) => ({ modal: { ...s.modal, error: 'Enter a valid starting number.' } }));
    return;
  }
  if (!validNumPg(md.target)) {
    setPgState((s) => ({ modal: { ...s.modal, error: 'Enter a valid target number.' } }));
    return;
  }
  if (md.kind === 'measure' && !validNumPg(md.current)) {
    setPgState((s) => ({ modal: { ...s.modal, error: 'Enter a valid number for the current value.' } }));
    return;
  }
  if (md.kind === 'measure' && !validDatePg(md.date)) {
    setPgState((s) => ({ modal: { ...s.modal, error: 'Enter a valid date — it can\'t be in the future.' } }));
    return;
  }
  setPgState((s) => ({ modal: { ...s.modal, phase: 'loading', error: '' } }));
  setTimeout(() => {
    if (!pgState.modal) return;
    setPgState((s) => ({ modal: { ...s.modal, phase: 'success' } }));
    setTimeout(() => applyModalPg(), 820);
  }, 760);
}
function applyModalPg() {
  const md = pgState.modal;
  if (!md) return;
  const cur = md.current.trim() === '' ? null : Number(md.current);
  const tgt = Number(md.target);
  const startVal = md.kind === 'measure' && !md.startLocked ? Number(md.start) : null;
  if (md.key === 'weight') {
    Data.addWeightEntry({ date: md.date, value: cur });
    const patch = { weightTarget: tgt };
    if (startVal != null) patch.weightStart = startVal;
    Data.updateGoals(patch);
  } else if (md.key === 'protein') {
    Data.updateGoals({ proteinTarget: tgt });
  } else if (md.key === 'calorie') {
    Data.updateGoals({ calorieTarget: tgt });
  } else if (md.key === 'waist') {
    Data.addWaistEntry({ date: md.date, value: cur });
    const patch = { waistTarget: tgt };
    if (startVal != null) patch.waistStart = startVal;
    Data.updateGoals(patch);
  } else if (md.key === 'hips') {
    Data.addHipsEntry({ date: md.date, value: cur });
    const patch = { hipsTarget: tgt };
    if (startVal != null) patch.hipsStart = startVal;
    Data.updateGoals(patch);
  } else if (md.key === 'water') {
    Data.setWaterGoal(tgt);
  }
  setPgState({ modal: null });
}

/* ============ Badges ============ */

function fmtBadgeDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
function badgeData() {
  const streak = Data.getStreak();
  const waterStreak = Data.getWaterStreak();
  const proteinStreak = Data.getProteinStreak();
  return [
    { id: 's7', type: 'streak', icon: 'star', label: '7-day streak', unlocked: streak.currentStreak >= 7, date: 'Jun 25', isNew: true, hint: 'Log meals 7 days in a row' },
    { id: 's30', type: 'streak', icon: 'star', label: '30-day streak', unlocked: streak.currentStreak >= 30, hint: 'Log meals 30 days in a row' },
    { id: 's90', type: 'streak', icon: 'star', label: '90-day streak', unlocked: streak.currentStreak >= 90, hint: 'Log meals 90 days in a row' },
    { id: 'fl', type: 'logging', icon: 'check', label: 'First log', unlocked: streak.totalDaysTracked >= 1, date: 'May 17' },
    { id: 'fw', type: 'logging', icon: 'cal', label: 'First week', unlocked: streak.totalDaysTracked >= 7, date: 'May 24', hint: 'Log meals on 7 different days' },
    { id: 'fm', type: 'logging', icon: 'cal', label: 'First month', unlocked: streak.totalDaysTracked >= 30, date: 'Jun 16', hint: 'Log meals on 30 different days' },
    { id: 'hs', type: 'logging', icon: 'glass', label: 'Hydration Station', unlocked: waterStreak.currentStreak >= 7, date: fmtBadgeDate(waterStreak.lastMetDate), hint: 'Log water 7 days in a row' },
    { id: 'pp', type: 'logging', icon: 'drumstick', label: 'Protein Pro', unlocked: proteinStreak.currentStreak >= 7, date: fmtBadgeDate(proteinStreak.lastMetDate), hint: 'Hit protein goal 7 days in a row' },
  ];
}
function buildBadges() {
  const MI = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const dnum = (b) => { if (!b.date) return -1; const p = b.date.split(' '); return MI[p[0]] * 100 + parseInt(p[1], 10); };
  const ordered = [...badgeData()].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (!a.unlocked) return 0;
    const da = dnum(a), db = dnum(b);
    if (db !== da) return db - da;
    return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
  });
  return ordered.map((b) => {
    const streak = b.type === 'streak';
    const accent = streak ? '#E8B800' : '#2ABFAD';
    const accentSoft = streak ? 'rgba(232,184,0,0.14)' : 'rgba(42,191,173,0.14)';

    let iconWrap = 'position:relative; width:58px; height:58px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:13px;';
    let tileStyle = 'position:relative; background:#1C2733; border:1px solid #2A3A4A; border-radius:16px; padding:22px 16px 18px; display:flex; flex-direction:column; align-items:center; text-align:center; min-height:150px;';
    let labelStyle = 'font-size:13.5px; font-weight:600; color:#E8EDF2;';
    let subStyle = 'font-size:11.5px; color:#8B9BAD; margin-top:4px;';
    const iconSize = 26;

    let iconFill = 'none', iconStroke = accent;
    if (b.unlocked) {
      iconWrap += ` background:${accentSoft};`;
      if (b.icon === 'star') { iconFill = accent; iconStroke = 'none'; }
      if (streak) tileStyle += ' border-color:rgba(232,184,0,0.35);';
    } else {
      iconWrap += ' background:#222E3B; opacity:0.55;';
      iconFill = b.icon === 'star' ? '#4A5A6B' : 'none';
      iconStroke = '#4A5A6B';
      tileStyle += ' opacity:0.62;';
      labelStyle = labelStyle.replace('#E8EDF2', '#8B9BAD');
    }
    if (b.isNew && b.unlocked) tileStyle += ' animation:newpulse 2.4s ease-in-out infinite;';

    const subText = b.unlocked ? `Unlocked ${b.date}` : 'Locked';
    const hintHtml = (!b.unlocked && b.hint) ? `<div style="font-size:10.5px; color:#8B9BAD; opacity:0.75; margin-top:2px; line-height:1.3;">${b.hint}</div>` : '';

    let iconSvg;
    if (b.icon === 'star') iconSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${iconFill}" stroke="${iconStroke}" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"></path></svg>`;
    else if (b.icon === 'check') iconSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;
    else if (b.icon === 'glass') iconSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.104l-1.626 16.256a1 1 0 0 1-.995.901H7.737a1 1 0 0 1-.995-.901z"></path><path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"></path></svg>`;
    else if (b.icon === 'drumstick') iconSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.3" cy="9.3" r="5.3"></circle><line x1="12.8" y1="12.8" x2="17.5" y2="17.5"></line><circle cx="18.3" cy="18.3" r="2.1"></circle></svg>`;
    else iconSvg = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"></rect><path d="M3 9.5h18M8 2.5v4M16 2.5v4"></path></svg>`;

    const lockSvg = !b.unlocked ? `
      <div style="position:absolute; right:-5px; bottom:-5px; width:22px; height:22px; border-radius:50%; background:#141B24; border:1px solid #2A3A4A; display:flex; align-items:center; justify-content:center;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>
      </div>
    ` : '';
    const newBadgeHtml = (b.isNew && b.unlocked) ? `<div style="position:absolute; top:11px; right:11px; font-size:9px; font-weight:600; letter-spacing:0.06em; color:#141B24; background:#E8B800; padding:3px 7px; border-radius:6px;">NEW</div>` : '';

    return `
      <div class="badge" style="${tileStyle}">
        ${newBadgeHtml}
        <div style="${iconWrap}">${iconSvg}${lockSvg}</div>
        <div style="${labelStyle}">${b.label}</div>
        <div style="${subStyle}">${subText}</div>
        ${hintHtml}
      </div>
    `;
  }).join('');
}

/* ============ Rendering ============ */

function renderNavPg() {
  return `
    <div class="nav-row">
      <div class="nav-left">
        <div class="logo">portia</div>
        <div class="nav-pills">
          <a class="nav-tab" href="today.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg>
            Today
          </a>
          <a class="nav-tab" href="week.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
            Week
          </a>
          <a class="nav-tab" href="recipes.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>
            Recipes
          </a>
          <a class="nav-tab active" href="progress.html">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="M7 15l3.5-4 3 2.5L20 7"/></svg>
            Progress
          </a>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="streak-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"/></svg>
          <span class="streak-number">${Data.getStreak().currentStreak}</span>
          <span class="streak-label">day streak</span>
        </div>
        <a href="backup.html" title="Backup & sync" style="width:40px; height:40px; border-radius:12px; background:#1C2733; border:1px solid #2A3A4A; display:flex; align-items:center; justify-content:center; color:#8B9BAD; transition:color 150ms ease;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.6 4.6 0 0 1-1-9.1A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1-1 7.9"></path><path d="M12 12v8m0 0-3-3m3 3 3-3"></path></svg>
        </a>
      </div>
    </div>
  `;
}

function renderWeightCard() {
  const goals = Data.getGoals();
  const all = fullWeightSeries();
  const current = all.length ? all[all.length - 1].w : null;
  const start = goals.weightStart != null ? goals.weightStart : (all.length ? all[0].w : null);
  const target = goals.weightTarget;
  const filled = current != null;

  if (!filled) {
    return `
      <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:26px 28px; margin-bottom:18px;">
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:18px 0 8px;">
          <div class="section-label" style="align-self:flex-start; margin-bottom:24px;">Weight</div>
          <div style="position:relative; width:100%; height:120px; margin-bottom:22px; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 1000 120" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;">
              <line x1="12" y1="60" x2="988" y2="60" stroke="#2A3A4A" stroke-width="1.5" stroke-dasharray="6 7"></line>
            </svg>
            <div style="position:relative; width:54px; height:54px; border-radius:14px; background:#141B24; border:1px solid #2A3A4A; display:flex; align-items:center; justify-content:center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7l3 3"></path></svg>
            </div>
          </div>
          <div style="font-size:19px; font-weight:600; color:#E8EDF2; margin-bottom:6px;">Track your weight</div>
          <div style="font-size:14px; color:#8B9BAD; margin-bottom:20px;">Log your current and target weight to see your progress</div>
          <button data-action="open-modal" data-key="weight" class="btn-primary" style="width:auto; display:inline-flex; align-items:center; gap:8px; padding:13px 22px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
            Set weight goal
          </button>
        </div>
      </div>
    `;
  }

  const VBW = 1000, VBH = 240, padL = 12, padR = 12, padT = 18, padB = 28;
  const wMax = start + 1, wMin = target - 1;
  const yOf = (val) => padT + ((wMax - val) / (wMax - wMin)) * (VBH - padT - padB);
  const series = visibleWeightSeries();
  const n = series.length;
  const xOf = (i) => padL + (n === 1 ? 0 : (i / (n - 1))) * (VBW - padL - padR);
  const pts = series.map((p, i) => ({ x: xOf(i), y: yOf(p.w), w: p.w, date: p.date }));
  const linePath = smoothPath(pts);
  const baseY = VBH - padB;
  const areaPath = pts.length > 1 ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${baseY} L ${pts[0].x.toFixed(1)},${baseY} Z` : '';
  const startY = yOf(start), targetY = yOf(target);

  const dotsHtml = pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="#141B24" stroke="#2ABFAD" stroke-width="2"></circle>`).join('');

  const hoverActive = pgState.hoverIdx != null && pgState.hoverIdx < n;
  const hp = hoverActive ? pts[pgState.hoverIdx] : null;
  const hoverHtml = hp ? `
    <line x1="${hp.x.toFixed(1)}" y1="0" x2="${hp.x.toFixed(1)}" y2="212" stroke="#3D5166" stroke-width="1"></line>
    <circle cx="${hp.x.toFixed(1)}" cy="${hp.y.toFixed(1)}" r="6" fill="#2ABFAD" stroke="#141B24" stroke-width="2.5"></circle>
  ` : '';
  const tipHtml = hp ? `
    <div style="position:absolute; left:${(hp.x / VBW * 100).toFixed(2)}%; top:${(hp.y / VBH * 100 * 0.96).toFixed(2)}%; transform:translate(-50%,-128%); background:#0E141B; border:1px solid #2A3A4A; border-radius:9px; padding:7px 11px; pointer-events:none; box-shadow:0 8px 22px rgba(0,0,0,0.5); white-space:nowrap;">
      <div style="font-size:15px; font-weight:600; color:#E8EDF2; line-height:1;">${hp.w.toFixed(1)} kg</div>
      <div style="font-size:11px; color:#8B9BAD; margin-top:3px;">${fmtDatePg(hp.date)}</div>
    </div>
  ` : '';

  const startLabelTop = `${(startY / VBH * 230 - 9).toFixed(0)}px`;
  const targetLabelTop = `${(targetY / VBH * 230 - 9).toFixed(0)}px`;
  const delta = current - start;
  const weightDelta = `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(0)} kg`;

  const rangePillsHtml = ['1M', '3M', 'All'].map((r) => {
    const on = pgState.range === r;
    return `<div data-action="set-range" data-range="${r}" style="padding:6px 13px; border-radius:8px; font-size:12.5px; font-weight:500; cursor:pointer; transition:background 150ms ease, color 150ms ease; ${on ? 'background:#2A3A4A; color:#E8EDF2;' : 'color:#8B9BAD;'}">${r}</div>`;
  }).join('');

  return `
    <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:20px; padding:26px 28px; margin-bottom:18px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px;">
        <div>
          <div class="section-label" style="margin-bottom:10px;">Weight</div>
          <div style="display:flex; align-items:baseline; gap:10px;">
            <span style="font-size:46px; font-weight:600; line-height:0.9; color:#E8EDF2; letter-spacing:-0.03em;">${current}</span>
            <span style="font-size:20px; font-weight:500; color:#E8EDF2;">kg</span>
            <span style="font-size:14px; font-weight:500; color:#2ABFAD; background:rgba(42,191,173,0.13); padding:4px 9px; border-radius:7px; margin-left:4px;">${weightDelta}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="display:flex; align-items:center; gap:3px; background:#141B24; border:1px solid #2A3A4A; border-radius:10px; padding:3px;">${rangePillsHtml}</div>
          <div data-action="open-modal" data-key="weight" title="Log weight" class="icon-btn" style="width:38px; height:38px; border-radius:10px; border:1px solid #2A3A4A;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
          </div>
        </div>
      </div>
      <div style="position:relative; width:100%;">
        <svg id="weight-chart-svg" viewBox="0 0 1000 240" preserveAspectRatio="none" style="width:100%; height:230px; display:block; overflow:visible;">
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2ABFAD" stop-opacity="0.32"></stop>
              <stop offset="100%" stop-color="#2ABFAD" stop-opacity="0"></stop>
            </linearGradient>
            <filter id="wglow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="6" result="b"></feGaussianBlur>
              <feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
            </filter>
          </defs>
          <line x1="12" y1="${startY.toFixed(1)}" x2="988" y2="${startY.toFixed(1)}" stroke="#3D5166" stroke-width="1" stroke-dasharray="2 5"></line>
          <line x1="12" y1="${targetY.toFixed(1)}" x2="988" y2="${targetY.toFixed(1)}" stroke="#2ABFAD" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.7"></line>
          <path d="${areaPath}" fill="url(#wfill)"></path>
          <path d="${linePath}" fill="none" stroke="#2ABFAD" style="stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; filter:url(#wglow);"></path>
          ${dotsHtml}
          ${hoverHtml}
        </svg>
        <div style="position:absolute; right:0; top:0; transform:translateY(${startLabelTop}); font-size:11px; color:#6B7E91; background:#1C2733; padding:1px 5px; border-radius:5px;">Start ${start}</div>
        <div style="position:absolute; right:0; top:0; transform:translateY(${targetLabelTop}); font-size:11px; color:#2ABFAD; background:#1C2733; padding:1px 5px; border-radius:5px;">Target ${target}</div>
        <div id="weight-chart-hover" style="position:absolute; inset:0 0 18px 0; cursor:crosshair;"></div>
        ${tipHtml}
      </div>
    </div>
  `;
}

function renderSmallCards() {
  const goals = Data.getGoals();
  const waistEntries = Data.getWaistEntries();
  const hipsEntries = Data.getHipsEntries();
  const waistCurrent = waistEntries.length ? waistEntries[waistEntries.length - 1].value : null;
  const hipsCurrent = hipsEntries.length ? hipsEntries[hipsEntries.length - 1].value : null;
  const cardsMeta = [
    { key: 'protein', label: 'Protein goal', kind: 'goal', unit: 'g', sub: 'Daily target', target: goals.proteinTarget },
    { key: 'calorie', label: 'Calorie limit', kind: 'goal', unit: 'kcal', sub: 'Daily limit', target: goals.calorieTarget },
    { key: 'waist', label: 'Waist', kind: 'measure', unit: 'cm', start: goals.waistStart, current: waistCurrent, target: goals.waistTarget },
    { key: 'hips', label: 'Hips', kind: 'measure', unit: 'cm', start: goals.hipsStart, current: hipsCurrent, target: goals.hipsTarget },
    { key: 'water', label: 'Water', kind: 'goal', unit: 'ml', sub: 'Daily target', target: goals.waterTarget },
  ];

  const cardsHtml = cardsMeta.map((m) => {
    const filled = m.kind === 'goal' ? m.target != null : (m.current != null && m.target != null);
    const reached = m.kind === 'measure' && filled && m.current <= m.target;
    const flipStyle = `position:relative; width:100%; height:100%; transition:transform 760ms cubic-bezier(0.45,0.05,0.2,1); transform-style:preserve-3d; transform:perspective(1500px) rotateY(${reached ? 180 : 0}deg);`;

    let bigVal, subText, showBar = false, barStyle = '', showGoalLine = false, goalLineText = '';
    if (m.kind === 'goal') {
      bigVal = fmtPg(m.target);
      subText = '';
      showGoalLine = true;
      goalLineText = m.sub;
    } else {
      bigVal = filled ? String(m.current) : '';
      subText = filled ? `/ ${m.target} ${m.unit}` : '';
      if (filled && m.start != null) {
        const pct = Math.min(100, Math.max(6, ((m.start - m.current) / (m.start - m.target)) * 100));
        showBar = true;
        barStyle = `height:100%; width:${pct.toFixed(0)}%; background:#2ABFAD; border-radius:4px; transition:width 600ms ease;`;
      }
    }

    const frontHtml = `
      <div class="small-card" style="position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; transform:rotateY(0deg); background:#1C2733; border:1px solid #2A3A4A; border-radius:18px; padding:20px 22px; display:flex; flex-direction:column;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between;">
          <span class="section-label">${m.label}</span>
          ${filled ? `
            <div class="card-pencil icon-btn" data-action="open-modal" data-key="${m.key}" title="Edit goal" style="width:28px; height:28px; transition:opacity 0.15s ease, color 150ms ease, transform 80ms ease;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
            </div>
          ` : ''}
        </div>
        ${filled ? `
          <div style="margin-top:auto;">
            <div style="display:flex; align-items:baseline; gap:7px; margin-bottom:6px;">
              <span style="font-size:28px; font-weight:600; line-height:0.9; color:#E8EDF2; letter-spacing:-0.02em;">${bigVal}</span>
              <span style="font-size:16px; font-weight:500; color:#E8EDF2;">${m.unit}</span>
              <span style="font-size:13px; color:#8B9BAD; margin-left:2px;">${subText}</span>
            </div>
            ${showBar ? `
              <div style="height:18px; display:flex; align-items:center;">
                <div style="width:100%; height:6px; background:#2A3A4A; border-radius:4px; overflow:hidden;"><div style="${barStyle}"></div></div>
              </div>
            ` : ''}
            ${showGoalLine ? `
              <div style="height:18px; display:flex; align-items:center; gap:7px;">
                <div style="width:7px; height:7px; border-radius:50%; background:#2ABFAD;"></div>
                <span style="font-size:12px; color:#8B9BAD;">${goalLineText}</span>
              </div>
            ` : ''}
          </div>
        ` : `
          <div style="margin-top:auto;">
            <div data-action="open-modal" data-key="${m.key}" style="display:inline-flex; align-items:center; gap:6px; color:#2ABFAD; font-size:13px; font-weight:500; cursor:pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
              Add goal
            </div>
          </div>
        `}
      </div>
    `;

    const backHtml = `
      <div style="position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; transform:rotateY(180deg); background:rgba(232,184,0,0.13); border:1px solid rgba(232,184,0,0.55); border-radius:18px; padding:20px 22px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; overflow:hidden;">
        <div style="width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(232,184,0,0.20);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#E8B800" stroke="none"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"></path></svg>
        </div>
        <div style="font-size:17px; font-weight:600; color:#E8EDF2; margin-top:12px;">Goal reached!</div>
        <div style="font-size:13px; color:#8B9BAD; margin-top:3px;">${m.label} hit ${m.target != null ? m.target : ''} ${m.unit}</div>
        <button data-action="open-modal" data-key="${m.key}" class="btn-set-goal" style="margin-top:16px;">Set new goal</button>
      </div>
    `;

    return `
      <div style="perspective:1500px; height:160px;">
        <div style="${flipStyle}">${frontHtml}${backHtml}</div>
      </div>
    `;
  }).join('');

  return `<div style="display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px;">${cardsHtml}</div>`;
}

function renderStreakCard() {
  const streak = Data.getStreak();
  const broken = streak.currentStreak === 0;
  const streakStatus = broken ? 'Streak broken — log today to start again' : 'On a roll — keep it going!';
  const streakStatusColor = broken ? '#E0746A' : '#8B9BAD';
  const streakIconStyle = broken
    ? 'width:58px; height:58px; border-radius:16px; background:#222E3B; display:flex; align-items:center; justify-content:center; flex-shrink:0;'
    : 'width:58px; height:58px; border-radius:16px; background:rgba(232,184,0,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0;';
  const starFill = broken ? 'none' : '#E8B800';
  const starStroke = broken ? '#5C6B7A' : 'none';

  return `
    <div style="background:#1C2733; border:1px solid #2A3A4A; border-radius:18px; padding:24px 24px; display:flex; flex-direction:column; align-items:stretch; gap:20px;">
      <div style="display:flex; align-items:center; gap:18px;">
        <div style="${streakIconStyle}">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="${starFill}" stroke="${starStroke}" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.9 6.9 20.7l1.5-6.4L3.5 9.6l6.4-.5z"></path></svg>
        </div>
        <div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span style="font-size:38px; font-weight:600; line-height:0.9; color:#E8B800; letter-spacing:-0.03em;">${streak.currentStreak}</span>
            <span style="font-size:16px; color:#8B9BAD;">day streak</span>
          </div>
          <div style="font-size:13px; color:${streakStatusColor}; margin-top:5px;">${streakStatus}</div>
        </div>
      </div>
      <div style="display:flex; align-items:stretch; gap:0; border-top:1px solid #2A3A4A; padding-top:18px;">
        <div style="flex:1; padding:0 12px; text-align:center; border-right:1px solid #2A3A4A;">
          <div style="font-size:22px; font-weight:600; color:#E8EDF2; letter-spacing:-0.02em;">${streak.bestStreak}</div>
          <div class="section-label" style="margin-top:4px;">Best streak</div>
        </div>
        <div style="flex:1; padding:0 12px; text-align:center;">
          <div style="font-size:22px; font-weight:600; color:#E8EDF2; letter-spacing:-0.02em;">${streak.totalDaysTracked}</div>
          <div class="section-label" style="margin-top:4px;">Days tracked</div>
        </div>
      </div>
    </div>
  `;
}

function renderModalPg() {
  const md = pgState.modal;
  if (!md) return '';
  const phase = md.phase;
  const busy = phase === 'loading' || phase === 'success';
  const errBorder = 'border-color: rgba(224,116,106,0.7) !important;';
  const startInvalid = md.error && md.kind === 'measure' && !md.startLocked && !validNumPg(md.start);
  const curInvalid = md.error && md.kind === 'measure' && !validNumPg(md.current);
  const tgtInvalid = md.error && !validNumPg(md.target);
  const dateInvalid = md.error && md.kind === 'measure' && !validDatePg(md.date);

  const startFieldHtml = md.kind === 'measure' ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#8B9BAD; margin-bottom:8px;">Start ${md.label.toLowerCase()}</div>
      <div class="field-box${md.startLocked ? ' is-disabled' : ''}" style="${startInvalid ? errBorder : ''}">
        <input id="pg-start" value="${md.start}" placeholder="0" ${md.startLocked ? 'disabled title="Start is locked after your first save"' : ''} style="flex:1; min-width:0; background:transparent; border:none; outline:none; font-family:Inter,sans-serif; font-size:18px; font-weight:500; color:${md.startLocked ? '#8B9BAD' : '#E8EDF2'};" />
        ${md.startLocked ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>` : ''}
        <span style="font-size:14px; color:#8B9BAD;">${md.unit}</span>
      </div>
    </div>
  ` : '';

  const currentFieldHtml = md.kind === 'measure' ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#8B9BAD; margin-bottom:8px;">Current ${md.label.toLowerCase()}</div>
      <div class="field-box" style="${curInvalid ? errBorder : ''}">
        <input id="pg-current" value="${md.current}" placeholder="0" style="flex:1; min-width:0; background:transparent; border:none; outline:none; font-family:Inter,sans-serif; font-size:18px; font-weight:500; color:#E8EDF2;" />
        <span style="font-size:14px; color:#8B9BAD;">${md.unit}</span>
      </div>
    </div>
  ` : '';

  const dateFieldHtml = md.kind === 'measure' ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#8B9BAD; margin-bottom:8px;">Date logged</div>
      <div class="field-box" style="${dateInvalid ? errBorder : ''}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8B9BAD" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"></rect><path d="M3 9.5h18M8 2.5v4M16 2.5v4"></path></svg>
        <input type="date" id="pg-date" value="${escapeAttr(md.date)}" max="${todayIsoPg()}" style="flex:1; min-width:0; background:transparent; border:none; outline:none; font-family:Inter,sans-serif; font-size:15px; color:#E8EDF2; color-scheme: dark;" />
      </div>
    </div>
  ` : '';

  const errorHtml = md.error ? `
    <div style="display:flex; align-items:center; gap:8px; background:rgba(224,90,90,0.10); border:1px solid rgba(224,90,90,0.35); border-radius:10px; padding:10px 12px; margin-bottom:16px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E0746A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg>
      <span style="font-size:13px; color:#E0746A;">${md.error}</span>
    </div>
  ` : '';

  let saveBtnContent;
  if (phase === 'loading') {
    saveBtnContent = `<span style="display:inline-flex; align-items:center; gap:9px;"><span style="width:16px; height:16px; border:2px solid rgba(20,27,36,0.35); border-top-color:#141B24; border-radius:50%; display:inline-block; animation:spin 0.7s linear infinite;"></span>Saving…</span>`;
  } else if (phase === 'success') {
    saveBtnContent = `<span style="display:inline-flex; align-items:center; gap:8px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#141B24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Saved</span>`;
  } else {
    saveBtnContent = 'Save';
  }

  return `
    <div class="modal-overlay no-transitions">
      <div style="position:relative; width:100%; max-width:440px; background:#1C2733; border:1px solid #2A3A4A; border-radius:22px; padding:26px 28px 24px; box-shadow:0 30px 80px rgba(0,0,0,0.55); font-family:Inter,sans-serif;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:22px;">
          <span class="modal-title">${md.label}</span>
          <div data-action="close-modal" class="icon-btn" style="width:30px; height:30px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </div>
        </div>
        ${startFieldHtml}
        <div style="margin-bottom:16px;">
          <div style="font-size:12px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#8B9BAD; margin-bottom:8px;">Target ${md.label.toLowerCase()}</div>
          <div class="field-box" style="${tgtInvalid ? errBorder : ''}">
            <input id="pg-target" value="${md.target}" placeholder="0" style="flex:1; min-width:0; background:transparent; border:none; outline:none; font-family:Inter,sans-serif; font-size:18px; font-weight:500; color:#E8EDF2;" />
            <span style="font-size:14px; color:#8B9BAD;">${md.unit}</span>
          </div>
        </div>
        ${currentFieldHtml}
        ${dateFieldHtml}
        ${errorHtml}
        <div style="display:flex; gap:10px; margin-top:4px;">
          <button data-action="close-modal" class="btn-ghost" style="flex:0 0 auto; padding:14px 22px;">Cancel</button>
          <button data-action="save-modal" class="btn-primary" style="flex:1; ${busy ? 'cursor:default;' : ''}">${saveBtnContent}</button>
        </div>
      </div>
    </div>
  `;
}

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PG_FOCUS_IDS = ['pg-start', 'pg-current', 'pg-target', 'pg-date'];

function captureFocusPg() {
  const el = document.activeElement;
  if (!el || !PG_FOCUS_IDS.includes(el.id)) return null;
  // selectionStart/selectionEnd throw on input types that don't support text
  // selection (e.g. type="date") — pg-date only needs focus() restored, not a
  // caret position, so fall back to nulls rather than letting this throw and
  // break the whole re-render.
  try {
    return { id: el.id, selStart: el.selectionStart, selEnd: el.selectionEnd };
  } catch (e) {
    return { id: el.id, selStart: null, selEnd: null };
  }
}
function restoreFocusPg(info) {
  if (!info) return;
  const el = document.getElementById(info.id);
  if (el) {
    el.focus();
    try { el.setSelectionRange(info.selStart, info.selEnd); } catch (e) {}
  }
}

// Modal templates render with a `no-transitions` class baked in so every full
// re-render (triggered on every keystroke) recreates focused inputs without
// replaying their focus-color transition as a flicker; this lifts it after
// one paint so real transitions (hover, etc.) resume working normally.
function clearNoTransitionsPg() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.no-transitions').forEach((el) => el.classList.remove('no-transitions'));
  }));
}

function renderProgress() {
  const app = document.getElementById('app');
  const focusInfo = captureFocusPg();
  app.innerHTML = `
    <div class="page-shell">
      <div class="page-content">
        ${renderNavPg()}
        <div style="margin-bottom:26px;">
          <div class="page-title">Progress</div>
          <div style="font-size:15px; color:#8B9BAD; margin-top:4px;">Your goals, trends, and the milestones you've earned</div>
        </div>
        <div style="display:flex; gap:24px; align-items:flex-start;">
          <div style="flex:2; min-width:0; display:flex; flex-direction:column;">
            <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:14px;">
              <span style="font-size:16px; font-weight:600; color:#E8EDF2;">Goals &amp; metrics</span>
            </div>
            ${renderWeightCard()}
            ${renderSmallCards()}
          </div>
          <div style="flex:1; min-width:0; display:flex; flex-direction:column;">
            <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:14px;">
              <span style="font-size:16px; font-weight:600; color:#E8EDF2;">Achievements</span>
            </div>
            ${renderStreakCard()}
            <div class="section-label" style="margin:22px 0 12px;">Milestones</div>
            <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px;">${buildBadges()}</div>
          </div>
        </div>
      </div>
      ${renderModalPg()}
    </div>
  `;

  restoreFocusPg(focusInfo);
  clearNoTransitionsPg();

  const hoverEl = document.getElementById('weight-chart-hover');
  if (hoverEl) {
    hoverEl.addEventListener('mousemove', (e) => {
      const r = hoverEl.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const n = visibleWeightSeries().length;
      const idx = Math.round(frac * (n - 1));
      if (idx !== pgState.hoverIdx) setPgState({ hoverIdx: idx });
    });
    hoverEl.addEventListener('mouseleave', () => setPgState({ hoverIdx: null }));
  }
}

/* ============ Event delegation ============ */

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    case 'open-modal': openModalPg(target.dataset.key); break;
    case 'close-modal': closeModalPg(); break;
    case 'set-range': setRangePg(target.dataset.range); break;
    case 'save-modal': saveModalPg(); break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'pg-start') setModalField('start', e.target.value);
  else if (e.target.id === 'pg-current') setModalField('current', e.target.value);
  else if (e.target.id === 'pg-target') setModalField('target', e.target.value);
  else if (e.target.id === 'pg-date') setModalField('date', e.target.value);
});

renderProgress();
Data.ready().then(renderProgress);
