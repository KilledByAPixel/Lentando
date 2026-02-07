// ============================================================
// ZERO-FRICTION USAGE + WINS TRACKER
// ============================================================

'use strict';

const debugMode = true;

// ========== CONSTANTS ==========
const STORAGE_EVENTS = 'ht_events';
const STORAGE_SETTINGS = 'ht_settings';
const STORAGE_TODOS = 'ht_todos';
const STORAGE_THEME = 'ht_theme';

const ADDICTION_PROFILES = {
  cannabis: {
    name: 'Cannabis',
    sessionLabel: 'Used',
    substanceLabel: 'Substance',
    substances: ['thc', 'cbd', 'mix'],
    substanceDisplay: { thc: 'THC', cbd: 'CBD', mix: 'Mix' },
    methods: ['bong', 'vape', 'joint', 'edible', 'other'],
    amounts: [0.5, 1.0, 1.5, 2.0],
    amountUnit: 'units',
    icons: { thc: '🔥', cbd: '🌿', mix: '🔥🌿' }
  },
  alcohol: {
    name: 'Alcohol',
    sessionLabel: 'Drank',
    substanceLabel: 'Type',
    substances: ['beer', 'wine', 'liquor', 'mixed'],
    substanceDisplay: { beer: 'Beer', wine: 'Wine', liquor: 'Liquor', mixed: 'Mixed' },
    methods: ['home', 'bar', 'restaurant', 'social', 'other'],
    amounts: [0.5, 1, 2, 3, 4, 5],
    amountUnit: 'drinks',
    icons: { beer: '🍺', wine: '🍷', liquor: '🥃', mixed: '🍹' }
  },
  nicotine: {
    name: 'Nicotine',
    sessionLabel: 'Smoked',
    substanceLabel: 'Type',
    substances: ['cigarette', 'vape', 'gum', 'other'],
    substanceDisplay: { cigarette: 'Cigarette', vape: 'Vape', gum: 'Gum', other: 'Other' },
    methods: ['outside', 'inside', 'car', 'work', 'social', 'other'],
    amounts: [1, 2, 3, 5, 10],
    amountUnit: 'count',
    icons: { cigarette: '🚬', vape: '💨', gum: '🍬', other: '⚡' }
  },
  other: {
    name: 'Other',
    sessionLabel: 'Used',
    substanceLabel: 'Type',
    substances: ['type1', 'type2', 'type3'],
    substanceDisplay: { type1: 'Type 1', type2: 'Type 2', type3: 'Type 3' },
    methods: ['method1', 'method2', 'method3', 'method4', 'other'],
    amounts: [0.5, 1.0, 1.5, 2.0],
    amountUnit: 'units',
    icons: { type1: '⚡', type2: '✨', type3: '🔥' }
  }
};

function getProfile() {
  const key = DB.loadSettings().addictionProfile || 'cannabis';
  return ADDICTION_PROFILES[key];
}

// User input options
const REASONS = ['start', 'break', 'habit', 'boredom', 'reward', 'sleep', 'social', 'pain', 'eating'];
const INTENSITIES = [1, 2, 3, 4, 5];
const TRIGGERS = ['transition', 'boredom', 'stress', 'stuck', 'reward', 'habit', 'social'];
const DID_INSTEAD = ['water', '10 breaths', '2-min tidy', 'step outside', 'stretch', 'just delayed'];
const EXERCISE_DURATIONS = [5, 10, 15, 20, 30, 45, 60];
const OPTIONAL_FIELDS = new Set(['reason', 'trigger', 'didInstead']);

// Timeouts and durations
const CHIP_TIMEOUT_MS = 5000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Win calculation thresholds
const GAP_MILESTONES = [1, 2, 4, 8, 12];
const DAYTIME_START_HOUR = 6;
const DAYTIME_END_HOUR = 20;
const LATE_START_HOUR = 10;
const AFTERNOON_HOUR = 12;
const MAX_STREAK_DAYS = 60;
const LOW_DAY_THRESHOLD = 2;

const COACHING_TIPS = [
  { text: 'Drink water', habit: 'water' },
  { text: '10 breaths', habit: 'breaths' },
  { text: 'Clean room', habit: 'clean' },
  { text: 'Step outside', habit: 'outside' },
];

const HABIT_ICONS = { water: '💧', breaths: '🌬️', clean: '🧹', exercise: '🏃', outside: '🚶' };
const HABIT_LABELS = {
  water: `${HABIT_ICONS.water} Water`,
  breaths: `${HABIT_ICONS.breaths} 10 Breaths`,
  clean: `${HABIT_ICONS.clean} Clean Room`,
  exercise: `${HABIT_ICONS.exercise} Exercise`,
  outside: `${HABIT_ICONS.outside} Outside`
};

const DEFAULT_SETTINGS = {
  addictionProfile: null, // Set on first launch
  lastSubstance: 'thc',
  lastMethod: 'bong',
  lastAmount: 1.0,
  lastReason: null,
  showCoaching: true
};

// ========== TINY HELPERS ==========
const $ = id => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

