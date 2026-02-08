// ============================================================
// ZERO-FRICTION USAGE + WINS TRACKER
// ============================================================

'use strict';

// ========== CONSTANTS ==========
const STORAGE_EVENTS = 'ht_events';
const STORAGE_SETTINGS = 'ht_settings';
const STORAGE_TODOS = 'ht_todos';
const STORAGE_THEME = 'ht_theme';
const STORAGE_WINS = 'ht_wins';
const STORAGE_LOGIN_SKIPPED = 'ht_login_skipped';

const ADDICTION_PROFILES = {
  cannabis: {
    name: 'Cannabis',
    sessionLabel: 'Used',
    substanceLabel: 'Substance',
    substances: ['thc', 'cbd', 'mix'],
    substanceDisplay: { thc: 'THC', cbd: 'CBD', mix: 'Mix' },
    methods: ['bong', 'vape', 'pipe', 'joint', 'edible', 'other'],
    amounts: [0.5, 1.0, 1.5, 2.0],
    amountUnit: 'units',
    icons: { thc: '🌿', cbd: '🌿', mix: '🌿' }
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
    amounts: [0.5, 1, 2, 3, 5, 10],
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
const REASONS = ['start', 'break', 'habit', 'boredom', 'reward', 'stress', 'sleep', 'social', 'pain', 'eating'];
const INTENSITIES = [1, 2, 3, 4, 5];
const EXERCISE_DURATIONS = [5, 10, 15, 20, 30, 45, 60];
const OPTIONAL_FIELDS = new Set(['reason', 'trigger']);

// Timeouts and durations
const CHIP_TIMEOUT_MS = 5000;
const FLASH_ANIMATION_MS = 300;
const IMPORT_STATUS_HIDE_MS = 5000;
const METRICS_REFRESH_MS = 30000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Win calculation thresholds
const GAP_MILESTONES = [1, 2, 4, 8, 12];
const DAYTIME_START_HOUR = 6;
const DAYTIME_END_HOUR = 20;
const AFTERNOON_HOUR = 12;
const MAX_STREAK_DAYS = 60;
const LOW_DAY_THRESHOLD = 2;

const COACHING_MESSAGES = [
  '💧 Drink a glass of water',
  '🌬️ Take 10 slow breaths',
  '🌳 Step outside for a minute',
  '📖 Read a few pages of a book',
  '🎵 Put on a song you love',
  '🍎 Grab a healthy snack',
  '☕ Make some tea or coffee',
  '🧘 Do a quick stretch',
  '🚶 Go for a short walk',
  '🧹 Tidy up one small thing',
  '💪 You\'re stronger than the urge',
  '🏆 Every resist is a win',
  '🧠 This craving will pass',
  '🎮 Play a quick game',
  '📞 Text a friend',
  '🎨 Do something creative',
  '🤸 Take a movement break',
  '🧼 Wash your face or hands',
  '🍬 Chew some gum or brush teeth',
  '📽️ Watch an educational video',
  '✍️ Write about how you feel',
  '🕯️ Light a candle or incense',
  '🦶 Feel your feet on the floor',
  '🗑️ Throw away one piece of trash',
  '🍽️ Wash a few dishes',
  '🧠 You\'re building the "pause" muscle',
  '📈 One good choice shifts the trend',
  '🌤️ This moment will pass',
  '📦 Put substance away for now',
  '🌱 Do something small for future you',
];

const HABIT_ICONS = { water: '💧', breaths: '🌬️', clean: '🧹', exercise: '🏃', outside: '🌳' };
const HABIT_LABELS = {
  water: `${HABIT_ICONS.water} Water`,
  breaths: `${HABIT_ICONS.breaths} 10 Breaths`,
  clean: `${HABIT_ICONS.clean} Clean Room`,
  exercise: `${HABIT_ICONS.exercise} Exercise`,
  outside: `${HABIT_ICONS.outside} Outside`
};

// Win definitions - maps win IDs to their display properties
const WIN_DEFINITIONS = {
  'welcome-back': { label: 'Welcome Back', icon: '👋', desc: 'Returned to tracking after 24+ hours away' },
  'resist': { label: 'Resist Win', icon: '💪', desc: 'Logged an urge but resisted using' },
  'delay-15m': { label: 'Delay Win (15m+)', icon: '⏳', desc: 'Resisted and didn\'t use for at least 15 minutes after' },
  'replacement-cbd': { label: 'Replacement Win (CBD)', icon: '🌿', desc: 'Used CBD during daytime (6am-8pm) instead of THC' },
  'harm-reduction-vape': { label: 'Harm Reduction (vape)', icon: '🌡️', desc: 'Chose vaping as a safer consumption method' },
  'dose-half': { label: 'Dose Win (half)', icon: '⚖️', desc: 'Used a smaller dose (0.5 units)' },
  'mindful': { label: 'Mindful Session', icon: '🧠', desc: 'Logged the reason for using, showing mindful awareness' },
  'cbd-only': { label: 'CBD-Only Day', icon: '🍃', desc: 'Used only CBD products today, no THC' },
  'low-day': { label: 'Low Day (≤2 units)', icon: '🤏', desc: 'Kept total usage to 2 units or less' },
  'zero-thc': { label: 'Clean Day', icon: '🏆', desc: 'No use today while staying engaged with tracking' },
  'tbreak-day': { label: 'Break Day', icon: '🚫', desc: 'Went a full day without using while staying engaged' },
  'hydrated': { label: 'Hydrated', icon: '💧', desc: 'Drank water at least 4 times today' },
  'habit-stack': { label: 'Habit Stack', icon: '🔗', desc: 'Logged multiple different habit types in one day' },
  'exercise-water-combo': { label: 'Exercise + Water Combo', icon: '🏃💧', desc: 'Logged both exercise and water today' },
  'gap-1h': { label: 'Gap Win (1h+)', icon: '⏱️', desc: 'Maintained a gap of 1+ hours between sessions' },
  'gap-2h': { label: 'Gap Win (2h+)', icon: '⏱️', desc: 'Maintained a gap of 2+ hours between sessions' },
  'gap-4h': { label: 'Gap Win (4h+)', icon: '⏱️', desc: 'Maintained a gap of 4+ hours between sessions' },
  'gap-8h': { label: 'Gap Win (8h+)', icon: '⏱️', desc: 'Maintained a gap of 8+ hours between sessions' },
  'gap-12h': { label: 'Gap Win (12h+)', icon: '⏱️', desc: 'Maintained a gap of 12+ hours between sessions' },
  'gap-above-avg': { label: 'Gap Longer Than Average', icon: '📏', desc: 'Today\'s longest gap between sessions exceeded your average' },
  'held-off-afternoon': { label: 'Held Off Until Afternoon', icon: '🌅', desc: 'Waited until afternoon before first session' },
  'fewer-sessions': { label: 'Fewer sessions than yesterday', icon: '📉', desc: 'Had fewer sessions than yesterday' },
  'lower-amount': { label: 'Lower amount than yesterday', icon: '📉', desc: 'Used a smaller total amount than yesterday' },
  'first-later': { label: 'First session later than yesterday', icon: '⏰', desc: 'Started your first session later than yesterday' },
  'last-earlier': { label: 'Last session earlier than yesterday', icon: '🌙', desc: 'Finished your last session earlier than yesterday' },
  'good-start': { label: 'Good Start', icon: '🌟', desc: 'Started your day with a positive action instead of using' },
  'resist-streak': { label: 'Resist Streak', icon: '🔥', desc: 'Resisted urges for multiple days in a row' },
  'habit-streak': { label: 'Habit Streak', icon: '⛓️', desc: 'Logged healthy habits for consecutive days' },
  'taper': { label: 'Taper Win', icon: '📐', desc: 'Gradually reduced usage over consecutive days' },
  'app-streak': { label: 'App Streak', icon: '📱', desc: 'Used the app multiple days in a row' },
  'week-streak': { label: 'Week Streak', icon: '📅', desc: 'Used the app every day for a week' },
  'month-streak': { label: 'Month Streak', icon: '🗓️', desc: 'Used the app every day for a month' },
  'year-streak': { label: 'Year Streak', icon: '🎉', desc: 'Used the app every day for a year!' },
  'tbreak-1d': { label: 'Break: 1 Day', icon: '🌱', desc: 'One full day clean' },
  'tbreak-7d': { label: 'Break: 1 Week', icon: '🌿', desc: 'One week clean' },
  'tbreak-14d': { label: 'Break: 2 Weeks', icon: '🍀', desc: 'Two weeks clean' },
  'tbreak-21d': { label: 'Break: 3 Weeks', icon: '🌳', desc: 'Three weeks clean' },
  'tbreak-30d': { label: 'Break: 1 Month', icon: '🏆', desc: 'One month clean' },
  'tbreak-365d': { label: 'Break: 1 Year', icon: '👑', desc: 'One year clean!' },
  'second-thought': { label: 'Second Thought', icon: '↩️', desc: 'Used undo to reconsider — shows mindful decision-making' },
};

function getWinDef(id) {
  return WIN_DEFINITIONS[id] || { label: 'Unknown Win', icon: '❓', desc: '' };
}

const DEFAULT_SETTINGS = {
  addictionProfile: null, // Set on first launch
  lastSubstance: 'thc',
  lastMethod: 'bong',
  lastAmount: 1.0,
  showCoaching: true,
  lastActivityTimestamp: null,
  graphDays: 7
};

// ========== TINY HELPERS ==========
const $ = id => document.getElementById(id);

// Cache Intl formatters — creating these is expensive
const _timeFormatter = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
const _dateFormatter = new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric' });

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

function flashEl(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), FLASH_ANIMATION_MS);
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
  return _timeFormatter.format(new Date(ts));
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
  return _dateFormatter.format(new Date(key + 'T12:00:00'));
}

