/**
 * SA Wellbeing Platform - Bhutan (SYNTHETIC DATA ONLY)
 * Code.gs = the "server". It loads the data, applies the flag rules,
 * saves follow-ups and prepares privacy-safe numbers for supervisors.
 */
const FLAG_ORDER = ['Urgent', 'High', 'Review', 'None'];
const STATUSES = ['Not started', 'In progress', 'Closed'];
const MIN_GROUP = 5;                  // groups smaller than this are hidden
const DEFAULT_PIN = 'counsellor2026'; // prototype only - see the setup guide
const FOLLOWUP_KEY = 'followups';
const ALT = { q1: [1, 2, 3, 4], q2: [1, 2, 3, 4], q3: ['Never', 'Sometimes', 'Often'],
  q4: ['Yes', 'No'], q5: ['Yes', 'No'], q6: ['Yes', 'No'], q7: ['Yes', 'No'] };
const QLABEL = { q1: 'sleep (q1)', q2: 'safe at home (q2)', q3: 'bullied (q3)', q4: 'trusted adult (q4)',
  q5: 'sad most days (q5)', q6: 'self-harm thoughts (q6)', q7: 'wants counsellor (q7)' };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SA Wellbeing Platform')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- 1. Load and clean the CSV ---------- */
function parseCsv_(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = [];
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

function cleanAnswer_(raw, key, cleaned) {
  const v = String(raw == null ? '' : raw).trim();
  if (v === '') return null;                                  // blank -> unknown (never guessed)
  const m = ALT[key].find(a => String(a).toLowerCase() === v.toLowerCase());
  if (m === undefined) return null;                           // invalid -> unknown
  if (String(m) !== v) cleaned.push(QLABEL[key] + ': "' + v + '" standardised to "' + m + '"');
  return m;
}

function loadStudents_() {
  const rows = parseCsv_(CSV_DATA.trim());
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o = {}; head.forEach((h, i) => o[h] = r[i] === undefined ? '' : r[i]);
    const cleaned = [], raw = {};
    const s = { id: o.student_id.trim(), school: o.school.trim() || 'Unknown', cls: o['class'].trim() || 'Unknown',
      comment: o.comment.trim(), cleaned: cleaned };
    ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach(k => {
      const col = Object.keys(o).find(h => h.indexOf(k + '_') === 0);
      raw[k] = o[col]; s[k] = cleanAnswer_(o[col], k, cleaned);
    });
    s.q6Extra = o.q6_thoughts_of_self_harm && o.q6_thoughts_of_self_harm.trim().toLowerCase() === 'prefer not to say';
    if (s.q6Extra && s.q6 === null) s.q6 = 'Prefer not to say';
    return s;
  });
}

/* ---------- 2. Official baseline flag rules (in order) ---------- */
function classify_(a) {
  if (a.q6 === 'Yes') return { flag: 'Urgent', reason: 'Answered "Yes" to thoughts of self-harm (q6)' };
  const high = [];
  if (a.q3 === 'Often') high.push('bullied "Often" (q3)');
  if (a.q2 === 1) high.push('does not feel safe at home (q2 = 1)');
  if (high.length) return { flag: 'High', reason: high.join(' and ') };
  const two = [];
  if (a.q1 !== null && a.q1 <= 2) two.push('poor sleep (q1 = ' + a.q1 + ')');
  if (a.q5 === 'Yes') two.push('sad most days (q5)');
  if (a.q4 === 'No') two.push('no trusted adult (q4)');
  const why = [];
  if (two.length >= 2) why.push('two or more concerns: ' + two.join(', '));
  if (a.q7 === 'Yes') why.push('asked to see a counsellor (q7)');
  if (why.length) return { flag: 'Review', reason: why.join('; ') };
  return { flag: 'None', reason: 'No rule matched' };
}

/* Extra improvement: "closer look" checks. These NEVER change the official flag. */
function checks_(s, flag) {
  const out = [], rank = FLAG_ORDER.indexOf(flag);
  ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach(k => {
    const unclear = s[k] === null || (k === 'q6' && s[k] === 'Prefer not to say');
    if (!unclear) return;
    let best = rank;
    ALT[k].forEach(v => { const t = Object.assign({}, s); t[k] = v; best = Math.min(best, FLAG_ORDER.indexOf(classify_(t).flag)); });
    const what = s[k] === null ? 'missing or invalid' : 'prefer not to say';
    out.push(QLABEL[k] + ' ' + what + (best < rank ? ': flag could be ' + FLAG_ORDER[best] + ' if answered' : ': does not change the flag'));
  });
  return out;
}

function buildStudents_() {
  return loadStudents_().map(s => {
    const c = classify_(s);
    return { id: s.id, school: s.school, cls: s.cls, flag: c.flag, reason: c.reason, comment: s.comment,
      checks: checks_(s, c.flag), cleaned: s.cleaned, raw: s };
  });
}

/* ---------- 3. Counsellor functions (PIN protected) ---------- */
function pin_() { return PropertiesService.getScriptProperties().getProperty('COUNSELLOR_PIN') || DEFAULT_PIN; }
function requirePin_(p) { if (String(p) !== pin_()) throw new Error('Incorrect access code.'); }
function followups_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(FOLLOWUP_KEY) || '{}'); } catch (e) { return {}; }
}