function flashEl(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 300);
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeOfDayMin(ts) {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

// ========== DATE HELPERS ==========
function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayKey() { return dateKey(new Date()); }

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(ms) {
  if (ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return totalMin + 'm';
  const h = Math.floor(totalMin / 60);
  return h + 'h ' + (totalMin % 60) + 'm';
}

function getLastNDays(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => daysAgoKey(n - 1 - i + offset));
}

function friendlyDate(key) {
  if (key === todayKey()) return 'Today';
  if (key === daysAgoKey(1)) return 'Yesterday';
  return new Date(key + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getPrevDayKey(key) {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

// ========== DATA LAYER ==========
const DB = {
  _events: null,
  _settings: null,

  loadEvents() {
    if (this._events) return this._events;
    try {
      this._events = JSON.parse(localStorage.getItem(STORAGE_EVENTS)) || [];
    } catch {
      this._events = [];
    }
    return this._events;
  },

  saveEvents() {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(this._events));
  },

  loadSettings() {
    if (this._settings) return this._settings;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS));
      this._settings = { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      this._settings = { ...DEFAULT_SETTINGS };
    }
    return this._settings;
  },

  saveSettings() {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(this._settings));
  },

  addEvent(evt) {
    this.loadEvents();
    this._events.push(evt);
    this.saveEvents();
    return evt;
  },

  updateEvent(id, data) {
    this.loadEvents();
    const idx = this._events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    Object.assign(this._events[idx], data);
    this.saveEvents();
    return this._events[idx];
  },

  deleteEvent(id) {
    this.loadEvents();
    this._events = this._events.filter(e => e.id !== id);
    this.saveEvents();
  },

  forDate(key) {
    return this.loadEvents()
      .filter(e => dateKey(e.ts) === key)
      .sort((a, b) => a.ts - b.ts);
  },

  getAllDayKeys() {
    const keys = new Set();
    this.loadEvents().forEach(e => keys.add(dateKey(e.ts)));
    return Array.from(keys).sort().reverse();
  },
};

// ========== EVENT QUERY HELPERS ==========
function filterByType(events, type) { return events.filter(e => e.type === type); }
function filterUsed(events) { return filterByType(events, 'used'); }
function filterTHC(usedEvents) { return usedEvents.filter(e => e.substance === 'thc' || e.substance === 'mix'); }
function filterCBD(usedEvents) { return usedEvents.filter(e => e.substance === 'cbd'); }
function sumAmount(usedEvents) { return usedEvents.reduce((s, e) => s + (e.amount ?? 1), 0); }
function getHabits(events, habitType) { 
  const habits = filterByType(events, 'habit');
  return habitType ? habits.filter(e => e.habit === habitType) : habits;
}

// ========== EVENT FACTORIES ==========
function createUsedEvent(substance, method, amount, reason) {
  const profile = getProfile();
  const sub = substance || 'thc';
  return {
    id: uid(), type: 'used', ts: Date.now(),
    substance: sub, method: method || 'bong',
    amount: amount != null ? amount : 1.0,
    reason: reason || null,
    icon: profile.icons[sub] || '💊',
  };
}

function createResistedEvent(intensity, trigger, didInstead) {
  return {
    id: uid(), type: 'resisted', ts: Date.now(),
    intensity: intensity || null, trigger: trigger || null, didInstead: didInstead || null,
  };
}

function createHabitEvent(habit, minutes) {
  return { id: uid(), type: 'habit', ts: Date.now(), habit, minutes: minutes || null };
}

// ========== WIN CALCULATION HELPERS ==========
function isDaytime(ts) {
  const h = new Date(ts).getHours();
  return h >= DAYTIME_START_HOUR && h < DAYTIME_END_HOUR;
}

function countDelayedResists(resisted, used) {
  return resisted.filter(r => 
    !used.some(u => u.ts > r.ts && u.ts - r.ts <= FIFTEEN_MINUTES_MS)
  ).length;
}

function getMaxGapHours(sessions) {
  if (sessions.length < 2) return 0;
  const maxGapMs = Math.max(...sessions.slice(1).map((u, i) => u.ts - sessions[i].ts));
  return maxGapMs / 3600000;
}

function getFirstSessionGapHours(sessions) {
  if (sessions.length < 1) return 0;
  const dayStart = new Date(sessions[0].ts);
  dayStart.setHours(0, 0, 0, 0);
  return (sessions[0].ts - dayStart.getTime()) / 3600000;
}

function getMilestoneWins(gapHours, milestones) {
  return milestones.filter(h => gapHours >= h);
}