// ========== DATA LAYER ==========
const DB = {
  _events: null,
  _settings: null,
  _dateIndex: null,

  _buildDateIndex() {
    this._dateIndex = new Map();
    for (const e of this._events) {
      const key = dateKey(e.ts);
      if (!this._dateIndex.has(key)) this._dateIndex.set(key, []);
      this._dateIndex.get(key).push(e);
    }
    for (const [, arr] of this._dateIndex) {
      arr.sort((a, b) => a.ts - b.ts);
    }
  },

  _invalidateDateIndex() {
    this._dateIndex = null;
  },

  loadEvents() {
    if (this._events) return this._events;
    try {
      this._events = JSON.parse(localStorage.getItem(STORAGE_EVENTS)) || [];
    } catch {
      this._events = [];
    }
    this._invalidateDateIndex();
    return this._events;
  },

  saveEvents() {
    try {
      localStorage.setItem(STORAGE_EVENTS, JSON.stringify(this._events));
      this._invalidateDateIndex();
      if (window.FirebaseSync) FirebaseSync.onDataChanged();
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('Storage limit reached. Please export your data and clear old events.');
      }
      throw e;
    }
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
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(this._settings));
      if (window.FirebaseSync) FirebaseSync.onDataChanged();
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('Storage limit reached. Please export your data.');
      }
      throw e;
    }
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
    this._invalidateDateIndex(); // Rebuild index if timestamp changed
    this.saveEvents();
    return this._events[idx];
  },

  deleteEvent(id) {
    this.loadEvents();
    this._events = this._events.filter(e => e.id !== id);
    this.saveEvents();
  },

  forDate(key) {
    this.loadEvents();
    if (!this._dateIndex) this._buildDateIndex();
    return this._dateIndex.get(key) || [];
  },

  getAllDayKeys() {
    this.loadEvents();
    if (!this._dateIndex) this._buildDateIndex();
    return Array.from(this._dateIndex.keys()).sort().reverse();
  },
};

// ========== EVENT QUERY HELPERS ==========
function filterByType(events, type) { return events.filter(e => e.type === type); }
function filterUsed(events) { return filterByType(events, 'used'); }
function filterProfileUsed(events) {
  const profile = getProfile();
  const subs = new Set(profile.substances);
  return filterUsed(events).filter(e => subs.has(e.substance));
}
function filterTHC(usedEvents) { return usedEvents.filter(e => e.substance === 'thc' || e.substance === 'mix'); }
function filterCBD(usedEvents) { return usedEvents.filter(e => e.substance === 'cbd'); }
function sumAmount(usedEvents) { return usedEvents.reduce((s, e) => s + (e.amount ?? 1), 0); }
function getHabits(events, habitType) { 
  const habits = filterByType(events, 'habit');
  return habitType ? habits.filter(e => e.habit === habitType) : habits;
}

// ========== EVENT FACTORIES ==========
function createUsedEvent(substance, method, amount, reason) {
  const sub = substance || 'thc';
  return {
    id: uid(), type: 'used', ts: Date.now(),
    substance: sub, method: method || 'bong',
    amount: amount != null ? amount : 1.0,
    reason: reason || null,
  };
}

function createResistedEvent(intensity, trigger) {
  return {
    id: uid(), type: 'resisted', ts: Date.now(),
    intensity: intensity || null, trigger: trigger || null,
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
  if (sessions.length === 0) return 0;
  if (sessions.length === 1) {
    // Single session — gap is time from that session to now
    return (Date.now() - sessions[0].ts) / 3600000;
  }
  const gaps = sessions.slice(1).map((u, i) => u.ts - sessions[i].ts);
  // Also include gap from last session to now
  const gapSinceLastSession = Date.now() - sessions[sessions.length - 1].ts;
  gaps.push(gapSinceLastSession);
  const maxGapMs = Math.max(...gaps);
  return maxGapMs / 3600000;
}

function getMilestoneWins(gapHours, milestones) {
  return milestones.filter(h => gapHours >= h);
}

// ========== WIN STORAGE ==========
function loadWinData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_WINS));
    if (!data) return { todayDate: null, todayWins: [], lifetimeWins: [], todayUndoCount: 0 };
    return data;
  } catch {
    return { todayDate: null, todayWins: [], lifetimeWins: [], todayUndoCount: 0 };
  }
}

function saveWinData(data) {
  try {
    localStorage.setItem(STORAGE_WINS, JSON.stringify(data));
    if (window.FirebaseSync) FirebaseSync.onDataChanged();
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storage limit reached. Please export your data.');
    }
    throw e;
  }
}

