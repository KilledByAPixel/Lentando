// LENTANDO - Progress At Your Pace
// Copyright (c) 2026 Frank Force

'use strict';

const debugMode = false; // Set to true to enable debug logging and debug time system messages

// ========== DEBUG TIME SYSTEM ==========
// Allows advancing time for testing badges, day boundaries, etc.
let _debugTimeOffset = 0;

function now() {
  return Date.now() + _debugTimeOffset;
}

function currentDate() {
  return new Date(now());
}

// Debug functions are only exposed on window when debugMode is true
if (debugMode) {

  function debugAdvanceTime(hours) {
    _debugTimeOffset += hours * 60 * 60 * 1000;
    console.log(`⏰ Time advanced by ${hours}h. Virtual date: ${currentDate().toLocaleString()}`);
    render();
  }

  function debugSetDate(dateString) {
    const targetTime = new Date(dateString).getTime();
    _debugTimeOffset = targetTime - Date.now();
    console.log(`⏰ Time set to ${currentDate().toLocaleString()}`);
    render();
  }

  function debugResetTime() {
    _debugTimeOffset = 0;
    console.log('⏰ Time reset to real time');
    render();
  }

  function debugGetTime() {
    console.log(`Current virtual time: ${currentDate().toLocaleString()}`);
    console.log(`Offset: ${_debugTimeOffset / (1000 * 60 * 60)} hours`);
    return currentDate();
  }
  
  window.debugAdvanceTime = debugAdvanceTime;
  window.debugSetDate = debugSetDate;
  window.debugResetTime = debugResetTime;
  window.debugGetTime = debugGetTime;
}

// ========== CONSTANTS ==========
const STORAGE_EVENTS = 'ht_events';
const STORAGE_SETTINGS = 'ht_settings';
const STORAGE_TODOS = 'ht_todos';
const STORAGE_THEME = 'ht_theme';
const STORAGE_BADGES = 'ht_badges';
const STORAGE_LOGIN_SKIPPED = 'ht_login_skipped';
const STORAGE_VERSION = 'ht_data_version';
const STORAGE_DELETED_IDS = 'ht_deleted_ids';
const STORAGE_DELETED_TODO_IDS = 'ht_deleted_todo_ids';
const STORAGE_CLEARED_AT = 'ht_cleared_at';
const DATA_VERSION = 3;

const ADDICTION_PROFILES = {
  cannabis: {
    sessionLabel: 'Use',
    substanceLabel: 'Type',
    methodLabel: 'Method',
    substances: ['thc', 'cbd', 'mix'],
    substanceDisplay: { thc: 'THC', cbd: 'CBD', mix: 'Mix' },
    methods: ['bong', 'vape', 'pipe', 'joint', 'edible', 'other'],
    amounts: [0.5, 1, 1.5, 2, 3, 4, 5],
    amountUnit: 'hits',
    icons: { thc: '🌿', cbd: '🍃', mix: '🍂' }
  },
  alcohol: {
    sessionLabel: 'Drink',
    substanceLabel: 'Type',
    substances: ['beer', 'wine', 'liquor'],
    substanceDisplay: { beer: 'Beer', wine: 'Wine', liquor: 'Liquor' },
    amounts: [0.5, 1, 2, 3, 4, 5, 10],
    amountUnit: 'drinks',
    icons: { beer: '🍺', wine: '🍷', liquor: '🥃' }
  },
  smoking: {
    sessionLabel: 'Smoke',
    substanceLabel: 'Type',
    substances: ['cigarette', 'vape', 'other'],
    substanceDisplay: { cigarette: 'Cigarette', vape: 'Vape', other: 'Other' },
    amounts: [0.5, 1, 2, 3, 5, 10, 20],
    amountUnit: 'count',
    icons: { cigarette: '🚬', vape: '💨', other: '⚡' }
  },
  custom: {
    sessionLabel: 'Use',
    substanceLabel: 'Type',
    methodLabel: 'Method',
    substances: ['type1', 'type2', 'type3'],
    substanceDisplay: { type1: 'Type 1', type2: 'Type 2', type3: 'Type 3' },
    methods: ['method1', 'method2', 'method3'],
    amounts: [0.5, 1, 1.5, 2, 5, 10, 20],
    amountUnit: 'units',
    icons: { type1: '⚡', type2: '✨', type3: '🔥' }
  }
};

function getProfile() {
  const settings = DB.loadSettings();
  let key = settings.addictionProfile || 'cannabis';
  // Migrate legacy 'other' profile key to 'custom'
  if (key === 'other') {
    key = 'custom';
    settings.addictionProfile = 'custom';
    DB._settings = settings;
    DB.saveSettings();
  }
  const base = ADDICTION_PROFILES[key];
  if (!base) return ADDICTION_PROFILES.cannabis;
  if (key !== 'custom') return base;
  // Build custom profile with user overrides
  return buildCustomProfile(settings);
}

function buildCustomProfile(settings) {
  const base = ADDICTION_PROFILES.custom;
  const cp = settings.customProfile || {};
  const typeNames = cp.types || ['', '', ''];
  const addictionName = cp.name || '';
  const customIcons = cp.icons || ['⚡', '⚡', '⚡'];

  // Build substances list — keep all 3 slots, use defaults for blanks
  const substanceDisplay = {
    type1: typeNames[0] || 'Type 1',
    type2: typeNames[1] || 'Type 2',
    type3: typeNames[2] || 'Type 3'
  };

  const icons = {
    type1: customIcons[0] || '⚡',
    type2: customIcons[1] || '⚡',
    type3: customIcons[2] || '⚡'
  };

  return {
    ...base,
    sessionLabel: addictionName || base.sessionLabel,
    substanceDisplay,
    icons,
    methods: null,
    methodLabel: null,
    methodDisplay: {}
  };
}

// User input options
const REASONS = ['habit', 'stress', 'social', 'reward','bored', 'pain', 'hungry', 'angry', 'lonely', 'tired'];
const INTENSITIES = [1, 2, 3, 4, 5];
const HABIT_DURATIONS = [0, 5, 10, 15, 20, 30, 45, 60, 120];
const OPTIONAL_FIELDS = new Set(['reason', 'trigger']);

// Timeouts and durations
const CHIP_TIMEOUT_MS = 10000;
const FLASH_ANIMATION_MS = 300;
const IMPORT_STATUS_HIDE_MS = 5000;
const METRICS_REFRESH_MS = 30000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// Badge calculation thresholds
const GAP_MILESTONES = [1, 2, 4, 8, 12];
const TBREAK_MILESTONES = [1, 7, 14, 21, 30, 365];
const APP_STREAK_MILESTONES = [2, 7, 30, 365];
const EARLY_HOUR = 6;
const MAX_STREAK_DAYS = 60;