// ========== WINS ENGINE ==========
const Wins = {
  calculate(todayEvents, yesterdayEvents) {
    const wins = [];
    const addWin = (condition, label, count, icon, desc) => {
      if (condition) wins.push({ label, count, icon, desc });
    };

    const used     = filterUsed(todayEvents);
    const resisted = filterByType(todayEvents, 'resisted');
    const habits   = filterByType(todayEvents, 'habit');
    const thcUsed  = filterTHC(used);
    const cbdUsed  = filterCBD(used);
    const totalAmt = sumAmount(used);

    // --- Session-based wins ---
    addWin(resisted.length > 0, 'Resist Win', resisted.length, '💪', 'Logged an urge but resisted using');

    const delayCount = countDelayedResists(resisted, used);
    addWin(delayCount > 0, 'Delay Win (15m+)', delayCount, '⏳', 'Resisted and didn\'t use for at least 15 minutes after');

    const replacementCount = cbdUsed.filter(u => isDaytime(u.ts)).length;
    addWin(replacementCount > 0, 'Replacement Win (CBD)', replacementCount, '🌿', 'Used CBD during daytime (6am-8pm) instead of THC');

    const vapeCount = used.filter(e => e.method === 'vape').length;
    addWin(vapeCount > 0, 'Harm Reduction (vape)', vapeCount, '🌡️', 'Chose vaping as a safer consumption method');

    const doseCount = used.filter(e => e.amount === 0.5).length;
    addWin(doseCount > 0, 'Dose Win (half)', doseCount, '⚖️', 'Used a smaller dose (0.5 units)');

    const mindfulCount = used.filter(e => e.reason).length;
    addWin(mindfulCount > 0, 'Mindful Session', mindfulCount, '🧠', 'Logged the reason for using, showing mindful awareness');

    addWin(used.length > 0 && thcUsed.length === 0, 'CBD-Only Day', 1, '🍃', 'Used only CBD products today, no THC');
    addWin(used.length > 0 && totalAmt <= LOW_DAY_THRESHOLD, `Low Day (≤${LOW_DAY_THRESHOLD} units)`, 1, '🤏', `Kept total usage to ${LOW_DAY_THRESHOLD} units or less`);
    addWin(thcUsed.length === 0 && (resisted.length > 0 || habits.length > 0 || cbdUsed.length > 0), 'Zero THC Day', 1, '🏆', 'No THC today while staying engaged with tracking');
    addWin(used.length === 0 && (resisted.length > 0 || habits.length > 0), 'T-Break Day', 1, '🚫', 'Went a full day without using while staying engaged');

    // --- Habit-based wins ---
    const waterCount = getHabits(todayEvents, 'water').length;
    addWin(waterCount >= 4, 'Hydrated', 1, '💧', 'Drank water at least 4 times today');
    
    const uniqueHabits = new Set(habits.map(e => e.habit));
    addWin(uniqueHabits.size >= 2, `Habit Stack (${uniqueHabits.size} types)`, uniqueHabits.size, '🔗', 'Logged multiple different habit types in one day');

    // --- Timing-based wins ---
    if (thcUsed.length >= 2) {
      const earned = getMilestoneWins(getMaxGapHours(thcUsed), GAP_MILESTONES);
      if (earned.length > 0) {
        const hours = earned[earned.length - 1];
        addWin(true, `Gap Win (${hours}h+)`, earned.length, '⏱️', `Maintained a gap of ${hours}+ hours between sessions`);
      }
    }

    if (thcUsed.length > 0) {
      const firstHour = new Date(thcUsed[0].ts).getHours();
      if (firstHour >= AFTERNOON_HOUR) {
        const firstTime = new Date(thcUsed[0].ts);
        const timeStr = firstTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        addWin(true, `Held Off Until Afternoon (${timeStr})`, 1, '🌅', `Waited until afternoon before first session`);
      }
    }

    // --- Comparison wins ---
    if (yesterdayEvents && yesterdayEvents.length > 0) {
      const yUsed = filterUsed(yesterdayEvents);
      const yThc  = filterTHC(yUsed);

      addWin(thcUsed.length < yThc.length, 'Fewer THC sessions than yesterday', 1, '📉', 'Had fewer THC sessions than yesterday');
      addWin(used.length > 0 && totalAmt < sumAmount(yUsed), 'Lower amount than yesterday', 1, '📉', 'Used a smaller total amount than yesterday');
      
      if (thcUsed.length > 0 && yThc.length > 0) {
        addWin(timeOfDayMin(thcUsed[0].ts) > timeOfDayMin(yThc[0].ts), 'First THC later than yesterday', 1, '⏰', 'Started your first session later than yesterday');
        addWin(timeOfDayMin(thcUsed[thcUsed.length - 1].ts) < timeOfDayMin(yThc[yThc.length - 1].ts), 'Last THC earlier than yesterday', 1, '🌙', 'Finished your last session earlier than yesterday');
      }
    }

    // --- Streak wins ---
    const resistStreak = this._countStreak('resisted');
    addWin(resistStreak >= 2, `Resist Streak (${resistStreak} days)`, resistStreak, '🔥', `Resisted urges for ${resistStreak} days in a row`);
    
    const habitStreak = this._countStreak('habit');
    addWin(habitStreak >= 3, `Habit Streak (${habitStreak} days)`, habitStreak, '⛓️', `Logged healthy habits for ${habitStreak} consecutive days`);

    const taperDays = this._countTaper();
    addWin(taperDays >= 3, `Taper Win (${taperDays} days declining)`, taperDays, '📐', `Gradually reduced usage over ${taperDays} consecutive days`);

    return wins;
  },

  _countStreak(eventType, habitType = null) {
    const d = new Date();
    
    for (let streak = 0; streak < MAX_STREAK_DAYS; streak++) {
      const dayEvents = DB.forDate(dateKey(d));
      const hasEvent = habitType
        ? dayEvents.some(e => e.type === eventType && e.habit === habitType)
        : dayEvents.some(e => e.type === eventType);
      if (!hasEvent) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_STREAK_DAYS;
  },

  _countTaper() {
    let count = 0, prevAmt = null;
    const d = new Date();
    
    for (let i = 0; i < MAX_STREAK_DAYS; i++) {
      const amt = sumAmount(filterUsed(DB.forDate(dateKey(d))));
      if (prevAmt !== null && amt <= prevAmt) break;
      if (prevAmt !== null) count++;
      prevAmt = amt;
      d.setDate(d.getDate() - 1);
    }
    return count;
  },
};

// ========== SHARED HTML BUILDERS ==========

function emptyStateHTML(message, style) {
  const attr = style ? ` style="${style}"` : '';
  return `<div class="empty-state"${attr}>${message}</div>`;
}

function tileHTML(val, label, sub = '') {
  const subHTML = sub ? `<div class="sub">${sub}</div>` : '';
  return `<div class="tile"><div class="val">${val}</div><div class="label">${label}</div>${subHTML}</div>`;
}

/** Generates a labelled chip group. displayFn defaults to String(v). */
function chipGroupHTML(label, field, values, activeVal, displayFn) {
  const fmt = displayFn || (v => String(v));
  return `
    <div class="chip-row-label">${label}</div>
    <div class="chip-group" data-field="${field}">
      ${values.map(v => `<span class="chip${activeVal === v ? ' active' : ''}" data-val="${v}">${fmt(v)}</span>`).join('')}
    </div>`;
}

function getUsedEventDetail(evt) {
  const profile = getProfile();
  
  // Use stored icon if available, otherwise try current profile, otherwise generic
  const icon = evt.icon || profile.icons[evt.substance] || '💊';
  const title = profile.substanceDisplay[evt.substance] || evt.substance.toUpperCase();
  
  return {
    icon,
    title,
    detail: [
      evt.method,
      evt.amount != null && `${evt.amount} ${evt.amount === 1 ? profile.amountUnit.replace(/s$/, '') : profile.amountUnit}`,
      evt.reason
    ].filter(Boolean).join(' · ')
  };
}

function getResistedEventDetail(evt) {
  return {
    icon: '💪',
    title: 'Resisted',
    detail: [
      evt.intensity && 'intensity ' + evt.intensity,
      evt.trigger,
      evt.didInstead && '→ ' + evt.didInstead
    ].filter(Boolean).join(' · ')
  };
}

function getHabitEventDetail(evt) {
  return {
    icon: HABIT_ICONS[evt.habit] || '✅',
    title: HABIT_LABELS[evt.habit] || evt.habit,
    detail: evt.minutes ? evt.minutes + ' min' : ''
  };
}

const EVENT_DETAIL_BUILDERS = {
  used: getUsedEventDetail,
  resisted: getResistedEventDetail,
  habit: getHabitEventDetail
};

/** Renders a single event as a timeline row. */
function eventRowHTML(e, editable) {
  const time = formatTime(e.ts);
  const { icon, title, detail } = EVENT_DETAIL_BUILDERS[e.type]?.(e) || { icon: '', title: '', detail: '' };

  const actions = editable
    ? `<div class="tl-actions">
          <button class="tl-act-btn" onclick="App.editEvent('${e.id}')" title="Edit">✏️</button>
          <button class="tl-act-btn" onclick="App.deleteEvent('${e.id}')" title="Delete">🗑️</button>
        </div>` : '';

  return `<li class="timeline-item" data-id="${e.id}" ${editable ? '' : 'style="padding:4px 0"'}>
    <span class="tl-time">${time}</span>
    <span class="tl-icon">${icon}</span>
    <div class="tl-body"><div class="tl-title">${title}</div><div class="tl-detail">${detail}</div></div>
    ${actions}
  </li>`;
}

// ========== SHARED CHIP VALUE HANDLING ==========
const NUMERIC_FIELDS = { amount: parseFloat, intensity: parseInt, minutes: parseFloat };

function parseChipVal(field, raw) {
  const parser = NUMERIC_FIELDS[field];
  return parser ? parser(raw, 10) : raw;
}

function resolveChipVal(field, rawVal, currentEvent) {
  let val = parseChipVal(field, rawVal);
  if (currentEvent && currentEvent[field] === val && OPTIONAL_FIELDS.has(field)) val = null;
  return val;
}

// ========== STATE ==========
let activeChipEventId = null;
let chipTimeout = null;
let exerciseTimeout = null;
let timerInterval = null;
let graphDays = 7;
let currentHistoryDay = todayKey();

function render() {
  renderDate();
  renderMetrics();
  renderProgress();
  renderWaterReminder();
  renderTodos();
  
  const activeTab = document.querySelector('.tab-panel.active')?.id.replace('tab-', '');
  if (activeTab === 'wins') renderWins();
  else if (activeTab === 'graph') { renderGraphs(); renderDayHistory(); }
}

function renderDate() {
  $('header-date').textContent = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  
  // Update dynamic labels based on profile
  const profile = getProfile();
  const usedLabel = $('used-label');
  if (usedLabel) usedLabel.textContent = profile.sessionLabel;
}

function sumHabitCounts(events, habitTypes) {
  return habitTypes.reduce((sum, h) => sum + getHabits(events, h).length, 0);
}

function buildCannabisTiles(used) {
  const thcUsed = filterTHC(used);
  const cbdCount = filterCBD(used).length + used.filter(e => e.substance === 'mix').length;
  const timeSinceTHC = thcUsed.length > 0 ? formatDuration(Date.now() - thcUsed[thcUsed.length - 1].ts) : '—';
  
  return [
    `<div class="tile"><div class="val" style="color:var(--thc)">${thcUsed.length}</div><div class="label">THC</div><div class="sub" style="color:var(--cbd)">${cbdCount} CBD</div></div>`,
    `<div class="tile"><div class="val">${timeSinceTHC}</div><div class="label">Since Last THC</div></div>`
  ].join('');
}

function renderMetrics() {
  const events   = DB.forDate(todayKey());
  const profile  = getProfile();
  const used     = filterUsed(events);
  const resisted = filterByType(events, 'resisted');
  const totalAmt = sumAmount(used);

  const exerciseMins = getHabits(events, 'exercise').reduce((sum, e) => sum + (e.minutes || 0), 0);
  const exerciseTotal = sumHabitCounts(events, ['exercise', 'outside', 'clean']);
  const goodHabits = sumHabitCounts(events, ['water', 'breaths', 'clean', 'outside']);

  const cannabisTiles = DB.loadSettings().addictionProfile === 'cannabis' ? buildCannabisTiles(used) : '';

  $('metrics').innerHTML = [
    tileHTML(used.length, 'Sessions', `${totalAmt} total ${profile.amountUnit}`),
    tileHTML(resisted.length, 'Urges Resisted'),
    cannabisTiles,
    tileHTML(`${exerciseMins} min`, 'Exercise', `${exerciseTotal} total activities`),
    tileHTML(goodHabits, 'Good Habits', 'today')
  ].join('');
}

function getRatioTile(weekUsed) {
  const settings = DB.loadSettings();
  
  const ratioMap = {
    cannabis: { filter: e => e.substance === 'cbd', label: 'CBD Ratio' },
    alcohol: { filter: e => e.substance === 'beer' || e.substance === 'wine', label: 'Beer/Wine Ratio' },
    nicotine: { filter: e => e.substance === 'vape', label: 'Vape Ratio' },
    other: { filter: e => e.substance === 'type2', label: 'Better Choice' }
  };
  
  const config = ratioMap[settings.addictionProfile];
  const total = weekUsed.length;
  const ratio = total > 0 ? ((weekUsed.filter(config.filter).length / total) * 100).toFixed(0) + '%' : '—';
  return tileHTML(ratio, config.label, 'this week');
}

function getTrendDisplay(trendPct) {
  const arrow = trendPct < -10 ? '↓' : trendPct > 10 ? '↑' : '→';
  const color = trendPct < -10 ? 'var(--win)' : 'var(--muted)';
  const label = Math.abs(trendPct) > 1 ? Math.abs(trendPct).toFixed(0) + '%' : 'stable';
  return { arrow, color, label };
}

function getWeekData(days) {
  const events = days.flatMap(k => DB.forDate(k));
  const used = filterUsed(events);
  return { events, used, thc: filterTHC(used) };
}

function countLateStarts(days) {
  return days.filter(day => {
    const dayTHC = filterTHC(filterUsed(DB.forDate(day)));
    return dayTHC.length > 0 && new Date(dayTHC[0].ts).getHours() >= LATE_START_HOUR;
  }).length;
}

function renderProgress() {
  const last7Days = getLastNDays(7);
  const prev7Days = getLastNDays(7, 7);

  const thisWeek = getWeekData(last7Days);
  const prevWeek = getWeekData(prev7Days);
  
  const thisWeekAvg = thisWeek.used.length / 7;
  const prevWeekAvg = prevWeek.used.length / 7;
  const trendPct = prevWeekAvg > 0 ? ((thisWeekAvg - prevWeekAvg) / prevWeekAvg) * 100 : 0;
  const trend = getTrendDisplay(trendPct);

  const dailyAvg = thisWeekAvg.toFixed(1);

  const longestGapMs = getMaxGapHours(thisWeek.thc) * 3600000;
  const gapStr = longestGapMs > 0 ? formatDuration(longestGapMs) : '—';

  const lateStarts = countLateStarts(last7Days);

  const ratioTile = getRatioTile(thisWeek.used);

  const exerciseMins = getHabits(thisWeek.events, 'exercise').reduce((sum, e) => sum + (e.minutes || 0), 0);
  const exercisePerDay = (exerciseMins / 7).toFixed(1);

  $('progress').innerHTML = [
    `<div class="tile"><div class="val" style="color:${trend.color}">${trend.arrow} ${trend.label}</div><div class="label">7-Day Trend</div><div class="sub">vs prev week</div></div>`,
    tileHTML(dailyAvg, 'Sessions/Day', 'last 7 days'),
    tileHTML(gapStr, 'Longest Gap', 'this week'),
    tileHTML(`${lateStarts} / 7`, 'Late Starts', 'past 10am'),
    ratioTile,
    tileHTML(`${exercisePerDay} min`, 'Exercise/Day', 'last 7 days')
  ].join('');
}

function winCardHTML(w) {
  return `<li class="win-item" title="${w.desc || ''}"><span class="win-badge">${w.count}</span><div class="win-icon">${w.icon}</div><div class="win-label">${w.label}</div></li>`;
}

function aggregateWins(days) {
  const winsMap = new Map();
  
  for (const day of days) {
    const dayEvents = DB.forDate(day);
    const prevDayEvents = DB.forDate(getPrevDayKey(day));
    const dayWins = Wins.calculate(dayEvents, prevDayEvents);
    
    for (const win of dayWins) {
      if (winsMap.has(win.label)) {
        winsMap.get(win.label).count += win.count;
      } else {
        winsMap.set(win.label, { ...win });
      }
    }
  }
  
  return Array.from(winsMap.values()).sort((a, b) => b.count - a.count);
}

function renderWins() {
  const todayWins = Wins.calculate(DB.forDate(todayKey()), DB.forDate(daysAgoKey(1)));
  const todayEl = $('wins-today');
  if (todayEl) {
    todayEl.innerHTML = todayWins.length === 0
      ? emptyStateHTML('Wins appear here as you go')
      : todayWins.map(winCardHTML).join('');
  }

  const totalEl = $('wins-total');
  if (!totalEl) return;
  
  const totalWins = aggregateWins(DB.getAllDayKeys());
  totalEl.innerHTML = totalWins.length === 0
    ? emptyStateHTML('Total wins will appear here')
    : totalWins.map(winCardHTML).join('');
}

function renderWaterReminder() {
  const reminderEl = $('water-reminder');
  reminderEl.classList.toggle('hidden', hasRecentWater());
}

// ========== HISTORY ==========
function historyStatRow(label, value) {
  return `<div class="hd-stat-row"><span class="hd-label">${label}</span><span>${value}</span></div>`;
}

function buildHistorySummary(used, resisted) {
  return [
    used.length > 0 && `${used.length} sess`,
    resisted.length > 0 && `${resisted.length} resisted`
  ].filter(Boolean).join(' · ');
}

function renderDayHistory() {
  const events = DB.forDate(currentHistoryDay).reverse();
  const historyEl = $('history-events');
  const labelEl = $('current-day-label');
  
  if (!historyEl) return;
  
  labelEl.textContent = friendlyDate(currentHistoryDay);
  
  if (events.length === 0) {
    historyEl.innerHTML = emptyStateHTML('No events for this day');
    return;
  }

  historyEl.innerHTML = events.map(e => eventRowHTML(e, true)).join('');
}

function navigateDay(offset) {
  const d = new Date(currentHistoryDay + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  const newKey = dateKey(d);
  
  // Don't go beyond today
  if (newKey > todayKey()) return;
  
  currentHistoryDay = newKey;
  renderDayHistory();
}

function toggleHistoryDay(headerEl) {
  headerEl.closest('.history-day')?.classList.toggle('open');
}

// ========== GRAPHS ==========
const GRAPH_DEFS = [
  { label: '⚡ Amount (units) / Day',    color: 'var(--thc)',     valueFn: evs => sumAmount(filterUsed(evs)) },
  { label: '💪 Resisted / Day',    color: 'var(--resist)',  valueFn: evs => filterByType(evs, 'resisted').length },
  { label: '🏃 Exercise (min) / Day', color: 'var(--thc)',     valueFn: evs => getHabits(evs, 'exercise').reduce((s, e) => s + (e.minutes || 0), 0) },
];

function formatGraphValue(val) {
  if (val <= 0) return '';
  return Number.isInteger(val) ? val : val.toFixed(1);
}

function graphBarCol(val, height, label, showLabel) {
  const valStr = formatGraphValue(val);
  const labelStyle = showLabel ? '' : 'visibility:hidden';
  const barStyle = `height:${height}px;background:${label.color};${val > 0 ? 'min-height:2px' : ''}`;
  return `<div class="graph-bar-col">
    <div class="graph-bar-val">${valStr}</div>
    <div class="graph-bar" style="${barStyle}"></div>
    <div class="graph-bar-label" style="${labelStyle}">${label.text}</div>
  </div>`;
}

function buildGraphBars(vals, days, max, def) {
  let html = '<div class="graph-bars">';
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const h = max > 0 ? Math.round((v / max) * 96) : 0;
    const dayLabel = days[i].slice(5);
    const showLabel = graphDays <= 14 || i % Math.ceil(graphDays / 14) === 0;
    html += graphBarCol(v, h, { color: def.color, text: dayLabel }, showLabel);
  }
  return html + '</div>';
}

function renderGraphs() {
  const days = getLastNDays(graphDays);
  const container = $('graph-content');

  let html = '';
  for (const def of GRAPH_DEFS) {
    const vals = days.map(dk => def.valueFn(DB.forDate(dk)));
    const max  = Math.max(...vals, 1);
    const hasData = vals.some(v => v > 0);

    html += `<div class="graph-container"><div class="graph-title">${def.label}</div>`;
    html += hasData 
      ? buildGraphBars(vals, days, max, def)
      : emptyStateHTML('No data yet', 'padding:12px 0');
    html += `</div>`;
  }
  container.innerHTML = html;
}

// ========== TAB SWITCHING ==========
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
  
  if (tabName === 'wins') renderWins();
  else if (tabName === 'graph') {
    requestAnimationFrame(() => {
      renderGraphs();
      renderDayHistory();
    });
  }
}