// ========== WINS ENGINE ==========
const Wins = {
  calculate(todayEvents, yesterdayEvents) {
    const wins = [];
    const addWin = (condition, id) => {
      if (condition) wins.push(id);
    };

    const used     = filterUsed(todayEvents);
    const resisted = filterByType(todayEvents, 'resisted');
    const habits   = filterByType(todayEvents, 'habit');
    const profileUsed = filterProfileUsed(used); // Profile-aware: only substances in current profile

    // --- Welcome Back win ---
    const settings = DB.loadSettings();
    if (settings.lastActivityTimestamp) {
      const hoursSinceLastActivity = (Date.now() - settings.lastActivityTimestamp) / (1000 * 60 * 60);
      addWin(hoursSinceLastActivity >= 24, 'welcome-back');
    }

    // --- Session-based wins ---
    for (let i = 0; i < resisted.length; i++) addWin(true, 'resist');

    const delayCount = countDelayedResists(resisted, used);
    for (let i = 0; i < delayCount; i++) addWin(true, 'delay-15m');

    // Cannabis-specific wins
    const isCannabis = DB.loadSettings().addictionProfile === 'cannabis';
    if (isCannabis) {
      const cbdUsed = filterCBD(used);
      const replacementCount = cbdUsed.filter(u => isDaytime(u.ts)).length;
      for (let i = 0; i < replacementCount; i++) addWin(true, 'replacement-cbd');
      addWin(used.length > 0 && profileUsed.length === 0, 'cbd-only');
    }

    const vapeCount = isCannabis ? used.filter(e => e.method === 'vape').length : 0;
    for (let i = 0; i < vapeCount; i++) addWin(true, 'harm-reduction-vape');

    const profile = getProfile();
    const smallDose = profile.amounts[0]; // Smallest amount in the profile
    const doseCount = used.filter(e => e.amount === smallDose).length;
    for (let i = 0; i < doseCount; i++) addWin(true, 'dose-half');

    const mindfulCount = used.filter(e => e.reason).length;
    for (let i = 0; i < mindfulCount; i++) addWin(true, 'mindful');

    const profileAmt = sumAmount(profileUsed);
    addWin(profileUsed.length > 0 && profileAmt <= LOW_DAY_THRESHOLD, 'low-day');
    addWin(profileUsed.length === 0 && (resisted.length > 0 || habits.length > 0), 'zero-thc');
    addWin(used.length === 0 && (resisted.length > 0 || habits.length > 0), 'tbreak-day');

    // --- Habit-based wins ---
    const waterCount = getHabits(todayEvents, 'water').length;
    addWin(waterCount >= 4, 'hydrated');
    
    const uniqueHabits = new Set(habits.map(e => e.habit));
    if (uniqueHabits.size >= 2) {
      for (let i = 0; i < uniqueHabits.size - 1; i++) addWin(true, 'habit-stack');
    }
    
    // Exercise + Water combo
    const hasExercise = habits.some(e => e.habit === 'exercise');
    const hasWater = habits.some(e => e.habit === 'water');
    addWin(hasExercise && hasWater, 'exercise-water-combo');

    // --- Timing-based wins ---
    if (profileUsed.length >= 2) {
      const maxGap = getMaxGapHours(profileUsed);
      const earned = getMilestoneWins(maxGap, GAP_MILESTONES);
      earned.forEach(h => addWin(true, `gap-${h}h`));
      
      // Gap longer than 7-day historical average
      const weekDays = getLastNDays(7);
      const weekSessions = weekDays.flatMap(k => filterProfileUsed(DB.forDate(k)));
      if (weekSessions.length >= 2) {
        const weekGaps = weekSessions.slice(1).map((u, i) => u.ts - weekSessions[i].ts);
        const avgGap = weekGaps.reduce((s, g) => s + g, 0) / weekGaps.length;
        const todayGaps = profileUsed.slice(1).map((u, i) => u.ts - profileUsed[i].ts);
        addWin(Math.max(...todayGaps) > avgGap, 'gap-above-avg');
      }
    }

    // Filter out late-night sessions (before 6 AM) when checking for "first session of the day"
    const daytimeSessions = profileUsed.filter(u => new Date(u.ts).getHours() >= DAYTIME_START_HOUR);
    if (daytimeSessions.length > 0) {
      const firstHour = new Date(daytimeSessions[0].ts).getHours();
      addWin(firstHour >= AFTERNOON_HOUR, 'held-off-afternoon');
    }

    // --- Comparison wins ---
    if (yesterdayEvents && yesterdayEvents.length > 0) {
      const yUsed = filterUsed(yesterdayEvents);
      const yProfile = filterProfileUsed(yesterdayEvents);

      addWin(profileUsed.length < yProfile.length, 'fewer-sessions');
      addWin(profileUsed.length > 0 && profileAmt < sumAmount(yProfile), 'lower-amount');
      
      // Reuse daytimeSessions from above for "first session" comparison
      const yesterdayDaytime = yProfile.filter(u => new Date(u.ts).getHours() >= DAYTIME_START_HOUR);
      
      if (daytimeSessions.length > 0 && yesterdayDaytime.length > 0) {
        addWin(timeOfDayMin(daytimeSessions[0].ts) > timeOfDayMin(yesterdayDaytime[0].ts), 'first-later');
      }
      
      // Last session comparison uses all sessions (late-night sessions are relevant for when you stopped)
      if (profileUsed.length > 0 && yProfile.length > 0) {
        addWin(timeOfDayMin(profileUsed[profileUsed.length - 1].ts) < timeOfDayMin(yProfile[yProfile.length - 1].ts), 'last-earlier');
      }
    }
    
    // Good Start win - logged habit or resist before first use
    const firstEvent = todayEvents[0];
    if (firstEvent && (firstEvent.type === 'habit' || firstEvent.type === 'resisted')) {
      addWin(true, 'good-start');
    }

    // --- Streak wins ---
    const resistStreak = this._countStreak('resisted');
    for (let i = 0; i < resistStreak - 1; i++) addWin(true, 'resist-streak');
    
    const habitStreak = this._countStreak('habit');
    for (let i = 0; i < habitStreak - 2; i++) addWin(true, 'habit-streak');

    const taperDays = this._countTaper();
    for (let i = 0; i < taperDays - 2; i++) addWin(true, 'taper');
    
    // App usage streaks
    const appStreak = this._countAppUsageStreak();
    for (let i = 0; i < appStreak - 1; i++) addWin(true, 'app-streak');
    addWin(appStreak >= 7, 'week-streak');
    addWin(appStreak >= 30, 'month-streak');
    addWin(appStreak >= 365, 'year-streak');
    
    // Break milestones (time since last use)
    if (profileUsed.length === 0) {
      const daysSinceLastUse = this._countDaysSinceLastUse();
      if (daysSinceLastUse >= 1) {
        addWin(true, 'tbreak-1d');
        addWin(daysSinceLastUse >= 7, 'tbreak-7d');
        addWin(daysSinceLastUse >= 14, 'tbreak-14d');
        addWin(daysSinceLastUse >= 21, 'tbreak-21d');
        addWin(daysSinceLastUse >= 30, 'tbreak-30d');
        addWin(daysSinceLastUse >= 365, 'tbreak-365d');
      }
    }

    return wins;
  },

  _countStreak(eventType) {
    const d = new Date();
    
    for (let streak = 0; streak < MAX_STREAK_DAYS; streak++) {
      if (!DB.forDate(dateKey(d)).some(e => e.type === eventType)) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_STREAK_DAYS;
  },

  _countTaper() {
    let count = 0, prevAmt = null;
    const d = new Date();
    
    for (let i = 0; i < MAX_STREAK_DAYS; i++) {
      const amt = sumAmount(filterProfileUsed(DB.forDate(dateKey(d))));
      // Walking backwards: prevAmt = newer day, amt = older day
      // Tapering means older day should have MORE usage than newer day
      // Break when older day <= newer day (not tapering)
      if (prevAmt !== null && amt <= prevAmt) break;
      if (prevAmt !== null) count++;
      prevAmt = amt;
      d.setDate(d.getDate() - 1);
    }
    return count;
  },
  
  _countAppUsageStreak() {
    const d = new Date();
    for (let streak = 0; streak < MAX_STREAK_DAYS; streak++) {
      const dayEvents = DB.forDate(dateKey(d));
      if (dayEvents.length === 0) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_STREAK_DAYS;
  },
  
  _countDaysSinceLastUse() {
    const keys = DB.getAllDayKeys(); // sorted reverse (most recent first)
    for (const key of keys) {
      const dayUsed = filterProfileUsed(DB.forDate(key));
      if (dayUsed.length > 0) {
        return Math.floor((Date.now() - dayUsed[dayUsed.length - 1].ts) / (1000 * 60 * 60 * 24));
      }
    }
    return 0;
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
  
  const icon = profile.icons[evt.substance] || '💊';
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
      evt.trigger
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
const HISTORY_PAGE_SIZE = 100;
let historyShowCount = HISTORY_PAGE_SIZE;
let eventsAreBound = false;

function render() {
  renderDate();
  renderMetrics();
  renderProgress();
  renderWaterReminder();
  renderTodos();
  
  const activeTab = document.querySelector('.tab-panel.active')?.id.replace('tab-', '');
  if (activeTab === 'wins') renderWins();
  else if (activeTab === 'graph') renderGraphs();
  else if (activeTab === 'history') renderDayHistory();
}

function renderDate() {
  $('header-date').textContent = _dateFormatter.format(new Date());
  
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
  
  // Calculate average gap from last 7 days
  let avgGapStr = '';
  if (thcUsed.length > 0) {
    const last7Days = getLastNDays(7);
    const weekTHC = last7Days.flatMap(k => filterTHC(filterUsed(DB.forDate(k))));
    if (weekTHC.length >= 2) {
      const gaps = weekTHC.slice(1).map((u, i) => u.ts - weekTHC[i].ts);
      const avgGapMs = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      // Only show if average is meaningful (more than 1 minute)
      if (avgGapMs >= 60000) {
        const currentGapMs = Date.now() - thcUsed[thcUsed.length - 1].ts;
        const avgFormatted = formatDuration(avgGapMs);
        const comparison = currentGapMs > avgGapMs ? '↑ longer' : currentGapMs < avgGapMs ? '↓ shorter' : '= equal';
        avgGapStr = `avg ${avgFormatted} (${comparison})`;
      }
    }
  }
  
  return [
    `<div class="tile"><div class="val" style="color:var(--thc)">${thcUsed.length}</div><div class="label">THC</div><div class="sub" style="color:var(--cbd)">${cbdCount} CBD</div></div>`,
    `<div class="tile"><div class="val">${timeSinceTHC}</div><div class="label">Since Last THC</div>${avgGapStr ? `<div class="sub">${avgGapStr}</div>` : ''}</div>`
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
    tileHTML(`${exerciseMins}m`, 'Exercise', `${exerciseTotal} total activities`),
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
  
  // If no profile is set, return a placeholder tile
  if (!config) {
    return tileHTML('—', 'Better Choice', 'this week');
  }
  
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
  return { events, used, profileUsed: filterProfileUsed(events) };
}

function countLateStarts(days) {
  return days.filter(day => {
    const dayUsed = filterProfileUsed(DB.forDate(day));
    return dayUsed.length > 0 && new Date(dayUsed[0].ts).getHours() >= AFTERNOON_HOUR;
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

  const longestGapMs = getMaxGapHours(thisWeek.profileUsed) * 3600000;
  const gapStr = longestGapMs > 0 ? formatDuration(longestGapMs) : '—';

  const lateStarts = countLateStarts(last7Days);

  const ratioTile = getRatioTile(thisWeek.used);

  const exerciseMins = getHabits(thisWeek.events, 'exercise').reduce((sum, e) => sum + (e.minutes || 0), 0);
  const exercisePerDay = (exerciseMins / 7).toFixed(1);

  $('progress').innerHTML = [
    `<div class="tile"><div class="val" style="color:${trend.color}">${trend.arrow} ${trend.label}</div><div class="label">7-Day Trend</div><div class="sub">vs prev week</div></div>`,
    tileHTML(dailyAvg, 'Sessions/Day', 'last 7 days'),
    tileHTML(gapStr, 'Longest Gap', 'this week'),
    tileHTML(`${lateStarts} / 7`, 'Late Starts', 'past noon'),
    ratioTile,
    tileHTML(`${exercisePerDay}m`, 'Exercise/Day', 'last 7 days')
  ].join('');
}

function winCardHTML(w) {
  return `<li class="win-item" title="${w.desc || ''}"><span class="win-badge">${w.count}</span><div class="win-icon">${w.icon}</div><div class="win-label">${w.label}</div></li>`;
}

function calculateAndUpdateWins() {
  const winData = loadWinData();
  const today = todayKey();
  const isSameDay = winData.todayDate === today;
  
  // Step 1: Create lifetime map
  const lifetimeMap = new Map();
  winData.lifetimeWins.forEach(w => {
    lifetimeMap.set(w.id, w.count);
  });
  
  // Only subtract old today's wins if we're recalculating the SAME day.
  // On a new day, the old today's wins are already part of lifetime history.
  if (isSameDay && winData.todayWins) {
    winData.todayWins.forEach(w => {
      const current = lifetimeMap.get(w.id) || 0;
      lifetimeMap.set(w.id, Math.max(0, current - (w.count || 1)));
    });
  }
  
  // Step 2: Calculate fresh today's wins
  const todayEvents = DB.forDate(today);
  const yesterdayEvents = DB.forDate(daysAgoKey(1));
  const freshTodayIds = Wins.calculate(todayEvents, yesterdayEvents);
  
  // Add undo wins (tracked separately since undos aren't events)
  const undoCount = isSameDay ? (winData.todayUndoCount || 0) : 0;
  for (let i = 0; i < undoCount; i++) freshTodayIds.push('second-thought');
  
  // Aggregate today's wins into {id, count} pairs
  const todayCountMap = new Map();
  freshTodayIds.forEach(id => {
    todayCountMap.set(id, (todayCountMap.get(id) || 0) + 1);
  });
  const freshTodayWins = Array.from(todayCountMap.entries())
    .map(([id, count]) => ({ id, count }));
  
  // Step 3: Add fresh today's wins to lifetime
  freshTodayWins.forEach(w => {
    const current = lifetimeMap.get(w.id) || 0;
    lifetimeMap.set(w.id, current + w.count);
  });
  
  // Step 4: Convert map back to array and save
  const updatedLifetimeWins = Array.from(lifetimeMap.entries())
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => {
      const defA = getWinDef(a.id);
      const defB = getWinDef(b.id);
      return defA.label.localeCompare(defB.label);
    });
  
  const updatedWinData = {
    todayDate: today,
    todayWins: freshTodayWins,
    lifetimeWins: updatedLifetimeWins,
    todayUndoCount: undoCount
  };
  
  saveWinData(updatedWinData);
  return updatedWinData;
}

function renderWins() {
  const winData = calculateAndUpdateWins();
  
  const todayEl = $('wins-today');
  if (todayEl) {
    if (winData.todayWins.length === 0) {
      todayEl.innerHTML = emptyStateHTML('Wins appear here as you go');
    } else {
      const todayWinsWithDef = winData.todayWins
        .map(w => ({ ...w, ...getWinDef(w.id) }))
        .sort((a, b) => a.label.localeCompare(b.label));
      todayEl.innerHTML = todayWinsWithDef.map(winCardHTML).join('');
    }
  }

  const totalEl = $('wins-total');
  if (!totalEl) return;
  
  if (winData.lifetimeWins.length === 0) {
    totalEl.innerHTML = emptyStateHTML('Total wins will appear here');
  } else {
    const lifetimeWinsWithDef = winData.lifetimeWins.map(w => ({ ...w, ...getWinDef(w.id) }));
    totalEl.innerHTML = lifetimeWinsWithDef.map(winCardHTML).join('');
  }
}

function hasRecentWater() {
  const cutoff = Date.now() - TWO_HOURS_MS;
  const today = DB.forDate(todayKey());
  const yesterday = DB.forDate(daysAgoKey(1));
  return [...today, ...yesterday].some(e => e.type === 'habit' && e.habit === 'water' && e.ts >= cutoff);
}

function renderWaterReminder() {
  const reminderEl = $('water-reminder');
  reminderEl.classList.toggle('hidden', hasRecentWater());
}

// ========== HISTORY ==========
function renderDayHistory() {
  const events = DB.forDate(currentHistoryDay);
  const historyEl = $('history-events');
  const labelEl = $('current-day-label');
  
  if (!historyEl || !labelEl) return;
  
  labelEl.textContent = friendlyDate(currentHistoryDay);
  
  if (events.length === 0) {
    historyEl.innerHTML = emptyStateHTML('No events for this day');
    return;
  }

  // Calculate summary stats
  const used = filterUsed(events);
  const resisted = filterByType(events, 'resisted');
  const exerciseMins = getHabits(events, 'exercise').reduce((sum, e) => sum + (e.minutes || 0), 0);
  const totalAmt = sumAmount(used);
  
  const summaryParts = [];
  if (used.length > 0) summaryParts.push(`Used ${used.length}x (${totalAmt} ${getProfile().amountUnit})`);
  if (resisted.length > 0) summaryParts.push(`Resisted ${resisted.length}x`);
  if (exerciseMins > 0) summaryParts.push(`Exercised ${exerciseMins}m`);
  
  const summary = summaryParts.length > 0 
    ? `<div style="padding:8px 12px;background:var(--card);border:1px solid var(--card-border);border-radius:8px;margin-bottom:12px;font-size:13px;color:var(--muted);text-align:center">${summaryParts.join(' • ')}</div>`
    : '';

  // Build HTML in reverse order, limited to historyShowCount
  const len = events.length;
  const start = Math.max(0, len - historyShowCount);
  let html = summary;
  for (let i = len - 1; i >= start; i--) {
    html += eventRowHTML(events[i], true);
  }
  
  // Show "Load More" button if there are more events
  if (start > 0) {
    const remaining = start;
    html += `<div style="text-align:center;padding:12px">
      <button onclick="App.loadMoreHistory()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--card-border);background:var(--card);color:var(--text);cursor:pointer">
        Show ${Math.min(remaining, HISTORY_PAGE_SIZE)} more (${remaining} remaining)
      </button>
    </div>`;
  }
  
  historyEl.innerHTML = html;
}

function loadMoreHistory() {
  historyShowCount += HISTORY_PAGE_SIZE;
  renderDayHistory();
}

function navigateDay(offset) {
  const d = new Date(currentHistoryDay + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  const newKey = dateKey(d);
  
  // Don't go beyond today
  if (newKey > todayKey()) return;
  
  currentHistoryDay = newKey;
  historyShowCount = HISTORY_PAGE_SIZE;
  renderDayHistory();
  
  // Update next button disabled state
  const nextBtn = $('next-day');
  if (nextBtn) nextBtn.disabled = (currentHistoryDay === todayKey());
}

// ========== GRAPHS ==========
const GRAPH_DEFS = [
  { label: '⚡ Amount Used / Day',    color: 'var(--primary)',  valueFn: evs => sumAmount(filterProfileUsed(evs)) },
  { label: '💪 Resists / Day',    color: 'var(--resist)',  valueFn: evs => filterByType(evs, 'resisted').length },
  { label: '🏃 Exercise Minutes / Day', color: '#e74c3c',  valueFn: evs => getHabits(evs, 'exercise').reduce((s, e) => s + (e.minutes || 0), 0) },
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
    
    // Show fewer labels for longer date ranges to prevent overlap
    let showLabel;
    if (graphDays <= 14) {
      showLabel = true; // Show all labels for short ranges
    } else if (graphDays <= 30) {
      showLabel = i % 5 === 0; // Show every 5th label (6 labels for 30 days)
    } else {
      showLabel = i % 10 === 0; // Show every 10th label (6 labels for 60 days)
    }
    
    html += graphBarCol(v, h, { color: def.color, text: dayLabel }, showLabel);
  }
  return html + '</div>';
}

function buildHourGraphBars(hourCounts, max, color) {
  let html = '<div class="graph-bars">';
  for (let hour = 0; hour < 24; hour++) {
    const count = hourCounts[hour] || 0;
    const h = max > 0 ? Math.round((count / max) * 96) : 0;
    const hourLabel = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
    html += graphBarCol(count, h, { color, text: hourLabel }, hour % 3 === 0);
  }
  return html + '</div>';
}

function renderGraphs() {
  const days = getLastNDays(graphDays);
  const container = $('graph-content');

  let html = '';
  
  // Regular graphs first (Amount per day, Resisted per day, Exercise)
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
  
  // Add today's usage by hour graph
  const todayEvents = DB.forDate(todayKey());
  const todayUsed = filterProfileUsed(todayEvents);
  const hourCounts = {};
  todayUsed.forEach(evt => {
    const hour = new Date(evt.ts).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const hasHourData = todayUsed.length > 0;
  const maxCount = hasHourData ? Math.max(...Object.values(hourCounts), 1) : 1;
  html += `<div class="graph-container"><div class="graph-title">🕒 Today's Usage by Hour</div>`;
  html += hasHourData
    ? buildHourGraphBars(hourCounts, maxCount, '#f39c12')
    : emptyStateHTML('No data yet', 'padding:12px 0');
  html += `</div>`;
  
  // Add average usage by hour heatmap
  const allDayKeys = DB.getAllDayKeys();
  const hourTotals = {};
  let daysWithUse = 0;
  
  allDayKeys.forEach(dayKey => {
    const dayUsed = filterProfileUsed(DB.forDate(dayKey));
    if (dayUsed.length > 0) {
      daysWithUse++;
      dayUsed.forEach(evt => {
        const hour = new Date(evt.ts).getHours();
        hourTotals[hour] = (hourTotals[hour] || 0) + 1;
      });
    }
  });
  
  // Calculate averages (only count days with at least 1 use)
  const hourAverages = {};
  for (let hour = 0; hour < 24; hour++) {
    if (hourTotals[hour] && daysWithUse > 0) {
      hourAverages[hour] = hourTotals[hour] / daysWithUse;
    }
  }
  
  const hasHeatmapData = Object.keys(hourAverages).length > 0;
  const maxAvg = hasHeatmapData ? Math.max(...Object.values(hourAverages)) : 1;
  html += `<div class="graph-container"><div class="graph-title">⚡ Average Usage by Hour</div>`;
  html += hasHeatmapData
    ? buildHourGraphBars(hourAverages, maxAvg, '#e67e22')
    : emptyStateHTML('No data yet', 'padding:12px 0');
  html += `</div>`;
  
  container.innerHTML = html;
}

// ========== TAB SWITCHING ==========
function switchTab(tabName) {
  hideUndo();
  hideUsedChips();
  hideResistedChips();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
  
  // Mount/unmount auth form to prevent browser autofill on other inputs
  if (window.FirebaseSync) {
    if (tabName === 'settings') FirebaseSync.mountAuthForm();
    else FirebaseSync.unmountAuthForm();
  }
  
  if (tabName === 'wins') renderWins();
  else if (tabName === 'graph') {
    requestAnimationFrame(() => {
      renderGraphs();
    });
  }
  else if (tabName === 'history') {
    currentHistoryDay = todayKey();
    historyShowCount = HISTORY_PAGE_SIZE;
    requestAnimationFrame(() => {
      renderDayHistory();
    });
  }
}

// ========== EXPORT ==========
function exportJSON() {
  const winData = loadWinData();
  const data = { 
    events: DB.loadEvents(), 
    settings: DB.loadSettings(), 
    lifetimeWins: winData.lifetimeWins,
    exportedAt: new Date().toISOString() 
  };
  downloadFile(JSON.stringify(data, null, 2), 'habit-tracker-' + todayKey() + '.json', 'application/json');
}

function clearDatabase() {
  if (!confirm('⚠️ This will permanently delete ALL events and reset settings. This cannot be undone.\n\nAre you sure?')) return;
  localStorage.removeItem(STORAGE_EVENTS);
  localStorage.removeItem(STORAGE_SETTINGS);
  localStorage.removeItem(STORAGE_TODOS);
  localStorage.removeItem(STORAGE_THEME);
  localStorage.removeItem(STORAGE_WINS);
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
  if (!statusEl) return;
  
  const showStatus = (msg, cls) => {
    statusEl.textContent = msg;
    statusEl.className = `import-status ${cls}`;
    setTimeout(() => statusEl.classList.add('hidden'), IMPORT_STATUS_HIDE_MS);
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
      
      DB._events = [...existing, ...newEvents].sort((a, b) => a.ts - b.ts);
      DB.saveEvents();

      // Import lifetime wins if present
      if (data.lifetimeWins && Array.isArray(data.lifetimeWins)) {
        const winData = loadWinData();
        const lifetimeMap = new Map();
        winData.lifetimeWins.forEach(w => lifetimeMap.set(w.id, w.count));
        
        // Merge imported wins (higher counts win)
        data.lifetimeWins.forEach(w => {
          const current = lifetimeMap.get(w.id) || 0;
          lifetimeMap.set(w.id, Math.max(current, w.count));
        });
        
        const mergedWinData = {
          todayDate: winData.todayDate,
          todayWins: winData.todayWins,
          todayUndoCount: winData.todayUndoCount || 0,
          lifetimeWins: Array.from(lifetimeMap.entries())
            .filter(([, count]) => count > 0)
            .map(([id, count]) => ({ id, count }))
        };
        saveWinData(mergedWinData);
      }

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

function buildTimeChips(eventTs) {
  const now = new Date();
  const slots = [{ label: 'Now', value: 'now' }];
  
  // Generate half-hour slots going back ~3 hours
  const d = new Date(now);
  // Round down to last half hour
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  
  for (let i = 0; i < 6; i++) {
    d.setMinutes(d.getMinutes() - 30);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    slots.push({ label, value: d.getTime().toString() });
  }
  
  // Determine which slot is active
  const isNow = Math.abs(eventTs - now.getTime()) < 60000; // within 1 minute = "Now"
  let activeSlot = 'now';
  if (!isNow) {
    let minDiff = Infinity;
    for (const s of slots) {
      if (s.value === 'now') continue;
      const diff = Math.abs(parseInt(s.value) - eventTs);
      if (diff < minDiff) { minDiff = diff; activeSlot = s.value; }
    }
  }
  
  return `
    <div class="chip-row-label">Time</div>
    <div class="chip-group" data-field="ts">
      ${slots.map(s => `<span class="chip${activeSlot === s.value ? ' active' : ''}" data-val="${s.value}">${s.label}</span>`).join('')}
    </div>`;
}

function buildUsedChips(evt) {
  const profile = getProfile();
  return [
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v]),
    chipGroupHTML('Method', 'method', profile.methods, evt.method),
    chipGroupHTML('Amount', 'amount', profile.amounts, evt.amount),
    buildTimeChips(evt.ts),
    chipGroupHTML('Reason (optional)', 'reason', REASONS, evt.reason),
    chipDismissBtn('dismiss ✕', 'App.hideUsedChips()')
  ].join('');
}

function buildResistedChips(evt) {
  return [
    chipGroupHTML('Urge Intensity', 'intensity', INTENSITIES, evt.intensity),
    chipGroupHTML('Trigger', 'trigger', REASONS, evt.trigger),
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
  // Don't persist reason - it should reset each time
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
  
  // Special handling for time field
  if (field === 'ts') {
    const newTs = chip.dataset.val === 'now' ? Date.now() : parseInt(chip.dataset.val);
    DB.updateEvent(activeChipEventId, { ts: newTs });
    updateActiveChips();
    render();
    return;
  }
  
  const val = resolveChipVal(field, chip.dataset.val, currentEvent);

  const updateData = { [field]: val };

  DB.updateEvent(activeChipEventId, updateData);
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
      chipGroupHTML('Trigger', 'trigger', REASONS, evt.trigger)
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
  
  // Format time as HH:MM for input type="time"
  const eventTime = new Date(evt.ts);
  const hours = String(eventTime.getHours()).padStart(2, '0');
  const minutes = String(eventTime.getMinutes()).padStart(2, '0');
  const timeValue = `${hours}:${minutes}`;

  $('modal-sheet').innerHTML = `
    <div class="modal-header"><h2>Edit Event</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
    <div class="modal-field"><label>Time</label><input type="time" id="modal-time-input" value="${timeValue}" style="padding:8px 12px;font-size:14px;border:1px solid var(--card-border);border-radius:8px;background:var(--card);color:var(--text);width:100%"></div>
    ${fieldsHTML}
    <div class="modal-actions">
      <button class="btn-delete" onclick="App.deleteEvent('${evt.id}'); App.closeModal();">Delete</button>
      <button class="btn-save" onclick="App.saveModal()">Done</button>
    </div>`;
  $('modal-sheet').dataset.eventId = eventId;
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
}

function saveModal() {
  const eventId = $('modal-sheet').dataset.eventId;
  const timeInput = $('modal-time-input');
  
  if (eventId && timeInput) {
    const currentEvent = DB.loadEvents().find(e => e.id === eventId);
    if (currentEvent) {
      const oldDateKey = dateKey(currentEvent.ts);
      
      // Parse the time input and create new timestamp on same date as event
      const [hours, minutes] = timeInput.value.split(':').map(Number);
      const newDate = new Date(currentEvent.ts);
      newDate.setHours(hours, minutes, 0, 0);
      const newTs = newDate.getTime();
      
      // Update the event timestamp
      DB.updateEvent(eventId, { ts: newTs });
      
      const newDateKey = dateKey(newTs);
      
      // If date changed, we need to refresh history view
      if (oldDateKey !== newDateKey && currentHistoryDay === oldDateKey) {
        // Event moved to different day - refresh the history display
        renderDayHistory();
      }
      
      // Recalculate wins since event time changed
      calculateAndUpdateWins();
    }
  }
  
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

  const updateData = { [field]: val };

  DB.updateEvent(eventId, updateData);
  chip.closest('.chip-group').querySelectorAll('.chip').forEach(c => 
    c.classList.toggle('active', val !== null && c.dataset.val === String(val))
  );
}

// ========== COACHING ==========
function showCoaching() {
  if (!DB.loadSettings().showCoaching) return;
  const msg = COACHING_MESSAGES[Math.floor(Math.random() * COACHING_MESSAGES.length)];
  $('coaching-text').textContent = msg;
  $('coaching-tip').classList.remove('hidden');
}

// ========== ONBOARDING ==========
// ========== LOGIN SCREEN ==========

function showLoginScreen() {
  const overlay = $('login-overlay');
  overlay.classList.remove('hidden');
  // Inject auth inputs only when login screen is visible
  const loginInputs = overlay.querySelector('.login-inputs');
  if (loginInputs && !loginInputs.children.length) {
    loginInputs.innerHTML = `
      <input type="email" id="login-email" placeholder="Email" class="login-input">
      <input type="password" id="login-password" placeholder="Password (6+ chars)" class="login-input">`;
  }
}

function hideLoginScreen() {
  const overlay = $('login-overlay');
  overlay.classList.add('hidden');
  // Remove auth inputs from DOM to prevent browser autofill on other inputs
  const loginInputs = overlay.querySelector('.login-inputs');
  if (loginInputs) loginInputs.innerHTML = '';
}

function skipLogin() {
  localStorage.setItem(STORAGE_LOGIN_SKIPPED, 'true');
  hideLoginScreen();
  continueToApp();
}

function continueToApp() {
  // After login or skip, check if we need onboarding
  if (!DB.loadSettings().addictionProfile) {
    showOnboarding();
  } else {
    // Restore user's preferred graph range
    const settings = DB.loadSettings();
    graphDays = settings.graphDays || 7;
    const rangeEl = $('graph-range');
    if (rangeEl) rangeEl.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.days === graphDays));
    
    calculateAndUpdateWins();
    bindEvents();
    render();
    // Clear existing interval if continueToApp is called multiple times
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
  }
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
  if (!profile) return;
  const settings = DB.loadSettings();
  
  // Default to 1.0 or closest amount to 1.0 in the profile's amounts array
  const defaultAmount = profile.amounts.find(a => a >= 1) || profile.amounts[0];
  
  Object.assign(settings, {
    addictionProfile: profileKey,
    lastSubstance: profile.substances[0],
    lastMethod: profile.methods[0],
    lastAmount: defaultAmount
  });
  
  DB._settings = settings;
  DB.saveSettings();
  
  $('onboarding-overlay').classList.add('hidden');
  
  bindEvents();
  render();
  // Clear existing interval if selectProfile is called multiple times
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
}

// ========== MAIN ACTIONS ==========
function stampActivity() {
  const s = DB.loadSettings();
  s.lastActivityTimestamp = Date.now();
  DB.saveSettings();
}

let lastUndoEventId = null;

function showUndo(eventId) {
  lastUndoEventId = eventId;
  const row = $('used-row');
  if (row) row.classList.add('has-undo');
}

function hideUndo() {
  lastUndoEventId = null;
  const row = $('used-row');
  if (row) row.classList.remove('has-undo');
}

function undoLastUsed() {
  if (!lastUndoEventId) return;
  DB.deleteEvent(lastUndoEventId);
  
  // Track undo for "Second Thought" win
  const winData = loadWinData();
  const today = todayKey();
  winData.todayUndoCount = (winData.todayDate === today ? (winData.todayUndoCount || 0) : 0) + 1;
  winData.todayDate = today;
  saveWinData(winData);
  
  hideUndo();
  hideUsedChips();
  render();
}

function logUsed() {
  const s = DB.loadSettings();
  const evt = createUsedEvent(s.lastSubstance, s.lastMethod, s.lastAmount);
  DB.addEvent(evt);
  stampActivity();
  calculateAndUpdateWins();
  render();
  hideResistedChips();
  showChips('used-chips', buildUsedChips, evt, hideUsedChips);
  flashEl($('btn-used'));
  showUndo(evt.id);
}

function logResisted() {
  const evt = createResistedEvent();
  DB.addEvent(evt);
  stampActivity();
  calculateAndUpdateWins();
  render();
  hideUsedChips();
  hideUndo();
  showChips('resisted-chips', buildResistedChips, evt, hideResistedChips);
  showCoaching();
  flashEl($('btn-resisted'));
}

function logHabit(habit, minutes) {
  const evt = createHabitEvent(habit, minutes);
  DB.addEvent(evt);
  stampActivity();
  calculateAndUpdateWins();
  render();
  hideUndo();
}

function logWaterFromReminder() {
  logHabit('water');
  flashEl($('water-reminder-btn'));
}

// ========== EVENT HANDLERS ==========
function bindEvents() {
  // Prevent duplicate event listener bindings
  if (eventsAreBound) return;
  eventsAreBound = true;

  $('tab-bar').addEventListener('click', e => { const b = e.target.closest('.tab-btn'); if (b) switchTab(b.dataset.tab); });

  $('graph-range').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    graphDays = +chip.dataset.days;
    const settings = DB.loadSettings();
    settings.graphDays = graphDays;
    DB._settings = settings;
    DB.saveSettings();
    e.currentTarget.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    requestAnimationFrame(renderGraphs);
  });

  $('btn-used').addEventListener('click', logUsed);
  $('btn-undo').addEventListener('click', undoLastUsed);
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
    if (e.target.classList.contains('todo-text')) editTodo(idx);
    
    // Handle button clicks (move up, move down, edit and delete)
    const btn = e.target.closest('.tl-act-btn');
    if (btn && btn.dataset.idx !== undefined) {
      const buttonIdx = +btn.dataset.idx;
      if (btn.title === 'Move Up') moveUpTodo(buttonIdx);
      if (btn.title === 'Move Down') moveDownTodo(buttonIdx);
      if (btn.title === 'Edit') editTodo(buttonIdx);
      if (btn.title === 'Delete') deleteTodo(buttonIdx);
    }
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
  try {
    localStorage.setItem(STORAGE_TODOS, JSON.stringify(todos));
    if (window.FirebaseSync) FirebaseSync.onDataChanged();
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storage limit reached. Please export your data and clear completed tasks.');
    }
    throw e;
  }
}

function renderTodos() {
  const todos = loadTodos();
  $('todo-list').innerHTML = todos.length === 0
    ? ''
    : todos.map((t, i) => `<li class="todo-item${t.done ? ' done' : ''}">
        <button class="tl-act-btn" data-idx="${i}" title="Move Up"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="tl-act-btn" data-idx="${i}" title="Move Down"${i === todos.length - 1 ? ' disabled' : ''}>↓</button>
        <input type="checkbox" class="todo-check" data-idx="${i}"${t.done ? ' checked' : ''}>
        <span class="todo-text" data-idx="${i}">${escapeHTML(t.text)}</span>
        <button class="tl-act-btn" data-idx="${i}" title="Edit">✏️</button>
        <button class="tl-act-btn" data-idx="${i}" title="Delete">🗑️</button>
      </li>`).join('');
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120) return;
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

function moveUpTodo(idx) {
  if (idx === 0) return;
  const todos = loadTodos();
  [todos[idx - 1], todos[idx]] = [todos[idx], todos[idx - 1]];
  saveTodos(todos);
  renderTodos();
}

function moveDownTodo(idx) {
  const todos = loadTodos();
  if (idx >= todos.length - 1) return;
  [todos[idx], todos[idx + 1]] = [todos[idx + 1], todos[idx]];
  saveTodos(todos);
  renderTodos();
}

function editTodo(idx) {
  const todos = loadTodos();
  const todo = todos[idx];
  if (!todo) return;
  
  const todoItems = $('todo-list').querySelectorAll('.todo-item');
  const item = todoItems[idx];
  if (!item) return;
  
  const textSpan = item.querySelector('.todo-text');
  if (!textSpan) return;
  
  const currentText = todo.text;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-edit-input';
  input.value = currentText;
  input.maxLength = 120;
  input.dataset.idx = idx;
  
  const saveEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      todos[idx].text = newText;
      saveTodos(todos);
    }
    renderTodos();
  };
  
  input.addEventListener('blur', saveEdit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') renderTodos();
  });
  
  textSpan.replaceWith(input);
  input.focus();
  input.select();
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
    render();
  },
  exportJSON,
  importJSON,
  clearDatabase,
  changeAddiction,
  switchTab,
  logWaterFromReminder,
  loadMoreHistory,
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    applyTheme(getToggleTheme(currentTheme));
  },
  skipLogin,
  loginWithGoogle() {
    if (window.FirebaseSync) {
      FirebaseSync.loginWithGoogle();
    }
  },
  async loginWithEmailFromScreen() {
    const email = $('login-email')?.value;
    const password = $('login-password')?.value;
    if (!email || !password) return alert('Enter email and password');
    try {
      if (window.FirebaseSync) {
        await FirebaseSync.loginWithEmail(email, password);
      }
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  },
  async signupWithEmailFromScreen() {
    const email = $('login-email')?.value;
    const password = $('login-password')?.value;
    if (!email || !password) return alert('Enter email and password');
    if (password.length < 6) return alert('Password must be at least 6 characters');
    try {
      if (window.FirebaseSync) {
        await FirebaseSync.signupWithEmail(email, password);
        if (FirebaseSync.showWelcome) {
          FirebaseSync.showWelcome(email);
        }
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        alert('Account already exists — use Log In instead.');
      } else {
        alert('Sign up failed: ' + err.message);
      }
    }
  }
};