const COACHING_MESSAGES = [
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
  '💪 One moment at a time',
  '🏆 Every resist is a win',
  '📞 Call a friend',
  '🎨 Do something creative',
  '🤸 Take a movement break',
  '🧼 Wash your face or hands',
  '🍬 Chew some gum or brush teeth',
  '📽️ Watch a calming video',
  '✍️ Write about how you feel',
  '🕯️ Light a candle or incense',
  '🦶 Feel your feet on the floor',
  '🗑️ Throw away one piece of trash',
  '🍽️ Wash or put away a few dishes',
  '📈 Small steps add up',
  '🌊 This urge will pass',
  '📦 Put it out of reach (for now)',
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

// Habits that show duration chips (time tracking) - set to true to enable
const HABIT_SHOW_CHIPS = {
  water: false,
  exercise: true,
  breaths: true,
  clean: true,
  outside: true
};

// Badge definitions - maps badge IDs to their display properties
// Order matters! sortOrder is auto-assigned based on position in this object
const BADGE_DEFINITIONS = {
  'welcome-back': { label: 'Welcome Back', icon: '👋', desc: 'Returned to tracking after 24+ hours away' },
  'daily-checkin': { label: 'Showed Up', icon: '✅', desc: 'Logged at least one event, showing up is everything' },
  'resist': { label: 'Resisted', icon: '💪', desc: 'Resisted an urge' },
  'urge-surfed': { label: 'Let It Pass', icon: '🧘', desc: 'Logged an urge and didn\'t use for 15+ minutes' },
  'swap-completed': { label: 'Healthy Swap', icon: '🧩', desc: 'Logged an urge, then did a healthy action within 15 minutes' },
  'intensity-logged': { label: 'Intensity Logged', icon: '🌡️', desc: 'Tracked urge intensity' },
  'trigger-noted': { label: 'Trigger Identified', icon: '🔍', desc: 'Identified what triggered the urge' },
  'full-report': { label: 'Full Report', icon: '📋', desc: 'Logged both intensity and trigger' },
  'tough-resist': { label: 'Tough Resist', icon: '🦁', desc: 'Resisted a strong urge (intensity 4+)' },
  'resist-majority': { label: 'Resist Majority', icon: '⚔️', desc: 'More resists than uses' },
  'second-thought': { label: 'Reconsidered', icon: '💭', desc: 'Used undo to reconsider' },
  'mindful': { label: 'Mindful Session', icon: '🌸', desc: 'Logged the reason for using' },
  'good-start': { label: 'Strong Start', icon: '🚀', desc: 'Started the day with a positive action instead of using' },
  'drank-water': { label: 'Drank Water', icon: '💧', desc: 'Logged water' },
  'hydrated': { label: 'Hydrated', icon: '🌊', desc: 'Logged water 5+ times' },
  'exercised': { label: 'Exercised', icon: '🏃', desc: 'Exercised or did a physical activity' },
  'breathwork': { label: 'Breathwork', icon: '🌬️', desc: 'Did breathing exercises or meditation' },
  'cleaned': { label: 'Tidied Up', icon: '🧹', desc: 'Tidied up or cleaned something' },
  'went-outside': { label: 'Went Outside', icon: '🌴', desc: 'Spent time outside or got some fresh air' },
  'five-star-day': { label: 'Five Star Day', icon: '🌟', desc: 'Logged all 5 habit types' },
  'habit-streak': { label: 'Habit Streak', icon: '🐢', desc: 'Logged healthy habits for consecutive days' },
  'resist-streak': { label: 'Resist Streak', icon: '🛡️', desc: 'Resisted urges for multiple days in a row' },
  'gap-1h': { label: 'Gap 1h', icon: '🕐', desc: 'Maintained a 1+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-2h': { label: 'Gap 2h', icon: '🕑', desc: 'Maintained a 2+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-4h': { label: 'Gap 4h', icon: '🕓', desc: 'Maintained a 4+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-8h': { label: 'Gap 8h', icon: '🕗', desc: 'Maintained an 8+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-12h': { label: 'Gap 12h', icon: '🕛', desc: 'Maintained a 12+ hour gap between sessions (excludes gaps crossing 6am)' },
  'night-gap': { label: 'Good Night', icon: '🛏️', desc: 'Maintained a 12+ hour gap that crosses 6am' },
  'dose-half': { label: 'Reduced Dose', icon: '⚖️', desc: 'Used less than a full dose' },
  'harm-reduction-vape': { label: 'Safer Choice', icon: '✨', desc: 'Chose vape over smoke' },
  'vape-only': { label: 'Vape Only Day', icon: '💨', desc: 'Only used vape or edibles' },
  'cbd-only': { label: 'CBD-Only Day', icon: '🍃', desc: 'Used only CBD products, no THC' },
  'half-cbd-day': { label: 'Half CBD Day', icon: '🍂', desc: 'At least 50% of usage was CBD' },
  'edibles-only': { label: 'Edibles Only Day', icon: '🍪', desc: 'Only used edibles' },
  'no-liquor': { label: 'No Liquor Day', icon: '🥃', desc: 'Did not drink liquor (alcohol tracking only)' },
  'one-session': { label: 'One Session', icon: '☝️', desc: 'Limited use to a single session' },
  'microdose-day': { label: 'Small Amount', icon: '🤏', desc: 'Total amount used of 2 or less' },
  'first-later': { label: 'Held Off', icon: '⏰', desc: 'First session later than yesterday (after 6am)' },
  'lower-amount': { label: 'Scaling Back', icon: '📉', desc: 'Used a smaller total amount than yesterday' },
  'taper': { label: 'Tapering', icon: '📐', desc: 'Gradually reduced usage over 3 or more consecutive days' },
  'gap-above-avg': { label: 'Beat Your Average', icon: '⏳', desc: 'Average gap exceeded trailing 7-day average (excludes gaps crossing 6am)' },
  'low-day': { label: 'Light Day', icon: '🎈', desc: 'Used less than half your trailing 7-day average' },
  'night-skip': { label: 'No Night Use', icon: '☄️', desc: 'No use between midnight and 6am' },
  'morning-skip': { label: 'No Morning Use', icon: '🌅', desc: 'No use between 6am and noon' },
  'day-skip': { label: 'No Day Use', icon: '☀️', desc: 'No use between noon and 6pm' },
  'evening-skip': { label: 'No Evening Use', icon: '🌙', desc: 'No use between 6pm and midnight' },
  'zero-use': { label: 'Clear Day', icon: '🏅', desc: 'No use today' },
  'app-streak': { label: 'App Streak', icon: '📱', desc: 'Used the app multiple days in a row' },
  'week-streak': { label: 'App Week Streak', icon: '📅', desc: 'Used the app every day for a week' },
  'month-streak': { label: 'App Month Streak', icon: '🗓️', desc: 'Used the app every day for a month' },
  'year-streak': { label: 'App Year Streak', icon: '🎉', desc: 'Used the app every day for a year!' },
  'tbreak-1d': { label: 'One Day', icon: '🌱', desc: '24 hour gap with no use' },
  'tbreak-7d': { label: 'One Week', icon: '🌿', desc: 'One week with no use' },
  'tbreak-14d': { label: 'Two Weeks', icon: '🍀', desc: 'Two weeks with no use' },
  'tbreak-21d': { label: 'Three Weeks', icon: '🌳', desc: 'Three weeks with no use' },
  'tbreak-30d': { label: 'One Month', icon: '🏆', desc: 'One month with no use' },
  'tbreak-365d': { label: 'One Year', icon: '👑', desc: 'One year with no use!' },
};

Object.keys(BADGE_DEFINITIONS).forEach((key, index) => {
  BADGE_DEFINITIONS[key].sortOrder = index;
});

function getBadgeDef(id) {
  return BADGE_DEFINITIONS[id] || { label: 'Unknown Badge', icon: '❓', desc: '' };
}

const DEFAULT_SETTINGS = {
  addictionProfile: null, // Set on first launch
  lastSubstance: 'thc',
  lastMethod: 'bong',
  lastAmount: 1.0,
  showCoaching: true,
  soundEnabled: true,
  customProfile: { name: '', types: ['', '', ''], icons: ['⚡', '⚡', '⚡'] },
  reminderEnabled: false,
  reminderHour: 18, // 24h format, default 6 PM
  reminderMinute: 0
};

// ========== SOUND SYSTEM ==========
let ZZFXSound = null;
let SOUNDS = null;

async function initSounds() {
  try {
    const zzfxModule = await import('./zzfx.js');
    ZZFXSound = zzfxModule.ZZFXSound;
    
    // Pre-build sound samples using ZZFXSound class (params will be tuned later)
    SOUNDS = {
      used: new ZZFXSound([,,224,.02,.02,.08,1,1.7,-14,,,,,,6.7]),
      resist: new ZZFXSound([,,422,.08,.26,.19,1,1.1,,-144,18,.07,.1,,,,,.84,.21,.5,520]),
      habit: new ZZFXSound([2,,330,.02,.05,,,.8,,,27,.06,,,,,.1,.5,.03]),
      habitChip: new ZZFXSound([,,990,,,.05,,9,20]),
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
  return now().toString(36) + '-' + (++_uidCounter).toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

/** Extract creation timestamp from a uid()-generated ID (base36 prefix) */
function getUidTimestamp(id) {
  if (!id || typeof id !== 'string') return 0;
  const firstPart = id.split('-')[0];
  const ts = parseInt(firstPart, 36);
  return Number.isFinite(ts) ? ts : 0;
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
  if (typeof str !== 'string') return str == null ? '' : String(str);
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
  localStorage.removeItem(STORAGE_BADGES);
  localStorage.removeItem(STORAGE_LOGIN_SKIPPED);
  localStorage.removeItem(STORAGE_VERSION);
  localStorage.removeItem(STORAGE_DELETED_IDS);
  localStorage.removeItem(STORAGE_DELETED_TODO_IDS);
  localStorage.removeItem(STORAGE_CLEARED_AT);
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

function todayKey() { return dateKey(currentDate()); }

function daysAgoKey(n) {
  const d = currentDate();
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
      const storedVersion = parseInt(raw, 10) || 0;
      if (storedVersion >= DATA_VERSION) return;

      // Brand-new install — no existing data to migrate, just stamp the version
      if (raw === null && !localStorage.getItem(STORAGE_EVENTS) && !localStorage.getItem(STORAGE_BADGES)) {
        safeSetItem(STORAGE_VERSION, DATA_VERSION.toString());
        return;
      }

      console.log(`Migrating data from version ${storedVersion} to ${DATA_VERSION}`);

      // Clean up any leftover old key
      localStorage.removeItem('ht_wins');

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
      // Filter out events created before the last database clear
      const clearedAt = parseInt(localStorage.getItem(STORAGE_CLEARED_AT) || '0', 10);
      if (clearedAt > 0) {
        this._events = this._events.filter(e => getUidTimestamp(e.id) > clearedAt);
      }
    } catch (e) {
      console.error('Failed to load events from localStorage:', e);
      alert('⚠️ Your saved data appears to be corrupted and could not be loaded. If you have cloud sync enabled, your data will be restored on next sync.');
      this._events = [];
    }
    this._invalidateDateIndex();
    return this._events;
  },

  _getDeletedIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '{}');
      return new Set(Object.keys(raw));
    } catch {
      return new Set();
    }
  },

  _addTombstone(eventId) {
    try {
      const raw = this._readTombstoneMap();
      if (raw[eventId]) return;
      raw[eventId] = now();
      safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(raw));
      if (window.FirebaseSync) FirebaseSync.onDataChanged();
    } catch (e) {
      console.error('Failed to add tombstone:', e);
    }
  },

  _readTombstoneMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '{}');
      return (typeof raw === 'object' && raw !== null) ? raw : {};
    } catch {
      return {};
    }
  },

  _cleanOldTombstones() {
    try {
      const raw = this._readTombstoneMap();
      const entries = Object.entries(raw);
      const ninetyDaysAgo = now() - (90 * 24 * 60 * 60 * 1000);
      const cleaned = {};
      for (const [id, deletedAt] of entries) {
        if (deletedAt > ninetyDaysAgo) cleaned[id] = deletedAt;
      }
      if (Object.keys(cleaned).length < entries.length) {
        safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(cleaned));
        console.log(`[Tombstone] Cleaned ${entries.length - Object.keys(cleaned).length} old tombstones`);
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
    this._events[idx].modifiedAt = now(); // Track edit time for sync conflict resolution
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
window.render = render;
window.showLandingPage = showLandingPage;
window.showLoginScreen = showLoginScreen;
window.hideLoginScreen = hideLoginScreen;
window.continueToApp = continueToApp;

/** Stop all background timers (called on logout) */
window.stopTimers = function() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (chipTimeout) { clearTimeout(chipTimeout); chipTimeout = null; }
  if (habitChipTimeout) { clearTimeout(habitChipTimeout); habitChipTimeout = null; }
  if (undoHideTimeout) { clearTimeout(undoHideTimeout); undoHideTimeout = null; }
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
  const evt = { id: uid(), type: 'used', ts: now(), substance: sub, amount: amount != null ? amount : 1.0 };
  if (method) evt.method = method;
  if (reason) evt.reason = reason;
  return evt;
}

function createResistedEvent(intensity, trigger) {
  const evt = { id: uid(), type: 'resisted', ts: now() };
  if (intensity) evt.intensity = intensity;
  if (trigger) evt.trigger = trigger;
  return evt;
}

function createHabitEvent(habit, minutes) {
  const evt = { id: uid(), type: 'habit', ts: now(), habit };
  if (minutes) evt.minutes = minutes;
  return evt;
}

// ========== BADGE CALCULATION HELPERS ==========
function countUrgeSurfed(resisted, used) {
  const CLUSTER_MS = 5 * 60 * 1000;
  const sorted = sortedByTime(resisted);
  
  return sorted.filter((r, i) => {
    // Skip if this resist is within 5 minutes of the previous resist (cluster de-dupe)
    if (i > 0 && r.ts - sorted[i - 1].ts <= CLUSTER_MS) {
      return false;
    }
    
    // Check if 15+ minutes have passed and no use occurred within 15 minutes after
    const timeSinceResist = now() - r.ts;
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

function getMilestoneBadges(gapHours, milestones) {
  // Return only the highest milestone reached, not all of them
  const reached = milestones.filter(h => gapHours >= h);
  return reached.length > 0 ? [reached[reached.length - 1]] : [];
}

/** Average within-day gap (ms) across the given day keys. Uses filterFn to get sessions per day. */
function avgWithinDayGapMs(dayKeys, filterFn) {
  const gaps = dayKeys.flatMap(dk => getGapsMs(filterFn(DB.forDate(dk))));
  return gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
}

function avgDailyAmount(dayKeys, filterFn) {
  const amounts = dayKeys.map(dk => sumAmount(filterFn(DB.forDate(dk))));
  const daysWithUse = amounts.filter(a => a > 0);
  return daysWithUse.length > 0 ? daysWithUse.reduce((s, a) => s + a, 0) / daysWithUse.length : 0;
}

// ========== BADGE STORAGE ==========
function loadBadgeData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_BADGES));
    if (!data) return { todayDate: null, todayBadges: [], yesterdayBadges: [], lifetimeBadges: [], todayUndoCount: 0 };
    // Backfill yesterdayBadges for existing data
    if (!data.yesterdayBadges) data.yesterdayBadges = [];
    return data;
  } catch {
    return { todayDate: null, todayBadges: [], yesterdayBadges: [], lifetimeBadges: [], todayUndoCount: 0 };
  }
}

function saveBadgeData(data) {
  safeSetItem(STORAGE_BADGES, JSON.stringify(data));
  if (window.FirebaseSync) FirebaseSync.onDataChanged();
}

// ========== BADGES ENGINE ==========
const Badges = {
  calculate(todayEvents, yesterdayEvents, options = {}) {
    const { completedDay = false, forDate = null, appStartDate = null, appStartTs = null } = options;
    // forDate: the date key being evaluated (defaults to todayKey())
    const evaluationDate = forDate || todayKey();

    // Determine reference timestamp for calculations
    let refTs, refDateObj;
    if (evaluationDate < todayKey()) {
      const d = new Date(evaluationDate + 'T23:59:59.999');
      refTs = d.getTime();
      refDateObj = d;
    } else {
      refTs = now();
      refDateObj = currentDate();
    }

    const badges = [];
    const addBadge = (condition, id) => {
      if (condition) badges.push(id);
    };

    const used     = filterUsed(todayEvents);
    const resisted = filterByType(todayEvents, 'resisted');
    const habits   = filterByType(todayEvents, 'habit');
    const subs = new Set(getProfile().substances);
    const profileUsed = used.filter(e => subs.has(e.substance)); // Profile-aware: only substances in current profile
    const settings = DB.loadSettings();

    // --- Pre-compute shared lookups (used by multiple badge groups) ---
    const allKeys = DB.getAllDayKeys(); // sorted most recent first
    const yesterdayProfileUsed = yesterdayEvents ? filterProfileUsed(yesterdayEvents) : [];
    const profileAmt = sumAmount(profileUsed);

    // Check if this is the user's first day using the app
    // Use appStartDate if available (reliable across zero-event days), else fall back to event check
    let isFirstDay;
    let hasHistoricalProfileUse = false; // Track if they have any past use events
    if (appStartDate) {
      isFirstDay = evaluationDate === appStartDate;
      // Check for historical profile use events before today
      if (isFirstDay) {
        hasHistoricalProfileUse = allKeys.some(key => {
          if (key >= evaluationDate) return false;
          return filterProfileUsed(DB.forDate(key)).length > 0;
        });
      }
    } else {
      const hasEventsBeforeToday = allKeys.some(key => key < evaluationDate && DB.forDate(key).length > 0);
      isFirstDay = !hasEventsBeforeToday;
      // While we have the keys, also check for profile-specific use events in previous days
      hasHistoricalProfileUse = allKeys.some(key => {
        if (key >= evaluationDate) return false;
        return filterProfileUsed(DB.forDate(key)).length > 0;
      });
    }

    // --- Daily Check-in badge ---
    addBadge(todayEvents.length > 0, 'daily-checkin');

    // --- Welcome Back badge ---
    // Use event timestamps (stable) so the badge is consistent across renders.
    if (todayEvents.length > 0) {
      for (const key of allKeys) {
        if (key >= evaluationDate) continue; // skip the day being evaluated
        const prevDayEvents = DB.forDate(key);
        if (prevDayEvents.length > 0) {
          const lastPrevTs = prevDayEvents[prevDayEvents.length - 1].ts;
          addBadge((todayEvents[0].ts - lastPrevTs) >= 24 * 3600000, 'welcome-back');
          break;
        }
      }
    }

    // --- Session-based badges ---
    addBadge(resisted.length > 0, 'resist');
    addBadge(countUrgeSurfed(resisted, used) > 0, 'urge-surfed');
    addBadge(countSwapCompleted(resisted, habits) > 0, 'swap-completed');

    // --- Resist awareness badges ---
    addBadge(resisted.some(r => r.intensity != null), 'intensity-logged');
    addBadge(resisted.some(r => r.trigger != null), 'trigger-noted');
    addBadge(resisted.some(r => r.intensity != null && r.trigger != null), 'full-report');
    addBadge(resisted.some(r => r.intensity >= 4), 'tough-resist');
    addBadge(resisted.length > 0 && resisted.length > profileUsed.length, 'resist-majority');

    // Harm reduction vape badge
    const isCannabis = settings.addictionProfile === 'cannabis';
    const isNicotine = settings.addictionProfile === 'smoking';
    
    let hasVape = false;
    if (isCannabis) {
      hasVape = profileUsed.some(e => e.method === 'vape');
    } else if (isNicotine) {
      hasVape = profileUsed.some(e => e.substance === 'vape');
    }
    addBadge(hasVape, 'harm-reduction-vape');

    // Cannabis-specific badges
    if (isCannabis) {
      const cbdUsed = filterCBD(used);
      const thcUsed = filterTHC(used);
      addBadge(cbdUsed.length > 0 && thcUsed.length === 0, 'cbd-only');
      // Half CBD Day: THC (via calcBadAmount, mix counts 50%) is at most half of total
      const thcAmt = calcBadAmount(profileUsed, 'cannabis', null);
      addBadge(profileUsed.length > 0 && profileAmt > 0 && thcAmt * 2 <= profileAmt, 'half-cbd-day');
      addBadge(profileUsed.length > 0 && profileUsed.every(e => e.method === 'edible'), 'edibles-only');
    }

    // Vape-only badge (cannabis: method=vape, smoking: substance=vape)
    if (isCannabis) {
      // Edibles don't produce smoke, so they don't count against vape-only
      const nonEdible = profileUsed.filter(e => e.method !== 'edible');
      addBadge(nonEdible.length > 0 && nonEdible.every(e => e.method === 'vape'), 'vape-only');
    } else if (isNicotine) {
      addBadge(profileUsed.length > 0 && profileUsed.every(e => e.substance === 'vape'), 'vape-only');
    }

    addBadge(used.some(e => e.amount < 1), 'dose-half');
    addBadge(used.some(e => e.reason), 'mindful');

    // Light Day: used today, but less than half of trailing 7-day average
    const avg7DayAmount = avgDailyAmount(getLastNDays(7, 1), filterProfileUsed);
    addBadge(profileUsed.length > 0 && avg7DayAmount > 0 && profileAmt < (avg7DayAmount / 2), 'low-day');
    addBadge(profileUsed.length === 0, 'zero-use');

    // Microdose Day: total amount of 2 or less (must have used something)
    addBadge(profileUsed.length > 0 && profileAmt > 0 && profileAmt <= 2, 'microdose-day');

    // One Session: exactly one use event today
    addBadge(profileUsed.length === 1, 'one-session');

    // No Liquor Day: alcohol profile and no liquor uses (including zero-use days)
    const isAlcohol = settings.addictionProfile === 'alcohol';
    if (isAlcohol) {
      addBadge(!profileUsed.some(e => e.substance === 'liquor'), 'no-liquor');
    }

    // --- Habit-based badges ---
    const waterCount = getHabits(todayEvents, 'water').length;
    addBadge(waterCount >= 1, 'drank-water');
    addBadge(waterCount >= 5, 'hydrated');
    
    // Individual habit badges
    const hasExercise = habits.some(e => e.habit === 'exercise');
    addBadge(hasExercise, 'exercised');
    
    const hasBreaths = habits.some(e => e.habit === 'breaths');
    addBadge(hasBreaths, 'breathwork');
    
    const hasClean = habits.some(e => e.habit === 'clean');
    addBadge(hasClean, 'cleaned');
    
    const hasOutside = habits.some(e => e.habit === 'outside');
    addBadge(hasOutside, 'went-outside');
    
    const uniqueHabits = new Set(habits.map(e => e.habit));
    addBadge(uniqueHabits.size === 5, 'five-star-day');

    // --- Timing-based badges ---
    // Gap badges — include all sessions but skip gaps that cross the 6am boundary (sleep gap)
    if (profileUsed.length >= 1 || yesterdayProfileUsed.length > 0) {
      // Include last event from yesterday to capture gap crossing midnight
      const gapEvents = [...profileUsed];
      if (yesterdayProfileUsed.length > 0) {
        // Add the last event from yesterday to the beginning of the list
        gapEvents.unshift(yesterdayProfileUsed[yesterdayProfileUsed.length - 1]);
      }
      
      const todayGapsMs = getGapsMs(gapEvents);
      
      // Award only the highest gap milestone achieved today
      if (todayGapsMs.length > 0) {
        const maxGapHours = Math.max(...todayGapsMs) / 3600000;
        const milestones = getMilestoneBadges(maxGapHours, GAP_MILESTONES);
        if (milestones.length > 0) {
          addBadge(true, `gap-${milestones[0]}h`);
        }
      }
      
      // Today's average gap longer than trailing 7-day average (excludes today to prevent self-dampening)
      const avgGap7Days = avgWithinDayGapMs(getLastNDays(7, 1), filterProfileUsed);
      if (avgGap7Days > 0 && todayGapsMs.length > 0) {
        const todayAvgGap = todayGapsMs.reduce((s, g) => s + g, 0) / todayGapsMs.length;
        addBadge(todayAvgGap > avgGap7Days, 'gap-above-avg');
      }
    }

    // --- Time-of-day skip badges ---
    // completedDay=true means the day is over; treat all hours as past
    const currentHour = completedDay ? 24 : currentDate().getHours();
    const isPastEarlyHour = completedDay || currentHour >= EARLY_HOUR;
    const noUseInRange = (start, end) => !profileUsed.some(u => {
      const h = getHour(u.ts);
      return h >= start && h < end;
    });

    // On first day only: user must have started before the badge period to be eligible
    const isEligibleForSkipBadge = (end) => {
      if (!isFirstDay) return true; // After first day, always eligible
      
      // If they have historical use events, they're eligible for all skip badges
      if (hasHistoricalProfileUse) return true;
      
      // Otherwise, check if they started before the period end (original logic)
      // Use earliest of: app start time (same day) or first event on that day (whichever is earlier)
      const sameDayStartTs = (appStartDate === evaluationDate) ? appStartTs : null;
      let earliestTs = null;
      if (todayEvents.length > 0) {
        earliestTs = Math.min(...todayEvents.map(e => e.ts));
      }
      if (sameDayStartTs != null && (earliestTs == null || sameDayStartTs < earliestTs)) {
        earliestTs = sameDayStartTs;
      }
      if (earliestTs == null) return false; // Shouldn't happen, but stay safe
      const firstHour = getHour(earliestTs);
      return firstHour < end; // Must have started before the period end
    };

    const skipBadges = [
      { start: 0,  end: 6, id: 'night-skip' },
      { start: 6, end: 12, id: 'morning-skip' },
      { start: 12, end: 18, id: 'day-skip' },
      { start: 18, end: 24, id: 'evening-skip' },
    ];
    for (const { start, end, id } of skipBadges) {
      const eligible = isEligibleForSkipBadge(end);
      addBadge(eligible && currentHour >= start && noUseInRange(start, end), id);
    }
    
    // Good Night — overnight break crossing 6am boundary
    // Look for last use between 6pm yesterday and 6am today.
    // If found, check earliest use after 6am: if none (or completed day), award it.
    // If there is a use after 6am, the gap must be 12h+.
    const today6am = new Date(evaluationDate + 'T06:00:00').getTime();
    const yesterday6pm = today6am - 12 * 3600000; // 6pm previous day
    
    const allRecent = sortedByTime([...yesterdayProfileUsed, ...profileUsed]);
    
    // Find last use between 6pm yesterday and 6am today
    const lastOvernightUse = allRecent.filter(e => e.ts >= yesterday6pm && e.ts < today6am).pop();
    // Find earliest use after 6am today
    const firstAfter6am = allRecent.find(e => e.ts >= today6am);
    
    let hasNightGap = false;
    if (completedDay || currentHour >= EARLY_HOUR) {
      if (!lastOvernightUse) {
        // No use between 6pm–6am = automatic 12h+ gap overnight
        // But not on the first day (no overnight history yet)
        hasNightGap = !isFirstDay;
      } else if (firstAfter6am) {
        // Use after 6am — gap from overnight use must be 12h+
        hasNightGap = (firstAfter6am.ts - lastOvernightUse.ts) / 3600000 >= 12;
      } else {
        // Overnight use but no use after 6am — award it (gap is growing)
        hasNightGap = true;
      }
    }
    addBadge(hasNightGap, 'night-gap');

    // --- Comparison badges ---
    if (profileUsed.length > 0 && yesterdayProfileUsed.length > 0) {
      addBadge(profileAmt < sumAmount(yesterdayProfileUsed), 'lower-amount');
      
      // First session later than yesterday — only awarded if you used today (compares first use after 6am)
      const todayDaytime = filterDaytime(profileUsed);
      const yesterdayDaytime = filterDaytime(yesterdayProfileUsed);
      
      if (todayDaytime.length > 0 && yesterdayDaytime.length > 0) {
        addBadge(timeOfDayMin(todayDaytime[0].ts) > timeOfDayMin(yesterdayDaytime[0].ts), 'first-later');
      }
    }
    
    // Good Start badge - first event after early hour is a habit or resist (not use)
    if (isPastEarlyHour) {
      const daytimeEvents = filterDaytime(todayEvents);
      const firstDaytimeEvent = daytimeEvents[0];
      if (firstDaytimeEvent && (firstDaytimeEvent.type === 'habit' || firstDaytimeEvent.type === 'resisted')) {
        addBadge(true, 'good-start');
      }
    }

    // --- Streak badges ---
    const resistStreak = this._countStreak('resisted', refDateObj);
    addBadge(resistStreak >= 2, 'resist-streak');
    
    const habitStreak = this._countStreak('habit', refDateObj);
    addBadge(habitStreak >= 3, 'habit-streak');

    const taperDays = this._countTaper(refDateObj);
    addBadge(taperDays >= 2, 'taper');
    
    // App usage streaks - award only the highest milestone
    const appStreak = this._countAppUsageStreak(refDateObj);
    if (appStreak >= 2) {
      const milestones = getMilestoneBadges(appStreak, APP_STREAK_MILESTONES);
      if (milestones.length > 0) {
        const highestMilestone = milestones[0];
        // Map milestone values to badge IDs
        const badgeMap = { 2: 'app-streak', 7: 'week-streak', 30: 'month-streak', 365: 'year-streak' };
        addBadge(true, badgeMap[highestMilestone]);
      }
    }
    
    // Break milestones (time since last use)
    if (profileUsed.length === 0) {
      const daysSinceLastUse = this._countDaysSinceLastUse(evaluationDate, refTs, appStartDate);
      if (daysSinceLastUse >= 1) {
        // Award only the highest T-break milestone achieved
        const milestones = getMilestoneBadges(daysSinceLastUse, TBREAK_MILESTONES);
        if (milestones.length > 0) {
          const highestMilestone = milestones[0];
          addBadge(true, `tbreak-${highestMilestone}d`);
        }
      }
    }

    return badges;
  },

  _countStreak(eventType, refDateObj) {
    const d = new Date(refDateObj || currentDate());
    
    for (let streak = 0; streak < MAX_STREAK_DAYS; streak++) {
      if (!DB.forDate(dateKey(d)).some(e => e.type === eventType)) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_STREAK_DAYS;
  },

  _countTaper(refDateObj) {
    let count = 0, prevAmt = null;
    const d = new Date(refDateObj || currentDate());
    
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
  
  _countAppUsageStreak(refDateObj) {
    const MAX_APP_STREAK = 366; // Must exceed 365 for year-streak badge
    const d = new Date(refDateObj || currentDate());
    for (let streak = 0; streak < MAX_APP_STREAK; streak++) {
      const dayEvents = DB.forDate(dateKey(d));
      if (dayEvents.length === 0) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_APP_STREAK;
  },
  
  _countDaysSinceLastUse(refDateKey, refTs, fallbackAppStartDate) {
    const keys = DB.getAllDayKeys(); // sorted reverse (most recent first)
    const effectiveNow = refTs || now();

    for (const key of keys) {
      if (refDateKey && key > refDateKey) continue; // Skip days after reference date

      const dayUsed = filterProfileUsed(DB.forDate(key));
      if (dayUsed.length > 0) {
        return Math.floor((effectiveNow - dayUsed[dayUsed.length - 1].ts) / (1000 * 60 * 60 * 24));
      }
    }
    // No use events ever — measure from appStartDate if available
    let startTs;
    if (fallbackAppStartDate) {
      startTs = new Date(fallbackAppStartDate + 'T12:00:00').getTime();
    } else {
      const badgeData = loadBadgeData();
      if (badgeData.appStartDate) {
        startTs = new Date(badgeData.appStartDate + 'T12:00:00').getTime();
      }
    }

    if (startTs) {
      return Math.floor((effectiveNow - startTs) / (1000 * 60 * 60 * 24));
    }
    return 0;
  },
  
};

// ========== SHARED HTML BUILDERS ==========

function emptyStateHTML(message, extraClass) {
  const cls = extraClass ? ` ${extraClass}` : '';
  return `<div class="empty-state${cls}">${message}</div>`;
}

function tileHTML(val, label, sub = '', tooltip = '') {
  const subHTML = sub ? `<div class="sub">${escapeHTML(String(sub))}</div>` : '';
  const dataTooltip = tooltip ? ` data-tooltip="${escapeHTML(tooltip)}"` : '';
  return `<div class="tile"${dataTooltip}><div class="val">${escapeHTML(String(val))}</div><div class="label">${escapeHTML(String(label))}</div>${subHTML}</div>`;
}

/** Generates a labelled chip group. displayFn defaults to String(v). */
function chipGroupHTML(label, field, values, activeVal, displayFn) {
  const fmt = displayFn || (v => String(v));
  return `
    <div class="chip-row-label">${escapeHTML(label)}</div>
    <div class="chip-group" data-field="${field}">
      ${values.map(v => `<span class="chip${activeVal === v ? ' active' : ''}" data-val="${escapeHTML(String(v))}">${escapeHTML(String(fmt(v)))}</span>`).join('')}
    </div>`;
}

function getUsedEventDetail(evt) {
  // Find the profile that owns this substance (may differ from current profile for historical events)
  const { profile: matchedProfile } = getProfileForSubstance(evt.substance);
  
  const icon = matchedProfile.icons[evt.substance] || '⚡';
  const title = matchedProfile.substanceDisplay[evt.substance] || (evt.substance ? evt.substance.toUpperCase() : 'Unknown');
  const unit = matchedProfile.amountUnit;
  
  return {
    icon,
    title,
    detail: [
      // Only show method if it's still in the profile's active methods list
      matchedProfile.methods && evt.method && matchedProfile.methods.includes(evt.method)
        ? (matchedProfile.methodDisplay ? (matchedProfile.methodDisplay[evt.method] || evt.method) : evt.method)
        : null,
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
    <span class="tl-icon">${escapeHTML(icon)}</span>
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
let habitChipTimeout = null;
let currentChipHabit = null;
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
  if (activeTab === 'badges') renderBadges();
  else if (activeTab === 'graph') renderGraphs();
  else if (activeTab === 'history') renderDayHistory();
}

function renderDate() {
  $('header-date').textContent = _dateFormatter.format(currentDate());
  
  const usedLabel = $('used-label');
  if (usedLabel) usedLabel.textContent = 'Use';
  
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
    const elapsedMs = now() - lastUsedTs;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    
    sinceLastVal = formatDuration(elapsedMs);
    
    if (elapsedDays >= 1) {
      const lastUsedDate = new Date(lastUsedTs);
      const options = { month: 'short', day: 'numeric' };
      const dateStr = lastUsedDate.toLocaleDateString([], options);
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
  const profile = getProfile();
  const ratioMap = {
    cannabis: { badFilter: e => e.substance === 'thc' || e.substance === 'mix', ratioLabel: 'THC Ratio Today', substanceName: 'THC' },
    alcohol: { badFilter: e => e.substance === 'liquor', ratioLabel: 'Liquor Ratio Today', substanceName: 'Liquor' },
    smoking: { badFilter: e => e.substance === 'cigarette', ratioLabel: 'Cigarette Ratio Today', substanceName: 'Cigarette' },
    custom: { badFilter: e => e.substance === 'type1', ratioLabel: (profile.substanceDisplay?.type1 || 'Type 1') + ' Ratio Today', substanceName: profile.substanceDisplay?.type1 || 'Type 1' }
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
    const elapsedMs = now() - lastBadTs;
    sinceLastBadSub = `${formatDuration(elapsedMs)} Since Last ${config.substanceName}`;
  }

  return tileHTML(ratio, config.ratioLabel, sinceLastBadSub, `Ratio of primary substance today and time since last use`);
}

function renderMetrics() {
  const events   = DB.forDate(todayKey());
  const profile  = getProfile();
  const used     = filterProfileUsed(events);
  const totalAmt = sumAmount(used);

  const exerciseEvents = getHabits(events, 'exercise');
  const exerciseMins = exerciseEvents.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const allHabits = sumHabitCounts(events, Object.keys(HABIT_LABELS));
  
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

  // Show sessions today as subtitle for the first tile
  const sessionsSub = used.length > 0 ? `${used.length} Sessions` : '';

  $('metrics').innerHTML = [
    buildSinceLastUsedTile(used),
    tileHTML(totalAmt, capitalize(profile.amountUnit), sessionsSub, `Total amount used and number of sessions today`),
    buildTodayRatioTile(used),
    fourthTile
  ].join('');
}

function getRatioTile(weekUsed, dayKeys) {
  const settings = DB.loadSettings();
  const profile = getProfile();
  const ratioMap = {
    cannabis: { badFilter: e => e.substance === 'thc' || e.substance === 'mix', ratioLabel: 'THC Ratio', freeLabel: 'No THC Days' },
    alcohol: { badFilter: e => e.substance === 'liquor', ratioLabel: 'Liquor Ratio', freeLabel: 'No Liquor Days' },
    smoking: { badFilter: e => e.substance === 'cigarette', ratioLabel: 'Cigarette Ratio', freeLabel: 'No Cigarette Days' },
    custom: { badFilter: e => e.substance === 'type1', ratioLabel: (profile.substanceDisplay?.type1 || 'Type 1') + ' Ratio', freeLabel: 'No ' + (profile.substanceDisplay?.type1 || 'Type 1') + ' Days' }
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
    let earliestTs = allEvents[0].ts;
    for (let i = 1; i < allEvents.length; i++) {
      if (allEvents[i].ts < earliestTs) earliestTs = allEvents[i].ts;
    }
    const daysSinceFirstUse = Math.ceil((now() - earliestTs) / (24 * 60 * 60 * 1000));
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
  const weekHabits = sumHabitCounts(thisWeek.events, Object.keys(HABIT_LABELS));
  
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
    tileHTML(avgGapStr, 'Average Gap', longestGapSub, 'Average time between sessions and longest gap (excludes gaps crossing 6am)'),
    tileHTML(dailyAmountAvg, `${capitalize(getProfile().amountUnit)}/Day`, hitsSub, 'Average amount used and average sessions per day'),
    ratioTile,
    fourthTile
  ].join('');
}

function badgeCardHTML(w, showCount = true) {
  const unearnedClass = w.count === 0 ? ' unearned' : '';
  const badgeHTML = showCount ? `<span class="badge-card">${w.count}</span>` : '';
  return `<li class="badge-item${unearnedClass}" data-tooltip="${escapeHTML(w.desc || '')}">${badgeHTML}<div class="badge-icon">${w.icon}</div><div class="badge-label">${escapeHTML(w.label)}</div></li>`;
}

function calculateAndUpdateBadges() {
  const badgeData = loadBadgeData();
  const today = todayKey();
  const isSameDay = badgeData.todayDate === today;

  // Derive app start timestamp/date from current events only.
  // Always revalidated — never carried over from storage — so deleted events
  // can't leave a stale anchor that inflates t-break badges.
  let appStartTs;
  const allEvents = DB.loadEvents();
  if (allEvents.length > 0) {
    appStartTs = Math.min(...allEvents.map(e => e.ts));
  } else {
    appStartTs = now();
  }
  const appStartDate = dateKey(appStartTs);
  
  // Step 1: If it's a new day, add yesterday's badges to lifetime before clearing
  const lifetimeMap = new Map();
  badgeData.lifetimeBadges.forEach(w => {
    lifetimeMap.set(w.id, w.count);
  });
  
  // Save yesterday's badges before clearing
  let yesterdayBadges = [];
  if (!isSameDay && badgeData.todayBadges && badgeData.todayDate) {
    // New day detected — recalculate previous day's badges as a completed day
    // so time-of-day skip badges (day-skip, evening-skip, etc.) are properly awarded
    const prevDayEvents = DB.forDate(badgeData.todayDate);
    const dayBeforePrevDate = new Date(badgeData.todayDate + 'T12:00:00');
    dayBeforePrevDate.setDate(dayBeforePrevDate.getDate() - 1);
    const dayBeforePrevEvents = DB.forDate(dateKey(dayBeforePrevDate));
    const recalcIds = Badges.calculate(prevDayEvents, dayBeforePrevEvents, {
      completedDay: true,
      forDate: badgeData.todayDate,
      appStartDate,
      appStartTs
    });
    // Carry over undo-driven badge for the prior day
    if ((badgeData.todayUndoCount || 0) > 0) recalcIds.push('second-thought');
    const recalcBadges = [...new Set(recalcIds)].map(id => ({ id, count: 1 }));

    // Merge recalculated (complete-day) badges into lifetime
    recalcBadges.forEach(w => {
      const current = lifetimeMap.get(w.id) || 0;
      lifetimeMap.set(w.id, current + w.count);
    });
    
    // Calculate how many days have passed since last session
    const lastDate = new Date(badgeData.todayDate + 'T12:00:00');
    const currentDateObj = new Date(today + 'T12:00:00');
    const daysPassed = Math.floor((currentDateObj - lastDate) / (24 * 60 * 60 * 1000));
    
    // Only save as "yesterday's" if exactly 1 day has passed
    if (daysPassed === 1) {
      yesterdayBadges = [...recalcBadges];
    }
    // If daysPassed > 1, yesterdayBadges stays empty (cleared)
  } else if (isSameDay) {
    // Same day - keep existing yesterday's badges
    yesterdayBadges = badgeData.yesterdayBadges || [];
  }
  // If new day but no badgeData.todayDate (first time), yesterdayBadges stays empty
  
  // Step 2: Calculate fresh today's badges
  const todayEvents = DB.forDate(today);
  const yesterdayEvents = DB.forDate(daysAgoKey(1));
  const freshTodayIds = Badges.calculate(todayEvents, yesterdayEvents, {
    appStartDate,
    appStartTs
  });
  
  // Add undo badges (tracked separately since undos aren't events)
  const undoCount = isSameDay ? (badgeData.todayUndoCount || 0) : 0;
  if (undoCount > 0) freshTodayIds.push('second-thought');
  
  // Today's badges: max 1 per badge type (deduplicate)
  const uniqueTodayIds = [...new Set(freshTodayIds)];
  const freshTodayBadges = uniqueTodayIds.map(id => ({ id, count: 1 }));
  
  // Step 3: Convert lifetime map to array (today's badges NOT included)
  const updatedLifetimeBadges = Array.from(lifetimeMap.entries())
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => {
      const defA = getBadgeDef(a.id);
      const defB = getBadgeDef(b.id);
      return defA.label.localeCompare(defB.label);
    });
  
  const updatedBadgeData = {
    todayDate: today,
    todayBadges: freshTodayBadges,
    yesterdayBadges: yesterdayBadges,
    lifetimeBadges: updatedLifetimeBadges,
    todayUndoCount: undoCount,
    appStartDate,
    appStartTs
  };
  
  saveBadgeData(updatedBadgeData);
  return updatedBadgeData;
}

function renderBadges() {
  const badgeData = calculateAndUpdateBadges();
  
  const todayEl = $('badges-today');
  if (todayEl) {
    // Get earned badges
    const earnedBadges = badgeData.todayBadges
      .map(w => ({ ...w, ...getBadgeDef(w.id) }))
      .filter(w => BADGE_DEFINITIONS[w.id]) // Filter out unknown badges
      .sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    // Get unearned badges (all badges not in earned list)
    const earnedIds = new Set(earnedBadges.map(w => w.id));
    let unearnedBadges = Object.keys(BADGE_DEFINITIONS)
      .filter(id => !earnedIds.has(id))
      .map(id => ({ id, count: 0, ...getBadgeDef(id) }));
    
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
    
    unearnedBadges = unearnedBadges.filter(w => {
      // Filter out sequential badges that aren't the next in sequence
      if (gapSequence.includes(w.id)) return allowedGaps.has(w.id);
      if (breakSequence.includes(w.id)) return allowedBreaks.has(w.id);
      if (appStreakSequence.includes(w.id)) return allowedAppStreaks.has(w.id);
      
      // Filter out profile-specific badges for today's unearned
      if (w.id === 'welcome-back') return false; // Can't earn it today
      if (w.id === 'harm-reduction-vape' && currentProfile !== 'cannabis' && currentProfile !== 'smoking') return false;
      if (w.id === 'cbd-only' && currentProfile !== 'cannabis') return false;
      if (w.id === 'half-cbd-day' && currentProfile !== 'cannabis') return false;
      if (w.id === 'edibles-only' && currentProfile !== 'cannabis') return false;
      if (w.id === 'vape-only' && currentProfile !== 'cannabis' && currentProfile !== 'smoking') return false;
      
      return true;
    });
    
    unearnedBadges.sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    // Today's badges: only show earned badges
    todayEl.innerHTML = earnedBadges.length > 0
      ? earnedBadges.map(w => badgeCardHTML(w, false)).join('') + 
        '<div class="empty-state badge-hint">Daily badges update based on your activity.</div>'
      : '';
  }

  // Render yesterday's badges
  const yesterdayEl = $('badges-yesterday');
  if (yesterdayEl) {
    const yesterdayBadges = badgeData.yesterdayBadges
      .map(w => ({ ...w, ...getBadgeDef(w.id) }))
      .filter(w => BADGE_DEFINITIONS[w.id])
      .sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    yesterdayEl.innerHTML = yesterdayBadges.length > 0
      ? yesterdayBadges.map(w => badgeCardHTML(w, false)).join('') + 
        '<div class="empty-state badge-hint">These are badges you earned yesterday and won\'t change.</div>'
      : '<div class="empty-state badge-hint">No badges earned yesterday.</div>';
  }

  const totalEl = $('badges-total');
  if (!totalEl) return;
  
  // Get earned lifetime badges
  const earnedLifetime = badgeData.lifetimeBadges
    .map(w => ({ ...w, ...getBadgeDef(w.id) }))
    .filter(w => BADGE_DEFINITIONS[w.id])
    .sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
  
  // Get unearned badges (show ALL for lifetime)
  const earnedLifetimeIds = new Set(earnedLifetime.map(w => w.id));
  const unearnedLifetime = Object.keys(BADGE_DEFINITIONS)
    .filter(id => !earnedLifetimeIds.has(id))
    .map(id => ({ id, count: 0, ...getBadgeDef(id) }))
    .sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
  
  const allLifetime = [...earnedLifetime, ...unearnedLifetime];
  totalEl.innerHTML = allLifetime.map(w => badgeCardHTML(w, true)).join('') + 
    '<div class="empty-state badge-hint">Every badge you\'ve earned will accumulate here.</div>';
}

function hasRecentWater() {
  const cutoff = now() - TWO_HOURS_MS;
  const today = DB.forDate(todayKey());
  const yesterday = DB.forDate(daysAgoKey(1));
  return [...today, ...yesterday].some(e => e.type === 'habit' && e.habit === 'water' && e.ts >= cutoff);
}

function renderWaterReminder() {
  const reminderEl = $('water-reminder');
  if (!reminderEl) return;
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
    ? `<div class="history-summary">${summaryParts.join(' • ')}</div>`
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
    html += `<div class="load-more-wrap">
      <button class="load-more-btn" onclick="App.loadMoreHistory()">
        Show ${Math.min(remaining, HISTORY_PAGE_SIZE)} more (${remaining} remaining)
      </button>
    </div>`;
  }
  
  // Clear Day button
  html += `<button class="action-btn danger-btn" id="clear-day-btn" onclick="App.clearDay()">🗑️ Clear Day</button>`;

  historyEl.innerHTML = html;
}

function loadMoreHistory() {
  historyShowCount += HISTORY_PAGE_SIZE;
  renderDayHistory();
}

function navigateDay(offset) {
  const allKeys = DB.getAllDayKeys(); // sorted reverse (newest first)
  
  if (offset < 0) {
    // Going back — find the nearest earlier day with events
    const earlier = allKeys.find(k => k < currentHistoryDay);
    if (!earlier) return; // no earlier days with data
    currentHistoryDay = earlier;
  } else {
    // Going forward — find the nearest later day with events, capped at today
    const today = todayKey();
    const later = [...allKeys].reverse().find(k => k > currentHistoryDay && k <= today);
    if (!later) {
      // No later day with events — jump to today if we're not already there
      if (currentHistoryDay >= today) return;
      currentHistoryDay = today;
    } else {
      currentHistoryDay = later;
    }
  }
  
  historyShowCount = HISTORY_PAGE_SIZE;
  renderDayHistory();
}

// ========== GRAPHS ==========
const GRAPH_DEFS = [
  { label: '⚡ Amount Used / Day',    color: '#f39c12',  valueFn: evs => sumAmount(filterProfileUsed(evs)), activity: false, tooltip: 'Total amount used each day. Lower bars mean less usage.' },
  { label: '💪 Resists / Day',    color: 'var(--resist)',  valueFn: evs => filterByType(evs, 'resisted').reduce((sum, e) => sum + (e.intensity || 1), 0), activity: false, tooltip: 'Total urge intensity resisted each day. Higher bars mean stronger urges resisted.' },
  { label: '💧 Water / Day', color: '#9c6fd4',  valueFn: evs => getHabits(evs, 'water').length, activity: true, tooltip: 'Number of water uses logged each day. Staying hydrated supports recovery.' },
  { label: '🏃 Exercise Minutes / Day', color: '#e6cc22',  valueFn: evs => getHabits(evs, 'exercise').reduce((s, e) => s + (e.minutes || 0), 0), activity: true, habitType: 'exercise', tooltip: 'Exercise minutes each day. Physical activity helps manage cravings.',
    countFn: evs => getHabits(evs, 'exercise').length, countLabel: '🏃 Exercise / Day', countTooltip: 'Number of exercise sessions each day.' },
  { label: '🌬️ Mindfulness Minutes / Day', color: '#5a9fd4',  valueFn: evs => getHabits(evs, 'breaths').reduce((s, e) => s + (e.minutes || 0), 0), activity: true, habitType: 'breaths', tooltip: 'Mindfulness/breathing minutes each day. Helps with stress and urges.',
    countFn: evs => getHabits(evs, 'breaths').length, countLabel: '🌬️ Mindfulness / Day', countTooltip: 'Number of mindfulness sessions each day.' },
  { label: '🧹 Cleaning Minutes / Day', color: '#8d6e63',  valueFn: evs => getHabits(evs, 'clean').reduce((s, e) => s + (e.minutes || 0), 0), activity: true, habitType: 'clean', tooltip: 'Cleaning or tidying minutes each day. Keeping busy is a great distraction.',
    countFn: evs => getHabits(evs, 'clean').length, countLabel: '🧹 Cleaning / Day', countTooltip: 'Number of cleaning or tidying sessions each day.' },
  { label: '🌳 Outside Minutes / Day', color: '#43a047',  valueFn: evs => getHabits(evs, 'outside').reduce((s, e) => s + (e.minutes || 0), 0), activity: true, habitType: 'outside', tooltip: 'Time spent outside each day. Fresh air and nature can help reset your mood.',
    countFn: evs => getHabits(evs, 'outside').length, countLabel: '🌳 Outside / Day', countTooltip: 'Number of times you went outside each day.' },
];

function formatGraphValue(val) {
  if (val <= 0) return '';
  return Number.isInteger(val) ? val : val.toFixed(1);
}

/** Pick a nice round interval and round max up to the next multiple */
function calcGridScale(max) {
  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  let interval = 1;
  for (const s of niceSteps) {
    if (max / s <= 5) { interval = s; break; }
  }
  const gridMax = Math.ceil(max / interval) * interval || max;
  return { interval, gridMax };
}

/** Pick nice round grid-line intervals based on max value. Returns [{value, px}] */
function calcGridLines(max) {
  if (max <= 0) return [];
  const BAR_HEIGHT = 96; // must match the px used in bar height calc
  const { interval, gridMax } = calcGridScale(max);
  const lines = [];
  for (let v = 0; v <= gridMax; v += interval) {
    lines.push({ value: v, px: Math.round((v / gridMax) * BAR_HEIGHT) });
  }
  return lines;
}

/** Build the y-axis labels + dashed gridlines HTML */
function gridHTML(lines) {
  if (!lines.length) return { yAxis: '', overlayLines: '' };
  let yAxis = '';
  let overlayLines = '';
  for (const l of lines) {
    overlayLines += `<span class="g-gridline" style="bottom:${l.px}px"></span>`;
    // Show label for all lines except zero (baseline is obvious)
    if (l.value > 0) {
      const label = formatGraphValue(l.value);
      yAxis += `<span class="gy-label" style="bottom:${l.px}px">${label}</span>`;
    }
  }
  return { yAxis, overlayLines };
}

function graphBarCol(val, height, label, showLabel) {
  const labelStyle = showLabel ? '' : 'visibility:hidden';
  const barStyle = `height:${height}px;background:${label.color};${val > 0 ? 'min-height:2px' : ''}`;
  return `<div class="graph-bar-col">
    <div class="graph-bar" style="${barStyle}"></div>
    <div class="graph-bar-label" style="${labelStyle}">${label.text}</div>
  </div>`;
}

function wrapBarsWithGrid(barsInnerHTML, max) {
  const lines = calcGridLines(max);
  const g = gridHTML(lines);
  const yAxisDiv = lines.length
    ? `<div class="gy-axis">${g.yAxis}</div>`
    : '';
  const gridOverlay = lines.length
    ? `<div class="g-gridlines">${g.overlayLines}</div>`
    : '';
  return `<div class="graph-with-grid">${yAxisDiv}<div class="graph-bars">${gridOverlay}${barsInnerHTML}</div></div>`;
}

function buildGraphBars(vals, days, max, def) {
  const effectiveMax = max > 0 ? calcGridScale(max).gridMax : 0;
  let inner = '';
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const h = effectiveMax > 0 ? Math.round((v / effectiveMax) * 96) : 0;
    const dayLabel = days[i].slice(5);
    
    // Show fewer labels for longer date ranges to prevent overlap
    let showLabel;
    if (graphDays <= 14) {
      showLabel = true; // Show all labels for 7-14 days
    } else if (graphDays <= 30) {
      showLabel = i % 4 === 0; // Show every 4th label (8 labels for 30 days)
    } else {
      showLabel = i % 10 === 0; // Show every 10th label (6 labels for 60 days)
    }
    
    inner += graphBarCol(v, h, { color: def.color, text: dayLabel }, showLabel);
  }
  return wrapBarsWithGrid(inner, max);
}

function buildHourGraphBars(hourCounts, max, color, startHour = 0) {
  const effectiveMax = max > 0 ? calcGridScale(max).gridMax : 0;
  let inner = '';
  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    const count = hourCounts[hour] || 0;
    const h = effectiveMax > 0 ? Math.round((count / effectiveMax) * 96) : 0;
    const hourLabel = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
    inner += graphBarCol(count, h, { color, text: hourLabel }, i % 3 === 0);
  }
  return wrapBarsWithGrid(inner, max);
}

function buildWeekSummaryHTML() {
  const days = getLastNDays(7);
  const profile = getProfile();
  const _weekdayFmt = new Intl.DateTimeFormat([], { weekday: 'short' });

  // Pre-compute per-day data
  const dayData = days.map(dayKey => {
    const d = new Date(dayKey + 'T12:00:00');
    const events = DB.forDate(dayKey);
    const used = filterProfileUsed(events);
    const resisted = filterByType(events, 'resisted');
    const habits = getHabits(events);
    // Substance amounts
    const bySubstance = {};
    used.forEach(e => {
      const sub = e.substance || 'unknown';
      bySubstance[sub] = (bySubstance[sub] || 0) + (e.amount ?? 1);
    });
    // Resist total
    const resistTotal = resisted.reduce((sum, e) => sum + (e.intensity || 1), 0);
    // Activity totals
    const actTotals = {};
    for (const act of Object.keys(HABIT_LABELS)) {
      const actEvents = habits.filter(e => e.habit === act);
      if (actEvents.length === 0) continue;
      const anyHaveMin = actEvents.some(e => e.minutes > 0);
      const totalMin = anyHaveMin
        ? actEvents.reduce((s, e) => s + ((e.minutes > 0) ? e.minutes : 5), 0)
        : 0;
      actTotals[act] = totalMin > 0 ? `${totalMin}m` : `${actEvents.length}`;
    }
    return {
      dayKey,
      dayLabel: dayKey === todayKey() ? 'Today' : _weekdayFmt.format(d),
      dayNum: d.getDate(),
      bySubstance,
      hasUse: used.length > 0,
      resistTotal,
      actTotals
    };
  });

  let html = '<div class="graph-container" data-tooltip="Daily snapshot of the past week. Shows usage by type, resists, and healthy activities for each day. A 🏅 means no usage that day. Untimed activities rounded up to 5 minutes each."><div class="graph-title">📅 Past 7 Day Summary</div>';
  html += '<div class="week-table">';

  // Header row: day names
  html += '<div class="week-row week-header-row"><div class="week-row-label"></div>';
  for (const dd of dayData) html += `<div class="week-cell week-col-head">${escapeHTML(dd.dayLabel)}</div>`;
  html += '</div>';

  // Date row
  html += '<div class="week-row week-date-row"><div class="week-row-label"></div>';
  for (const dd of dayData) html += `<div class="week-cell week-col-date">${dd.dayNum}</div>`;
  html += '</div>';

  // Data rows use week-data-row class for alternating stripe
  let dataRowIdx = 0;

  // Star row: 🏅 for clean days (no usage at all) — shown first
  const hasAnyCleanDay = dayData.some(dd => !dd.hasUse);
  if (hasAnyCleanDay) {
    html += `<div class="week-row week-data-row ${dataRowIdx++ % 2 ? '' : 'week-row-alt'}"><div class="week-row-label"></div>`;
    for (const dd of dayData) {
      html += dd.hasUse
        ? '<div class="week-cell"></div>'
        : '<div class="week-cell week-star">🏅</div>';
    }
    html += '</div>';
  }

  // Substance rows — one per substance, only if any day has it
  for (const sub of profile.substances) {
    const hasAny = dayData.some(dd => dd.bySubstance[sub] > 0);
    if (!hasAny) continue;
    const icon = profile.icons[sub] || '⚡';
    html += `<div class="week-row week-data-row ${dataRowIdx++ % 2 ? '' : 'week-row-alt'}"><div class="week-row-label">${icon}</div>`;
    for (const dd of dayData) {
      const amt = dd.bySubstance[sub];
      if (amt > 0) {
        const displayAmt = Number.isInteger(amt) ? amt : amt.toFixed(1);
        html += `<div class="week-cell week-val">${displayAmt}</div>`;
      } else {
        html += '<div class="week-cell"></div>';
      }
    }
    html += '</div>';
  }

  // Resist row
  const hasAnyResist = dayData.some(dd => dd.resistTotal > 0);
  if (hasAnyResist) {
    html += `<div class="week-row week-data-row ${dataRowIdx++ % 2 ? '' : 'week-row-alt'}"><div class="week-row-label">💪</div>`;
    for (const dd of dayData) {
      if (dd.resistTotal > 0) {
        const display = Number.isInteger(dd.resistTotal) ? dd.resistTotal : dd.resistTotal.toFixed(1);
        html += `<div class="week-cell week-val">${display}</div>`;
      } else {
        html += '<div class="week-cell"></div>';
      }
    }
    html += '</div>';
  }

  // Activity rows — one per type, only if any day has it
  for (const act of Object.keys(HABIT_LABELS)) {
    const hasAny = dayData.some(dd => dd.actTotals[act]);
    if (!hasAny) continue;
    const icon = HABIT_ICONS[act] || '✅';
    html += `<div class="week-row week-data-row ${dataRowIdx++ % 2 ? '' : 'week-row-alt'}"><div class="week-row-label">${icon}</div>`;
    for (const dd of dayData) {
      const val = dd.actTotals[act];
      html += val
        ? `<div class="week-cell week-val">${val}</div>`
        : '<div class="week-cell"></div>';
    }
    html += '</div>';
  }

  html += '</div></div>'; // close week-table, graph-container
  return html;
}

function renderGraphs() {
  const days = getLastNDays(graphDays);
  const hourContainer = $('hour-graphs');
  const dayContainer = $('graph-content');

  // Hour graphs (not affected by day selector)
  let hourHtml = '';

  // Add past 24 hours usage by hour graph
  // Align window to clock-hour boundaries so each clock hour maps to exactly one bar
  const nowMs = now();
  const currentHour = new Date(nowMs).getHours();
  const startOfCurrentHour = new Date(nowMs);
  startOfCurrentHour.setMinutes(0, 0, 0);
  const past24Hours = startOfCurrentHour.getTime() - (23 * 60 * 60 * 1000);
  const allEvents = DB.loadEvents();
  const past24Used = filterProfileUsed(allEvents.filter(evt => evt.ts >= past24Hours && evt.ts <= nowMs));
  const hourCounts = {};
  past24Used.forEach(evt => {
    const hour = getHour(evt.ts);
    hourCounts[hour] = (hourCounts[hour] || 0) + (evt.amount ?? 1);
  });
  const hasHourData = past24Used.length > 0;
  const maxCount = hasHourData ? Math.max(...Object.values(hourCounts), 1) : 1;
  const graphStartHour = (currentHour + 1) % 24;
  hourHtml += `<div class="graph-container" data-tooltip="Shows your use over the past 24 hours, broken down by hour. Helps identify your peak usage times."><div class="graph-title">🕒 Usage Over Past 24 Hours</div>`;
  hourHtml += hasHourData
    ? buildHourGraphBars(hourCounts, maxCount, 'var(--primary)', graphStartHour)
    : emptyStateHTML('No data yet', 'compact');
  hourHtml += `</div>`;

  // Add 7-day summary grid
  hourHtml += buildWeekSummaryHTML();
  
  hourContainer.innerHTML = hourHtml;
  
  // Day-based graphs (affected by 7/14/30 day selector)
  let dayHtml = '';

  // Render average usage by hour first (filtered by selected time window)
  const hourTotals = {};
  let daysWithUse = 0;
  
  days.forEach(dayKey => {
    const dayUsed = filterProfileUsed(DB.forDate(dayKey));
    if (dayUsed.length > 0) {
      daysWithUse++;
      dayUsed.forEach(evt => {
        const hour = getHour(evt.ts);
        hourTotals[hour] = (hourTotals[hour] || 0) + (evt.amount ?? 1);
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
  dayHtml += `<div class="graph-container" data-tooltip="Your average hourly usage across days you used. Reveals your habitual usage patterns."><div class="graph-title">⚡ Average Usage by Hour</div>`;
  dayHtml += hasHeatmapData
    ? buildHourGraphBars(hourAverages, maxAvg, '#e53935')
    : emptyStateHTML('No data yet', 'compact');
  dayHtml += `</div>`;
  
  // Render all GRAPH_DEFS graphs
  for (let gi = 0; gi < GRAPH_DEFS.length; gi++) {
    const def = GRAPH_DEFS[gi];
    let vals = days.map(dk => def.valueFn(DB.forDate(dk)));
    let max  = Math.max(...vals, 1);
    let hasData = vals.some(v => v > 0);
    let label = def.label;
    let tooltip = def.tooltip;

    // For activity graphs: if some events have minutes and some don't,
    // round up events without minutes to 5min for a more accurate view
    let didRoundUp = false;
    if (def.activity && def.habitType && def.countFn) {
      let anyHaveMinutes = false;
      let anyMissingMinutes = false;
      for (const dk of days) {
        const habits = getHabits(DB.forDate(dk), def.habitType);
        if (habits.some(e => e.minutes > 0)) anyHaveMinutes = true;
        if (habits.some(e => !e.minutes)) anyMissingMinutes = true;
        if (anyHaveMinutes && anyMissingMinutes) break;
      }
      if (anyHaveMinutes) {
        vals = days.map(dk => {
          const habits = getHabits(DB.forDate(dk), def.habitType);
          return habits.reduce((s, e) => s + ((e.minutes > 0) ? e.minutes : 5), 0);
        });
        max = Math.max(...vals, 1);
        hasData = vals.some(v => v > 0);
        didRoundUp = anyMissingMinutes;
      }
    }

    // For activity graphs with no minutes data, fall back to event count
    if (def.activity && !hasData && def.countFn) {
      vals = days.map(dk => def.countFn(DB.forDate(dk)));
      max = Math.max(...vals, 1);
      hasData = vals.some(v => v > 0);
      label = def.countLabel || def.label;
      tooltip = def.countTooltip || def.tooltip;
    }

    // For activity graphs, skip rendering if no data at all
    if (def.activity && !hasData) continue;

    if (didRoundUp) tooltip = (tooltip ? tooltip + ' ' : '') + 'Untimed activities rounded up to 5 minutes each.';
    const tipAttr = tooltip ? ` data-tooltip="${escapeHTML(tooltip)}"` : '';
    dayHtml += `<div class="graph-container"${tipAttr}><div class="graph-title">${label}</div>`;
    dayHtml += hasData 
      ? buildGraphBars(vals, days, max, def)
      : emptyStateHTML('No data yet', 'compact');
    dayHtml += `</div>`;
  }
  
  dayContainer.innerHTML = dayHtml;
}

// ========== BACK BUTTON NAVIGATION ==========
// Single guard entry in history. Back = cancel/close the topmost layer.
// After every back press, re-push the guard via setTimeout+pushState.
// pushState clears forward entries, so the forward button stays grayed out.

let _navGuardActive = false;

/** Push a single guard entry so the back button can be intercepted */
function navGuard() {
  if (!_navGuardActive) {
    _navGuardActive = true;
    history.pushState({ lentando: true }, '');
  }
}

/** Close the topmost overlay/modal/tab. Returns true if something was closed. */
function navHandleBack() {
  // Onboarding flow overlay — go back one step or close
  if (!$('onboarding-flow-overlay').classList.contains('hidden')) {
    if (_onboardingFlowStep > 0) {
      _onboardingFlowStep--;
      showOnboardingFlowStep();
    } else {
      // On first step, skip to finish
      finishOnboardingFlow();
    }
    return true;
  }
  // Custom config overlay
  if (!$('custom-config-overlay').classList.contains('hidden')) {
    $('custom-config-overlay').classList.add('hidden');
    // If opened from settings, return to settings tab
    if (customConfigFromSettings) {
      switchTab('settings');
      return true;
    }
    // Fall through to close onboarding too (if open) and go to Today
  }
  // Onboarding overlay
  if (!$('onboarding-overlay').classList.contains('hidden')) {
    if (_previousProfile) {
      // Changing tracking — restore previous profile
      const settings = DB.loadSettings();
      settings.addictionProfile = _previousProfile;
      DB._settings = settings;
      DB.saveSettings();
      _previousProfile = null;
      $('onboarding-overlay').classList.add('hidden');
      switchTab('today');
      return true;
    }
    // First-time onboarding — default to custom profile and enter app
    const settings = DB.loadSettings();
    if (!settings.addictionProfile) {
      settings.addictionProfile = 'custom';
      settings.lastSubstance = 'type1';
      settings.lastAmount = 1.0;
      DB._settings = settings;
      DB.saveSettings();
      $('onboarding-overlay').classList.add('hidden');
      calculateAndUpdateBadges();
      bindEvents();
      render();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
      return true;
    }
    return true; // consume the event to prevent leaving
  }
  // Login overlay — go back to landing page
  if (!$('login-overlay').classList.contains('hidden')) {
    hideLoginScreen();
    showLandingPage();
    return true;
  }
  // In-app: close everything and go to Today
  if (!$('modal-overlay').classList.contains('hidden')) {
    closeModal();
  }
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab && activeTab !== 'today') {
    switchTab('today');
    return true;
  }
  return false;
}

window.addEventListener('popstate', () => {
  if (!_appStarted) return;

  _navGuardActive = false; // guard was consumed by this back press
  navHandleBack();

  // Re-push the guard. pushState clears forward entries, keeping the
  // forward button grayed out. Deferred so it runs outside the popstate handler.
  setTimeout(() => navGuard(), 0);
});

// ========== TAB SWITCHING ==========
function switchTab(tabName) {
  // When switching away, just visually hide the undo button (don't clear the event ID)
  // When switching back to today during cooldown, restore it
  if (tabName === 'today') {
    // Restore undo button visibility when switching back to today tab
    if (lastUndoEventId) {
      showUndo(lastUndoEventId);
    }
  } else {
    // Only remove the CSS class, preserve lastUndoEventId so we can restore on return
    const row = $('used-row');
    if (row) row.classList.remove('has-undo');
  }
  hideUsedChips();
  hideResistedChips();
  hideHabitChips();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
  
  // Mount/unmount auth form to prevent browser autofill on other inputs
  if (window.FirebaseSync) {
    if (tabName === 'settings') FirebaseSync.mountAuthForm();
    else FirebaseSync.unmountAuthForm();
  }
  
  if (tabName === 'badges') renderBadges();
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
  const badgeData = loadBadgeData();
  const clearedAt = parseInt(localStorage.getItem(STORAGE_CLEARED_AT) || '0', 10);
  const data = { 
    events: DB.loadEvents(), 
    settings: DB.loadSettings(), 
    todos: loadTodos(),
    lifetimeBadges: badgeData.lifetimeBadges,
    clearedAt: clearedAt || undefined,
    exportedAt: currentDate().toISOString() 
  };
  downloadFile(JSON.stringify(data, null, 2), 'lentando-' + todayKey() + '.json', 'application/json');
}

async function clearDatabase() {
  const isLoggedIn = window.FirebaseSync && FirebaseSync.getUser();
  const msg = isLoggedIn
    ? '⚠️ This will permanently delete ALL local AND cloud data and reset settings. This cannot be undone.\n\nAre you sure?'
    : '⚠️ This will permanently delete ALL events and reset settings. This cannot be undone.\n\nAre you sure?';
  if (!confirm(msg)) return;

  // Record the clear timestamp BEFORE wiping — this single timestamp replaces
  // per-event tombstones. During merge, any event whose uid was created at or
  // before this timestamp gets discarded. O(1) storage vs O(n) tombstones.
  const clearedAt = now();

  clearAllStorage();

  // Only persist clearedAt when logged in — it needs to propagate to cloud
  // so other devices discard old events. For local-only users, a full wipe
  // is sufficient and leaving clearedAt behind would block future imports.
  if (isLoggedIn) {
    safeSetItem(STORAGE_CLEARED_AT, String(clearedAt));
  }

  // Push cleared state + clearedAt to cloud so other devices pick it up
  if (isLoggedIn && window.FirebaseSync) {
    try {
      await FirebaseSync.pushNow();
    } catch (_e) {
      alert('⚠️ Local data was cleared, but we could not clear your cloud data. Next time you sign in, your old data may reappear. Please try syncing again when you have a connection.');
    }
  }
  location.reload();
}

let _previousProfile = null; // saved when changeAddiction opens onboarding

function changeAddiction() {
  if (!confirm('🔄 Change what you\'re tracking?\n\nYour data will be kept, but tracked substance will change. Continue?')) return;
  const settings = DB.loadSettings();
  _previousProfile = settings.addictionProfile; // save for back button restore
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
  const SAFE_ID = /^[a-z0-9-]+$/;
  const MIN_TS = new Date('2000-01-01T00:00:00Z').getTime();
  const MAX_TS = Date.now() + (365 * 24 * 60 * 60 * 1000); // one year in the future

  const validEvents = [];
  for (const raw of data.events) {
    if (!raw || !raw.id || !raw.type) continue;
    const ts = Number(raw.ts);
    if (!Number.isFinite(ts) || ts < MIN_TS || ts > MAX_TS) continue;

    const evt = { ...raw, ts };
    // Sanitize IDs — regenerate any with characters outside safe set to prevent injection
    if (typeof evt.id !== 'string' || !SAFE_ID.test(evt.id)) evt.id = uid();
    validEvents.push(evt);
  }

  if (validEvents.length === 0) {
    return { valid: false, error: '❌ No valid events with usable timestamps found in file.' };
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

      // When importing, reset clearedAt so pre-clear events aren't blocked.
      // The user is explicitly choosing to restore data — honour that intent.
      // If the import file carries its own clearedAt, adopt it; otherwise clear it.
      const importedClearedAt = parseInt(data.clearedAt, 10) || 0;
      if (importedClearedAt > 0) {
        safeSetItem(STORAGE_CLEARED_AT, String(importedClearedAt));
      } else {
        localStorage.removeItem(STORAGE_CLEARED_AT);
      }
      // Invalidate cache so loadEvents() re-reads with updated clearedAt
      DB._events = null;
      DB._dateIndex = null;

      const existing = DB.loadEvents();
      const existingIds = new Set(existing.map(e => e.id));
      // Filter imported events through clearedAt (from the import file, not from a later local clear)
      const activeClearedAt = parseInt(localStorage.getItem(STORAGE_CLEARED_AT) || '0', 10);
      const newEvents = validation.events.filter(evt =>
        !existingIds.has(evt.id) && (activeClearedAt <= 0 || getUidTimestamp(evt.id) > activeClearedAt)
      );
      
      DB._events = sortedByTime([...existing, ...newEvents]);
      DB.saveEvents();

      // Import lifetime badges if present
      const importedLifetime = data.lifetimeBadges;
      if (importedLifetime && Array.isArray(importedLifetime)) {
        const badgeData = loadBadgeData();
        const lifetimeMap = new Map();
        badgeData.lifetimeBadges.forEach(w => lifetimeMap.set(w.id, w.count));
        
        // Merge imported badges (higher counts win)
        importedLifetime.forEach(w => {
          const current = lifetimeMap.get(w.id) || 0;
          lifetimeMap.set(w.id, Math.max(current, w.count));
        });
        
        const mergedBadgeData = {
          todayDate: badgeData.todayDate,
          todayBadges: badgeData.todayBadges,
          yesterdayBadges: badgeData.yesterdayBadges,
          todayUndoCount: badgeData.todayUndoCount || 0,
          appStartDate: badgeData.appStartDate,
          appStartTs: badgeData.appStartTs,
          lifetimeBadges: Array.from(lifetimeMap.entries())
            .filter(([, count]) => count > 0)
            .map(([id, count]) => ({ id, count }))
        };
        saveBadgeData(mergedBadgeData);
      }

      // Import todos if present and local list is empty
      if (data.todos && Array.isArray(data.todos) && loadTodos().length === 0) {
        const validTodos = data.todos
          .filter(t => t && typeof t.text === 'string' && t.text.trim())
          .map(t => ({ ...t, text: t.text.trim().slice(0, 250) }));
        if (validTodos.length > 0) saveTodos(validTodos);
      }

      // Restore settings including addiction profile from export
      if (data.settings && data.settings.addictionProfile) {
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
  const now = currentDate();
  const slots = [{ label: 'Now', value: 'now' }];
  
  // Generate half-hour slots going back ~3 hours, starting from most recent half-hour
  const d = new Date(now);
  // Round down to last half hour
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  
  for (let i = 0; i < 6; i++) {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    slots.push({ label, value: d.getTime().toString() });
    d.setMinutes(d.getMinutes() - 30);
  }
  
  // Determine which slot is active
  const isNow = Math.abs(eventTs - now.getTime()) < 60000; // within 1 minute = "Now"
  let activeSlot = 'now';
  if (!isNow) {
    let minDiff = Infinity;
    for (const s of slots) {
      if (s.value === 'now') continue;
      const diff = Math.abs(parseInt(s.value, 10) - eventTs);
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
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => (profile.icons[v] || '') + ' ' + profile.substanceDisplay[v])
  ];
  if (profile.methods) {
    const methodFn = profile.methodDisplay ? (v => profile.methodDisplay[v] || capitalize(v)) : undefined;
    chips.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, evt.method, methodFn));
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

function hideHabitChips() {
  const picker = $('habit-chips');
  if (picker) picker.classList.add('hidden');
  clearTimeout(habitChipTimeout);
  currentChipHabit = null;
}

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
    const newTs = chip.dataset.val === 'now' ? now() : parseInt(chip.dataset.val, 10);
    if (!Number.isFinite(newTs)) return;
    DB.updateEvent(activeChipEventId, { ts: newTs });
    updateActiveChips();
    calculateAndUpdateBadges();
    render();
    return;
  }
  
  const val = resolveChipVal(field, chip.dataset.val, currentEvent);

  const updateData = { [field]: val };

  DB.updateEvent(activeChipEventId, updateData);
  persistFieldDefault(field, val);
  updateActiveChips();
  calculateAndUpdateBadges();
  render();
}

// ========== EDIT MODAL ==========
function modalFieldWrap(html) {
  return `<div class="modal-field">${html}</div>`;
}

/** Find the addiction profile that owns a given substance key */
function getProfileForSubstance(substance) {
  const currentKey = DB.loadSettings().addictionProfile || 'cannabis';
  // For custom profile, use the dynamically-built profile with custom display names
  const current = currentKey === 'custom' ? getProfile() : ADDICTION_PROFILES[currentKey];
  if (current && current.substanceDisplay[substance]) return { key: currentKey, profile: current };
  for (const [k, p] of Object.entries(ADDICTION_PROFILES)) {
    // For custom profile, use the dynamically-built version so we get the saved custom name/icons
    const resolved = k === 'custom' ? buildCustomProfile(DB.loadSettings()) : p;
    if (resolved.substanceDisplay[substance]) return { key: k, profile: resolved };
  }
  return { key: currentKey, profile: current || ADDICTION_PROFILES.cannabis }; // fallback
}

function openCreateEventModal() {
  hideUsedChips();
  hideResistedChips();
  hideUndo();

  const s = DB.loadSettings();
  const profileKey = s.addictionProfile || 'cannabis';

  // Build profile switcher buttons
  const profileSwitcher = buildCreateModalProfileSwitcher(profileKey);

  // Build substance/method/amount fields for the current profile
  const fieldsHTML = buildCreateModalFields(profileKey);

  // Default to now (use currentDate() so debug time offset is respected)
  const nowDate = currentDate();
  const dateValue = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  const timeValue = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;

  $('modal-sheet').innerHTML = `
    <div class="modal-header"><h2>Add Past Session</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
    ${profileSwitcher}
    <div id="create-modal-fields">${fieldsHTML}</div>
    <div class="modal-field"><label>Date</label><input type="date" id="modal-date-input" value="${dateValue}" class="form-input"></div>
    <div class="modal-field"><label>Time</label><input type="time" id="modal-time-input" value="${timeValue}" class="form-input"></div>
    <div class="modal-actions">
      <button class="btn-delete" onclick="App.closeModal()">Cancel</button>
      <button class="btn-save" onclick="App.saveCreateModal()">Done</button>
    </div>`;
  $('modal-sheet').dataset.eventId = '';
  $('modal-sheet').dataset.createMode = 'true';
  $('modal-sheet').dataset.createProfile = profileKey;
  $('modal-overlay').classList.remove('hidden');
}

/** Build the profile switcher chip row for the create modal */
function buildCreateModalProfileSwitcher(activeKey) {
  const profiles = [
    { key: 'cannabis', icon: '🌿', label: 'Cannabis' },
    { key: 'alcohol', icon: '🍺', label: 'Alcohol' },
    { key: 'smoking', icon: '🚬', label: 'Smoking' },
  ];
  // Custom profile — use saved name/icon if available
  const s = DB.loadSettings();
  const cp = s.customProfile || {};
  const customLabel = cp.name || 'Custom';
  const customIcon = (cp.icons && cp.icons[0]) || '⚡';
  profiles.push({ key: 'custom', icon: customIcon, label: customLabel });

  const chips = profiles.map(p =>
    `<span class="chip${p.key === activeKey ? ' active' : ''}" data-profile="${p.key}" onclick="App.switchCreateProfile('${p.key}')">${p.icon} ${escapeHTML(p.label)}</span>`
  ).join('');

  return `<div class="modal-field">
    <div class="chip-row-label">Tracking</div>
    <div class="chip-group" data-field="profile">${chips}</div>
  </div>`;
}

/** Build the substance/method/amount/reason fields for a given profile in create mode */
function buildCreateModalFields(profileKey, activeReason) {
  const profile = profileKey === 'custom' ? buildCustomProfile(DB.loadSettings()) : ADDICTION_PROFILES[profileKey];
  if (!profile) return '';

  const defaultSubstance = profile.substances[0];
  const defaultAmount = profile.amounts.find(a => a >= 1) || profile.amounts[0];

  const fields = [
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, defaultSubstance, v => (profile.icons[v] || '') + ' ' + profile.substanceDisplay[v])
  ];
  if (profile.methods) {
    const methodFn = profile.methodDisplay ? (v => profile.methodDisplay[v] || capitalize(v)) : undefined;
    fields.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, profile.methods[0], methodFn));
  }
  fields.push(
    chipGroupHTML('Amount', 'amount', profile.amounts, defaultAmount),
    chipGroupHTML('Reason', 'reason', REASONS, activeReason || null)
  );

  return fields.map(modalFieldWrap).join('');
}

/** Switch the profile in the create modal and rebuild substance/method/amount fields */
function switchCreateProfile(profileKey) {
  const container = $('create-modal-fields');
  if (!container) return;

  // Preserve currently selected reason before rebuilding
  const reasonGroup = container.querySelector('.chip-group[data-field="reason"]');
  const activeReason = reasonGroup?.querySelector('.chip.active')?.dataset.val || null;

  // Update active chip
  const group = $('modal-sheet').querySelector('.chip-group[data-field="profile"]');
  if (group) {
    group.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.profile === profileKey));
  }

  // Rebuild fields for the new profile, preserving reason selection
  container.innerHTML = buildCreateModalFields(profileKey, activeReason);

  // Store selected profile
  $('modal-sheet').dataset.createProfile = profileKey;
}

function saveCreateModal() {
  const dateInput = $('modal-date-input');
  const timeInput = $('modal-time-input');
  if (!dateInput || !timeInput || !dateInput.value || !timeInput.value) {
    alert('Please set both date and time.');
    return;
  }

  const [year, month, day] = dateInput.value.split('-').map(Number);
  const [hours, minutes] = timeInput.value.split(':').map(Number);
  if (isNaN(year) || isNaN(hours)) {
    alert('Invalid date or time.');
    return;
  }

  const ts = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
  if (ts > now()) {
    alert('Cannot create events in the future.');
    return;
  }

  // Read chip selections from the modal DOM
  const readChip = (field) => {
    const group = $('modal-sheet').querySelector(`.chip-group[data-field="${field}"]`);
    if (!group) return null;
    const active = group.querySelector('.chip.active');
    return active ? parseChipVal(field, active.dataset.val) : null;
  };

  const selectedProfileKey = $('modal-sheet').dataset.createProfile || DB.loadSettings().addictionProfile || 'cannabis';
  const selectedProfile = selectedProfileKey === 'custom' ? buildCustomProfile(DB.loadSettings()) : ADDICTION_PROFILES[selectedProfileKey];
  const substance = readChip('substance') || (selectedProfile && selectedProfile.substances[0]) || 'thc';
  const method = readChip('method') || null;
  const amount = readChip('amount') ?? 1.0;
  const reason = readChip('reason') || null;

  const evt = {
    id: uid(), type: 'used', ts,
    substance, method, amount, reason
  };

  DB.addEvent(evt);
  calculateAndUpdateBadges();
  render();
  showToast('☑️ Past use logged');
  closeModal();
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
      const displayName = key === 'custom' && profile.sessionLabel !== 'Use'
        ? profile.sessionLabel
        : key[0].toUpperCase() + key.slice(1);
      const fields = [
        `<label>Tracking</label><div class="modal-value">${escapeHTML(displayName)}</div>`,
        chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => (profile.icons[v] || '') + ' ' + profile.substanceDisplay[v])
      ];
      if (profile.methods) {
        const methodFn = profile.methodDisplay ? (v => profile.methodDisplay[v] || capitalize(v)) : undefined;
        fields.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, evt.method, methodFn));
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
      const fields = [`<label>Habit</label><div class="modal-value">${HABIT_LABELS[evt.habit] || evt.habit}</div>`];
      if (HABIT_SHOW_CHIPS[evt.habit]) {
        fields.push(chipGroupHTML('Minutes', 'minutes', HABIT_DURATIONS, evt.minutes ?? 0, v => v === 0 ? '-' : String(v)));
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
    <div class="modal-field"><label>Time</label><input type="time" id="modal-time-input" value="${timeValue}" class="form-input"></div>
    <div class="modal-actions">
      <button class="btn-delete" onclick="if(App.deleteEvent('${escapeHTML(evt.id)}')) App.closeModal()">Delete</button>
      <button class="btn-save" onclick="App.saveModal()">Done</button>
    </div>`;
  $('modal-sheet').dataset.eventId = eventId;
  $('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  delete $('modal-sheet').dataset.createMode;
  calculateAndUpdateBadges();
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

        if (newTs > now()) {
          alert('Cannot create events in the future.');
          return;
        }
        
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
  const isCreateMode = $('modal-sheet').dataset.createMode === 'true';

  if (isCreateMode) {
    // In create mode, just toggle chip selection visually (no DB writes)
    const group = chip.closest('.chip-group');
    const field = group.dataset.field;
    const wasActive = chip.classList.contains('active');
    // For optional fields, allow deselect; for required, always select
    group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    if (!wasActive || !OPTIONAL_FIELDS.has(field)) {
      chip.classList.add('active');
    }
    return;
  }

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

let _appStarted = false;

function showLandingPage() {
  _appStarted = true;
  navGuard(); // Push initial guard entry for back button interception
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
  _appStarted = true;
  navGuard();
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
  // Hide landing page if still visible
  const landing = $('landing-page');
  if (landing) landing.classList.add('hidden');
  
  // Switch to Today tab when showing login screen
  switchTab('today');
  
  const overlay = $('login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  // Inject auth inputs only when login screen is visible
  const loginInputs = overlay.querySelector('.login-inputs');
  if (loginInputs && !loginInputs.children.length) {
    loginInputs.innerHTML = `
      <form id="login-form" onsubmit="App.loginWithEmailFromScreen(); return false">
        <input type="email" id="login-email" name="email" autocomplete="username" placeholder="Email" class="login-input">
        <div class="password-wrap">
          <input type="password" id="login-password" name="password" autocomplete="current-password" placeholder="Password" class="login-input">
          <button type="button" class="password-toggle" onclick="App.togglePasswordVisibility(this)" title="Show password">👁️</button>
        </div>
        <button type="submit" class="hidden"></button>
      </form>`;
  }
}

function hideLoginScreen() {
  const overlay = $('login-overlay');
  if (!overlay) return;
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
  _appStarted = true;
  navGuard();
  const splash = $('splash-screen');
  if (splash) splash.classList.add('hidden');
  
  // After login or skip, check if we need onboarding
  if (!DB.loadSettings().addictionProfile) {
    showOnboarding();
  } else {
    calculateAndUpdateBadges();
    bindEvents();
    render();
    // Clear existing interval if continueToApp is called multiple times
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
    // Schedule daily reminder notification if enabled
    setReminderButton();
    scheduleReminder();
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

  if (profileKey === 'custom') {
    $('onboarding-overlay').classList.add('hidden');
    showCustomConfig(false);
    return;
  }

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

  // New user: start full multi-step onboarding flow
  if (!_previousProfile) {
    startOnboardingFlow();
    return;
  }
  
  // Changing tracked substance: just prompt for most recent use
  _previousProfile = null;
  startChangeTrackingFlow();
  return;
}

// ========== ONBOARDING FLOW (multi-step for new users) ==========
let _onboardingFlowStep = 0;
let _onboardingFlowSteps = [];

function startOnboardingFlow() {
  _onboardingFlowStep = 0;
  _onboardingFlowSteps = ['recent-use', 'daily-reminder', 'welcome-guide'];
  // PWA install is always last — prompt won't be consumed before it's shown
  if (_deferredInstallPrompt) _onboardingFlowSteps.push('install-app');
  showOnboardingFlowStep();
}

/** Abbreviated flow for changing tracked substance (just log recent use, then enter app) */
function startChangeTrackingFlow() {
  _onboardingFlowStep = 0;
  _onboardingFlowSteps = ['recent-use'];
  showOnboardingFlowStep();
}

function showOnboardingFlowStep() {
  const steps = _onboardingFlowSteps;
  if (_onboardingFlowStep >= steps.length) {
    finishOnboardingFlow();
    return;
  }

  const overlay = $('onboarding-flow-overlay');
  const content = $('onboarding-flow-content');
  overlay.classList.remove('hidden');

  const step = steps[_onboardingFlowStep];
  switch (step) {
    case 'recent-use': renderFlowStepRecentUse(content); break;
    case 'daily-reminder': renderFlowStepDailyReminder(content); break;
    case 'install-app': renderFlowStepInstallApp(content); break;
    case 'welcome-guide': renderFlowStepWelcomeGuide(content); break;
  }
}

function advanceOnboardingFlow() {
  _onboardingFlowStep++;
  showOnboardingFlowStep();
}

function finishOnboardingFlow() {
  _onboardingFlowSteps = [];
  $('onboarding-flow-overlay').classList.add('hidden');
  calculateAndUpdateBadges();
  bindEvents();
  render();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
  setReminderButton();
  scheduleReminder();
}

/** Step 1: Log most recent use */
function renderFlowStepRecentUse(container) {
  const profile = getProfile();
  const settings = DB.loadSettings();
  const sessionLabel = profile.sessionLabel || 'Use';

  const defaultSubstance = settings.lastSubstance || profile.substances[0];
  const defaultAmount = settings.lastAmount || profile.amounts.find(a => a >= 1) || profile.amounts[0];
  const defaultMethod = profile.methods ? (settings.lastMethod || profile.methods[0]) : null;

  // Build chip groups for substance/method/amount
  const fields = [
    chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, defaultSubstance,
      v => (profile.icons[v] || '') + ' ' + profile.substanceDisplay[v])
  ];
  if (profile.methods) {
    const methodFn = profile.methodDisplay ? (v => profile.methodDisplay[v] || capitalize(v)) : undefined;
    fields.push(chipGroupHTML(profile.methodLabel, 'method', profile.methods, defaultMethod, methodFn));
  }
  fields.push(chipGroupHTML('Amount', 'amount', profile.amounts, defaultAmount));
  const fieldsHTML = fields.map(modalFieldWrap).join('');

  // Default date/time to now
  const nowDate = currentDate();
  const dateValue = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  const timeValue = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;

  container.innerHTML = `
    <h2>Log your most recent ${escapeHTML(sessionLabel.toLowerCase())}</h2>
    <p class="ob-flow-subtitle">When did you last use? This helps set your starting point.</p>
    <div class="ob-flow-fields" id="ob-flow-use-fields">
      ${fieldsHTML}
      <div class="modal-field"><label>Date</label><input type="date" id="ob-flow-date" value="${dateValue}" class="form-input"></div>
      <div class="modal-field"><label>Time</label><input type="time" id="ob-flow-time" value="${timeValue}" class="form-input"></div>
    </div>
    <div class="ob-flow-actions">
      <button class="action-btn" onclick="App.saveOnboardingRecentUse()">✅ Log ${escapeHTML(sessionLabel)}</button>
      <button class="btn-text" onclick="App.skipOnboardingStep()">Skip for now</button>
    </div>`;

  // Bind chip click handlers within the flow fields
  container.querySelectorAll('.chip-group .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.closest('.chip-group');
      const field = group.dataset.field;
      // For optional fields, allow deselect
      if (OPTIONAL_FIELDS.has(field) && chip.classList.contains('active')) {
        chip.classList.remove('active');
        return;
      }
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

function saveOnboardingRecentUse() {
  const container = $('ob-flow-use-fields');
  if (!container) return advanceOnboardingFlow();

  const dateInput = $('ob-flow-date');
  const timeInput = $('ob-flow-time');
  if (!dateInput?.value || !timeInput?.value) {
    alert('Please set both date and time.');
    return;
  }

  const [year, month, day] = dateInput.value.split('-').map(Number);
  const [hours, minutes] = timeInput.value.split(':').map(Number);
  if (isNaN(year) || isNaN(hours)) {
    alert('Invalid date or time.');
    return;
  }

  const ts = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
  if (ts > now()) {
    alert('Cannot log events in the future.');
    return;
  }

  const readChip = (field) => {
    const group = container.querySelector(`.chip-group[data-field="${field}"]`);
    if (!group) return null;
    const active = group.querySelector('.chip.active');
    return active ? parseChipVal(field, active.dataset.val) : null;
  };

  const profile = getProfile();
  const substance = readChip('substance') || profile.substances[0];
  const method = readChip('method') || null;
  const amount = readChip('amount') ?? 1.0;

  const evt = {
    id: uid(), type: 'used', ts,
    substance, amount
  };
  if (method) evt.method = method;

  DB.addEvent(evt);
  playSound('used');
  showToast(`✅ Logged ${profile.sessionLabel}`);
  advanceOnboardingFlow();
}

/** Step 2: Daily reminder */
function renderFlowStepDailyReminder(container) {
  container.innerHTML = `
    <h2>Daily Check-in Reminder</h2>
    <p class="ob-flow-subtitle">Get a gentle daily reminder to check in with Lentando and track your progress.</p>
    <div class="ob-flow-fields">
      <div class="modal-field">
        <label>Reminder time</label>
        <input type="time" id="ob-flow-reminder-time" value="18:00" class="form-input" style="text-align:center; background:var(--bg);">
      </div>
    </div>
    <div class="ob-flow-actions">
      <button class="action-btn" onclick="App.enableOnboardingReminder()">🔔 Enable Reminder</button>
      <button class="btn-text" onclick="App.skipOnboardingStep()">Continue without reminder</button>
    </div>`;
}

async function enableOnboardingReminder() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const timeInput = $('ob-flow-reminder-time');
  const [hours, mins] = (timeInput?.value || '18:00').split(':').map(Number);
  const settings = DB.loadSettings();
  settings.reminderEnabled = true;
  settings.reminderHour = isNaN(hours) ? 18 : hours;
  settings.reminderMinute = isNaN(mins) ? 0 : mins;
  DB.saveSettings();
  showToast('🔔 Reminder set!');
  advanceOnboardingFlow();
}

/** Step 4 (last, optional): Install PWA — only shown if beforeinstallprompt fired */
function renderFlowStepInstallApp(container) {
  container.innerHTML = `
    <h2>Install Lentando</h2>
    <p class="ob-flow-subtitle">Add Lentando to your home screen for quick access. It works offline and feels like a native app.</p>
    <div class="ob-flow-actions">
      <button class="action-btn" onclick="App.installAppOnboarding()">📲 Install App</button>
      <button class="btn-text" onclick="App.skipOnboardingStep()">Continue in browser</button>
    </div>`;
}

function installAppOnboarding() {
  if (!_deferredInstallPrompt) {
    showToast('Use your browser menu to install');
    advanceOnboardingFlow();
    return;
  }
  _deferredInstallPrompt.prompt();
  _deferredInstallPrompt.userChoice.then((result) => {
    if (result.outcome === 'accepted') {
      showToast('Installing app… 📲');
    }
    _deferredInstallPrompt = null;
    const bar = $('install-app-bar');
    if (bar) bar.classList.add('hidden');
    advanceOnboardingFlow();
  });
}

/** Step 3: Welcome guide */
function renderFlowStepWelcomeGuide(container) {
  const profile = getProfile();
  const sessionLabel = (profile.sessionLabel || 'Use').toLowerCase();

  container.innerHTML = `
    <h2>How to Use Lentando</h2>
    <ul class="ob-flow-guide">
      <li>☑️ Tap <strong>${escapeHTML(sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1))}</strong> whenever you use - tap <strong>Undo</strong> anytime to cancel</li>
      <li>💪 Tap <strong>Resist</strong> when you feel the urge but choose not to</li>
      <li>📝 Use <strong>Add Past Session</strong> in History to earlier log events</li>
      <li>✅ Track healthy <strong>actions</strong>: Water, Exercise, Breaths, Cleaning, Outside</li>
      <li>💧 Lentando will remind you to <strong>drink water</strong> every two hours</li>
      <li>🏆 Earn <strong>badges</strong> that update throughout the day based on your activity</li>
      <li>🔄 You can <strong>change what you're tracking</strong> anytime in Settings</li>
    </ul>
    <div class="ob-flow-actions">
      <button class="action-btn" onclick="App.skipOnboardingStep()">👍 Got it — let's go!</button>
    </div>`;
}

function skipOnboardingStep() {
  advanceOnboardingFlow();
}

/** Emoji picker helpers */
const CUSTOM_ICON_OPTIONS = ['⚡','☕','🥤','🍬','🍩','🍔','🎮','🎲','🏷️','💊','❄️','📱','📺','🖥️','🎧','💸','🛒','📦','🍆','💦','🧠','⏳','🧭','🧿'];

function setActiveIcon(containerId, emoji) {
  const container = $(containerId);
  if (!container) return;
  let found = false;
  container.querySelectorAll('.icon-option').forEach(btn => {
    const match = btn.textContent === emoji;
    btn.classList.toggle('active', match);
    if (match) found = true;
  });
  // If saved icon was removed from options, default to first icon
  if (!found) {
    const first = container.querySelector('.icon-option');
    if (first) first.classList.add('active');
  }
}

function getActiveIcon(containerId) {
  const container = $(containerId);
  if (!container) return '⚡';
  const active = container.querySelector('.icon-option.active');
  return active ? active.textContent : '⚡';
}

function buildIconPicker(containerId) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = CUSTOM_ICON_OPTIONS.map(e =>
    `<button type="button" class="icon-option" onclick="this.parentNode.querySelectorAll('.icon-option').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${e}</button>`
  ).join('');
}