// ========== EXPORT ==========
function exportJSON() {
  const data = { events: DB.loadEvents(), settings: DB.loadSettings(), exportedAt: new Date().toISOString() };
  downloadFile(JSON.stringify(data, null, 2), 'habit-tracker-' + todayKey() + '.json', 'application/json');
}

function clearDatabase() {
  if (!confirm('⚠️ This will permanently delete ALL events and reset settings. This cannot be undone.\n\nAre you sure?')) return;
  localStorage.removeItem(STORAGE_EVENTS);
  localStorage.removeItem(STORAGE_SETTINGS);
  localStorage.removeItem(STORAGE_TODOS);
  localStorage.removeItem(STORAGE_THEME);
  location.reload();
}

function changeAddiction() {
  if (!confirm('🔄 Change what you\'re tracking?\n\nYour data will be kept, but substance/method types will change. Continue?')) return;
  const settings = DB.loadSettings();
  settings.addictionProfile = null;
  DB._settings = settings;
  DB.saveSettings();
  location.reload();
}

function validateImportData(data) {
  if (!data.events || !Array.isArray(data.events)) {
    return { valid: false, error: '❌ Invalid file — no events array found.' };
  }
  const validEvents = data.events.filter(e => e.id && e.type && e.ts);
  if (validEvents.length === 0) {
    return { valid: false, error: '❌ No valid events found in file.' };
  }
  return { valid: true, events: validEvents };
}