// ========== TEST DATA GENERATION ==========
// Call these from browser console to generate realistic historical data:
// generateAllTestData() - adds a mix of everything (recommended)
// generateTestData(100) - adds 100 random usage events over past 30 days
// generateTestHabits(20) - adds 20 random events per habit type
// generateTestResists(50) - adds 50 random resist events

function generateAllTestData() {
  console.log('🎲 Generating comprehensive test data...');
  generateTestData(80);
  generateTestHabits(15);
  generateTestResists(40);
  generateTestWins();
  console.log('✅ All test data generated! Reload the page to see results.');
}

function generateTestData(numEvents = 100) {
  const profile = getProfile();
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  DB.loadEvents();
  
  console.log(`Generating ${numEvents} random usage events...`);
  
  for (let i = 0; i < numEvents; i++) {
    // Random timestamp within past 30 days
    const timestamp = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
    
    // Random substance, method, amount
    const substance = profile.substances[Math.floor(Math.random() * profile.substances.length)];
    const method = profile.methods[Math.floor(Math.random() * profile.methods.length)];
    const amount = profile.amounts[Math.floor(Math.random() * profile.amounts.length)];
    const reason = Math.random() > 0.3 ? REASONS[Math.floor(Math.random() * REASONS.length)] : null;
    
    const evt = {
      id: uid(),
      type: 'used',
      ts: timestamp,
      substance,
      method,
      amount,
      reason,
    };
    
    DB._events.push(evt);
  }
  
  // Sort events by timestamp
  DB._events.sort((a, b) => a.ts - b.ts);
  DB.saveEvents();
  
  console.log(`✅ Added ${numEvents} usage events. Reload the page to see updated data.`);
}