/** Whether the custom config was opened from settings (true) or onboarding (false) */
let customConfigFromSettings = false;

function showCustomConfig(fromSettings) {
  customConfigFromSettings = fromSettings;
  const overlay = $('custom-config-overlay');
  overlay.classList.remove('hidden');
  
  // Build icon pickers
  buildIconPicker('custom-icon1');
  buildIconPicker('custom-icon2');
  buildIconPicker('custom-icon3');
  
  // Pre-fill from saved custom profile
  const settings = DB.loadSettings();
  const cp = settings.customProfile || { name: '', types: ['', '', ''], icons: ['⚡', '⚡', '⚡'] };
  
  $('custom-name').value = cp.name || '';
  $('custom-type1').value = (cp.types && cp.types[0]) || '';
  $('custom-type2').value = (cp.types && cp.types[1]) || '';
  $('custom-type3').value = (cp.types && cp.types[2]) || '';

  // Set icon selections
  const icons = cp.icons || ['⚡', '⚡', '⚡'];
  setActiveIcon('custom-icon1', icons[0]);
  setActiveIcon('custom-icon2', icons[1]);
  setActiveIcon('custom-icon3', icons[2]);

  // Update button text based on context
  const btn = $('btn-save-custom');
  if (btn) btn.textContent = fromSettings ? '✅ Save Changes' : '✅ Save & Continue';
}