function importJSON(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;

  const statusEl = $('import-status');
  const showStatus = (msg, cls) => {
    statusEl.textContent = msg;
    statusEl.className = `import-status ${cls}`;
    setTimeout(() => statusEl.classList.add('hidden'), 5000);
  };

  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const data = JSON.parse(ev.target.result);
      const validation = validateImportData(data);
      
      if (!validation.valid) {
        return showStatus(validation.error, 'error');
      }

      const existing = DB.loadEvents();
      const existingIds = new Set(existing.map(e => e.id));
      const newEvents = validation.events.filter(evt => !existingIds.has(evt.id));
      
      DB._events = [...existing, ...newEvents];
      DB.saveEvents();

      const added = newEvents.length;
      const skipped = validation.events.length - added;
      const msg = added === 0 
        ? `⚠️ All ${validation.events.length} events already exist — nothing imported.`
        : `✅ Imported ${added} new events${skipped ? ` (${skipped} duplicates skipped)` : ''}.`;
      showStatus(msg, added === 0 ? 'warn' : 'success');

      render();
    } catch (err) {
      showStatus('❌ Could not parse file: ' + err.message, 'error');
    }
    inputEl.value = '';
  };
  reader.readAsText(file);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========== CHIP ROWS ==========
function chipDismissBtn(text, onclick) {
  return `<button class="chip-dismiss" onclick="${onclick}">${text}</button>`;
}