function generateTestHabits(numPerHabit = 20) {
  const habitTypes = ['water', 'breaths', 'clean', 'exercise', 'outside'];
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  DB.loadEvents();
  
  console.log(`Generating ${numPerHabit} events for each habit type...`);
  
  for (const habit of habitTypes) {
    for (let i = 0; i < numPerHabit; i++) {
      const timestamp = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
      const minutes = habit === 'exercise' 
        ? EXERCISE_DURATIONS[Math.floor(Math.random() * EXERCISE_DURATIONS.length)]
        : null;
      
      const evt = {
        id: uid(),
        type: 'habit',
        ts: timestamp,
        habit,
        minutes
      };
      
      DB._events.push(evt);
    }
  }
  
  // Sort events by timestamp
  DB._events.sort((a, b) => a.ts - b.ts);
  DB.saveEvents();
  
  console.log(`✅ Added ${numPerHabit * habitTypes.length} habit events. Reload the page to see updated data.`);
}

function generateTestResists(numEvents = 50) {
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  DB.loadEvents();
  
  console.log(`Generating ${numEvents} random resist events...`);
  
  for (let i = 0; i < numEvents; i++) {
    const timestamp = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
    const intensity = Math.random() > 0.2 ? INTENSITIES[Math.floor(Math.random() * INTENSITIES.length)] : null;
    const trigger = Math.random() > 0.3 ? REASONS[Math.floor(Math.random() * REASONS.length)] : null;
    
    const evt = {
      id: uid(),
      type: 'resisted',
      ts: timestamp,
      intensity,
      trigger
    };
    
    DB._events.push(evt);
  }
  
  // Sort events by timestamp
  DB._events.sort((a, b) => a.ts - b.ts);
  DB.saveEvents();
  
  console.log(`✅ Added ${numEvents} resist events. Reload the page to see updated data.`);
}

