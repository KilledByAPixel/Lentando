// ============================================================
// ZERO-FRICTION USAGE + WINS TRACKER
// ============================================================

'use strict';

const debugMode = false; // Set to true to enable debug logging

// ========== CONSTANTS ==========
const STORAGE_EVENTS = 'ht_events';
const STORAGE_SETTINGS = 'ht_settings';
const STORAGE_TODOS = 'ht_todos';
const STORAGE_THEME = 'ht_theme';
const STORAGE_WINS = 'ht_wins';
const STORAGE_LOGIN_SKIPPED = 'ht_login_skipped';
const STORAGE_VERSION = 'ht_data_version';
const STORAGE_DELETED_IDS = 'ht_deleted_ids';
const DATA_VERSION = 1;

const ADDICTION_PROFILES = {
  cannabis: {
    sessionLabel: 'Use',
    substanceLabel: 'Type',
    methodLabel: 'Method',
    substances: ['thc', 'cbd', 'mix'],
    substanceDisplay: { thc: 'THC', cbd: 'CBD', mix: 'Mix' },
    methods: ['bong', 'vape', 'pipe', 'joint', 'edible', 'other'],
    amounts: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],
    amountUnit: 'hits',
    icons: { thc: '🌿', cbd: '🍃', mix: '🍂' }
  },
  alcohol: {
    sessionLabel: 'Drink',
    substanceLabel: 'Type',
    substances: ['beer', 'wine', 'liquor'],
    substanceDisplay: { beer: 'Beer', wine: 'Wine', liquor: 'Liquor' },
    amounts: [0.5, 1, 2, 3, 4, 5],
    amountUnit: 'drinks',
    icons: { beer: '🍺', wine: '🍷', liquor: '🥃' }
  },
  smoking: {
    sessionLabel: 'Smoke',
    substanceLabel: 'Type',
    substances: ['cigarette', 'vape', 'other'],
    substanceDisplay: { cigarette: 'Cigarette', vape: 'Vape', other: 'Other' },
    amounts: [0.5, 1, 2, 3, 5, 10],
    amountUnit: 'count',
    icons: { cigarette: '🚬', vape: '💨', other: '⚡' }
  },
  other: {
    sessionLabel: 'Use',
    substanceLabel: 'Type',
    methodLabel: 'Method',
    substances: ['type1', 'type2', 'type3'],
    substanceDisplay: { type1: 'Type 1', type2: 'Type 2', type3: 'Type 3' },
    methods: ['method1', 'method2', 'method3', 'other'],
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
const REASONS = ['habit', 'stress', 'break', 'social', 'sleep', 'pain'];
const INTENSITIES = [1, 2, 3, 4, 5];
const EXERCISE_DURATIONS = [0, 5, 10, 15, 20, 30, 45, 60];
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
const TBREAK_MILESTONES = [1, 7, 14, 21, 30, 365];
const APP_STREAK_MILESTONES = [2, 7, 30, 365];
const EARLY_HOUR = 6;
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
  '☕ Make a warm drink',
  '🚿 Splash water on your face',
  '🧘 Do a quick stretch',
  '🚶 Go for a short walk',
  '🧹 Tidy up one small thing',
  '💪 One minute at a time',
  '🏆 Every resist is a win',
  '🎮 Play a quick game',
  '📞 Text a friend',
  '🎨 Do something creative',
  '🤸 Take a movement break',
  '🧼 Wash your face or hands',
  '🍬 Chew some gum or brush teeth',
  '📽️ Watch something calming',
  '✍️ Write about how you feel',
  '🕯️ Light a candle or incense',
  '🦶 Feel your feet on the floor',
  '🗑️ Throw away one piece of trash',
  '🍽️ Wash a few dishes',
  '🧠 You\'re building the "pause" muscle',
  '📈 Small steps add up',
  '🌊 This urge will pass',
  '📦 Put it out of reach for now',
  '🌱 Do something small for future you',
];

const HABIT_ICONS = { water: '💧', breaths: '🌬️', clean: '🧹', exercise: '🏃', outside: '🌳' };
const HABIT_LABELS = {
  water: 'Water',
  breaths: 'Breaths',
  clean: 'Tidy',
  exercise: 'Exercise',
  outside: 'Outside'
};

// Win definitions - maps win IDs to their display properties
// Order matters! sortOrder is auto-assigned based on position in this object
// Note: While we use "badges" as the primary user-facing term, it's fine to use "win"
// in individual medal labels (e.g., "Gap Win", "Taper Win") when it sounds natural
const WIN_DEFINITIONS = {
  'welcome-back': { label: 'Welcome Back', icon: '👋', desc: 'Returned to tracking after 24+ hours away' },
  'daily-checkin': { label: 'Daily Check-in', icon: '✅', desc: 'Logged at least one thing - showing up is a win' },
  'resist': { label: 'Resisted', icon: '💪', desc: 'Resisted an urge' },
  'urge-surfed': { label: 'Urge Surfed', icon: '🧘', desc: 'Logged an urge and didn\'t use for 15+ minutes' },
  'second-thought': { label: 'Second Thought', icon: '↩️', desc: 'Used undo to reconsider' },
  'swap-completed': { label: 'Swap Completed', icon: '🛠️', desc: 'Logged an urge, then did a healthy action within 15 minutes' },
  'intensity-logged': { label: 'Intensity Logged', icon: '📊', desc: 'Tracked urge intensity' },
  'trigger-noted': { label: 'Trigger Identified', icon: '🔍', desc: 'Identified what triggered the urge' },
  'full-report': { label: 'Full Report', icon: '📋', desc: 'Logged both intensity and trigger' },
  'tough-resist': { label: 'Tough Resist', icon: '🦁', desc: 'Resisted a strong urge (intensity 4+)' },
  'mindful': { label: 'Mindful Session', icon: '🧠', desc: 'Logged the reason for using' },
  'dose-half': { label: 'Low Dose', icon: '⚖️', desc: 'Used less than a full dose' },
  'harm-reduction-vape': { label: 'Harm Reduction', icon: '🌡️', desc: 'Chose vape over smoke' },
  'cbd-only': { label: 'CBD-Only Day', icon: '🍃', desc: 'Used only CBD products, no THC' },
  'low-day': { label: 'Low Use Day', icon: '🤏', desc: 'Total usage ≤2 units' },
  'zero-use': { label: 'No Use Day', icon: '🏆', desc: 'No use' },
  'good-start': { label: 'Good Start', icon: '🚀', desc: 'Started the day with a positive action instead of using' },
  'drank-water': { label: 'Drank Water', icon: '💧', desc: 'Logged water' },
  'hydrated': { label: 'Well Hydrated', icon: '🌊', desc: 'Logged water 5+ times' },
  'breathwork': { label: 'Breathwork', icon: '🌬️', desc: 'Did breathing exercises or meditation' },
  'cleaned': { label: 'Tidied', icon: '🧹', desc: 'Tidied up or cleaned something' },
  'went-outside': { label: 'Went Outside', icon: '🌳', desc: 'Spent time outside or got some fresh air' },
  'exercised': { label: 'Exercised', icon: '🏃', desc: 'Logged exercise' },
  'habit-stack': { label: 'Habit Stack', icon: '🧱', desc: 'Logged multiple different habit types' },
  'five-star-day': { label: 'Five Star Day', icon: '🌟', desc: 'Logged all 5 habit types' },
  'gap-above-avg': { label: 'Longer Gaps', icon: '📏', desc: 'Average gap today exceeded 7-day average (excludes gaps crossing 6am)' },
  'gap-1h': { label: 'Gap 1h', icon: '🕐', desc: 'Maintained a 1+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-2h': { label: 'Gap 2h', icon: '🕑', desc: 'Maintained a 2+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-4h': { label: 'Gap 4h', icon: '🕓', desc: 'Maintained a 4+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-8h': { label: 'Gap 8h', icon: '🕗', desc: 'Maintained a 8+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-12h': { label: 'Gap 12h', icon: '🕛', desc: 'Maintained a 12+ hour gap between sessions (excludes gaps crossing 6am)' },
  'night-gap': { label: 'Night Gap', icon: '🛏️', desc: 'Maintained a 12+ hour gap between sessions crossing the 6am threshold' },
  'night-skip': { label: 'Night Skip', icon: '☄️', desc: 'No use between midnight and 6am' },
  'morning-skip': { label: 'Morning Skip', icon: '🌅', desc: 'No use between 6am and noon' },
  'day-skip': { label: 'Day Skip', icon: '☀️', desc: 'No use between noon and 6pm' },
  'evening-skip': { label: 'Evening Skip', icon: '🌙', desc: 'No use between 6pm and midnight' },
  'lower-amount': { label: 'Less Than Yesterday', icon: '📉', desc: 'Used a smaller total amount than yesterday' },
  'first-later': { label: 'Later Than Yesterday', icon: '⏰', desc: 'First session later than yesterday (after 6am)' },
  'resist-streak': { label: 'Resist Streak', icon: '🛡️', desc: 'Resisted urges for multiple days in a row' },
  'habit-streak': { label: 'Habit Streak', icon: '🐢', desc: 'Logged healthy habits for consecutive days' },
  'taper': { label: 'Tapering Off', icon: '📐', desc: 'Gradually reduced usage over 3 or more consecutive days' },
  'app-streak': { label: 'App Streak', icon: '📱', desc: 'Used the app multiple days in a row' },
  'week-streak': { label: 'App Week Streak', icon: '📅', desc: 'Used the app every day for a week' },
  'month-streak': { label: 'App Month Streak', icon: '🗓️', desc: 'Used the app every day for a month' },
  'year-streak': { label: 'App Year Streak', icon: '🎉', desc: 'Used the app every day for a year!' },
  'tbreak-1d': { label: 'Day Break', icon: '🌱', desc: 'One full day with no use' },
  'tbreak-7d': { label: 'Week Break', icon: '🌿', desc: 'One week with no use' },
  'tbreak-14d': { label: '2 Week Break', icon: '🍀', desc: 'Two weeks with no use' },
  'tbreak-21d': { label: '3 Week Break', icon: '🌳', desc: 'Three weeks with no use' },
  'tbreak-30d': { label: '1 Month Break', icon: '🏆', desc: 'One month with no use' },
  'tbreak-365d': { label: '1 Year Break', icon: '👑', desc: 'One year with no use!' },
};

// Auto-assign sortOrder based on position in WIN_DEFINITIONS object
Object.keys(WIN_DEFINITIONS).forEach((key, index) => {
  WIN_DEFINITIONS[key].sortOrder = index;
});

function getWinDef(id) {
  return WIN_DEFINITIONS[id] || { label: 'Unknown Medal', icon: '❓', desc: '' };
}

const DEFAULT_SETTINGS = {
  addictionProfile: null, // Set on first launch
  lastSubstance: 'thc',
  lastMethod: 'bong',
  lastAmount: 1.0,
  showCoaching: true,
  graphDays: 7,
  soundEnabled: true
};

// ========== SOUND SYSTEM ==========
let ZZFXSound = null;
let SOUNDS = null;

// Initialize sounds on startup
async function initSounds() {
  try {
    const zzfxModule = await import('./zzfx.js');
    ZZFXSound = zzfxModule.ZZFXSound;
    
    // Pre-build sound samples using ZZFXSound class (params will be tuned later)
    SOUNDS = {
      used: new ZZFXSound([,,224,.02,.02,.08,1,1.7,-14,,,,,,6.7]),
      resist: new ZZFXSound([,,422,.08,.26,.19,1,1.1,,-144,18,.07,.1,,,,,.84,.21,.5,520]),
      habit: new ZZFXSound([2,,330,.02,.05,,,.8,,,27,.06,,,,,.1,.5,.03]),
      exercise: new ZZFXSound([,,990,,,.05,,9,20]),
      undo: new ZZFXSound([,,150,.05,,.05,,1.3,,,,,,3]),
      cooldown: new ZZFXSound([2,0,260,,.2,.2,,,,,,,,,,,.12,.3,.1]),
      //badge: new ZZFXSound([3,.02,988,,,.4,,33,,,331,.1,,,,,,,,,-340]), // coin sound for badges, disabled for now
      //click: new ZZFXSound([1.5,,300,,,.008,,,300,,,,,,,,,.5]), // short sound for UI clicks, disabled for now
    };
  } catch (e) {
    console.error('Failed to load sound system:', e);
  }
}

function playSound(soundName) {
  if (!SOUNDS || !DB.loadSettings().soundEnabled) return;
  try {
    SOUNDS[soundName]?.play();
  } catch (e) {
    console.error('Failed to play sound:', soundName, e);
  }
}

// ========== TINY HELPERS ==========
const $ = id => document.getElementById(id);

// Cache Intl formatters — creating these is expensive
const _timeFormatter = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
const _dateFormatter = new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric' });

let _uidCounter = 0;
function uid() {
  return Date.now().toString(36) + '-' + (++_uidCounter).toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('⚠️ Storage full — your data may not have saved.\n\nPlease export your data from Settings and clear old events to free up space.');
      console.error('QuotaExceededError writing key:', key);
      return false;
    }
    throw e;
  }
}
window.safeSetItem = safeSetItem;

function flashEl(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), FLASH_ANIMATION_MS);
}