function buildUsedChips(evt) {
  const profile = getProfile();
  return [
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v]),
    chipGroupHTML('Method', 'method', profile.methods, evt.method),
    chipGroupHTML('Amount', 'amount', profile.amounts, evt.amount),
    chipGroupHTML('Reason (optional)', 'reason', REASONS, evt.reason),
    chipDismissBtn('dismiss ✕', 'App.hideUsedChips()')
  ].join('');
}

function buildResistedChips(evt) {
  return [
    chipGroupHTML('Urge Intensity', 'intensity', INTENSITIES, evt.intensity),
    chipGroupHTML('Trigger', 'trigger', TRIGGERS, evt.trigger),
    chipGroupHTML('Did Instead', 'didInstead', DID_INSTEAD, evt.didInstead),
    chipDismissBtn('dismiss ✕', 'App.hideResistedChips()')
  ].join('');
}

function showChips(elId, buildFn, evt, hideFn) {
  activeChipEventId = evt.id;
  const el = $(elId);
  el.innerHTML = buildFn(evt);
  el.classList.remove('hidden');
  clearTimeout(chipTimeout);
  chipTimeout = setTimeout(hideFn, CHIP_TIMEOUT_MS);
}

function hideChips(chipId, coachingToo = false) {
  $(chipId).classList.add('hidden');
  if (coachingToo) $('coaching-tip').classList.add('hidden');
  activeChipEventId = null;
  clearTimeout(chipTimeout);
}