function saveCustomConfig() {
  const settings = DB.loadSettings();
  
  // Read and sanitize inputs
  const name = $('custom-name').value.trim().slice(0, 24);
  const types = [
    $('custom-type1').value.trim().slice(0, 20),
    $('custom-type2').value.trim().slice(0, 20),
    $('custom-type3').value.trim().slice(0, 20)
  ];
  const icons = [
    getActiveIcon('custom-icon1'),
    getActiveIcon('custom-icon2'),
    getActiveIcon('custom-icon3')
  ];
  
  settings.customProfile = { name, types, icons };
  
  if (customConfigFromSettings) {
    // From settings — just save and refresh
    DB._settings = settings;
    DB.saveSettings();
    $('custom-config-overlay').classList.add('hidden');
    render();
  } else {
    // From onboarding — complete profile selection
    const profile = buildCustomProfile(settings);
    const defaultAmount = profile.amounts.find(a => a >= 1) || profile.amounts[0];
    
    settings.addictionProfile = 'custom';
    settings.lastSubstance = profile.substances[0];
    settings.lastAmount = defaultAmount;
    
    DB._settings = settings;
    DB.saveSettings();
    
    $('custom-config-overlay').classList.add('hidden');
    playSound('resist');

    // New user: start full multi-step onboarding flow
    if (!_previousProfile) {
      startOnboardingFlow();
      return;
    }
    
    // Changing tracked substance: just prompt for most recent use
    _previousProfile = null;
    startChangeTrackingFlow();
    return;
  }
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
  
  // Track undo for "Second Thought" badge
  const badgeData = loadBadgeData();
  const today = todayKey();
  badgeData.todayUndoCount = (badgeData.todayDate === today ? (badgeData.todayUndoCount || 0) : 0) + 1;
  badgeData.todayDate = today;
  saveBadgeData(badgeData);
  
  calculateAndUpdateBadges();
  
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
  const nowTs = now();
  const last = _lastActionTime[actionKey];
  if (last && (nowTs - last) < COOLDOWN_MS) {
    const secsLeft = Math.ceil((COOLDOWN_MS - (nowTs - last)) / 1000);
    playSound('cooldown');
    showToast(`⏳ Wait ${secsLeft}s before logging the same event again`);
    return false;
  }
  _lastActionTime[actionKey] = nowTs;
  return true;
}

