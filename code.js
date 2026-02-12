// LENTANDO - Progress At Your Pace
// Copyright (c) 2026 Frank Force

'use strict';

const debugMode = true; // Set to true to enable debug logging and debug time system messages

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
  window.debugAdvanceTime = (hours) => {
    _debugTimeOffset += hours * 60 * 60 * 1000;
    console.log(`⏰ Time advanced by ${hours}h. Virtual date: ${currentDate().toLocaleString()}`);
    render();
  };

  window.debugSetDate = (dateString) => {
    const targetTime = new Date(dateString).getTime();
    _debugTimeOffset = targetTime - Date.now();
    console.log(`⏰ Time set to ${currentDate().toLocaleString()}`);
    render();
  };

  window.debugResetTime = () => {
    _debugTimeOffset = 0;
    console.log('⏰ Time reset to real time');
    render();
  };

  window.debugGetTime = () => {
    console.log(`Current virtual time: ${currentDate().toLocaleString()}`);
    console.log(`Offset: ${_debugTimeOffset / (1000 * 60 * 60)} hours`);
    return currentDate();
  };
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
const DATA_VERSION = 2;

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
  custom: {
    sessionLabel: 'Use',
    substanceLabel: 'Type',
    methodLabel: 'Method',
    substances: ['type1', 'type2', 'type3'],
    substanceDisplay: { type1: 'Type 1', type2: 'Type 2', type3: 'Type 3' },
    methods: ['method1', 'method2', 'method3'],
    amounts: [0.5, 1.0, 1.5, 2.0, 5, 10],
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

  // Build custom icons
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

// Badge calculation thresholds
const GAP_MILESTONES = [1, 2, 4, 8, 12];
const TBREAK_MILESTONES = [1, 7, 14, 21, 30, 365];
const APP_STREAK_MILESTONES = [2, 7, 30, 365];
const EARLY_HOUR = 6;
const AFTERNOON_HOUR = 12;
const MAX_STREAK_DAYS = 60;
const LOW_DAY_THRESHOLD = 2;

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
  '🎮 Play a quick game',
  '📞 Text a friend',
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
  '🧠 You\'re building your pause muscle',
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
  breaths: true,
  clean: false,
  exercise: true,
  outside: false
};