const hideUsedChips = () => hideChips('used-chips');
const hideResistedChips = () => hideChips('resisted-chips', true);

// ========== CHIP CLICK HANDLER (shared) ==========
function persistFieldDefault(field, val) {
  const settings = DB.loadSettings();
  if (field === 'substance') settings.lastSubstance = val;
  else if (field === 'method') settings.lastMethod = val;
  else if (field === 'amount') settings.lastAmount = val;
  else if (field === 'reason' && val) settings.lastReason = val;
  else return;
  DB.saveSettings();
}

const CHIP_BUILDERS = {
  used: buildUsedChips,
  resisted: buildResistedChips
};

function updateActiveChips() {
  const evt = DB.loadEvents().find(ev => ev.id === activeChipEventId);
  if (!evt) return;
  const elId = evt.type === 'used' ? 'used-chips' : 'resisted-chips';
  const buildFn = CHIP_BUILDERS[evt.type];
  if (buildFn) $(elId).innerHTML = buildFn(evt);
}

function handleChipClick(e) {
  const chip = e.target.closest('.chip');
  if (!chip || !activeChipEventId) return;

  clearTimeout(chipTimeout);
  chipTimeout = setTimeout(() => { hideUsedChips(); hideResistedChips(); }, CHIP_TIMEOUT_MS);

  const field = chip.closest('.chip-group').dataset.field;
  const currentEvent = DB.loadEvents().find(ev => ev.id === activeChipEventId);
  const val = resolveChipVal(field, chip.dataset.val, currentEvent);

  DB.updateEvent(activeChipEventId, { [field]: val });
  persistFieldDefault(field, val);
  updateActiveChips();
  render();
}

// ========== EDIT MODAL ==========
function modalFieldWrap(html) {
  return `<div class="modal-field">${html}</div>`;
}

function openEditModal(eventId) {
  hideUsedChips();
  hideResistedChips();
  const evt = DB.loadEvents().find(e => e.id === eventId);
  if (!evt) return;
  const profile = getProfile();

  const fieldBuilders = {
    used: () => [
      chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v]),
      chipGroupHTML('Method', 'method', profile.methods, evt.method),
      chipGroupHTML('Amount', 'amount', profile.amounts, evt.amount),
      chipGroupHTML('Reason', 'reason', REASONS, evt.reason)
    ],
    resisted: () => [
      chipGroupHTML('Urge Intensity', 'intensity', INTENSITIES, evt.intensity),
      chipGroupHTML('Trigger', 'trigger', TRIGGERS, evt.trigger),
      chipGroupHTML('Did Instead', 'didInstead', DID_INSTEAD, evt.didInstead)
    ],
    habit: () => {
      const fields = [`<label>Habit</label><div style="font-size:16px">${HABIT_LABELS[evt.habit] || evt.habit}</div>`];
      if (evt.habit === 'exercise') {
        fields.push(chipGroupHTML('Minutes', 'minutes', EXERCISE_DURATIONS, evt.minutes));
      }
      return fields;
    }
  };

  const fields = fieldBuilders[evt.type]?.() || [];
  const fieldsHTML = fields.map(modalFieldWrap).join('');

  $('modal-sheet').innerHTML = `
    <div class="modal-header"><h2>Edit Event</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
    <div class="modal-field"><label>Time</label><div style="font-size:14px">${formatTime(evt.ts)}</div></div>
    ${fieldsHTML}
    <div class="modal-actions">
      <button class="btn-delete" onclick="App.deleteEvent('${evt.id}'); App.closeModal();">Delete</button>
      <button class="btn-save" onclick="App.saveModal()">Save</button>
    </div>`;
  $('modal-sheet').dataset.eventId = eventId;
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
}

function saveModal() {
  closeModal();
  render();
}

function handleModalChipClick(e) {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  
  const eventId = $('modal-sheet').dataset.eventId;
  if (!eventId) return;

  const field = chip.closest('.chip-group').dataset.field;
  const currentEvent = DB.loadEvents().find(ev => ev.id === eventId);
  const val = resolveChipVal(field, chip.dataset.val, currentEvent);

  DB.updateEvent(eventId, { [field]: val });
  chip.closest('.chip-group').querySelectorAll('.chip').forEach(c => 
    c.classList.toggle('active', val !== null && c.dataset.val === String(val))
  );
}

// ========== COACHING ==========
function hasRecentWater() {
  const cutoff = Date.now() - TWO_HOURS_MS;
  return DB.loadEvents().some(e => e.type === 'habit' && e.habit === 'water' && e.ts >= cutoff);
}

function showCoaching() {
  if (!DB.loadSettings().showCoaching) return;
  
  const tips = hasRecentWater() 
    ? COACHING_TIPS.filter(t => t.habit !== 'water')
    : [COACHING_TIPS.find(t => t.habit === 'water')];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  
  $('coaching-text').textContent = tip.text;
  $('coaching-log-btn').onclick = () => {
    DB.addEvent(createHabitEvent(tip.habit));
    $('coaching-tip').classList.add('hidden');
    render();
  };
  $('coaching-tip').classList.remove('hidden');
}

// ========== ONBOARDING ==========
function showOnboarding() {
  const overlay = $('onboarding-overlay');
  overlay.classList.remove('hidden');
  
  document.querySelectorAll('.profile-card').forEach(card => {
    card.onclick = () => selectProfile(card.dataset.profile);
  });
}