function logUsed() {
  if (!checkCooldown('used')) return;
  const s = DB.loadSettings();
  const profile = getProfile();
  const method = profile.methods ? s.lastMethod : null;
  const evt = createUsedEvent(s.lastSubstance, method, s.lastAmount);
  DB.addEvent(evt);
  calculateAndUpdateBadges();
  render();
  hideResistedChips();
  hideHabitChips();
  hideUndo();
  showChips('used-chips', buildUsedChips, evt, hideUsedChips);
  
  const btn = $('btn-used');
  playSound('used');
  hapticFeedback();
  pulseEl(btn);
  
  showToast(`☑️ Logged ${profile.sessionLabel}`);
  
  showUndo(evt.id);
}

function logResisted() {
  if (!checkCooldown('resisted')) return;
  const evt = createResistedEvent();
  DB.addEvent(evt);
  calculateAndUpdateBadges();
  render();
  hideUsedChips();
  hideHabitChips();
  showChips('resisted-chips', buildResistedChips, evt, hideResistedChips);

  // Only show coaching if resisted was already clicked within the past 30 minutes
  const thirtyMinAgo = now() - 30 * 60 * 1000;
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
  calculateAndUpdateBadges();
  render();
  
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
  document.querySelector('header h1 .brand').addEventListener('click', () => switchTab('today'));

  $('graph-range').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    graphDays = +chip.dataset.days;
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
  $('reminder-overlay').addEventListener('click', e => { if (e.target === $('reminder-overlay')) closeReminderModal(); });

  $('habit-row').addEventListener('click', e => {
    const btn = e.target.closest('.habit-btn');
    if (!btn) return;
    const habit = btn.dataset.habit;
    
    // Check if this habit shows duration chips
    if (HABIT_SHOW_CHIPS[habit]) {
      // Check cooldown before showing chips
      if (!checkCooldown('habit_' + habit)) return;
      
      // Immediately log habit with 0 minutes
      const evt = createHabitEvent(habit, 0);
      DB.addEvent(evt);
      calculateAndUpdateBadges();
      render();
      
      playSound('habit');
      hapticFeedback();
      const label = HABIT_LABELS[habit] || habit;
      const icon = HABIT_ICONS[habit] || '';
      showToast(`${icon} Logged ${label}`);
      flashEl(btn);
      
      // Show chips so user can optionally add duration
      currentChipHabit = habit;
      const picker = $('habit-chips');
      picker.classList.remove('hidden');
      clearTimeout(habitChipTimeout);
      habitChipTimeout = setTimeout(() => hideHabitChips(), CHIP_TIMEOUT_MS);
      return;
    }
    
    hideHabitChips();
    hideUsedChips();
    hideResistedChips();
    logHabit(habit);
    flashEl(btn);
  });

  $('habit-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip || !currentChipHabit) return;
    
    // Find the most recent event for this habit and update its minutes
    const events = DB.loadEvents();
    const recentHabit = events
      .filter(evt => evt.type === 'habit' && evt.habit === currentChipHabit)
      .sort((a, b) => b.ts - a.ts)[0];
    
    if (recentHabit) {
      const minutes = parseInt(chip.dataset.min, 10);
      if (!isNaN(minutes)) {
        DB.updateEvent(recentHabit.id, { minutes });
        calculateAndUpdateBadges();
        render();
      }
    }
    
    const habitBtn = document.querySelector(`[data-habit="${currentChipHabit}"]`);
    if (habitBtn) pulseEl(habitBtn);
    playSound('habitChip');
    hideHabitChips();
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
    const todoId = e.target.dataset.id;
    if (e.target.classList.contains('todo-check')) toggleTodo(todoId);
    if (e.target.classList.contains('todo-text')) editTodo(todoId);
    
    // Handle button clicks (move up, move down, edit and delete)
    const btn = e.target.closest('.tl-act-btn');
    if (btn && btn.dataset.id) {
      const btnId = btn.dataset.id;
      if (btn.title === 'Move Up') moveUpTodo(btnId);
      if (btn.title === 'Move Down') moveDownTodo(btnId);
      if (btn.title === 'Edit') editTodo(btnId);
      if (btn.title === 'Delete') deleteTodo(btnId);
    }
  });
  
  const prevBtn = $('prev-day');
  const nextBtn = $('next-day');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateDay(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateDay(1));
}