function pulseEl(el) {
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 400);
}

function hapticFeedback() {
  if (debugMode) console.log('Haptic feedback triggered');
  if (navigator.vibrate) navigator.vibrate(50);
}

let toastTimeout = null;

function showToast(message, durationMs = 2000) {
  clearTimeout(toastTimeout);
  
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, durationMs);
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Clear all app localStorage keys and invalidate DB caches */
function clearAllStorage() {
  localStorage.removeItem(STORAGE_EVENTS);
  localStorage.removeItem(STORAGE_SETTINGS);
  localStorage.removeItem(STORAGE_TODOS);
  localStorage.removeItem(STORAGE_THEME);
  localStorage.removeItem(STORAGE_WINS);
  localStorage.removeItem(STORAGE_LOGIN_SKIPPED);
  localStorage.removeItem(STORAGE_VERSION);
  localStorage.removeItem(STORAGE_DELETED_IDS);
  localStorage.removeItem('ht_last_updated');
  DB._events = null;
  DB._settings = null;
  DB._dateIndex = null;
}

/** Validate password strength. Returns error message or null if valid. */
function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
}

function timeOfDayMin(ts) {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

// ========== DATE HELPERS ==========
const sortByTime = (a, b) => a.ts - b.ts;
const sortedByTime = (arr) => [...arr].sort(sortByTime);
const getHour = (ts) => new Date(ts).getHours();
const filterDaytime = (events) => events.filter(e => getHour(e.ts) >= EARLY_HOUR);

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
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) return totalHours + 'h ' + (totalMin % 60) + 'm';
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays < 365) return totalDays + 'd ' + (totalHours % 24) + 'h ' + (totalMin % 60) + 'm';
  const years = Math.floor(totalDays / 365);
  const days = totalDays % 365;
  const hours = totalHours % 24;
  return years + 'y ' + days + 'd ' + hours + 'h ' + (totalMin % 60) + 'm';
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
      arr.sort(sortByTime);
    }
  },

  _invalidateDateIndex() {
    this._dateIndex = null;
  },

  _migrateDataIfNeeded() {
    try {
      const raw = localStorage.getItem(STORAGE_VERSION);
      const storedVersion = parseInt(raw) || 0;
      if (storedVersion >= DATA_VERSION) return;

      // Brand-new install — no existing data to migrate, just stamp the version
      if (raw === null && !localStorage.getItem(STORAGE_EVENTS) && !localStorage.getItem(STORAGE_WINS)) {
        safeSetItem(STORAGE_VERSION, DATA_VERSION.toString());
        return;
      }

      console.log(`Migrating data from version ${storedVersion} to ${DATA_VERSION}`);

      // Future migrations go here
      // if (storedVersion < 2) { /* migrate to v2 */ }

      safeSetItem(STORAGE_VERSION, DATA_VERSION.toString());
    } catch (e) {
      console.error('Data migration failed:', e);
    }
  },

  loadEvents() {
    if (this._events) return this._events;
    try {
      const data = localStorage.getItem(STORAGE_EVENTS);
      this._events = data ? JSON.parse(data) : [];
      this._migrateDataIfNeeded();
      // Filter out deleted events using tombstone list
      const deletedIds = this._getDeletedIds();
      if (deletedIds.size > 0) {
        this._events = this._events.filter(e => !deletedIds.has(e.id));
      }
    } catch {
      this._events = [];
    }
    this._invalidateDateIndex();
    return this._events;
  },

  _getDeletedIds() {
    try {
      const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '[]');
      return new Set(tombstones.map(t => t.id));
    } catch {
      return new Set();
    }
  },

  _addTombstone(eventId) {
    try {
      const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '[]');
      // Don't duplicate
      if (tombstones.some(t => t.id === eventId)) return;
      tombstones.push({ id: eventId, deletedAt: Date.now() });
      safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(tombstones));
      if (window.FirebaseSync) FirebaseSync.onDataChanged();
    } catch (e) {
      console.error('Failed to add tombstone:', e);
    }
  },

  _cleanOldTombstones() {
    try {
      const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '[]');
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const cleaned = tombstones.filter(t => t.deletedAt > ninetyDaysAgo);
      if (cleaned.length < tombstones.length) {
        safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(cleaned));
        console.log(`[Tombstone] Cleaned ${tombstones.length - cleaned.length} old tombstones`);
      }
    } catch (e) {
      console.error('Failed to clean tombstones:', e);
    }
  },

  saveEvents() {
    safeSetItem(STORAGE_EVENTS, JSON.stringify(this._events));
    this._invalidateDateIndex();
    if (window.FirebaseSync) FirebaseSync.onDataChanged();
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
    safeSetItem(STORAGE_SETTINGS, JSON.stringify(this._settings));
    if (window.FirebaseSync) FirebaseSync.onDataChanged();
  },

  addEvent(evt) {
    this.loadEvents();
    this._events.push(evt);
    this._invalidateDateIndex();
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
    // Add to tombstone list before removing
    this._addTombstone(id);
    this._events = this._events.filter(e => e.id !== id);
    this._invalidateDateIndex();
    this.saveEvents();
    // Clean up old tombstones periodically (every delete is fine, it's cheap)
    this._cleanOldTombstones();
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

// Expose DB globally so firebase-sync.js can invalidate caches after cloud sync
window.DB = DB;

// Expose shared helpers for firebase-sync.js (ES module can't access code.js scope directly)
window.clearAllStorage = clearAllStorage;
window.validatePassword = validatePassword;

/** Stop all background timers (called on logout) */
window.stopTimers = function() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  clearTimeout(chipTimeout);
  clearTimeout(exerciseTimeout);
  clearTimeout(undoHideTimeout);
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
    substance: sub, method: method || null,
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
function countUrgeSurfed(resisted, used) {
  const CLUSTER_MS = 5 * 60 * 1000;
  const sorted = sortedByTime(resisted);
  
  return sorted.filter((r, i) => {
    // Skip if this resist is within 5 minutes of the previous resist (cluster de-dupe)
    if (i > 0 && r.ts - sorted[i - 1].ts <= CLUSTER_MS) {
      return false;
    }
    
    // Check if 15+ minutes have passed and no use occurred within 15 minutes after
    const timeSinceResist = Date.now() - r.ts;
    const usedAfter = used.some(u => u.ts > r.ts && u.ts - r.ts <= FIFTEEN_MINUTES_MS);
    return timeSinceResist >= FIFTEEN_MINUTES_MS && !usedAfter;
  }).length;
}

function countSwapCompleted(resisted, habits) {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const sorted = sortedByTime(resisted);
  return sorted.filter((r, i) => {
    // Skip if this resist is within 5 minutes of the previous resist (not first in cluster)
    if (i > 0 && r.ts - sorted[i - 1].ts <= FIVE_MINUTES_MS) return false;
    return habits.some(h => h.ts > r.ts && h.ts - r.ts <= FIFTEEN_MINUTES_MS);
  }).length;
}

/** Check if a 6am boundary falls between two timestamps */
function gapCrosses6am(ts1, ts2) {
  const d = new Date(ts1);
  d.setHours(EARLY_HOUR, 0, 0, 0);
  if (d.getTime() <= ts1) d.setDate(d.getDate() + 1);
  return d.getTime() <= ts2;
}

/** Get all within-day gaps (ms) between consecutive sessions, excluding gaps crossing 6am */
function getGapsMs(sessions) {
  if (sessions.length < 2) return [];
  const sorted = sortedByTime(sessions);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    if (gapCrosses6am(sorted[i - 1].ts, sorted[i].ts)) continue;
    gaps.push(sorted[i].ts - sorted[i - 1].ts);
  }
  return gaps;
}

function getMilestoneWins(gapHours, milestones) {
  // Return only the highest milestone reached, not all of them
  const reached = milestones.filter(h => gapHours >= h);
  return reached.length > 0 ? [reached[reached.length - 1]] : [];
}