// Badge definitions - maps badge IDs to their display properties
// Order matters! sortOrder is auto-assigned based on position in this object
// Note: "badges" is the primary user-facing term
const BADGE_DEFINITIONS = {
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
  'zero-use': { label: 'No Use Day', icon: '🏆', desc: 'No use today' },
  'good-start': { label: 'Good Start', icon: '🚀', desc: 'Started the day with a positive action instead of using' },
  'drank-water': { label: 'Drank Water', icon: '💧', desc: 'Logged water' },
  'hydrated': { label: 'Hydrated', icon: '🌊', desc: 'Logged water 5+ times' },
  'breathwork': { label: 'Breathwork', icon: '🌬️', desc: 'Did breathing exercises or meditation' },
  'cleaned': { label: 'Tidied', icon: '🧹', desc: 'Tidied up or cleaned something' },
  'went-outside': { label: 'Went Outside', icon: '🌳', desc: 'Spent time outside or got some fresh air' },
  'exercised': { label: 'Exercised', icon: '🏃', desc: 'Exercised or did a physical activity' },
  'habit-stack': { label: 'Habit Stack', icon: '🧱', desc: 'Logged multiple different habit types' },
  'five-star-day': { label: 'Five Star Day', icon: '🌟', desc: 'Logged all 5 habit types' },
  'habit-streak': { label: 'Habit Streak', icon: '🐢', desc: 'Logged healthy habits for consecutive days' },
  'resist-streak': { label: 'Resist Streak', icon: '🛡️', desc: 'Resisted urges for multiple days in a row' },
  'gap-1h': { label: 'Gap 1h', icon: '🕐', desc: 'Maintained a 1+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-2h': { label: 'Gap 2h', icon: '🕑', desc: 'Maintained a 2+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-4h': { label: 'Gap 4h', icon: '🕓', desc: 'Maintained a 4+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-8h': { label: 'Gap 8h', icon: '🕗', desc: 'Maintained an 8+ hour gap between sessions (excludes gaps crossing 6am)' },
  'gap-12h': { label: 'Gap 12h', icon: '🕛', desc: 'Maintained a 12+ hour gap between sessions (excludes gaps crossing 6am)' },
  'night-gap': { label: 'Good Night', icon: '🛏️', desc: 'Maintained a 12+ hour gap that crosses 6am' },
  'night-skip': { label: 'Night Skip', icon: '☄️', desc: 'No use between midnight and 6am' },
  'morning-skip': { label: 'Morning Skip', icon: '🌅', desc: 'No use between 6am and noon' },
  'day-skip': { label: 'Day Skip', icon: '☀️', desc: 'No use between noon and 6pm' },
  'evening-skip': { label: 'Evening Skip', icon: '🌙', desc: 'No use between 6pm and midnight' },
  'lower-amount': { label: 'Less Than Yesterday', icon: '📉', desc: 'Used a smaller total amount than yesterday' },
  'first-later': { label: 'Later Than Yesterday', icon: '⏰', desc: 'First session later than yesterday (after 6am)' },
  'gap-above-avg': { label: 'Longer Gaps', icon: '📏', desc: 'Average gap today exceeded 7-day average (excludes gaps crossing 6am)' },
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

// Auto-assign sortOrder based on position in BADGE_DEFINITIONS object
Object.keys(BADGE_DEFINITIONS).forEach((key, index) => {
  BADGE_DEFINITIONS[key].sortOrder = index;
});

function getBadgeDef(id) {
  return BADGE_DEFINITIONS[id] || { label: 'Unknown Medal', icon: '❓', desc: '' };
}

const DEFAULT_SETTINGS = {
  addictionProfile: null, // Set on first launch
  lastSubstance: 'thc',
  lastMethod: 'bong',
  lastAmount: 1.0,
  showCoaching: true,
  graphDays: 7,
  soundEnabled: true,
  customProfile: { name: '', types: ['', '', ''], icons: ['⚡', '⚡', '⚡'] }
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
  return now().toString(36) + '-' + (++_uidCounter).toString(36) + '-' + Math.random().toString(36).substring(2, 9);
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
  localStorage.removeItem(STORAGE_BADGES);
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
      const storedVersion = parseInt(raw) || 0;
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
      tombstones.push({ id: eventId, deletedAt: now() });
      safeSetItem(STORAGE_DELETED_IDS, JSON.stringify(tombstones));
      if (window.FirebaseSync) FirebaseSync.onDataChanged();
    } catch (e) {
      console.error('Failed to add tombstone:', e);
    }
  },

  _cleanOldTombstones() {
    try {
      const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '[]');
      const ninetyDaysAgo = now() - (90 * 24 * 60 * 60 * 1000);
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
  clearTimeout(habitChipTimeout);
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
    id: uid(), type: 'used', ts: now(),
    substance: sub, method: method || null,
    amount: amount != null ? amount : 1.0,
    reason: reason || null,
  };
}

function createResistedEvent(intensity, trigger) {
  return {
    id: uid(), type: 'resisted', ts: now(),
    intensity: intensity || null, trigger: trigger || null,
  };
}

function createHabitEvent(habit, minutes) {
  return { id: uid(), type: 'habit', ts: now(), habit, minutes: minutes || null };
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
  calculate(todayEvents, yesterdayEvents) {
    const badges = [];
    const addBadge = (condition, id) => {
      if (condition) badges.push(id);
    };

    const used     = filterUsed(todayEvents);
    const resisted = filterByType(todayEvents, 'resisted');
    const habits   = filterByType(todayEvents, 'habit');
    const subs = new Set(getProfile().substances);
    const profileUsed = used.filter(e => subs.has(e.substance)); // Profile-aware: only substances in current profile

    // --- Daily Check-in badge ---
    addBadge(todayEvents.length > 0, 'daily-checkin');

    // --- Welcome Back badge ---
    // Use event timestamps (stable) so the badge is consistent across renders.
    if (todayEvents.length > 0) {
      const allKeys = DB.getAllDayKeys(); // sorted most recent first
      for (const key of allKeys) {
        if (key >= todayKey()) continue; // skip today
        const prevDayEvents = DB.forDate(key);
        if (prevDayEvents.length > 0) {
          const lastPrevTs = prevDayEvents[prevDayEvents.length - 1].ts;
          addBadge((todayEvents[0].ts - lastPrevTs) >= 24 * 3600000, 'welcome-back');
          break;
        }
      }
    }
    const settings = DB.loadSettings();

    // --- Session-based badges ---
    for (let i = 0; i < resisted.length; i++) addBadge(true, 'resist');

    const urgeSurfedCount = countUrgeSurfed(resisted, used);
    for (let i = 0; i < urgeSurfedCount; i++) addBadge(true, 'urge-surfed');

    const swapCount = countSwapCompleted(resisted, habits);
    for (let i = 0; i < swapCount; i++) addBadge(true, 'swap-completed');

    // --- Resist awareness badges ---
    for (const r of resisted) {
      addBadge(r.intensity != null, 'intensity-logged');
      addBadge(r.trigger != null, 'trigger-noted');
      addBadge(r.intensity != null && r.trigger != null, 'full-report');
      addBadge(r.intensity >= 4, 'tough-resist');
    }

    // Harm reduction vape badge
    const isCannabis = settings.addictionProfile === 'cannabis';
    const isNicotine = settings.addictionProfile === 'smoking';
    
    let vapeCount = 0;
    if (isCannabis) {
      vapeCount = profileUsed.filter(e => e.method === 'vape').length;
    } else if (isNicotine) {
      vapeCount = profileUsed.filter(e => e.substance === 'vape').length;
    }
    addBadge(vapeCount > 0, 'harm-reduction-vape');

    // Cannabis-specific badges
    if (isCannabis) {
      const cbdUsed = filterCBD(used);
      const thcUsed = filterTHC(used);
      addBadge(cbdUsed.length > 0 && thcUsed.length === 0, 'cbd-only');
    }

    const doseCount = used.filter(e => e.amount < 1).length;
    for (let i = 0; i < doseCount; i++) addBadge(true, 'dose-half');

    const mindfulCount = used.filter(e => e.reason).length;
    for (let i = 0; i < mindfulCount; i++) addBadge(true, 'mindful');

    const profileAmt = sumAmount(profileUsed);
    addBadge(profileUsed.length > 0 && profileAmt <= LOW_DAY_THRESHOLD, 'low-day');
    addBadge(profileUsed.length === 0, 'zero-use');

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
    addBadge(uniqueHabits.size >= 2, 'habit-stack');
    addBadge(uniqueHabits.size === 5, 'five-star-day');

    // --- Timing-based badges ---
    // Gap badges — include all sessions but skip gaps that cross the 6am boundary (sleep gap)
    if (profileUsed.length >= 2) {
      const todayGapsMs = getGapsMs(profileUsed);
      
      // Award only the highest gap milestone achieved today
      if (todayGapsMs.length > 0) {
        const maxGapHours = Math.max(...todayGapsMs) / 3600000;
        const milestones = getMilestoneBadges(maxGapHours, GAP_MILESTONES);
        if (milestones.length > 0) {
          addBadge(true, `gap-${milestones[0]}h`);
        }
      }
      
      // Today's average gap longer than 7-day average (includes today, same as progress section)
      const avgGap7Days = avgWithinDayGapMs(getLastNDays(7), filterProfileUsed);
      if (avgGap7Days > 0 && todayGapsMs.length > 0) {
        const todayAvgGap = todayGapsMs.reduce((s, g) => s + g, 0) / todayGapsMs.length;
        addBadge(todayAvgGap > avgGap7Days, 'gap-above-avg');
      }
    }

    // --- Time-of-day skip badges ---
    const currentHour = currentDate().getHours();
    const isPastEarlyHour = currentHour >= EARLY_HOUR;
    const noUseInRange = (start, end) => !profileUsed.some(u => {
      const h = getHour(u.ts);
      return h >= start && h < end;
    });

    // Check if this is the user's first day using the app
    const allKeys = DB.getAllDayKeys();
    const hasEventsBeforeToday = allKeys.some(key => key < todayKey() && DB.forDate(key).length > 0);
    const isFirstDay = !hasEventsBeforeToday;
    
    // On first day only: user must have started before the badge period to be eligible
    const isEligibleForSkipBadge = (end) => {
      if (!isFirstDay) return true; // After first day, always eligible
      if (todayEvents.length === 0) return false; // No events yet on first day, not eligible
      const earliestEventTs = Math.min(...todayEvents.map(e => e.ts));
      const firstEventHour = getHour(earliestEventTs);
      return firstEventHour <= end; // Must have started before the period end
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
    
    // Good Night — 12+ hour gap crossing today's 6am boundary (overnight break)
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
    addBadge(hasNightGap, 'night-gap');

    // --- Comparison badges ---
    if (yesterdayEvents && yesterdayEvents.length > 0) {
      const yProfile = filterProfileUsed(yesterdayEvents);

      addBadge(yProfile.length > 0 && profileAmt < sumAmount(yProfile), 'lower-amount');
      
      // First session later than yesterday — only awarded if you used today (compares first use after 6am)
      const todayDaytime = filterDaytime(profileUsed);
      const yesterdayDaytime = filterDaytime(yProfile);
      
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
    const resistStreak = this._countStreak('resisted');
    addBadge(resistStreak >= 2, 'resist-streak');
    
    const habitStreak = this._countStreak('habit');
    addBadge(habitStreak >= 3, 'habit-streak');

    const taperDays = this._countTaper();
    addBadge(taperDays >= 2, 'taper');
    
    // App usage streaks - award only the highest milestone
    const appStreak = this._countAppUsageStreak();
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
      const daysSinceLastUse = this._countDaysSinceLastUse();
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

  _countStreak(eventType) {
    const d = currentDate();
    
    for (let streak = 0; streak < MAX_STREAK_DAYS; streak++) {
      if (!DB.forDate(dateKey(d)).some(e => e.type === eventType)) return streak;
      d.setDate(d.getDate() - 1);
    }
    return MAX_STREAK_DAYS;
  },

  _countTaper() {
    let count = 0, prevAmt = null;
    const d = currentDate();
    
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
    const d = currentDate();
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
        return Math.floor((now() - dayUsed[dayUsed.length - 1].ts) / (1000 * 60 * 60 * 24));
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
  
  // Update dynamic labels based on profile
  const profile = getProfile();
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
    const earliestTs = Math.min(...allEvents.map(e => e.ts));
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

function badgeCardHTML(w, showCount = true) {
  const unearnedClass = w.count === 0 ? ' unearned' : '';
  const badgeHTML = showCount ? `<span class="badge-card">${w.count}</span>` : '';
  return `<li class="badge-item${unearnedClass}" title="${escapeHTML(w.desc || '')}">${badgeHTML}<div class="badge-icon">${w.icon}</div><div class="badge-label">${escapeHTML(w.label)}</div></li>`;
}

function calculateAndUpdateBadges() {
  const badgeData = loadBadgeData();
  const today = todayKey();
  const isSameDay = badgeData.todayDate === today;
  
  // Step 1: If it's a new day, add yesterday's badges to lifetime before clearing
  const lifetimeMap = new Map();
  badgeData.lifetimeBadges.forEach(w => {
    lifetimeMap.set(w.id, w.count);
  });
  
  // Save yesterday's badges before clearing
  let yesterdayBadges = [];
  if (!isSameDay && badgeData.todayBadges && badgeData.todayDate) {
    // New day detected - add to lifetime
    badgeData.todayBadges.forEach(w => {
      const current = lifetimeMap.get(w.id) || 0;
      lifetimeMap.set(w.id, current + w.count);
    });
    
    // Calculate how many days have passed since last session
    const lastDate = new Date(badgeData.todayDate + 'T12:00:00');
    const currentDate = new Date(today + 'T12:00:00');
    const daysPassed = Math.floor((currentDate - lastDate) / (24 * 60 * 60 * 1000));
    
    // Only save as "yesterday's" if exactly 1 day has passed
    if (daysPassed === 1) {
      yesterdayBadges = [...badgeData.todayBadges];
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
  const freshTodayIds = Badges.calculate(todayEvents, yesterdayEvents);
  
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
    todayUndoCount: undoCount
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
      
      return true;
    });
    
    unearnedBadges.sort((a, b) => (BADGE_DEFINITIONS[a.id]?.sortOrder ?? 999) - (BADGE_DEFINITIONS[b.id]?.sortOrder ?? 999));
    
    // Today's badges: only show earned badges
    todayEl.innerHTML = earnedBadges.length > 0
      ? earnedBadges.map(w => badgeCardHTML(w, false)).join('') + 
        '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">Daily badges update based on your activity.</div>'
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
        '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">These are badges you earned yesterday and won\'t change.</div>'
      : '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">No badges earned yesterday.</div>';
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
    '<div class="empty-state" style="grid-column:1/-1;margin-top:-20px;font-size:0.9rem;opacity:0.7;font-style:italic;word-wrap:break-word;overflow-wrap:break-word;white-space:normal">Every badge you\'ve earned will accumulate here.</div>';
}

function hasRecentWater() {
  const cutoff = now() - TWO_HOURS_MS;
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
  { label: '🌬️ Breathing Minutes / Day', color: '#5a9fd4',  valueFn: evs => getHabits(evs, 'breaths').reduce((s, e) => s + (e.minutes || 0), 0) },
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
      const timeSinceUse = now() - lastUsedTime;
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
  const data = { 
    events: DB.loadEvents(), 
    settings: DB.loadSettings(), 
    todos: loadTodos(),
    lifetimeBadges: badgeData.lifetimeBadges,
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
  const now = currentDate();
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
    const newTs = chip.dataset.val === 'now' ? now() : parseInt(chip.dataset.val);
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
        `<label>Tracking</label><div style="font-size:16px">${escapeHTML(displayName)}</div>`,
        chipGroupHTML(profile.substanceLabel, 'substance', profile.substances, evt.substance, v => profile.substanceDisplay[v])
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
      const fields = [`<label>Habit</label><div style="font-size:16px">${HABIT_LABELS[evt.habit] || evt.habit}</div>`];
      if (HABIT_SHOW_CHIPS[evt.habit]) {
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
    
    calculateAndUpdateBadges();
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

  // For custom, show config screen first (onboarding flow)
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
  
  calculateAndUpdateBadges();
  bindEvents();
  render();
  // Clear existing interval if selectProfile is called multiple times
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
}

/** Emoji picker helpers */
const CUSTOM_ICON_OPTIONS = ['⚡','☕','🥤','🍬','🍩','🍔','🎮','🎲','🃏','🎰','💊','📱','📺','🖥️','🛒','💸'];

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
    
    calculateAndUpdateBadges();
    bindEvents();
    render();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => renderMetrics(), METRICS_REFRESH_MS);
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
  
  showToast(`✅ Logged ${profile.sessionLabel}`);
  
  showUndo(evt.id);
}

function logResisted() {
  if (!checkCooldown('resisted')) return;
  const evt = createResistedEvent();
  DB.addEvent(evt);
  calculateAndUpdateBadges();
  render();
  hideUsedChips();
  hideUndo();
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
    
    // Check if this habit shows duration chips
    if (HABIT_SHOW_CHIPS[habit]) {
      // Check cooldown before showing chips
      if (!checkCooldown('habit_' + habit)) return;
      
      // Immediately log habit with 0 minutes
      const evt = createHabitEvent(habit, 0);
      DB.addEvent(evt);
      calculateAndUpdateBadges();
      render();
      hideUndo();
      
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
    hideUndo();
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
    playSound('habit');
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
  hideHabitChips,
  editEvent: openEditModal,
  closeModal,
  saveModal,
  dismissLanding,
  deleteEvent(id) {
    if (!confirm('Delete this event?')) return false;
    DB.deleteEvent(id);
    calculateAndUpdateBadges();
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
      const nowTs = now();
      for (const id of idsToDelete) {
        if (!existingIds.has(id)) tombstones.push({ id, deletedAt: nowTs });
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
      try { await FirebaseSync.pushNow(); } catch (e) { /* ignore */ }
    }
  },
  exportJSON,
  importJSON,
  clearDatabase,
  clearTodos,
  changeAddiction,
  showCustomConfig,
  saveCustomConfig,
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
  const habitTypes = ['water', 'breaths', 'clean', 'exercise', 'outside'];
  const nowTs = now();
  const thirtyDaysAgo = nowTs - (30 * 24 * 60 * 60 * 1000);
  DB.loadEvents();
  
  console.log(`Generating ${numPerHabit} events for each habit type...`);
  
  for (const habit of habitTypes) {
    for (let i = 0; i < numPerHabit; i++) {
      const timestamp = thirtyDaysAgo + Math.random() * (nowTs - thirtyDaysAgo);
      const minutes = HABIT_SHOW_CHIPS[habit]
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
    'habit-stack', 'good-start', 'app-streak', 'gap-1h', 'gap-2h']);
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
  const days = parseInt(daysAgo);
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
    const badgeItem = e.target.closest('.badge-item');
    const tile = e.target.closest('.tile[data-tooltip]');
    
    if (badgeItem) {
      e.preventDefault();
      e.stopPropagation();
      
      const tooltipText = badgeItem.getAttribute('title');
      
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
    } else {
      // Clicked outside, hide tooltip
      hideTooltip();
    }
  });
  
  // Hide tooltip on scroll
  window.addEventListener('scroll', hideTooltip, { passive: true });
}