// ========== TO-DO LIST ==========

// --- Todo tombstone helpers ---
function addTodoTombstone(todoId) {
  try {
    const raw = readTodoTombstoneMap();
    if (raw[todoId]) return;
    raw[todoId] = now();
    safeSetItem(STORAGE_DELETED_TODO_IDS, JSON.stringify(raw));
    if (window.FirebaseSync) FirebaseSync.onDataChanged();
  } catch (e) {
    console.error('Failed to add todo tombstone:', e);
  }
}

function readTodoTombstoneMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_DELETED_TODO_IDS) || '{}');
    return (typeof raw === 'object' && raw !== null) ? raw : {};
  } catch {
    return {};
  }
}

function cleanOldTodoTombstones() {
  try {
    const raw = readTodoTombstoneMap();
    const entries = Object.entries(raw);
    const ninetyDaysAgo = now() - (90 * 24 * 60 * 60 * 1000);
    const cleaned = {};
    for (const [id, deletedAt] of entries) {
      if (deletedAt > ninetyDaysAgo) cleaned[id] = deletedAt;
    }
    if (Object.keys(cleaned).length < entries.length) {
      safeSetItem(STORAGE_DELETED_TODO_IDS, JSON.stringify(cleaned));
    }
  } catch (e) {
    console.error('Failed to clean todo tombstones:', e);
  }
}