/** Average within-day gap (ms) across the given day keys. Uses filterFn to get sessions per day. */
function avgWithinDayGapMs(dayKeys, filterFn) {
  const gaps = dayKeys.flatMap(dk => getGapsMs(filterFn(DB.forDate(dk))));
  return gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
}

// ========== WIN STORAGE ==========
function loadWinData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_WINS));
    if (!data) return { todayDate: null, todayWins: [], yesterdayWins: [], lifetimeWins: [], todayUndoCount: 0 };
    // Backfill yesterdayWins for existing data
    if (!data.yesterdayWins) data.yesterdayWins = [];
    return data;
  } catch {
    return { todayDate: null, todayWins: [], yesterdayWins: [], lifetimeWins: [], todayUndoCount: 0 };
  }
}

function saveWinData(data) {
  safeSetItem(STORAGE_WINS, JSON.stringify(data));
  if (window.FirebaseSync) FirebaseSync.onDataChanged();
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
    const subs = new Set(getProfile().substances);
    const profileUsed = used.filter(e => subs.has(e.substance)); // Profile-aware: only substances in current profile

    // --- Daily Check-in win ---
    addWin(todayEvents.length > 0, 'daily-checkin');

    // --- Welcome Back win ---
    // Use event timestamps (stable) so the badge is consistent across renders.
    if (todayEvents.length > 0) {
      const allKeys = DB.getAllDayKeys(); // sorted most recent first
      for (const key of allKeys) {
        if (key >= todayKey()) continue; // skip today
        const prevDayEvents = DB.forDate(key);
        if (prevDayEvents.length > 0) {
          const lastPrevTs = prevDayEvents[prevDayEvents.length - 1].ts;
          addWin((todayEvents[0].ts - lastPrevTs) >= 24 * 3600000, 'welcome-back');
          break;
        }
      }
    }
    const settings = DB.loadSettings();

    // --- Session-based wins ---
    for (let i = 0; i < resisted.length; i++) addWin(true, 'resist');

    const urgeSurfedCount = countUrgeSurfed(resisted, used);
    for (let i = 0; i < urgeSurfedCount; i++) addWin(true, 'urge-surfed');

    const swapCount = countSwapCompleted(resisted, habits);
    for (let i = 0; i < swapCount; i++) addWin(true, 'swap-completed');

    // --- Resist awareness wins ---
    for (const r of resisted) {
      addWin(r.intensity != null, 'intensity-logged');
      addWin(r.trigger != null, 'trigger-noted');
      addWin(r.intensity != null && r.trigger != null, 'full-report');
      addWin(r.intensity >= 4, 'tough-resist');
    }

    // Harm reduction vape win
    const isCannabis = settings.addictionProfile === 'cannabis';
    const isNicotine = settings.addictionProfile === 'smoking';
    
    let vapeCount = 0;
    if (isCannabis) {
      vapeCount = profileUsed.filter(e => e.method === 'vape').length;
    } else if (isNicotine) {
      vapeCount = profileUsed.filter(e => e.substance === 'vape').length;
    }
    addWin(vapeCount > 0, 'harm-reduction-vape');

    // Cannabis-specific wins
    if (isCannabis) {
      const cbdUsed = filterCBD(used);
      const thcUsed = filterTHC(used);
      addWin(cbdUsed.length > 0 && thcUsed.length === 0, 'cbd-only');
    }

    const doseCount = used.filter(e => e.amount < 1).length;
    for (let i = 0; i < doseCount; i++) addWin(true, 'dose-half');

    const mindfulCount = used.filter(e => e.reason).length;
    for (let i = 0; i < mindfulCount; i++) addWin(true, 'mindful');

    const profileAmt = sumAmount(profileUsed);
    addWin(profileUsed.length > 0 && profileAmt <= LOW_DAY_THRESHOLD, 'low-day');
    addWin(profileUsed.length === 0, 'zero-use');

    // --- Habit-based wins ---
    const waterCount = getHabits(todayEvents, 'water').length;
    addWin(waterCount >= 1, 'drank-water');
    addWin(waterCount >= 5, 'hydrated');
    
    // Individual habit badges
    const hasExercise = habits.some(e => e.habit === 'exercise');
    addWin(hasExercise, 'exercised');
    
    const hasBreaths = habits.some(e => e.habit === 'breaths');
    addWin(hasBreaths, 'breathwork');
    
    const hasClean = habits.some(e => e.habit === 'clean');
    addWin(hasClean, 'cleaned');
    
    const hasOutside = habits.some(e => e.habit === 'outside');
    addWin(hasOutside, 'went-outside');
    
    const uniqueHabits = new Set(habits.map(e => e.habit));
    addWin(uniqueHabits.size >= 2, 'habit-stack');
    addWin(uniqueHabits.size === 5, 'five-star-day');

    // --- Timing-based wins ---
    // Gap wins — include all sessions but skip gaps that cross the 6am boundary (sleep gap)
    if (profileUsed.length >= 2) {
      const todayGapsMs = getGapsMs(profileUsed);
      
      // Award only the highest gap milestone achieved today
      if (todayGapsMs.length > 0) {
        const maxGapHours = Math.max(...todayGapsMs) / 3600000;
        const milestones = getMilestoneWins(maxGapHours, GAP_MILESTONES);
        if (milestones.length > 0) {
          addWin(true, `gap-${milestones[0]}h`);
        }
      }
      
      // Today's average gap longer than 7-day average (includes today, same as progress section)
      const avgGap7Days = avgWithinDayGapMs(getLastNDays(7), filterProfileUsed);
      if (avgGap7Days > 0 && todayGapsMs.length > 0) {
        const todayAvgGap = todayGapsMs.reduce((s, g) => s + g, 0) / todayGapsMs.length;
        addWin(todayAvgGap > avgGap7Days, 'gap-above-avg');
      }
    }

    // --- Time-of-day skip badges ---
    const currentHour = new Date().getHours();
    const isPastEarlyHour = currentHour >= EARLY_HOUR;
    const noUseInRange = (start, end) => !profileUsed.some(u => {
      const h = getHour(u.ts);
      return h >= start && h < end;
    });

    const skipBadges = [
      { start: EARLY_HOUR, end: AFTERNOON_HOUR, id: 'morning-skip' },
      { start: 12, end: 18, id: 'day-skip' },
      { start: 18, end: 24, id: 'evening-skip' },
      { start: 0,  end: EARLY_HOUR, id: 'night-skip' },
    ];
    for (const { start, end, id } of skipBadges) {
      addWin(currentHour >= start && noUseInRange(start, end), id);
    }
    
    // Night Gap — 12+ hour gap crossing today's 6am boundary (overnight break)
    const today6am = new Date(todayKey() + 'T06:00:00').getTime();
    
    // Get all events from yesterday and today
    const yesterdayProfileUsed = yesterdayEvents ? filterProfileUsed(yesterdayEvents) : [];
    const allRecent = sortedByTime([...yesterdayProfileUsed, ...profileUsed]);
    
    // Find last event before 6am and first event after 6am
    const lastBefore6am = allRecent.filter(e => e.ts < today6am).pop();
    const firstAfter6am = allRecent.find(e => e.ts >= today6am);
    
    let hasNightGap = false;
    if (lastBefore6am && firstAfter6am) {
      const gapHours = (firstAfter6am.ts - lastBefore6am.ts) / 3600000;
      hasNightGap = gapHours >= 12;
    }
    addWin(hasNightGap, 'night-gap');

    // --- Comparison wins ---
    if (yesterdayEvents && yesterdayEvents.length > 0) {
      const yProfile = filterProfileUsed(yesterdayEvents);

      addWin(yProfile.length > 0 && profileAmt < sumAmount(yProfile), 'lower-amount');
      
      // First session later than yesterday — only awarded if you used today (compares first use after 6am)
      const todayDaytime = filterDaytime(profileUsed);
      const yesterdayDaytime = filterDaytime(yProfile);
      
      if (todayDaytime.length > 0 && yesterdayDaytime.length > 0) {
        addWin(timeOfDayMin(todayDaytime[0].ts) > timeOfDayMin(yesterdayDaytime[0].ts), 'first-later');
      }
    }
    
    // Good Start win - first event after early hour is a habit or resist (not use)
    if (isPastEarlyHour) {
      const daytimeEvents = filterDaytime(todayEvents);
      const firstDaytimeEvent = daytimeEvents[0];
      if (firstDaytimeEvent && (firstDaytimeEvent.type === 'habit' || firstDaytimeEvent.type === 'resisted')) {
        addWin(true, 'good-start');
      }
    }

    // --- Streak wins ---
    const resistStreak = this._countStreak('resisted');
    addWin(resistStreak >= 2, 'resist-streak');
    
    const habitStreak = this._countStreak('habit');
    addWin(habitStreak >= 3, 'habit-streak');

    const taperDays = this._countTaper();
    addWin(taperDays >= 2, 'taper');
    
    // App usage streaks - award only the highest milestone
    const appStreak = this._countAppUsageStreak();
    if (appStreak >= 2) {
      const milestones = getMilestoneWins(appStreak, APP_STREAK_MILESTONES);
      if (milestones.length > 0) {
        const highestMilestone = milestones[0];
        // Map milestone values to badge IDs
        const badgeMap = { 2: 'app-streak', 7: 'week-streak', 30: 'month-streak', 365: 'year-streak' };
        addWin(true, badgeMap[highestMilestone]);
      }
    }
    
    // Break milestones (time since last use)
    if (profileUsed.length === 0) {
      const daysSinceLastUse = this._countDaysSinceLastUse();
      if (daysSinceLastUse >= 1) {
        // Award only the highest T-break milestone achieved
        const milestones = getMilestoneWins(daysSinceLastUse, TBREAK_MILESTONES);
        if (milestones.length > 0) {
          const highestMilestone = milestones[0];
          addWin(true, `tbreak-${highestMilestone}d`);
        }
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
      // Tapering means older day should have MORE usage than newer day (amt > prevAmt)
      // Break when older day <= newer day (increasing or flat = not tapering)
      if (prevAmt !== null && amt <= prevAmt) break;
      if (prevAmt !== null) count++;
      prevAmt = amt;
      d.setDate(d.getDate() - 1);
    }
    return count;
  },
  
  _countAppUsageStreak() {
    const MAX_APP_STREAK = 366; // Must exceed 365 for year-streak badge
    const d = new Date();
    for (let streak = 0; streak < MAX_APP_STREAK; streak++) {
      const dayEvents = DB.forDate(dateKey(d));
      if (dayEvents.length === 0) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_APP_STREAK;
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

function tileHTML(val, label, sub = '', tooltip = '') {
  const subHTML = sub ? `<div class="sub">${sub}</div>` : '';
  const titleAttr = tooltip ? ` title="${escapeHTML(tooltip)}"` : '';
  const dataTooltip = tooltip ? ` data-tooltip="${escapeHTML(tooltip)}"` : '';
  return `<div class="tile"${titleAttr}${dataTooltip}><div class="val">${val}</div><div class="label">${label}</div>${subHTML}</div>`;
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
  // Find the profile that owns this substance (may differ from current profile for historical events)
  const { profile: matchedProfile } = getProfileForSubstance(evt.substance);
  
  const icon = matchedProfile.icons[evt.substance] || '⚡';
  const title = matchedProfile.substanceDisplay[evt.substance] || evt.substance.toUpperCase();
  const unit = matchedProfile.amountUnit;
  
  return {
    icon,
    title,
    detail: [
      evt.method,
      evt.amount != null && `${evt.amount} ${unit}`,
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
    detail: (evt.minutes && evt.minutes > 0) ? evt.minutes + ' min' : ''
  };
}

const EVENT_DETAIL_BUILDERS = {
  used: getUsedEventDetail,
  resisted: getResistedEventDetail,
  habit: getHabitEventDetail
};

/** Renders a single event as a timeline row. */
function eventRowHTML(e) {
  const time = formatTime(e.ts);
  const { icon, title, detail } = EVENT_DETAIL_BUILDERS[e.type]?.(e) || { icon: '', title: '', detail: '' };
  const safeId = escapeHTML(e.id);

  return `<li class="timeline-item" data-id="${safeId}">
    <span class="tl-time">${time}</span>
    <span class="tl-icon">${icon}</span>
    <div class="tl-body"><div class="tl-title">${escapeHTML(title)}</div><div class="tl-detail">${escapeHTML(detail)}</div></div>
    <div class="tl-actions">
          <button class="tl-act-btn" onclick="App.editEvent('${safeId}')" title="Edit">✏️</button>
          <button class="tl-act-btn" onclick="App.deleteEvent('${safeId}')" title="Delete">🗑️</button>
        </div>
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
  
  // Update sound button to reflect current setting
  setSoundButton(DB.loadSettings().soundEnabled);
}

function sumHabitCounts(events, habitTypes) {
  return habitTypes.reduce((sum, h) => sum + getHabits(events, h).length, 0);
}

/** Calculate "bad" substance amount — for cannabis, mix counts as 0.5 THC. */
function calcBadAmount(usedEvents, profile, badFilter) {
  if (profile === 'cannabis') {
    return usedEvents.reduce((sum, e) => {
      if (e.substance === 'thc') return sum + (e.amount || 0);
      if (e.substance === 'mix') return sum + (e.amount || 0) * 0.5;
      return sum;
    }, 0);
  }
  return usedEvents.filter(badFilter).reduce((sum, e) => sum + (e.amount || 0), 0);
}

function buildSinceLastUsedTile(used) {
  // Find last used event across all history (current profile's substances)
  let lastUsedTs = null;
  if (used.length > 0) {
    lastUsedTs = used[used.length - 1].ts;
  } else {
    const allKeys = DB.getAllDayKeys();
    for (const key of allKeys) {
      const dayUsed = filterProfileUsed(DB.forDate(key));
      if (dayUsed.length > 0) {
        lastUsedTs = dayUsed[dayUsed.length - 1].ts;
        break;
      }
    }
  }
  
  let sinceLastVal = '—';
  let sinceLastSub = '';
  
  if (lastUsedTs) {
    const elapsedMs = Date.now() - lastUsedTs;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    
    // Always show full duration in main value
    sinceLastVal = formatDuration(elapsedMs);
    
    if (elapsedDays >= 1) {
      // Show date of last use if over a day
      const lastUsedDate = new Date(lastUsedTs);
      const options = { month: 'short', day: 'numeric' };
      const dateStr = lastUsedDate.toLocaleDateString('en-US', options);
      sinceLastSub = `Last Used On ${dateStr}`;
    } else {
      // Show average gap today (excludes gaps crossing 6am)
      const todayGaps = getGapsMs(used);
      if (todayGaps.length > 0) {
        const avgGap = todayGaps.reduce((s, g) => s + g, 0) / todayGaps.length;
        sinceLastSub = `${formatDuration(avgGap)} Average Gap`;
      }
    }
  }
  
  return tileHTML(sinceLastVal, 'Since Last Use', sinceLastSub, 'Time since your last session and average gap today (excludes gaps crossing 6am)');
}

function buildTodayRatioTile(used) {
  const settings = DB.loadSettings();
  const ratioMap = {
    cannabis: { badFilter: e => e.substance === 'thc' || e.substance === 'mix', ratioLabel: 'THC Ratio Today', substanceName: 'THC' },
    alcohol: { badFilter: e => e.substance === 'liquor', ratioLabel: 'Liquor Ratio Today', substanceName: 'Liquor' },
    smoking: { badFilter: e => e.substance === 'cigarette', ratioLabel: 'Cigarette Ratio Today', substanceName: 'Cigarette' },
    other: { badFilter: e => e.substance === 'type1', ratioLabel: 'Type1 Ratio Today', substanceName: 'Type1' }
  };
  
  const config = ratioMap[settings.addictionProfile];
  
  // If no profile is set, return a placeholder tile
  if (!config) {
    return tileHTML('—', 'Ratio Today', '', 'Ratio of primary substance');
  }
  
  // Calculate bad ratio by amount for today
  const totalAmount = used.reduce((sum, e) => sum + (e.amount || 0), 0);
  const badAmount = calcBadAmount(used, settings.addictionProfile, config.badFilter);
  const ratio = totalAmount > 0 ? ((badAmount / totalAmount) * 100).toFixed(0) + '%' : '—';

  // Find time since last use of bad substance
  let sinceLastBadSub = '';
  const allUsed = filterUsed(DB.loadEvents());
  const badUsed = allUsed.filter(config.badFilter).sort(sortByTime);
  if (badUsed.length > 0) {
    const lastBadTs = badUsed[badUsed.length - 1].ts;
    const elapsedMs = Date.now() - lastBadTs;
    sinceLastBadSub = `${formatDuration(elapsedMs)} Since Last ${config.substanceName}`;
  }

  return tileHTML(ratio, config.ratioLabel, sinceLastBadSub, `Ratio of primary substance today and time since last use`);
}

function renderMetrics() {
  const events   = DB.forDate(todayKey());
  const profile  = getProfile();
  const used     = filterProfileUsed(events);
  const resisted = filterByType(events, 'resisted');
  const totalAmt = sumAmount(used);

  const exerciseEvents = getHabits(events, 'exercise');
  const exerciseMins = exerciseEvents.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const allHabits = sumHabitCounts(events, ['water', 'breaths', 'clean', 'outside', 'exercise']);
  
  // Build 4th tile based on whether there's exercise time
  let fourthTile;
  if (exerciseMins > 0) {
    // Show exercise as main metric, healthy actions as subtitle
    const exerciseMain = `${exerciseMins}m`;
    const habitsSub = allHabits > 0 ? `${allHabits} Healthy Actions` : '';
    fourthTile = tileHTML(exerciseMain, 'Exercise', habitsSub, 'Exercise minutes and healthy habits logged today');
  } else {
    // Show healthy actions as main metric, exercise actions (if any) as subtitle
    const exerciseSub = exerciseEvents.length > 0 ? `${exerciseEvents.length} Exercise Actions` : '';
    fourthTile = tileHTML(allHabits, 'Healthy Actions', exerciseSub, 'Healthy habits and exercise minutes logged today');
  }

  // Calculate longest resist streak today (max consecutive resists between uses)
  let maxResistStreak = 0, currentResistStreak = 0;
  for (const e of events) {
    if (e.type === 'resisted') {
      currentResistStreak++;
      if (currentResistStreak > maxResistStreak) maxResistStreak = currentResistStreak;
    } else if (e.type === 'used') {
      currentResistStreak = 0;
    }
  }
  const resistSub = maxResistStreak > 1 ? `Longest Streak: ${maxResistStreak}` : '';

  // Show sessions today as subtitle for the first tile
  const sessionsSub = used.length > 0 ? `${used.length} Sessions` : '';

  $('metrics').innerHTML = [
    tileHTML(totalAmt, capitalize(profile.amountUnit), sessionsSub, `Total amount used and number of sessions today`),
    buildSinceLastUsedTile(used),
    buildTodayRatioTile(used),
    fourthTile
  ].join('');
}

function getRatioTile(weekUsed, dayKeys) {
  const settings = DB.loadSettings();
  
  const ratioMap = {
    cannabis: { badFilter: e => e.substance === 'thc' || e.substance === 'mix', ratioLabel: 'THC Ratio', freeLabel: 'No THC Days' },
    alcohol: { badFilter: e => e.substance === 'liquor', ratioLabel: 'Liquor Ratio', freeLabel: 'No Liquor Days' },
    smoking: { badFilter: e => e.substance === 'cigarette', ratioLabel: 'Cigarette Ratio', freeLabel: 'No Cigarette Days' },
    other: { badFilter: e => e.substance === 'type1', ratioLabel: 'Type1 Ratio', freeLabel: 'No Use Days' }
  };
  
  const config = ratioMap[settings.addictionProfile];
  
  // If no profile is set, return a placeholder tile
  if (!config) {
    return tileHTML('—', 'No Use Days', '', 'Days without primary substance');
  }
  
  // Calculate bad ratio by amount — for cannabis, mix counts as 0.5 since it's half THC
  const totalAmount = weekUsed.reduce((sum, e) => sum + (e.amount || 0), 0);
  const badAmount = calcBadAmount(weekUsed, settings.addictionProfile, config.badFilter);
  const ratio = totalAmount > 0 ? ((badAmount / totalAmount) * 100).toFixed(0) + '%' : '—';

  // Count days without the "bad" substance this week — always consider full 7 days
  // Days before first event are counted as free days
  const freeDays = dayKeys.filter(dk => {
    const dayUsed = filterUsed(DB.forDate(dk));
    // If no events for this day, count as free. If events exist, check for bad substance
    return dayUsed.length === 0 || !dayUsed.some(config.badFilter);
  }).length;
  const freeDaysSub = freeDays > 0 ? `${freeDays} ${config.freeLabel}` : '';

  return tileHTML(ratio, config.ratioLabel, freeDaysSub, `Ratio and days without primary substance`);
}

function getWeekData(days) {
  const events = days.flatMap(k => DB.forDate(k));
  return { events, profileUsed: filterProfileUsed(events) };
}

function renderProgress() {
  const last7Days = getLastNDays(7);
  const thisWeek = getWeekData(last7Days);
  
  // Calculate actual days of app usage (clamped between 1 and 7)
  const allEvents = DB.loadEvents();
  let daysOfUse = 7;
  if (allEvents.length > 0) {
    const earliestTs = Math.min(...allEvents.map(e => e.ts));
    const daysSinceFirstUse = Math.ceil((Date.now() - earliestTs) / (24 * 60 * 60 * 1000));
    daysOfUse = Math.max(1, Math.min(7, daysSinceFirstUse));
  }
  
  const dailyAvg = (thisWeek.profileUsed.length / daysOfUse).toFixed(1);

  // Calculate average amount per day for this week
  const weekTotalAmount = sumAmount(thisWeek.profileUsed);
  const dailyAmountAvg = (weekTotalAmount / daysOfUse).toFixed(1);
  const hitsSub = `${dailyAvg} Sessions/Day`;

  // Longest gap within a single day (excludes gaps crossing 6am)
  let maxGapMs = 0;
  let totalGapMs = 0;
  let gapCount = 0;
  
  for (const dayKey of last7Days) {
    const dayEvents = filterProfileUsed(DB.forDate(dayKey));
    const gaps = getGapsMs(dayEvents); // Uses existing helper that excludes 6am crossings
    for (const gap of gaps) {
      totalGapMs += gap;
      gapCount++;
      if (gap > maxGapMs) maxGapMs = gap;
    }
  }
  
  const avgGapStr = gapCount > 0 ? formatDuration(totalGapMs / gapCount) : '—';
  const longestGapSub = maxGapMs > 0 ? `${formatDuration(maxGapMs)} Longest Gap` : '';


  const ratioTile = getRatioTile(thisWeek.profileUsed, last7Days);

  const exerciseEvents = getHabits(thisWeek.events, 'exercise');
  const exerciseMins = exerciseEvents.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const weekHabits = sumHabitCounts(thisWeek.events, ['water', 'breaths', 'clean', 'outside', 'exercise']);
  
  // Build 4th tile based on whether there's exercise time
  let fourthTile;
  if (exerciseMins > 0) {
    // Show exercise per day as main metric, healthy actions as subtitle
    const exercisePerDay = (exerciseMins / daysOfUse).toFixed(1);
    const habitsSub = weekHabits > 0 ? `${weekHabits} Healthy Actions` : '';
    fourthTile = tileHTML(exercisePerDay + 'm', 'Exercise/Day', habitsSub, 'Total healthy habits and average exercise per day');
  } else {
    // Show healthy actions as main metric, exercise actions (if any) as subtitle
    const exerciseSub = exerciseEvents.length > 0 ? `${exerciseEvents.length} Exercise Actions` : '';
    fourthTile = tileHTML(weekHabits, 'Healthy Actions', exerciseSub, 'Total healthy habits and average exercise per day');
  }

  $('progress').innerHTML = [
    tileHTML(dailyAmountAvg, `${capitalize(getProfile().amountUnit)}/Day`, hitsSub, 'Average amount used and average sessions per day'),
    tileHTML(avgGapStr, 'Average Gap', longestGapSub, 'Average gap between sessions and longest gap (excludes gaps crossing 6am)'),
    ratioTile,
    fourthTile
  ].join('');
}

function winCardHTML(w, showCount = true) {
  const unearnedClass = w.count === 0 ? ' unearned' : '';
  const badgeHTML = showCount ? `<span class="win-badge">${w.count}</span>` : '';
  return `<li class="win-item${unearnedClass}" title="${escapeHTML(w.desc || '')}">${badgeHTML}<div class="win-icon">${w.icon}</div><div class="win-label">${escapeHTML(w.label)}</div></li>`;
}

function calculateAndUpdateWins() {
  const winData = loadWinData();
  const today = todayKey();
  const isSameDay = winData.todayDate === today;
  
  // Step 1: If it's a new day, add yesterday's wins to lifetime before clearing
  const lifetimeMap = new Map();
  winData.lifetimeWins.forEach(w => {
    lifetimeMap.set(w.id, w.count);
  });
  
  // Save yesterday's wins before clearing
  let yesterdayWins = [];
  if (!isSameDay && winData.todayWins && winData.todayDate) {
    // New day detected - add to lifetime
    winData.todayWins.forEach(w => {
      const current = lifetimeMap.get(w.id) || 0;
      lifetimeMap.set(w.id, current + w.count);
    });
    
    // Calculate how many days have passed since last session
    const lastDate = new Date(winData.todayDate + 'T12:00:00');
    const currentDate = new Date(today + 'T12:00:00');
    const daysPassed = Math.floor((currentDate - lastDate) / (24 * 60 * 60 * 1000));
    
    // Only save as "yesterday's" if exactly 1 day has passed
    if (daysPassed === 1) {
      yesterdayWins = [...winData.todayWins];
    }
    // If daysPassed > 1, yesterdayWins stays empty (cleared)
  } else if (isSameDay) {
    // Same day - keep existing yesterday's wins
    yesterdayWins = winData.yesterdayWins || [];
  }
  // If new day but no winData.todayDate (first time), yesterdayWins stays empty
  
  // Step 2: Calculate fresh today's wins
  const todayEvents = DB.forDate(today);
  const yesterdayEvents = DB.forDate(daysAgoKey(1));
  const freshTodayIds = Wins.calculate(todayEvents, yesterdayEvents);
  
  // Add undo wins (tracked separately since undos aren't events)
  const undoCount = isSameDay ? (winData.todayUndoCount || 0) : 0;
  if (undoCount > 0) freshTodayIds.push('second-thought');
  
  // Today's wins: max 1 per badge type (deduplicate)
  const uniqueTodayIds = [...new Set(freshTodayIds)];
  const freshTodayWins = uniqueTodayIds.map(id => ({ id, count: 1 }));
  
  // Step 3: Convert lifetime map to array (today's wins NOT included)
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
    yesterdayWins: yesterdayWins,
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
    // Get earned badges
    const earnedWins = winData.todayWins
      .map(w => ({ ...w, ...getWinDef(w.id) }))
      .filter(w => WIN_DEFINITIONS[w.id]) // Filter out unknown badges
      .sort((a, b) => (WIN_DEFINITIONS[a.id]?.sortOrder ?? 999) - (WIN_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    // Get unearned badges (all badges not in earned list)
    const earnedIds = new Set(earnedWins.map(w => w.id));
    let unearnedWins = Object.keys(WIN_DEFINITIONS)
      .filter(id => !earnedIds.has(id))
      .map(id => ({ id, count: 0, ...getWinDef(id) }));
    
    // For sequential badges, only show the next unearned one
    const gapSequence = ['gap-1h', 'gap-2h', 'gap-4h', 'gap-8h', 'gap-12h'];
    const breakSequence = ['tbreak-1d', 'tbreak-7d', 'tbreak-14d', 'tbreak-21d', 'tbreak-30d', 'tbreak-365d'];
    const appStreakSequence = ['app-streak', 'week-streak', 'month-streak', 'year-streak'];
    
    const filterSequence = (sequence) => {
      const unearnedInSeq = sequence.filter(id => !earnedIds.has(id));
      if (unearnedInSeq.length > 0) {
        const nextUnearned = unearnedInSeq[0]; // First unearned in sequence
        return sequence.filter(id => earnedIds.has(id) || id === nextUnearned);
      }
      return sequence;
    };
    
    const allowedGaps = new Set(filterSequence(gapSequence));
    const allowedBreaks = new Set(filterSequence(breakSequence));
    const allowedAppStreaks = new Set(filterSequence(appStreakSequence));
    
    // Get current addiction profile for filtering profile-specific badges
    const settings = DB.loadSettings();
    const currentProfile = settings.addictionProfile;
    
    unearnedWins = unearnedWins.filter(w => {
      // Filter out sequential badges that aren't the next in sequence
      if (gapSequence.includes(w.id)) return allowedGaps.has(w.id);
      if (breakSequence.includes(w.id)) return allowedBreaks.has(w.id);
      if (appStreakSequence.includes(w.id)) return allowedAppStreaks.has(w.id);
      
      // Filter out profile-specific badges for today's unearned
      if (w.id === 'welcome-back') return false; // Can't earn it today
      if (w.id === 'harm-reduction-vape' && currentProfile !== 'cannabis' && currentProfile !== 'smoking') return false;
      if (w.id === 'cbd-only' && currentProfile !== 'cannabis') return false;
      
      return true;
    });
    
    unearnedWins.sort((a, b) => (WIN_DEFINITIONS[a.id]?.sortOrder ?? 999) - (WIN_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    // Today's badges: only show earned badges
    todayEl.innerHTML = earnedWins.length > 0
      ? earnedWins.map(w => winCardHTML(w, false)).join('') + 
        '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">Daily badges update based on your activity.</div>'
      : '';
  }

  // Render yesterday's badges
  const yesterdayEl = $('wins-yesterday');
  if (yesterdayEl) {
    const yesterdayWins = winData.yesterdayWins
      .map(w => ({ ...w, ...getWinDef(w.id) }))
      .filter(w => WIN_DEFINITIONS[w.id])
      .sort((a, b) => (WIN_DEFINITIONS[a.id]?.sortOrder ?? 999) - (WIN_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    yesterdayEl.innerHTML = yesterdayWins.length > 0
      ? yesterdayWins.map(w => winCardHTML(w, false)).join('') + 
        '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">These are badges you earned yesterday and won\'t change.</div>'
      : '<div class="empty-state" style="grid-column:1/-1">No badges earned yesterday</div>';
  }

  const totalEl = $('wins-total');
  if (!totalEl) return;
  
  // Get earned lifetime badges
  const earnedLifetime = winData.lifetimeWins
    .map(w => ({ ...w, ...getWinDef(w.id) }))
    .filter(w => WIN_DEFINITIONS[w.id])
    .sort((a, b) => (WIN_DEFINITIONS[a.id]?.sortOrder ?? 999) - (WIN_DEFINITIONS[b.id]?.sortOrder ?? 999));
  
  // Get unearned badges (show ALL for lifetime)
  const earnedLifetimeIds = new Set(earnedLifetime.map(w => w.id));
  const unearnedLifetime = Object.keys(WIN_DEFINITIONS)
    .filter(id => !earnedLifetimeIds.has(id))
    .map(id => ({ id, count: 0, ...getWinDef(id) }))
    .sort((a, b) => (WIN_DEFINITIONS[a.id]?.sortOrder ?? 999) - (WIN_DEFINITIONS[b.id]?.sortOrder ?? 999));
  
  const allLifetime = [...earnedLifetime, ...unearnedLifetime];
  totalEl.innerHTML = allLifetime.map(w => winCardHTML(w, true)).join('') + 
    '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">Every badge you\'ve earned will accumulate here.</div>';
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
  
  // Update navigation button disabled states (before possible early return)
  const nextBtn = $('next-day');
  if (nextBtn) nextBtn.disabled = (currentHistoryDay === todayKey());
  const prevBtn = $('prev-day');
  if (prevBtn) {
    const allKeys = DB.getAllDayKeys(); // sorted reverse (newest first)
    const earliest = allKeys.length > 0 ? allKeys[allKeys.length - 1] : null;
    prevBtn.disabled = !earliest || currentHistoryDay <= earliest;
  }
  
  if (events.length === 0) {
    historyEl.innerHTML = emptyStateHTML('No events for this day');
    return;
  }

  // Calculate summary stats
  const used = filterProfileUsed(events);
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
    html += eventRowHTML(events[i]);
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
  
  // Clear Day button
  html += `<button class="export-btn danger-btn" onclick="App.clearDay()" style="width:100%;margin-top:12px;font-size:13px;padding:10px;color:var(--muted)">🗑️ Clear Day</button>`;

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
}

// ========== GRAPHS ==========
const GRAPH_DEFS = [
  { label: '⚡ Amount Used / Day',    color: 'var(--primary)',  valueFn: evs => sumAmount(filterProfileUsed(evs)) },
  { label: '💪 Resists / Day',    color: 'var(--resist)',  valueFn: evs => filterByType(evs, 'resisted').length },
  { label: '🏃 Exercise Minutes / Day', color: '#e6cc22',  valueFn: evs => getHabits(evs, 'exercise').reduce((s, e) => s + (e.minutes || 0), 0) },
  { label: '💧 Water / Day', color: '#9c6fd4',  valueFn: evs => getHabits(evs, 'water').length },
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
  const hourContainer = $('hour-graphs');
  const dayContainer = $('graph-content');

  // Hour graphs (not affected by day selector)
  let hourHtml = '';
  
  // Add today's usage by hour graph
  const todayEvents = DB.forDate(todayKey());
  const todayUsed = filterProfileUsed(todayEvents);
  const hourCounts = {};
  todayUsed.forEach(evt => {
    const hour = getHour(evt.ts);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const hasHourData = todayUsed.length > 0;
  const maxCount = hasHourData ? Math.max(...Object.values(hourCounts), 1) : 1;
  hourHtml += `<div class="graph-container"><div class="graph-title">🕒 Today's Usage by Hour</div>`;
  hourHtml += hasHourData
    ? buildHourGraphBars(hourCounts, maxCount, '#f39c12')
    : emptyStateHTML('No data yet', 'padding:12px 0');
  hourHtml += `</div>`;
  
  hourContainer.innerHTML = hourHtml;
  
  // Day-based graphs (affected by 7/14/30 day selector)
  let dayHtml = '';
  
  // Add average usage by hour (filtered by selected time window)
  const hourTotals = {};
  let daysWithUse = 0;
  
  days.forEach(dayKey => {
    const dayUsed = filterProfileUsed(DB.forDate(dayKey));
    if (dayUsed.length > 0) {
      daysWithUse++;
      dayUsed.forEach(evt => {
        const hour = getHour(evt.ts);
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
  dayHtml += `<div class="graph-container"><div class="graph-title">⚡ Average Usage by Hour</div>`;
  dayHtml += hasHeatmapData
    ? buildHourGraphBars(hourAverages, maxAvg, '#e53935')
    : emptyStateHTML('No data yet', 'padding:12px 0');
  dayHtml += `</div>`;
  
  for (const def of GRAPH_DEFS) {
    const vals = days.map(dk => def.valueFn(DB.forDate(dk)));
    const max  = Math.max(...vals, 1);
    const hasData = vals.some(v => v > 0);

    dayHtml += `<div class="graph-container"><div class="graph-title">${def.label}</div>`;
    dayHtml += hasData 
      ? buildGraphBars(vals, days, max, def)
      : emptyStateHTML('No data yet', 'padding:12px 0');
    dayHtml += `</div>`;
  }
  
  dayContainer.innerHTML = dayHtml;
}

// ========== TAB SWITCHING ==========
function switchTab(tabName) {
  // When switching away, just visually hide the undo button (don't clear the event ID)
  // When switching back to today during cooldown, restore it
  if (tabName === 'today') {
    const lastUsedTime = _lastActionTime['used'];
    if (lastUsedTime && lastUndoEventId) {
      const timeSinceUse = Date.now() - lastUsedTime;
      if (timeSinceUse < COOLDOWN_MS) {
        showUndo(lastUndoEventId);
      } else {
        hideUndo();
      }
    }
  } else {
    // Only remove the CSS class, preserve lastUndoEventId so we can restore on return
    const row = $('used-row');
    if (row) row.classList.remove('has-undo');
  }
  hideUsedChips();
  hideResistedChips();
  $('exercise-chips').classList.add('hidden');
  clearTimeout(exerciseTimeout);
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
    todos: loadTodos(),
    lifetimeWins: winData.lifetimeWins,
    exportedAt: new Date().toISOString() 
  };
  downloadFile(JSON.stringify(data, null, 2), 'lentando-' + todayKey() + '.json', 'application/json');
}

async function clearDatabase() {
  const isLoggedIn = window.FirebaseSync && FirebaseSync.getUser();
  const msg = isLoggedIn
    ? '⚠️ This will permanently delete ALL local AND cloud data and reset settings. This cannot be undone.\n\nAre you sure?'
    : '⚠️ This will permanently delete ALL events and reset settings. This cannot be undone.\n\nAre you sure?';
  if (!confirm(msg)) return;
  clearAllStorage();
  // Push cleared state to cloud so data doesn't restore on reload
  if (window.FirebaseSync) {
    try {
      await FirebaseSync.pushNow();
    } catch (e) {
      alert('⚠️ Local data was cleared, but we could not clear your cloud data. Next time you sign in, your old data may reappear. Please try syncing again when you have a connection.');
    }
  }
  location.reload();
}

function changeAddiction() {
  if (!confirm('🔄 Change what you\'re tracking?\n\nYour data will be kept, but substance/method types will change. Continue?')) return;
  const settings = DB.loadSettings();
  settings.addictionProfile = null;
  DB._settings = settings;
  DB.saveSettings();
  switchTab('today');
  showOnboarding();
}

function validateImportData(data) {
  if (!data.events || !Array.isArray(data.events)) {
    return { valid: false, error: '❌ Invalid file — no events array found.' };
  }
  const validEvents = data.events.filter(e => e.id && e.type && e.ts);
  if (validEvents.length === 0) {
    return { valid: false, error: '❌ No valid events found in file.' };
  }
  // Sanitize IDs — regenerate any with characters outside safe set to prevent injection
  const SAFE_ID = /^[a-z0-9-]+$/;
  validEvents.forEach(e => {
    if (typeof e.id !== 'string' || !SAFE_ID.test(e.id)) e.id = uid();
  });
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
      
      DB._events = sortedByTime([...existing, ...newEvents]);
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
          yesterdayWins: winData.yesterdayWins,
          todayUndoCount: winData.todayUndoCount || 0,
          lifetimeWins: Array.from(lifetimeMap.entries())
            .filter(([, count]) => count > 0)
            .map(([id, count]) => ({ id, count }))
        };
        saveWinData(mergedWinData);
      }

      // Import todos if present and local list is empty
      if (data.todos && Array.isArray(data.todos) && loadTodos().length === 0) {
        const validTodos = data.todos
          .filter(t => t && typeof t.text === 'string' && t.text.trim())
          .map(t => ({ ...t, text: t.text.trim().slice(0, 120) }));
        if (validTodos.length > 0) saveTodos(validTodos);
      }

      // Restore settings if no profile configured (e.g., after clear + reimport)
      if (data.settings && data.settings.addictionProfile && !DB.loadSettings().addictionProfile) {
        const settings = DB.loadSettings();
        Object.assign(settings, data.settings);
        DB._settings = settings;
        DB.saveSettings();
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const chips = [
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v])
  ];
  if (profile.methods) {
    chips.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, evt.method));
  }
  chips.push(
    chipGroupHTML('Amount', 'amount', profile.amounts, evt.amount),
    buildTimeChips(evt.ts),
    chipGroupHTML('Reason (optional)', 'reason', REASONS, evt.reason),
    chipDismissBtn('dismiss ✕', 'App.hideUsedChips()')
  );
  return chips.join('');
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
  else if (field === 'method') {
    const profile = getProfile();
    if (profile.methods) settings.lastMethod = val;
  }
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
    calculateAndUpdateWins();
    render();
    return;
  }
  
  const val = resolveChipVal(field, chip.dataset.val, currentEvent);

  const updateData = { [field]: val };

  DB.updateEvent(activeChipEventId, updateData);
  persistFieldDefault(field, val);
  updateActiveChips();
  calculateAndUpdateWins();
  render();
}

// ========== EDIT MODAL ==========
function modalFieldWrap(html) {
  return `<div class="modal-field">${html}</div>`;
}

/** Find the addiction profile that owns a given substance key */
function getProfileForSubstance(substance) {
  const currentKey = DB.loadSettings().addictionProfile || 'cannabis';
  const current = ADDICTION_PROFILES[currentKey];
  if (current.substanceDisplay[substance]) return { key: currentKey, profile: current };
  for (const [k, p] of Object.entries(ADDICTION_PROFILES)) {
    if (p.substanceDisplay[substance]) return { key: k, profile: p };
  }
  return { key: currentKey, profile: current }; // fallback
}

function openEditModal(eventId) {
  hideUsedChips();
  hideResistedChips();
  hideUndo();
  const evt = DB.loadEvents().find(e => e.id === eventId);
  if (!evt) return;

  const fieldBuilders = {
    used: () => {
      // Use the profile that owns this event's substance (not necessarily the current profile)
      const { key, profile } = getProfileForSubstance(evt.substance);
      const fields = [
        `<label>Tracking</label><div style="font-size:16px">${key[0].toUpperCase() + key.slice(1)}</div>`,
        chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v])
      ];
      if (profile.methods) {
        fields.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, evt.method));
      }
      fields.push(
        chipGroupHTML('Amount', 'amount', profile.amounts, evt.amount),
        chipGroupHTML('Reason', 'reason', REASONS, evt.reason)
      );
      return fields;
    },
    resisted: () => [
      chipGroupHTML('Urge Intensity', 'intensity', INTENSITIES, evt.intensity),
      chipGroupHTML('Trigger', 'trigger', REASONS, evt.trigger)
    ],
    habit: () => {
      const fields = [`<label>Habit</label><div style="font-size:16px">${HABIT_LABELS[evt.habit] || evt.habit}</div>`];
      if (evt.habit === 'exercise') {
        fields.push(chipGroupHTML('Minutes', 'minutes', EXERCISE_DURATIONS, evt.minutes ?? 0));
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
    ${fieldsHTML}
    <div class="modal-field"><label>Time</label><input type="time" id="modal-time-input" value="${timeValue}" style="padding:8px 12px;font-size:14px;border:1px solid var(--card-border);border-radius:8px;background:var(--card);color:var(--text);width:100%"></div>
    <div class="modal-actions">
      <button class="btn-delete" onclick="if(App.deleteEvent('${escapeHTML(evt.id)}')) App.closeModal()">Delete</button>
      <button class="btn-save" onclick="App.saveModal()">Done</button>
    </div>`;
  $('modal-sheet').dataset.eventId = eventId;
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  calculateAndUpdateWins();
  render();
}

function saveModal() {
  const eventId = $('modal-sheet').dataset.eventId;
  const timeInput = $('modal-time-input');
  
  if (eventId && timeInput && timeInput.value) {
    const currentEvent = DB.loadEvents().find(e => e.id === eventId);
    if (currentEvent) {
      const oldDateKey = dateKey(currentEvent.ts);
      
      // Parse the time input and create new timestamp on same date as event
      const [hours, minutes] = timeInput.value.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const newDate = new Date(currentEvent.ts);
        newDate.setHours(hours, minutes, 0, 0);
        const newTs = newDate.getTime();
        
        // Only update if time actually changed
        if (newTs !== currentEvent.ts) {
          DB.updateEvent(eventId, { ts: newTs });
          
          const newDateKey = dateKey(newTs);
          if (oldDateKey !== newDateKey && currentHistoryDay === oldDateKey) {
            renderDayHistory();
          }
        }
      }
    }
  }
  
  closeModal();
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

function showLandingPage() {
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
  const landing = $('landing-page');
  if (landing) landing.classList.remove('hidden');
}

function dismissLanding() {
  const landing = $('landing-page');
  if (landing) landing.classList.add('hidden');
  showLoginScreen();
}

function showLoginScreen() {
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
  // Hide landing page if still visible
  const landing = $('landing-page');
  if (landing) landing.classList.add('hidden');
  
  // Switch to Today tab when showing login screen
  switchTab('today');
  
  const overlay = $('login-overlay');
  overlay.classList.remove('hidden');
  // Inject auth inputs only when login screen is visible
  const loginInputs = overlay.querySelector('.login-inputs');
  if (loginInputs && !loginInputs.children.length) {
    loginInputs.innerHTML = `
      <form id="login-form" onsubmit="return false" style="display:flex;flex-direction:column;gap:8px">
        <input type="email" id="login-email" name="email" autocomplete="username" placeholder="Email" class="login-input">
        <div class="password-wrap">
          <input type="password" id="login-password" name="password" autocomplete="current-password" placeholder="Password" class="login-input">
          <button type="button" class="password-toggle" onclick="App.togglePasswordVisibility(this)" title="Show password">👁️</button>
        </div>
      </form>`;
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
  if (!confirm('⚠️ Continue without an account?\n\nYour data will only be saved on this device and won\'t sync to other devices.\n\nYou can sign in later from Settings to enable cloud backup.')) {
    return;
  }
  safeSetItem(STORAGE_LOGIN_SKIPPED, 'true');
  hideLoginScreen();
  
  // Hide delete account button when continuing without account
  const deleteAccountBar = $('delete-account-bar');
  if (deleteAccountBar) deleteAccountBar.classList.add('hidden');
  
  continueToApp();
}

function continueToApp() {
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
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
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
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
  
  const newSettings = {
    addictionProfile: profileKey,
    lastSubstance: profile.substances[0],
    lastAmount: defaultAmount
  };
  
  if (profile.methods) {
    newSettings.lastMethod = profile.methods[0];
  }
  
  Object.assign(settings, newSettings);
  
  DB._settings = settings;
  DB.saveSettings();
  
  $('onboarding-overlay').classList.add('hidden');
  playSound('resist');
  
  calculateAndUpdateWins();
  bindEvents();
  render();
  // Clear existing interval if selectProfile is called multiple times
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
}

// ========== MAIN ACTIONS ==========
let lastUndoEventId = null;
let undoHideTimeout = null;

function showUndo(eventId) {
  lastUndoEventId = eventId;
  // Clear any pending hide timeout from a previous undo
  if (undoHideTimeout) {
    clearTimeout(undoHideTimeout);
    undoHideTimeout = null;
  }
  const row = $('used-row');
  if (row) row.classList.add('has-undo');
}

function hideUndo() {
  lastUndoEventId = null;
  if (undoHideTimeout) {
    clearTimeout(undoHideTimeout);
    undoHideTimeout = null;
  }
  const row = $('used-row');
  if (row) row.classList.remove('has-undo');
}

function undoLastUsed() {
  if (!lastUndoEventId) return;
  
  const undoBtn = $('btn-undo');
  if (undoBtn) pulseEl(undoBtn);
  
  // Hide used chips immediately
  hideUsedChips();
  
  DB.deleteEvent(lastUndoEventId);
  
  // Track undo for "Second Thought" win
  const winData = loadWinData();
  const today = todayKey();
  winData.todayUndoCount = (winData.todayDate === today ? (winData.todayUndoCount || 0) : 0) + 1;
  winData.todayDate = today;
  saveWinData(winData);
  
  calculateAndUpdateWins();
  
  // Clear the undo state immediately so it won't restore on tab switch
  lastUndoEventId = null;
  
  // Delay hiding undo button until after animation completes
  undoHideTimeout = setTimeout(() => {
    hideUndo();
  }, 400);
  
  playSound('undo');
  hapticFeedback();
  showToast('↩️ Undone');
  render();
  
  // Reset 'used' cooldown so user can log again immediately
  delete _lastActionTime['used'];
}

// ========== BUTTON COOLDOWNS ==========
const COOLDOWN_MS = 60 * 1000; // 1 minute
const _lastActionTime = {};

function checkCooldown(actionKey) {
  const now = Date.now();
  const last = _lastActionTime[actionKey];
  if (last && (now - last) < COOLDOWN_MS) {
    const secsLeft = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    playSound('cooldown');
    showToast(`⏳ Wait ${secsLeft}s before logging the same event again`);
    return false;
  }
  _lastActionTime[actionKey] = now;
  return true;
}

function logUsed() {
  if (!checkCooldown('used')) return;
  const s = DB.loadSettings();
  const profile = getProfile();
  const method = profile.methods ? s.lastMethod : null;
  const evt = createUsedEvent(s.lastSubstance, method, s.lastAmount);
  DB.addEvent(evt);
  calculateAndUpdateWins();
  render();
  hideResistedChips();
  $('exercise-chips').classList.add('hidden');
  clearTimeout(exerciseTimeout);
  hideUndo();
  showChips('used-chips', buildUsedChips, evt, hideUsedChips);
  
  const btn = $('btn-used');
  playSound('used');
  hapticFeedback();
  pulseEl(btn);
  
  showToast(`✅ Logged ${profile.sessionLabel}`);
  
  showUndo(evt.id);
}

function logResisted() {
  if (!checkCooldown('resisted')) return;
  const evt = createResistedEvent();
  DB.addEvent(evt);
  calculateAndUpdateWins();
  render();
  hideUsedChips();
  hideUndo();
  $('exercise-chips').classList.add('hidden');
  clearTimeout(exerciseTimeout);
  showChips('resisted-chips', buildResistedChips, evt, hideResistedChips);

  // Only show coaching if resisted was already clicked within the past 30 minutes
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  const todayResisted = filterByType(DB.forDate(todayKey()), 'resisted');
  if (todayResisted.some(r => r.id !== evt.id && r.ts >= thirtyMinAgo)) {
    showCoaching();
  }
  
  const btn = $('btn-resisted');
  playSound('resist');
  hapticFeedback();
  pulseEl(btn);
  showToast('🛡️ Resisted!');
}

function logHabit(habit, minutes) {
  if (!checkCooldown('habit_' + habit)) return;
  const evt = createHabitEvent(habit, minutes);
  DB.addEvent(evt);
  calculateAndUpdateWins();
  render();
  hideUndo();
  
  playSound('habit');
  hapticFeedback();
  const label = HABIT_LABELS[habit] || habit;
  const icon = HABIT_ICONS[habit] || '';
  const message = (habit === 'exercise' && minutes && minutes > 0) ? `${icon} Logged ${label} +${minutes} min` : `${icon} Logged ${label}`;
  showToast(message);
}

function logWaterFromReminder() {
  logHabit('water');
  const btn = $('water-reminder-btn');
  pulseEl(btn);
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
      // Check cooldown before showing chips
      if (!checkCooldown('habit_exercise')) return;
      
      // Immediately log exercise with 0 minutes
      const evt = createHabitEvent('exercise', 0);
      DB.addEvent(evt);
      calculateAndUpdateWins();
      render();
      hideUndo();
      
      playSound('habit');
      hapticFeedback();
      showToast('🏃 Logged Exercise');
      flashEl(btn);
      
      // Show chips so user can optionally add duration
      const picker = $('exercise-chips');
      picker.classList.remove('hidden');
      clearTimeout(exerciseTimeout);
      exerciseTimeout = setTimeout(() => picker.classList.add('hidden'), CHIP_TIMEOUT_MS);
      return;
    }
    
    $('exercise-chips').classList.add('hidden');
    clearTimeout(exerciseTimeout);
    hideUsedChips();
    hideResistedChips();
    hideUndo();
    logHabit(habit);
    flashEl(btn);
  });

  $('exercise-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    // Find the most recent exercise event and update its minutes
    const events = DB.loadEvents();
    const recentExercise = events
      .filter(evt => evt.type === 'habit' && evt.habit === 'exercise')
      .sort((a, b) => b.ts - a.ts)[0];
    
    if (recentExercise) {
      const minutes = parseInt(chip.dataset.min, 10);
      if (!isNaN(minutes)) {
        DB.updateEvent(recentExercise.id, { minutes });
        calculateAndUpdateWins();
        render();
      }
    }
    
    const exerciseBtn = document.querySelector('[data-habit="exercise"]');
    if (exerciseBtn) pulseEl(exerciseBtn);
    playSound('exercise');
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
  safeSetItem(STORAGE_TODOS, JSON.stringify(todos));
  if (window.FirebaseSync) FirebaseSync.onDataChanged();
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
  const clearBtn = $('todo-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', todos.length === 0);
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

async function deleteTodo(idx) {
  if (!confirm('Delete this goal?')) return;
  const todos = loadTodos();
  todos.splice(idx, 1);
  saveTodos(todos);
  renderTodos();
  // Push immediately so focus-triggered pull doesn't restore the deleted item
  if (window.FirebaseSync) {
    try { await FirebaseSync.pushNow(); } catch (e) { /* ignore */ }
  }
}

async function clearTodos() {
  if (!confirm('Clear all goal items?')) return;
  saveTodos([]);
  renderTodos();
  if (window.FirebaseSync) {
    try { await FirebaseSync.pushNow(); } catch (e) { /* ignore */ }
  }
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
  
  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
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
    if (e.key === 'Escape') { saved = true; renderTodos(); }
  });
  
  textSpan.replaceWith(input);
  input.focus();
  input.select();
}

// ========== PUBLIC API ==========
function setThemeIcon(theme) {
  const icon = $('theme-icon-settings');
  const text = $('theme-text-settings');
  // Show what you'll toggle TO
  if (theme === 'light') {
    if (icon) icon.textContent = '🌙';
    if (text) text.textContent = 'Enable Dark Theme';
  } else {
    if (icon) icon.textContent = '☀️';
    if (text) text.textContent = 'Enable Light Theme';
  }
}

function setSoundButton(soundEnabled) {
  const icon = $('sound-icon-settings');
  const text = $('sound-text-settings');
  // Show what you'll toggle TO
  if (soundEnabled) {
    if (icon) icon.textContent = '🔇';
    if (text) text.textContent = 'Disable Sounds';
  } else {
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = 'Enable Sounds';
  }
}

function getToggleTheme(current) {
  return current === 'light' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  safeSetItem(STORAGE_THEME, theme);
  setThemeIcon(theme);
}

window.App = {
  hideUsedChips,
  hideResistedChips,
  editEvent: openEditModal,
  closeModal,
  saveModal,
  dismissLanding,
  deleteEvent(id) {
    if (!confirm('Delete this event?')) return false;
    DB.deleteEvent(id);
    calculateAndUpdateWins();
    render();
    // Flush to cloud immediately so focus-triggered pull doesn't restore the deleted event
    if (window.FirebaseSync) FirebaseSync.pushNow().catch(() => {});
    return true;
  },
  async clearDay() {
    const events = DB.forDate(currentHistoryDay);
    if (events.length === 0) return;
    const label = friendlyDate(currentHistoryDay);
    if (!confirm(`🗑️ Delete all ${events.length} events for ${label}?\n\nThis cannot be undone.`)) return;
    // Batch delete — single filter + save instead of N individual deletions
    const idsToDelete = new Set(events.map(e => e.id));
    // Batch-add tombstones in one write (avoids N parse/stringify cycles)
    try {
      const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '[]');
      const existingIds = new Set(tombstones.map(t => t.id));
      const now = Date.now();
      for (const id of idsToDelete) {
        if (!existingIds.has(id)) tombstones.push({ id, deletedAt: now });
      }
      safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(tombstones));
    } catch (e) { console.error('Failed to batch-add tombstones:', e); }
    DB.loadEvents();
    DB._events = DB._events.filter(e => !idsToDelete.has(e.id));
    DB._invalidateDateIndex();
    DB.saveEvents();
    DB._cleanOldTombstones();
    calculateAndUpdateWins();
    render();
    if (window.FirebaseSync) {
      try { await FirebaseSync.pushNow(); } catch (e) { /* ignore */ }
    }
  },
  exportJSON,
  importJSON,
  clearDatabase,
  clearTodos,
  changeAddiction,
  switchTab,
  logWaterFromReminder,
  loadMoreHistory,
  togglePasswordVisibility(btn) {
    const input = btn.parentElement.querySelector('input');
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
    btn.title = isHidden ? 'Hide password' : 'Show password';
  },
  toggleSound() {
    const settings = DB.loadSettings();
    settings.soundEnabled = !settings.soundEnabled;
    DB.saveSettings();
    setSoundButton(settings.soundEnabled);
  },
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
  async forgotPasswordFromScreen() {
    const email = $('login-email')?.value;
    if (!email) return alert('Enter your email address first');
    try {
      if (window.FirebaseSync) {
        await FirebaseSync.sendPasswordReset(email);
        alert('✅ Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      alert('Failed to send reset email: ' + err.message);
    }
  },
  async deleteAccount() {
    if (!confirm('⚠️ Delete your account?\n\nThis will permanently delete your cloud data and account. Local data will also be cleared.\n\nThis cannot be undone.')) return;
    try {
      if (window.FirebaseSync) {
        await FirebaseSync.deleteAccount();
      }
      clearAllStorage();
      location.reload();
    } catch (err) {
      alert('Failed to delete account: ' + err.message);
    }
  },
  async signupWithEmailFromScreen() {
    const email = $('login-email')?.value;
    const password = $('login-password')?.value;
    if (!email || !password) return alert('Enter email and password');
    const pwError = validatePassword(password);
    if (pwError) return alert(pwError);
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
// generateUseEvent(7) - adds a single use event 7 days ago

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
    const method = profile.methods ? profile.methods[Math.floor(Math.random() * profile.methods.length)] : null;
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
  DB._events.sort(sortByTime);
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
  DB._events.sort(sortByTime);
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
  DB._events.sort(sortByTime);
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
  
  // Generate yesterday's wins (subset of eligible wins)
  console.log('Generating random yesterday wins...');
  const fakeYesterdayWins = [];
  // Pick 5-12 random wins for yesterday
  const numYesterdayWins = Math.floor(Math.random() * 8) + 5; // 5-12
  const shuffledEligible = [...eligibleIds].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(numYesterdayWins, shuffledEligible.length); i++) {
    const id = shuffledEligible[i];
    // Most wins earned once, some 2-3 times
    const count = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 2) + 2;
    fakeYesterdayWins.push({ id, count });
  }
  
  // Set todayDate to yesterday, and put the wins in todayWins
  // When the app loads "today", it will auto-move them to yesterdayWins
  const updatedData = {
    todayDate: daysAgoKey(1),  // Yesterday's date
    todayWins: fakeYesterdayWins,  // These will become yesterday's wins on reload
    yesterdayWins: [],
    todayUndoCount: 0,
    lifetimeWins: Array.from(lifetimeMap.entries())
      .map(([id, count]) => ({ id, count }))
      .filter(w => w.count > 0)
  };
  
  saveWinData(updatedData);
  
  // Verify save
  const verify = loadWinData();
  console.log(`✅ Added random wins for ${updatedData.lifetimeWins.length} lifetime win types and ${fakeYesterdayWins.length} yesterday wins.`);
  console.log('Generated as "today" wins for yesterday\'s date - will auto-move to yesterday on reload');
  console.log('Sample wins:', verify.todayWins.slice(0, 5));
  console.log('Sample lifetime wins:', verify.lifetimeWins.slice(0, 5));
}

// DEBUG: Generate a use event X days ago
function generateUseEvent(daysAgo) {
  const settings = DB.loadSettings();
  const profile = getProfile();
  
  // Parse input
  const days = parseInt(daysAgo);
  if (isNaN(days) || days < 0) {
    showToast('❌ Please enter a valid number of days');
    return;
  }
  
  // Calculate timestamp - random time within the target day
  const msPerDay = 24 * 60 * 60 * 1000;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  targetDate.setHours(0, 0, 0, 0); // Start of day
  const randomMs = Math.floor(Math.random() * msPerDay); // Random time within the day
  const targetTimestamp = targetDate.getTime() + randomMs;
  
  // Create event with current settings
  const substance = settings.lastSubstance || profile.substances[0];
  const method = profile.methods ? (settings.lastMethod || profile.methods[0]) : null;
  const amount = settings.lastAmount || profile.amounts[0];
  
  const evt = {
    id: uid(),
    type: 'used',
    ts: targetTimestamp,
    substance,
    method,
    amount
  };
  
  DB.addEvent(evt);
  calculateAndUpdateWins();
  render();
  
  console.log(`✅ Added ${profile.sessionLabel} event ${days} day(s) ago:`, evt);
  showToast(`✅ Added ${profile.sessionLabel} event ${days} day(s) ago`);
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  // Don't preload events or settings - let them load lazily to avoid caching stale data before Firebase sync
  
  applyTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
  
  // Initialize sound system
  initSounds();
  
  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
      .catch(err => console.log('[PWA] Service worker registration failed:', err));
  }
  
  // Firebase will handle initial auth check and call continueToApp() or show login screen
  // If Firebase is not configured, checkAuthAndContinue will be called after a short delay
  
  // Mobile badge tooltip handling
  setupBadgeTooltips();
});

// Mobile badge tooltip system
function setupBadgeTooltips() {
  let activeTooltip = null;
  
  // Create tooltip element if it doesn't exist
  function getTooltipElement() {
    let tooltip = document.querySelector('.badge-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'badge-tooltip';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  
  // Show tooltip
  function showTooltip(element, text) {
    if (!text) return;
    
    const tooltip = getTooltipElement();
    tooltip.textContent = text;
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Center horizontally on the badge, adjust if it goes off screen
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
    
    // Position above the badge, or below if no room
    let top = rect.top - tooltipRect.height - 10;
    if (top < 10) {
      top = rect.bottom + 10;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
    
    activeTooltip = tooltip;
  }
  
  // Hide tooltip
  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.classList.remove('visible');
      activeTooltip = null;
    }
  }
  
  // Event delegation for badge items and tiles
  document.addEventListener('click', (e) => {
    const winItem = e.target.closest('.win-item');
    const tile = e.target.closest('.tile[data-tooltip]');
    
    if (winItem) {
      e.preventDefault();
      e.stopPropagation();
      
      const tooltipText = winItem.getAttribute('title');
      
      // If clicking the same badge, toggle it off
      if (activeTooltip && activeTooltip.textContent === tooltipText) {
        hideTooltip();
      } else {
        showTooltip(winItem, tooltipText);
      }
    } else if (tile) {
      e.preventDefault();
      e.stopPropagation();
      
      const tooltipText = tile.getAttribute('data-tooltip');
      
      // If clicking the same tile, toggle it off
      if (activeTooltip && activeTooltip.textContent === tooltipText) {
        hideTooltip();
      } else {
        showTooltip(tile, tooltipText);
      }
    } else {
      // Clicked outside, hide tooltip
      hideTooltip();
    }
  });
  
  // Hide tooltip on scroll
  window.addEventListener('scroll', hideTooltip, { passive: true });
}