function selectProfile(profileKey) {
  const profile = ADDICTION_PROFILES[profileKey];
  const settings = DB.loadSettings();
  
  Object.assign(settings, {
    addictionProfile: profileKey,
    lastSubstance: profile.substances[0],
    lastMethod: profile.methods[0],
    lastAmount: profile.amounts[0]
  });
  
  DB._settings = settings;
  DB.saveSettings();
  
  $('onboarding-overlay').classList.add('hidden');
  
  bindEvents();
  render();
  timerInterval = setInterval(() => renderMetrics(), 30000);
}

// ========== MAIN ACTIONS ==========
function logUsed() {
  const s = DB.loadSettings();
  const evt = createUsedEvent(s.lastSubstance, s.lastMethod, s.lastAmount, s.lastReason);
  DB.addEvent(evt);
  render();
  hideResistedChips();
  showChips('used-chips', buildUsedChips, evt, hideUsedChips);
  flashEl($('btn-used'));
}

function logResisted() {
  const evt = createResistedEvent();
  DB.addEvent(evt);
  render();
  hideUsedChips();
  showChips('resisted-chips', buildResistedChips, evt, hideResistedChips);
  showCoaching();
  flashEl($('btn-resisted'));
}

function logHabit(habit, minutes) {
  DB.addEvent(createHabitEvent(habit, minutes));
  render();
}

function logWaterFromReminder() {
  logHabit('water');
  flashEl($('water-reminder-btn'));
}

// ========== EVENT HANDLERS ==========
function bindEvents() {
  $('tab-bar').addEventListener('click', e => { const b = e.target.closest('.tab-btn'); if (b) switchTab(b.dataset.tab); });

  $('graph-range').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    graphDays = +chip.dataset.days;
    e.currentTarget.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    requestAnimationFrame(renderGraphs);
  });

  $('btn-used').addEventListener('click', logUsed);
  $('btn-resisted').addEventListener('click', logResisted);
  $('used-chips').addEventListener('click', handleChipClick);
  $('resisted-chips').addEventListener('click', handleChipClick);
  $('modal-sheet').addEventListener('click', e => handleModalChipClick(e));
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

  $('habit-row').addEventListener('click', e => {
    const btn = e.target.closest('.habit-btn');
    if (!btn) return;
    const habit = btn.dataset.habit;
    
    if (habit === 'exercise') {
      const picker = $('exercise-chips');
      const isNowHidden = picker.classList.toggle('hidden');
      clearTimeout(exerciseTimeout);
      if (!isNowHidden) {
        exerciseTimeout = setTimeout(() => picker.classList.add('hidden'), CHIP_TIMEOUT_MS);
      }
      return;
    }
    
    logHabit(habit);
    flashEl(btn);
  });

  $('exercise-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    logHabit('exercise', parseInt(chip.dataset.min, 10));
    $('exercise-chips').classList.add('hidden');
  });

  $('todo-add-btn').addEventListener('click', () => {
    addTodo($('todo-input').value);
    $('todo-input').value = '';
  });
  $('todo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTodo($('todo-input').value);
      $('todo-input').value = '';
    }
  });
  $('todo-list').addEventListener('click', e => {
    const idx = +e.target.dataset.idx;
    if (e.target.classList.contains('todo-check')) toggleTodo(idx);
    if (e.target.classList.contains('todo-delete')) deleteTodo(idx);
  });
  
  const prevBtn = $('prev-day');
  const nextBtn = $('next-day');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateDay(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateDay(1));
}

// ========== TO-DO LIST ==========
function loadTodos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_TODOS)) || []; }
  catch { return []; }
}

function saveTodos(todos) {
  localStorage.setItem(STORAGE_TODOS, JSON.stringify(todos));
}

function renderTodos() {
  const todos = loadTodos();
  $('todo-list').innerHTML = todos.length === 0
    ? ''
    : todos.map((t, i) => `<li class="todo-item${t.done ? ' done' : ''}">
        <input type="checkbox" class="todo-check" data-idx="${i}"${t.done ? ' checked' : ''}>
        <span class="todo-text">${escapeHTML(t.text)}</span>
        <button class="todo-delete" data-idx="${i}">✕</button>
      </li>`).join('');
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const todos = loadTodos();
  todos.push({ text: trimmed, done: false });
  saveTodos(todos);
  renderTodos();
}

function toggleTodo(idx) {
  const todos = loadTodos();
  if (todos[idx]) todos[idx].done = !todos[idx].done;
  saveTodos(todos);
  renderTodos();
}

function deleteTodo(idx) {
  const todos = loadTodos();
  todos.splice(idx, 1);
  saveTodos(todos);
  renderTodos();
}

// ========== PUBLIC API ==========
function setThemeIcon(theme) {
  const el = $('theme-icon-settings');
  if (el) el.textContent = theme === 'light' ? '🌙' : '☀️';
}

function getToggleTheme(current) {
  return current === 'light' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_THEME, theme);
  setThemeIcon(theme);
}

window.App = {
  hideUsedChips,
  hideResistedChips,
  editEvent: openEditModal,
  closeModal,
  saveModal,
  deleteEvent(id) {
    DB.deleteEvent(id);
    currentHistoryDay = todayKey();
    render();
  },
  toggleHistoryDay,
  exportJSON,
  importJSON,
  clearDatabase,
  changeAddiction,
  switchTab,
  logWaterFromReminder,
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    applyTheme(getToggleTheme(currentTheme));
  }
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  DB.loadEvents();
  DB.loadSettings();
  
  applyTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
  
  // Register service worker for PWA support
  if (!debugMode)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
      .catch(err => console.log('[PWA] Service worker registration failed:', err));
  }
  
  if (!DB.loadSettings().addictionProfile) {
    showOnboarding();
  } else {
    bindEvents();
    render();
    timerInterval = setInterval(() => renderMetrics(), 30000);
  }
});