// --- Todo data model: { id, text, done, position, modifiedAt } ---

function loadTodos() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_TODOS)) || [];
    // Migrate legacy todos (plain { text, done } without id/position)
    let needsMigration = false;
    const todos = raw.map((t, i) => {
      if (!t.id) {
        needsMigration = true;
        return { id: uid(), text: t.text || '', done: !!t.done, position: (i + 1) * 1.0, modifiedAt: now() };
      }
      return t;
    });
    if (needsMigration) {
      safeSetItem(STORAGE_TODOS, JSON.stringify(todos));
    }
    // Always return sorted by position
    return todos.sort((a, b) => a.position - b.position);
  } catch { return []; }
}

function saveTodos(todos) {
  safeSetItem(STORAGE_TODOS, JSON.stringify(todos));
  if (window.FirebaseSync) FirebaseSync.onDataChanged();
}

function renderTodos() {
  const todos = loadTodos();
  $('todo-list').innerHTML = todos.length === 0
    ? ''
    : todos.map((t, i) => { const safeId = escapeHTML(t.id); return `<li class="todo-item${t.done ? ' done' : ''}">
        <div class="todo-controls">
          <button class="tl-act-btn" data-id="${safeId}" title="Move Up"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="tl-act-btn" data-id="${safeId}" title="Move Down"${i === todos.length - 1 ? ' disabled' : ''}>↓</button>
        </div>
        <input type="checkbox" class="todo-check" data-id="${safeId}"${t.done ? ' checked' : ''}>
        <div class="tl-body">
          <span class="todo-text" data-id="${safeId}">${escapeHTML(t.text)}</span>
        </div>
        <div class="tl-actions">
          <button class="tl-act-btn" data-id="${safeId}" title="Delete">🗑️</button>
        </div>
      </li>`; }).join('');
  const clearBtn = $('todo-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', todos.length === 0);
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 250) return;
  const todos = loadTodos();
  const maxPos = todos.length > 0 ? Math.max(...todos.map(t => t.position)) : 0;
  todos.push({ id: uid(), text: trimmed, done: false, position: maxPos + 1, modifiedAt: now() });
  saveTodos(todos);
  renderTodos();
}

function toggleTodo(todoId) {
  const todos = loadTodos();
  const todo = todos.find(t => t.id === todoId);
  if (todo) {
    todo.done = !todo.done;
    todo.modifiedAt = now();
    saveTodos(todos);
    renderTodos();
  }
}

function deleteTodo(todoId) {
  if (!confirm('Delete this goal?')) return;
  const todos = loadTodos();
  const todo = todos.find(t => t.id === todoId);
  if (todo) addTodoTombstone(todo.id);
  saveTodos(todos.filter(t => t.id !== todoId));
  renderTodos();
  cleanOldTodoTombstones();
}

function clearTodos() {
  if (!confirm('Clear all goal items?')) return;
  const todos = loadTodos();
  for (const t of todos) addTodoTombstone(t.id);
  saveTodos([]);
  renderTodos();
  cleanOldTodoTombstones();
}

function moveUpTodo(todoId) {
  const todos = loadTodos(); // already sorted by position
  const idx = todos.findIndex(t => t.id === todoId);
  if (idx <= 0) return;
  // Swap positions using float midpoint: move this item above the previous one
  const prev = todos[idx - 1];
  const prevPrev = todos[idx - 2];
  const newPos = prevPrev ? (prevPrev.position + prev.position) / 2 : prev.position - 1;
  todos[idx].position = newPos;
  todos[idx].modifiedAt = now();
  // Renormalize if gap is too small
  if (Math.abs(newPos - prev.position) < 0.001) {
    todos.sort((a, b) => a.position - b.position);
    todos.forEach((t, i) => { t.position = i + 1; t.modifiedAt = now(); });
  }
  saveTodos(todos);
  renderTodos();
}

function moveDownTodo(todoId) {
  const todos = loadTodos(); // already sorted by position
  const idx = todos.findIndex(t => t.id === todoId);
  if (idx === -1 || idx >= todos.length - 1) return;
  // Swap positions using float midpoint: move this item below the next one
  const next = todos[idx + 1];
  const nextNext = todos[idx + 2];
  const newPos = nextNext ? (next.position + nextNext.position) / 2 : next.position + 1;
  todos[idx].position = newPos;
  todos[idx].modifiedAt = now();
  // Renormalize if gap is too small
  if (Math.abs(newPos - next.position) < 0.001) {
    todos.sort((a, b) => a.position - b.position);
    todos.forEach((t, i) => { t.position = i + 1; t.modifiedAt = now(); });
  }
  saveTodos(todos);
  renderTodos();
}