function generateTestWins() {
  const winIds = Object.keys(WIN_DEFINITIONS);
  // Exclude rare/milestone wins to keep it realistic
  const excludeIds = new Set(['year-streak', 'month-streak', 'tbreak-365d', 'tbreak-30d', 'tbreak-21d']);
  // Common wins get higher counts, rare wins get lower
  const commonWins = new Set(['resist', 'mindful', 'dose-half', 'harm-reduction-vape', 'hydrated',
    'habit-stack', 'good-start', 'app-streak', 'gap-1h', 'gap-2h']);
  const eligibleIds = winIds.filter(id => !excludeIds.has(id));
  
  console.log('Generating random lifetime wins...');
  
  // Start fresh — only keep existing lifetime wins, clear today tracking
  // so calculateAndUpdateWins won't subtract stale todayWins from the new lifetime.
  const winData = loadWinData();
  const lifetimeMap = new Map();
  winData.lifetimeWins.forEach(w => lifetimeMap.set(w.id, w.count));
  
  for (const id of eligibleIds) {
    // ~80% chance each win has been earned at least once
    if (Math.random() < 0.8) {
      // Common wins: 10-50 count, rare wins: 1-10
      const count = commonWins.has(id)
        ? Math.floor(Math.random() * 40) + 10
        : Math.floor(Math.random() * 10) + 1;
      lifetimeMap.set(id, (lifetimeMap.get(id) || 0) + count);
    }
  }
  
  const updatedData = {
    todayDate: null,
    todayWins: [],
    todayUndoCount: 0,
    lifetimeWins: Array.from(lifetimeMap.entries())
      .map(([id, count]) => ({ id, count }))
      .filter(w => w.count > 0)
  };
  
  saveWinData(updatedData);
  
  // Verify save
  const verify = loadWinData();
  console.log(`✅ Added random wins for ${updatedData.lifetimeWins.length} win types. Stored ${verify.lifetimeWins.length} in database.`);
  console.log('Sample lifetime wins:', verify.lifetimeWins.slice(0, 5));
}

// Attach to window for console access
window.generateAllTestData = generateAllTestData;
window.generateTestData = generateTestData;
window.generateTestHabits = generateTestHabits;
window.generateTestResists = generateTestResists;
window.generateTestWins = generateTestWins;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  // Don't preload events or settings - let them load lazily to avoid caching stale data before Firebase sync
  
  applyTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
  
  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
      .catch(err => console.log('[PWA] Service worker registration failed:', err));
  }
  
  // Firebase will handle initial auth check and call continueToApp() or show login screen
  // If Firebase is not configured, checkAuthAndContinue will be called after a short delay
});