function getCounsellorData(pin) {
  requirePin_(pin);
  const fu = followups_();
  const list = buildStudents_().map(s => {
    delete s.raw;
    s.status = s.flag === 'None' ? null : ((fu[s.id] && fu[s.id].status) || 'Not started');
    return s;
  });
  list.sort((a, b) => FLAG_ORDER.indexOf(a.flag) - FLAG_ORDER.indexOf(b.flag) || a.id.localeCompare(b.id));
  return list;
}

function setFollowUp(pin, id, status) {
  requirePin_(pin);
  if (STATUSES.indexOf(status) < 0) throw new Error('Invalid status.');
  const st = buildStudents_().find(s => s.id === id);
  if (!st) throw new Error('Unknown student.');
  if (st.flag === 'None') throw new Error('Only flagged students have follow-ups.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const fu = followups_(); fu[id] = { status: status, updatedAt: new Date().toISOString() };
    PropertiesService.getScriptProperties().setProperty(FOLLOWUP_KEY, JSON.stringify(fu));
  } finally { lock.releaseLock(); }
  return { id: id, status: status };
}

/* ---------- 4. Supervisor functions (aggregates only, no IDs ever leave the server) ---------- */
function count_(list) {
  const c = { Urgent: 0, High: 0, Review: 0, None: 0 }; list.forEach(s => c[s.flag]++); return c;
}

// Hide small cells. If only ONE cell in a row is hidden it could be worked out by
// subtraction from the total, so the next-smallest cell is withheld as well.
function maskRow_(counts) {
  const hide = FLAG_ORDER.map(f => counts[f] < MIN_GROUP);
  const extra = FLAG_ORDER.map(() => false);
  if (hide.filter(Boolean).length === 1) {
    let k = -1; FLAG_ORDER.forEach((f, i) => { if (!hide[i] && (k < 0 || counts[f] < counts[FLAG_ORDER[k]])) k = i; });
    if (k >= 0) extra[k] = true;
  }
  return FLAG_ORDER.map((f, i) => hide[i] ? { text: '<5', value: null }
    : extra[i] ? { text: 'withheld', value: null } : { text: String(counts[f]), value: counts[f] });
}

// Same idea for a set of groups that add up to a known parent total (e.g. classes in a school).
function maskGroups_(groups) {
  const small = groups.map(g => g.n < MIN_GROUP), w = groups.map(() => false);
  if (small.filter(Boolean).length === 1) {
    let k = -1; groups.forEach((g, i) => { if (!small[i] && (k < 0 || g.n < groups[k].n)) k = i; });
    if (k >= 0) w[k] = true;
  }
  return groups.map((g, i) => {
    const hidden = small[i] || w[i], t = small[i] ? '<5' : 'withheld';
    return { label: g.label, n: hidden ? t : String(g.n),
      cells: hidden ? FLAG_ORDER.map(() => ({ text: t, value: null })) : maskRow_(g.counts) };
  });
}

const INDICATORS = [
  ['Sleeps poorly', s => s.q1 === null ? undefined : s.q1 <= 2],
  ['Does not feel safe at home', s => s.q2 === null ? undefined : s.q2 <= 2],
  ['Bullied (sometimes or often)', s => s.q3 === null ? undefined : s.q3 !== 'Never'],
  ['No trusted adult', s => s.q4 === null ? undefined : s.q4 === 'No'],
  ['Sad most days', s => s.q5 === null ? undefined : s.q5 === 'Yes'],
  ['Wants to see a counsellor', s => s.q7 === null ? undefined : s.q7 === 'Yes']
];

function getSupervisorData() {
  const all = buildStudents_(), raw = all.map(s => Object.assign({ flag: s.flag }, s.raw));
  const schools = [...new Set(all.map(s => s.school))].sort();
  const schoolRows = maskGroups_(schools.map(sc => {
    const g = all.filter(s => s.school === sc); return { label: sc, n: g.length, counts: count_(g) };
  }));
  const classRows = schools.map((sc, i) => {
    const classes = [...new Set(all.filter(s => s.school === sc).map(s => s.cls))];
    const groups = classes.map(c => { const g = all.filter(s => s.school === sc && s.cls === c); return { label: c, n: g.length, counts: count_(g) }; });
    return { school: sc, rows: maskGroups_(groups) };
  });
  const patterns = INDICATORS.map(ind => ({
    label: ind[0],
    cells: schools.map(sc => {
      const g = raw.filter(s => s.school === sc && ind[1](s) !== undefined);
      const k = g.filter(s => ind[1](s)).length;
      return g.length < MIN_GROUP || k < MIN_GROUP ? { text: '<5', pct: null }
        : { text: Math.round(100 * k / g.length) + '% (' + k + ')', pct: Math.round(100 * k / g.length) };
    })
  }));
  return { total: all.length, flags: FLAG_ORDER, overall: maskRow_(count_(all)), schools: schools, schoolRows: schoolRows,
    classRows: classRows, patterns: patterns, minGroup: MIN_GROUP };
}