function editTodo(todoId) {
  const todos = loadTodos();
  const todo = todos.find(t => t.id === todoId);
  if (!todo) return;
  
  const todoItems = $('todo-list').querySelectorAll('.todo-item');
  const sortedIdx = todos.findIndex(t => t.id === todoId);
  const item = todoItems[sortedIdx];
  if (!item) return;
  
  const textSpan = item.querySelector('.todo-text');
  if (!textSpan) return;
  
  const currentText = todo.text;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-edit-input';
  input.value = currentText;
  input.maxLength = 250;
  input.dataset.id = todoId;
  
  let saved = false;
  const saveEdit = () => {
    if (saved) return;
    saved = true;
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      const freshTodos = loadTodos();
      const freshTodo = freshTodos.find(t => t.id === todoId);
      if (freshTodo) {
        freshTodo.text = newText;
        freshTodo.modifiedAt = now();
        saveTodos(freshTodos);
      }
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
    if (icon) icon.textContent = '☀️';
    if (text) text.textContent = 'Light Theme Enabled';
  } else {
    if (icon) icon.textContent = '🌙';
    if (text) text.textContent = 'Dark Theme Enabled';
  }
}

// ========== DAILY REMINDER NOTIFICATIONS ==========
let _reminderTimer = null;

function scheduleReminder() {
  if (_reminderTimer) { clearTimeout(_reminderTimer); _reminderTimer = null; }
  const settings = DB.loadSettings();
  if (!settings.reminderEnabled) return;

  const now_ = new Date();
  const target = new Date(now_);
  target.setHours(settings.reminderHour, settings.reminderMinute ?? 0, 0, 0);
  // If target is in the past, schedule for tomorrow
  if (target <= now_) target.setDate(target.getDate() + 1);
  const ms = target - now_;
  _reminderTimer = setTimeout(() => fireReminder(), ms);
}

function fireReminder() {
  _reminderTimer = null;
  const settings = DB.loadSettings();
  if (!settings.reminderEnabled) return;

  showReminderNotification();
  // Re-schedule for tomorrow
  scheduleReminder();
}

function showReminderNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const msg = {
    type: 'SHOW_REMINDER',
    title: 'How\'s your day going?',
    body: 'Tap to check in with Lentando.',
    icon: './icon-192.png'
  };
  // Use service worker to show notification (works even when tab is focused)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
  } else if (navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage(msg);
    });
  } else {
    new Notification(msg.title, { body: msg.body, icon: msg.icon });
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Notifications are not supported in this browser.');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    alert('Notifications are blocked. Please enable them in your browser settings.');
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function setReminderButton() {
  const settings = DB.loadSettings();
  const icon = $('reminder-icon-settings');
  const text = $('reminder-text-settings');
  if (settings.reminderEnabled) {
    const h = settings.reminderHour;
    const m = settings.reminderMinute ?? 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const mStr = String(m).padStart(2, '0');
    if (icon) icon.textContent = '🔔';
    if (text) text.textContent = `Reminder at ${h12}:${mStr} ${ampm}`;
  } else {
    if (icon) icon.textContent = '🔕';
    if (text) text.textContent = 'Enable Daily Reminder';
  }
}

function openReminderModal() {
  const settings = DB.loadSettings();
  const timeInput = $('reminder-time-input');
  if (timeInput) {
    const h = String(settings.reminderHour).padStart(2, '0');
    const m = String(settings.reminderMinute ?? 0).padStart(2, '0');
    timeInput.value = `${h}:${m}`;
  }
  // Show disable button only if currently enabled
  const disableBtn = $('btn-disable-reminder');
  if (disableBtn) disableBtn.classList.toggle('hidden', !settings.reminderEnabled);
  // Update save button text
  const overlay = $('reminder-overlay');
  const saveBtn = overlay?.querySelector('.btn-save');
  if (saveBtn) saveBtn.textContent = settings.reminderEnabled ? '🔔 Update Reminder' : '🔔 Enable Reminder';
  overlay.classList.remove('hidden');
}

function closeReminderModal() {
  $('reminder-overlay').classList.add('hidden');
}

async function saveReminder() {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  const timeInput = $('reminder-time-input');
  const [hours, minutes] = (timeInput?.value || '18:00').split(':').map(Number);
  const settings = DB.loadSettings();
  settings.reminderEnabled = true;
  settings.reminderHour = isNaN(hours) ? 18 : hours;
  settings.reminderMinute = isNaN(minutes) ? 0 : minutes;
  DB.saveSettings();
  setReminderButton();
  scheduleReminder();
  closeReminderModal();
}

function disableReminder() {
  const settings = DB.loadSettings();
  settings.reminderEnabled = false;
  DB.saveSettings();
  setReminderButton();
  scheduleReminder();
  closeReminderModal();
}

function setSoundButton(soundEnabled) {
  const icon = $('sound-icon-settings');
  const text = $('sound-text-settings');
  // Show what you'll toggle TO
  if (soundEnabled) {
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = 'Sounds Enabled';
  } else {
    if (icon) icon.textContent = '🔇';
    if (text) text.textContent = 'Sounds Disabled';
  }
}

function getToggleTheme(current) {
  return current === 'light' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  safeSetItem(STORAGE_THEME, theme);
  setThemeIcon(theme);
  // Update browser chrome to match manual theme toggle
  const themeColor = theme === 'dark' ? '#1a1a1a' : '#5c6bc0';
  document.querySelectorAll('meta[name="theme-color"]').forEach((metaTheme) => {
    metaTheme.setAttribute('content', themeColor);
  });
}

// ========== PWA INSTALL PROMPT ==========
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  const bar = $('install-app-bar');
  if (bar) bar.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  _deferredInstallPrompt = null;
  const bar = $('install-app-bar');
  if (bar) bar.classList.add('hidden');
  showToast('App installed! 🎉');
});

window.App = {
  hideUsedChips,
  hideResistedChips,
  hideHabitChips,
  editEvent: openEditModal,
  closeModal,
  saveModal,
  dismissLanding,
  switchCreateProfile,
  deleteEvent(id) {
    if (!confirm('Delete this event?')) return false;
    DB.deleteEvent(id);
    calculateAndUpdateBadges();
    render();
    // Flush to cloud immediately so focus-triggered pull doesn't restore the deleted event
    if (window.FirebaseSync) {
      FirebaseSync.pushNow().catch((err) => {
        console.warn('[Sync] Immediate push after delete failed:', err);
      });
    }
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
      const tombstones = DB._readTombstoneMap();
      const nowTs = now();
      for (const id of idsToDelete) {
        if (!tombstones[id]) tombstones[id] = nowTs;
      }
      safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(tombstones));
    } catch (e) { console.error('Failed to batch-add tombstones:', e); }
    DB.loadEvents();
    DB._events = DB._events.filter(e => !idsToDelete.has(e.id));
    DB._invalidateDateIndex();
    DB.saveEvents();
    DB._cleanOldTombstones();
    calculateAndUpdateBadges();
    render();
    if (window.FirebaseSync) {
      try { await FirebaseSync.pushNow(); } catch (_e) { /* ignore */ }
    }
  },
  exportJSON,
  importJSON,
  clearDatabase,
  clearTodos,
  changeAddiction,
  installApp() {
    if (!_deferredInstallPrompt) {
      showToast('Use your browser menu to install');
      return;
    }
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.then((result) => {
      if (result.outcome === 'accepted') {
        showToast('Installing app… 📲');
      }
      _deferredInstallPrompt = null;
      const bar = $('install-app-bar');
      if (bar) bar.classList.add('hidden');
    });
  },
  openCreateEventModal,
  saveCreateModal,
  showCustomConfig,
  saveCustomConfig,
  switchTab,
  logWaterFromReminder,
  loadMoreHistory,
  saveOnboardingRecentUse,
  enableOnboardingReminder,
  installAppOnboarding,
  skipOnboardingStep,
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
  openReminderModal,
  closeReminderModal,
  saveReminder,
  disableReminder,
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
        const result = await FirebaseSync.deleteAccount();
        if (result === false) return; // Deletion was aborted (e.g. requires recent login)
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
// Only defined when debugMode is true
if (debugMode) {

  function generateAllTestData() {
    console.log('🎲 Generating comprehensive test data...');
    generateTestData(80);
    generateTestHabits(15);
    generateTestResists(40);
    generateTestBadges();
    console.log('✅ All test data generated! Reload the page to see results.');
  }

  function generateTestData(numEvents = 100) {
    const profile = getProfile();
    const nowTs = now();
    const thirtyDaysAgo = nowTs - (30 * 24 * 60 * 60 * 1000);
    DB.loadEvents();
    
    console.log(`Generating ${numEvents} random usage events...`);
    
    for (let i = 0; i < numEvents; i++) {
      // Random timestamp within past 30 days
      const timestamp = thirtyDaysAgo + Math.random() * (nowTs - thirtyDaysAgo);
      
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
    const habitTypes = Object.keys(HABIT_LABELS);
    const nowTs = now();
    const thirtyDaysAgo = nowTs - (30 * 24 * 60 * 60 * 1000);
    DB.loadEvents();
    
    console.log(`Generating ${numPerHabit} events for each habit type...`);
    
    for (const habit of habitTypes) {
      for (let i = 0; i < numPerHabit; i++) {
        const timestamp = thirtyDaysAgo + Math.random() * (nowTs - thirtyDaysAgo);
        const minutes = HABIT_SHOW_CHIPS[habit]
          ? HABIT_DURATIONS[Math.floor(Math.random() * HABIT_DURATIONS.length)]
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
    const nowTs = now();
    const thirtyDaysAgo = nowTs - (30 * 24 * 60 * 60 * 1000);
    DB.loadEvents();
    
    console.log(`Generating ${numEvents} random resist events...`);
    
    for (let i = 0; i < numEvents; i++) {
      const timestamp = thirtyDaysAgo + Math.random() * (nowTs - thirtyDaysAgo);
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

  function generateTestBadges() {
    const badgeIds = Object.keys(BADGE_DEFINITIONS);
    // Exclude rare/milestone badges to keep it realistic
    const excludeIds = new Set(['year-streak', 'month-streak', 'tbreak-365d', 'tbreak-30d', 'tbreak-21d']);
    // Common badges get higher counts, rare badges get lower
    const commonBadges = new Set(['resist', 'mindful', 'dose-half', 'harm-reduction-vape', 'hydrated',
      'good-start', 'app-streak', 'gap-1h', 'gap-2h']);
    const eligibleIds = badgeIds.filter(id => !excludeIds.has(id));
    
    console.log('Generating random lifetime badges...');
    
    // Start fresh — only keep existing lifetime badges, clear today tracking
    // so calculateAndUpdateBadges won't subtract stale todayBadges from the new lifetime.
    const badgeData = loadBadgeData();
    const lifetimeMap = new Map();
    badgeData.lifetimeBadges.forEach(w => lifetimeMap.set(w.id, w.count));
    
    for (const id of eligibleIds) {
      // ~80% chance each badge has been earned at least once
      if (Math.random() < 0.8) {
        // Common badges: 10-50 count, rare badges: 1-10
        const count = commonBadges.has(id)
          ? Math.floor(Math.random() * 40) + 10
          : Math.floor(Math.random() * 10) + 1;
        lifetimeMap.set(id, (lifetimeMap.get(id) || 0) + count);
      }
    }
    
    // Generate yesterday's badges (subset of eligible badges)
    console.log('Generating random yesterday badges...');
    const fakeYesterdayBadges = [];
    // Pick 5-12 random badges for yesterday
    const numYesterdayBadges = Math.floor(Math.random() * 8) + 5; // 5-12
    const shuffledEligible = [...eligibleIds].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(numYesterdayBadges, shuffledEligible.length); i++) {
      const id = shuffledEligible[i];
      // Most badges earned once, some 2-3 times
      const count = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 2) + 2;
      fakeYesterdayBadges.push({ id, count });
    }
    
    // Set todayDate to yesterday, and put the badges in todayBadges
    // When the app loads "today", it will auto-move them to yesterdayBadges
    const updatedData = {
      todayDate: daysAgoKey(1),  // Yesterday's date
      todayBadges: fakeYesterdayBadges,  // These will become yesterday's badges on reload
      yesterdayBadges: [],
      todayUndoCount: 0,
      lifetimeBadges: Array.from(lifetimeMap.entries())
        .map(([id, count]) => ({ id, count }))
        .filter(w => w.count > 0)
    };
    
    saveBadgeData(updatedData);
    
    // Verify save
    const verify = loadBadgeData();
    console.log(`✅ Added random badges for ${updatedData.lifetimeBadges.length} lifetime badge types and ${fakeYesterdayBadges.length} yesterday badges.`);
    console.log('Generated as "today" badges for yesterday\'s date - will auto-move to yesterday on reload');
    console.log('Sample badges:', verify.todayBadges.slice(0, 5));
    console.log('Sample lifetime badges:', verify.lifetimeBadges.slice(0, 5));
  }

  function generateUseEvent(daysAgo) {
    const settings = DB.loadSettings();
    const profile = getProfile();
    
    // Parse input
    const days = parseInt(daysAgo, 10);
    if (isNaN(days) || days < 0) {
      showToast('❌ Please enter a valid number of days');
      return;
    }
    
    // Calculate timestamp - random time within the target day
    const msPerDay = 24 * 60 * 60 * 1000;
    const targetDate = currentDate();
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
    calculateAndUpdateBadges();
    render();
    
    console.log(`✅ Added ${profile.sessionLabel} event ${days} day(s) ago:`, evt);
    showToast(`✅ Added ${profile.sessionLabel} event ${days} day(s) ago`);
  }

  window.generateAllTestData = generateAllTestData;
  window.generateTestData = generateTestData;
  window.generateTestHabits = generateTestHabits;
  window.generateTestResists = generateTestResists;
  window.generateUseEvent = generateUseEvent;

  console.log('%c🛠️ Debug Mode Active', 'color: #4a9eff; font-weight: bold; font-size: 14px');
  console.log('%cTime Commands:', 'font-weight: bold');
  console.log('  debugAdvanceTime(hours)    - Advance time by N hours');
  console.log('  debugSetDate("2026-02-15") - Jump to specific date');
  console.log('  debugResetTime()           - Reset to real time');
  console.log('  debugGetTime()             - Show current virtual time');
  console.log('%cTest Data Commands:', 'font-weight: bold');
  console.log('  generateAllTestData()      - Mix of everything (recommended)');
  console.log('  generateTestData(100)      - 100 random usage events over 30 days');
  console.log('  generateTestHabits(20)     - 20 events per habit type');
  console.log('  generateTestResists(50)    - 50 random resist events');
  console.log('  generateUseEvent(7)        - Single use event N days ago');
} // end if (debugMode)

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  // Don't preload events or settings - let them load lazily to avoid caching stale data before Firebase sync
  
  // Use saved theme or specific system preference to avoid flash of wrong color
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(localStorage.getItem(STORAGE_THEME) || (systemDark ? 'dark' : 'light'));
  
  initSounds();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
      .catch(err => console.log('[PWA] Service worker registration failed:', err));
  }
  
  // Firebase will handle initial auth check and call continueToApp() or show login screen
  // If Firebase is not configured, checkAuthAndContinue will be called after a short delay
  
  // Safety net: if firebase-sync.js fails to load (offline, blocked, slow CDN),
  // start the app after 2s so users aren't stuck on the splash screen forever
  setTimeout(() => {
    if (!_appStarted) {
      console.warn('[App] Firebase module did not respond — starting with local data');
      continueToApp();
    }
  }, 2000);
  
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
    const badgeItem = e.target.closest('.badge-item');
    const tile = e.target.closest('.tile[data-tooltip]');
    const graphContainer = e.target.closest('.graph-container[data-tooltip]');
    
    if (badgeItem) {
      e.preventDefault();
      e.stopPropagation();
      
      const tooltipText = badgeItem.getAttribute('data-tooltip');
      
      // If clicking the same badge, toggle it off
      if (activeTooltip && activeTooltip.textContent === tooltipText) {
        hideTooltip();
      } else {
        showTooltip(badgeItem, tooltipText);
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
    } else if (graphContainer) {
      e.preventDefault();
      e.stopPropagation();
      
      const tooltipText = graphContainer.getAttribute('data-tooltip');
      
      if (activeTooltip && activeTooltip.textContent === tooltipText) {
        hideTooltip();
      } else {
        showTooltip(graphContainer, tooltipText);
      }
    } else {
      // Clicked outside, hide tooltip
      hideTooltip();
    }
  });
  
  // Hide tooltip on scroll
  window.addEventListener('scroll', hideTooltip, { passive: true });
}