// LENTANDO - Automated Test Suite
// Copyright (c) 2026 Frank Force
// Runs in Node.js — no external dependencies. Integrated into build via: node test.js

'use strict';

const assert = require('assert');
const fs = require('fs');

// ========== BROWSER ENVIRONMENT STUBS ==========
// Provide minimal browser globals so code.js can load in Node

const _storage = new Map();
const localStorage = {
  getItem(key) { return _storage.has(key) ? _storage.get(key) : null; },
  setItem(key, value) { _storage.set(key, String(value)); },
  removeItem(key) { _storage.delete(key); },
  clear() { _storage.clear(); }
};

// Minimal DOM stub — only what code.js needs at load time
const document = {
  getElementById() { return null; },
  addEventListener(event, fn) {
    // Capture DOMContentLoaded but don't fire it (tests control app lifecycle)
    if (event === 'DOMContentLoaded') document._domReadyFn = fn;
  },
  createElement() {
    return { id: '', className: '', setAttribute() {}, classList: { add() {}, remove() {} }, appendChild() {} };
  },
  body: { appendChild() {} },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  _domReadyFn: null
};

// Build a global/window combined object
// Use Object.defineProperty for read-only globals
global.window = global;
global.document = document;
global.localStorage = localStorage;
Object.defineProperty(global, 'navigator', {
  value: { vibrate() {}, serviceWorker: null },
  writable: true,
  configurable: true
});
global.alert = (msg) => { /* silent in tests */ };
global.confirm = () => true;
global.location = { reload() {}, href: '' };
global.window.addEventListener = (event, fn) => { /* ignore focus/visibilitychange etc */ };
global.window.matchMedia = () => ({ matches: false, addEventListener() {} });
global.Intl = global.Intl || {};
global.HTMLElement = global.HTMLElement || class HTMLElement {};

// ========== LOAD code.js INTO A SANDBOX ==========
const vm = require('vm');
const codeSource = fs.readFileSync('code.js', 'utf8');

// Remove the import('./zzfx.js') dynamic import — not available in Node
// and the serviceWorker registration
const patchedSource = codeSource
  .replace(/await import\('\.\/zzfx\.js'\)/g, '({ ZZFXSound: null })')
  .replace(/'serviceWorker' in navigator/g, 'false')
  .replace(/'use strict';/, ''); // Remove strict mode so sandbox vars become accessible

// Create a sandbox with all the browser stubs
const sandbox = {
  console,
  Date,
  Array,
  Object,
  Map,
  Set,
  String,
  Number,
  JSON,
  Math,
  RegExp,
  Error,
  TypeError,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  Intl: global.Intl,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  alert: (msg) => {},
  confirm: () => true,
  localStorage,
  document,
  navigator: { vibrate() {}, serviceWorker: null },
  location: { reload() {}, href: '' },
  HTMLElement: class HTMLElement {},
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  history: { pushState() {}, replaceState() {} },
  Promise,
  Symbol,
  Proxy: global.Proxy,
  Reflect: global.Reflect,
  WeakMap,
  WeakSet,
  ArrayBuffer,
  Uint8Array,
  TextEncoder: global.TextEncoder,
  TextDecoder: global.TextDecoder,
  URL: global.URL,
  URLSearchParams: global.URLSearchParams,
  crypto: { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
  fetch: () => Promise.resolve({ ok: false }),
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  queueMicrotask: global.queueMicrotask,
  structuredClone: global.structuredClone,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// Auto-expose top-level const/let/function declarations to the sandbox's window object.
// VM contexts isolate block-scoped vars, so we parse code.js for declaration names and
// append a patch assigning each to window (which is the sandbox). New functions are
// picked up automatically.
const declRegex = /^(?:const|let|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
const exposedNames = [...codeSource.matchAll(declRegex)].map(m => m[1]);
const exposePatch = `
;(function(){
  var _w = typeof window !== 'undefined' ? window : this;
  ${exposedNames.map(n => `if (typeof ${n} !== 'undefined') _w.${n} = ${n};`).join('\n  ')}
})();
`;

// Silence console during code.js loading to suppress debug mode banner
const _realConsole = console;
sandbox.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };

try {
  vm.runInContext(patchedSource + exposePatch, sandbox, { filename: 'code.js' });
} catch (e) {
  console.error('❌ Failed to load code.js:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// Restore real console for test output
sandbox.console = _realConsole;

// Pull needed symbols from the sandbox (all auto-exposed above)
const {
  // Utility functions
  escapeHTML, dateKey, formatDuration, getUidTimestamp, validatePassword,
  uid, now, currentDate, todayKey, daysAgoKey,
  // Gap & urge calculations
  gapCrosses6am, getGapsMs, countUrgeSurfed, countSwapCompleted,
  // Badge system
  getMilestoneBadges, Badges, calculateAndUpdateBadges,
  loadBadgeData, saveBadgeData, getBadgeDef, BADGE_DEFINITIONS,
  // Filters & stats
  filterByType, filterUsed, filterProfileUsed, filterTHC, filterCBD,
  filterDaytime, sumAmount, getHabits, getProfile, sortedByTime,
  avgWithinDayGapMs, avgDailyAmount, getLastNDays,
  // Import/export
  validateImportData,
  // Event factories
  createUsedEvent, createResistedEvent, createHabitEvent,
  // Data layer
  DB, DEFAULT_SETTINGS, ADDICTION_PROFILES,
  // Constants
  EARLY_HOUR, FIFTEEN_MINUTES_MS, GAP_MILESTONES, TBREAK_MILESTONES,
  APP_STREAK_MILESTONES, STORAGE_EVENTS, STORAGE_SETTINGS, STORAGE_BADGES,
  STORAGE_DELETED_IDS, STORAGE_VERSION, CONSOLIDATION_DAYS,
  // Consolidation
  consolidateDay, consolidateOldEvents, stripNulls,
} = sandbox;

// ========== TEST FRAMEWORK ==========
let _passed = 0;
let _failed = 0;
let _currentGroup = '';
let _groupCounts = {}; // { groupName: { passed, failed } }

function group(name) {
  _currentGroup = name;
  if (!_groupCounts[name]) _groupCounts[name] = { passed: 0, failed: 0 };
}

function test(name, fn) {
  const label = _currentGroup ? `${_currentGroup} > ${name}` : name;
  try {
    fn();
    _passed++;
    if (_currentGroup) _groupCounts[_currentGroup].passed++;
  } catch (e) {
    _failed++;
    if (_currentGroup) _groupCounts[_currentGroup].failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`        ${e.message}`);
  }
}

function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg || `Expected ${expected}, got ${actual}`);
}

function deepEq(actual, expected, msg) {
  // Cross-context objects (from vm sandbox) fail deepStrictEqual, so use JSON comparison
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

function ok(value, msg) {
  assert.ok(value, msg || `Expected truthy, got ${value}`);
}

function includes(arr, val, msg) {
  assert.ok(arr.includes(val), msg || `Expected array to include '${val}', got [${arr.join(', ')}]`);
}

function notIncludes(arr, val, msg) {
  assert.ok(!arr.includes(val), msg || `Expected array to NOT include '${val}', got [${arr.join(', ')}]`);
}

// ========== HELPER: RESET STATE BETWEEN TESTS ==========
function resetState() {
  _storage.clear();
  // Stamp data version so DB._migrateDataIfNeeded() doesn't log migration messages
  localStorage.setItem(STORAGE_VERSION, '3');
  // Reset in-memory caches
  DB._events = null;
  DB._settings = null;
  DB._dateIndex = null;
}

function setSettings(overrides) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  DB._settings = null; // force reload
}

function addEvents(events) {
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
  DB._events = null;
  DB._dateIndex = null;
}

// Make a timestamp at a specific hour on a given date key
function makeTs(dateStr, hour, min = 0) {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`).getTime();
}

function makeUsedEvent(ts, substance = 'thc', amount = 1, extra = {}) {
  return { id: uid(), type: 'used', ts, substance, amount, ...extra };
}

function makeResistEvent(ts, extra = {}) {
  return { id: uid(), type: 'resisted', ts, ...extra };
}

function makeHabitEvent(ts, habit = 'water', extra = {}) {
  return { id: uid(), type: 'habit', ts, habit, ...extra };
}

// ========== TESTS: UTILITY FUNCTIONS ==========

group('escapeHTML');

test('escapes all special characters', () => {
  eq(escapeHTML('<script>"test" & \'xss\'</script>'),
    '&lt;script&gt;&quot;test&quot; &amp; &#39;xss&#39;&lt;/script&gt;');
});

test('handles null and undefined', () => {
  eq(escapeHTML(null), '');
  eq(escapeHTML(undefined), '');
});

test('handles numbers', () => {
  eq(escapeHTML(42), '42');
});

test('returns empty string as-is', () => {
  eq(escapeHTML(''), '');
});

// ========== TESTS: dateKey ==========

group('dateKey');

test('formats Date objects correctly', () => {
  eq(dateKey(new Date('2025-03-05T10:00:00')), '2025-03-05');
});

test('formats timestamps correctly', () => {
  const ts = new Date('2025-12-31T23:59:59').getTime();
  eq(dateKey(ts), '2025-12-31');
});

test('pads single-digit months and days', () => {
  eq(dateKey(new Date('2025-01-02T10:00:00')), '2025-01-02');
});

// ========== TESTS: formatDuration ==========

group('formatDuration');

test('formats minutes', () => {
  eq(formatDuration(5 * 60000), '5m');
});

test('formats hours and minutes', () => {
  eq(formatDuration(90 * 60000), '1h 30m');
});

test('formats days hours and minutes', () => {
  eq(formatDuration((25 * 60 + 15) * 60000), '1d 1h 15m');
});

test('returns dash for non-finite', () => {
  eq(formatDuration(NaN), '—');
  eq(formatDuration(Infinity), '—');
  eq(formatDuration(-1), '—');
});

// ========== TESTS: getUidTimestamp ==========

group('getUidTimestamp');

test('extracts timestamp from valid uid', () => {
  const ts = Date.now();
  const id = ts.toString(36) + '-1-abc1234';
  const result = getUidTimestamp(id);
  eq(result, ts);
});

test('returns 0 for null/undefined/empty', () => {
  eq(getUidTimestamp(null), 0);
  eq(getUidTimestamp(undefined), 0);
  eq(getUidTimestamp(''), 0);
});

test('returns 0 for non-string', () => {
  eq(getUidTimestamp(42), 0);
});

// ========== TESTS: validatePassword ==========

group('validatePassword');

test('accepts valid password', () => {
  eq(validatePassword('MyPass123'), null);
});

test('rejects short password', () => {
  ok(validatePassword('Ab1') !== null);
});

test('rejects missing lowercase', () => {
  ok(validatePassword('ABCDEFG1') !== null);
});

test('rejects missing uppercase', () => {
  ok(validatePassword('abcdefg1') !== null);
});

test('rejects missing number', () => {
  ok(validatePassword('Abcdefgh') !== null);
});

// ========== TESTS: gapCrosses6am ==========

group('gapCrosses6am');

test('gap within afternoon does not cross 6am', () => {
  const ts1 = makeTs('2025-06-15', 14, 0);
  const ts2 = makeTs('2025-06-15', 18, 0);
  eq(gapCrosses6am(ts1, ts2), false);
});

test('gap from evening to next morning crosses 6am', () => {
  const ts1 = makeTs('2025-06-15', 22, 0);
  const ts2 = makeTs('2025-06-16', 8, 0);
  eq(gapCrosses6am(ts1, ts2), true);
});

test('gap from 5am to 7am crosses 6am', () => {
  const ts1 = makeTs('2025-06-15', 5, 0);
  const ts2 = makeTs('2025-06-15', 7, 0);
  eq(gapCrosses6am(ts1, ts2), true);
});

test('gap from 1am to 5am does NOT cross 6am', () => {
  const ts1 = makeTs('2025-06-15', 1, 0);
  const ts2 = makeTs('2025-06-15', 5, 0);
  eq(gapCrosses6am(ts1, ts2), false);
});

test('gap from 7am to 11pm same day does not cross 6am', () => {
  const ts1 = makeTs('2025-06-15', 7, 0);
  const ts2 = makeTs('2025-06-15', 23, 0);
  eq(gapCrosses6am(ts1, ts2), false);
});

// ========== TESTS: getGapsMs ==========

group('getGapsMs');

test('returns empty for less than 2 events', () => {
  const result = getGapsMs([{ ts: 1000 }]);
  deepEq(result, []);
});

test('calculates gaps between events', () => {
  const ts1 = makeTs('2025-06-15', 10, 0);
  const ts2 = makeTs('2025-06-15', 12, 0);
  const ts3 = makeTs('2025-06-15', 15, 0);
  const result = getGapsMs([{ ts: ts1 }, { ts: ts3 }, { ts: ts2 }]); // unsorted
  eq(result.length, 2);
  eq(result[0], 2 * 3600000); // 10am → 12pm
  eq(result[1], 3 * 3600000); // 12pm → 3pm
});

test('excludes gaps crossing 6am', () => {
  const ts1 = makeTs('2025-06-15', 23, 0);
  const ts2 = makeTs('2025-06-16', 8, 0); // crosses 6am
  const result = getGapsMs([{ ts: ts1 }, { ts: ts2 }]);
  deepEq(result, []); // gap should be excluded
});

// ========== TESTS: countUrgeSurfed ==========

group('countUrgeSurfed');

test('counts resist with 15+ min elapsed and no use after', () => {
  resetState();
  const resistTs = now() - 20 * 60 * 1000; // 20 min ago
  const resisted = [{ ts: resistTs, type: 'resisted' }];
  const used = [];
  eq(countUrgeSurfed(resisted, used), 1);
});

test('does not count if use happened within 15 min', () => {
  resetState();
  const resistTs = now() - 20 * 60 * 1000;
  const resisted = [{ ts: resistTs, type: 'resisted' }];
  const used = [{ ts: resistTs + 5 * 60 * 1000, type: 'used' }]; // used 5 min after resist
  eq(countUrgeSurfed(resisted, used), 0);
});

test('does not count if less than 15 min have elapsed', () => {
  resetState();
  const resistTs = now() - 5 * 60 * 1000; // 5 min ago
  const resisted = [{ ts: resistTs, type: 'resisted' }];
  const used = [];
  eq(countUrgeSurfed(resisted, used), 0);
});

test('de-dupes clustered resists within 5 min', () => {
  resetState();
  const baseTs = now() - 30 * 60 * 1000;
  const resisted = [
    { ts: baseTs, type: 'resisted' },
    { ts: baseTs + 2 * 60 * 1000, type: 'resisted' }, // 2 min later = cluster
    { ts: baseTs + 3 * 60 * 1000, type: 'resisted' }, // 3 min later = cluster
  ];
  const used = [];
  eq(countUrgeSurfed(resisted, used), 1); // only the first counts
});

// ========== TESTS: countSwapCompleted ==========

group('countSwapCompleted');

test('counts resist followed by habit within 15 min', () => {
  const baseTs = Date.now() - 30 * 60 * 1000;
  const resisted = [{ ts: baseTs, type: 'resisted' }];
  const habits = [{ ts: baseTs + 10 * 60 * 1000, type: 'habit' }];
  eq(countSwapCompleted(resisted, habits), 1);
});

test('does not count if habit is too late', () => {
  const baseTs = Date.now() - 60 * 60 * 1000;
  const resisted = [{ ts: baseTs, type: 'resisted' }];
  const habits = [{ ts: baseTs + 20 * 60 * 1000, type: 'habit' }]; // 20 min
  eq(countSwapCompleted(resisted, habits), 0);
});

test('does not count habit before resist', () => {
  const baseTs = Date.now() - 30 * 60 * 1000;
  const resisted = [{ ts: baseTs, type: 'resisted' }];
  const habits = [{ ts: baseTs - 5 * 60 * 1000, type: 'habit' }]; // before
  eq(countSwapCompleted(resisted, habits), 0);
});

// ========== TESTS: getMilestoneBadges ==========

group('getMilestoneBadges');

test('returns highest milestone reached', () => {
  deepEq(getMilestoneBadges(5, [1, 2, 4, 8, 12]), [4]);
});

test('returns exact milestone', () => {
  deepEq(getMilestoneBadges(8, [1, 2, 4, 8, 12]), [8]);
});

test('returns empty when no milestone reached', () => {
  deepEq(getMilestoneBadges(0.5, [1, 2, 4, 8, 12]), []);
});

test('returns highest when all reached', () => {
  deepEq(getMilestoneBadges(15, [1, 2, 4, 8, 12]), [12]);
});

// ========== TESTS: validateImportData ==========

group('validateImportData');

test('rejects missing events array', () => {
  const result = validateImportData({});
  eq(result.valid, false);
});

test('rejects non-array events', () => {
  const result = validateImportData({ events: 'not an array' });
  eq(result.valid, false);
});

test('accepts valid events', () => {
  const result = validateImportData({
    events: [
      { id: 'abc-1-xyz', type: 'used', ts: Date.now() - 1000 },
      { id: 'def-2-xyz', type: 'resisted', ts: Date.now() - 2000 }
    ]
  });
  eq(result.valid, true);
  eq(result.events.length, 2);
});

test('filters events with invalid timestamps', () => {
  const result = validateImportData({
    events: [
      { id: 'abc-1-xyz', type: 'used', ts: Date.now() },
      { id: 'bad-ts', type: 'used', ts: 100 }, // before year 2000
      { id: 'no-ts', type: 'used' } // missing ts
    ]
  });
  eq(result.valid, true);
  eq(result.events.length, 1);
});

test('sanitizes unsafe IDs', () => {
  const result = validateImportData({
    events: [
      { id: '<script>alert(1)</script>', type: 'used', ts: Date.now() }
    ]
  });
  eq(result.valid, true);
  // ID should have been regenerated
  ok(result.events[0].id !== '<script>alert(1)</script>');
  ok(/^[a-z0-9-]+$/.test(result.events[0].id));
});

test('returns invalid for all-bad events', () => {
  const result = validateImportData({
    events: [
      { id: 'x', type: 'used', ts: 50 }, // before 2000
      { type: 'used', ts: Date.now() } // missing id
    ]
  });
  // Second event has no id, should be skipped; first has bad ts
  eq(result.valid, false);
});

// ========== TESTS: DB MODULE ==========

group('DB');

test('addEvent stores and retrieves events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const evt = { id: uid(), type: 'used', ts: Date.now(), substance: 'thc', amount: 1 };
  DB.addEvent(evt);
  const events = DB.loadEvents();
  eq(events.length, 1);
  eq(events[0].id, evt.id);
});

test('forDate returns events for correct day', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const todayTs = Date.now();
  const evt1 = { id: uid(), type: 'used', ts: todayTs, substance: 'thc', amount: 1 };
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayTs = yesterdayDate.getTime();
  const evt2 = { id: uid(), type: 'used', ts: yesterdayTs, substance: 'thc', amount: 1 };
  addEvents([evt1, evt2]);
  
  const todayEvents = DB.forDate(dateKey(todayTs));
  eq(todayEvents.length, 1);
  eq(todayEvents[0].id, evt1.id);
});

test('deleteEvent removes event and adds tombstone', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const evt = { id: uid(), type: 'used', ts: Date.now(), substance: 'thc', amount: 1 };
  DB.addEvent(evt);
  eq(DB.loadEvents().length, 1);
  DB.deleteEvent(evt.id);
  // Force reload
  DB._events = null;
  eq(DB.loadEvents().length, 0);
  // Tombstone should exist
  const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '{}');
  ok(tombstones[evt.id]);
});

test('updateEvent modifies event data', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const evt = { id: uid(), type: 'used', ts: Date.now(), substance: 'thc', amount: 1 };
  DB.addEvent(evt);
  DB.updateEvent(evt.id, { amount: 3 });
  DB._events = null; // force reload
  const updated = DB.loadEvents().find(e => e.id === evt.id);
  eq(updated.amount, 3);
  ok(updated.modifiedAt > 0);
});

test('getAllDayKeys returns sorted keys', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  addEvents([
    { id: uid(), type: 'used', ts: today.getTime(), substance: 'thc', amount: 1 },
    { id: uid(), type: 'used', ts: yesterday.getTime(), substance: 'thc', amount: 1 }
  ]);
  
  const keys = DB.getAllDayKeys();
  eq(keys.length, 2);
  // Reverse sorted — most recent first
  ok(keys[0] >= keys[1]);
});

test('loadSettings merges with defaults', () => {
  resetState();
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ showCoaching: false }));
  DB._settings = null;
  const s = DB.loadSettings();
  eq(s.showCoaching, false); // overridden
  eq(s.soundEnabled, true); // default
});

// ========== TESTS: BADGE SYSTEM ==========

group('Badges.calculate - basic');

test('awards daily-checkin when events exist', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 1)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5), appStartTs: makeTs(daysAgoKey(5), 10) });
  includes(badges, 'daily-checkin');
});

test('does not award daily-checkin with no events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const badges = Badges.calculate([], [], {});
  notIncludes(badges, 'daily-checkin');
});

test('awards resist badge when resisted events exist', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeResistEvent(makeTs(today, 10))];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'resist');
});

test('awards zero-use when no used events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeHabitEvent(makeTs(today, 10), 'water')];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'zero-use');
  // A habit IS an event, so daily-checkin is also awarded
  includes(badges, 'daily-checkin');
});

group('Badges.calculate - habits');

test('awards drank-water badge', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeHabitEvent(makeTs(today, 10), 'water')];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'drank-water');
  notIncludes(badges, 'hydrated'); // need 5+
});

test('awards hydrated with 5+ water events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [];
  for (let i = 0; i < 5; i++) {
    events.push(makeHabitEvent(makeTs(today, 8 + i), 'water'));
  }
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'drank-water');
  includes(badges, 'hydrated');
});

test('awards five-star-day for all 5 habit types', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeHabitEvent(makeTs(today, 8), 'water'),
    makeHabitEvent(makeTs(today, 9), 'exercise'),
    makeHabitEvent(makeTs(today, 10), 'breaths'),
    makeHabitEvent(makeTs(today, 11), 'clean'),
    makeHabitEvent(makeTs(today, 12), 'outside'),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'five-star-day');
});

test('does not award five-star-day with 4 habits', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeHabitEvent(makeTs(today, 8), 'water'),
    makeHabitEvent(makeTs(today, 9), 'exercise'),
    makeHabitEvent(makeTs(today, 10), 'breaths'),
    makeHabitEvent(makeTs(today, 11), 'clean'),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'five-star-day');
});

group('Badges.calculate - harm reduction');

test('awards dose-half for amount < 1', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 0.5)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'dose-half');
});

test('awards mindful when reason is logged', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 1, { reason: 'stress' })];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'mindful');
});

test('awards one-session for exactly 1 profile use', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 1)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'one-session');
});

test('does not award one-session for 2 uses', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
    makeUsedEvent(makeTs(today, 14), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'one-session');
});

test('awards microdose-day for total amount <= 2', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
    makeUsedEvent(makeTs(today, 14), 'thc', 0.5),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'microdose-day');
});

test('does not award microdose-day for total amount > 2', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 2),
    makeUsedEvent(makeTs(today, 14), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'microdose-day');
});

group('Badges.calculate - cannabis-specific');

test('awards cbd-only when only CBD used', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'cbd', 1)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'cbd-only');
});

test('does not award cbd-only when THC also used', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'cbd', 1),
    makeUsedEvent(makeTs(today, 12), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'cbd-only');
});

test('awards edibles-only when all edibles', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 1, { method: 'edible' })];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'edibles-only');
});

test('awards vape-only for cannabis when method is vape (ignoring edibles)', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 1, { method: 'vape' }),
    makeUsedEvent(makeTs(today, 12), 'thc', 0.5, { method: 'edible' }), // edibles don't count against vape-only
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'vape-only');
});

group('Badges.calculate - alcohol-specific');

test('awards no-liquor for alcohol profile with no liquor', () => {
  resetState();
  setSettings({ addictionProfile: 'alcohol' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 18), 'beer', 2)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'no-liquor');
});

test('does not award no-liquor when liquor was consumed', () => {
  resetState();
  setSettings({ addictionProfile: 'alcohol' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 18), 'liquor', 1)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'no-liquor');
});

group('Badges.calculate - resist awareness');

test('awards intensity-logged for resisted with intensity', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeResistEvent(makeTs(today, 10), { intensity: 3 })];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'intensity-logged');
});

test('awards tough-resist for intensity 4+', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeResistEvent(makeTs(today, 10), { intensity: 4 })];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'tough-resist');
});

test('awards full-report for intensity + trigger', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeResistEvent(makeTs(today, 10), { intensity: 3, trigger: 'stress' })];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'full-report');
});

test('awards resist-majority when more resists than uses', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeResistEvent(makeTs(today, 9)),
    makeResistEvent(makeTs(today, 11)),
    makeUsedEvent(makeTs(today, 14), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'resist-majority');
});

test('does not award resist-majority when equal resists and uses', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeResistEvent(makeTs(today, 9)),
    makeUsedEvent(makeTs(today, 14), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'resist-majority');
});

group('Badges.calculate - gaps');

test('awards gap-1h for 1+ hour gap (same day, not crossing 6am)', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
    makeUsedEvent(makeTs(today, 12), 'thc', 1), // 2h gap
  ];
  addEvents(events);
  
  const yesterday = daysAgoKey(1);
  const yesterdayEvents = [makeUsedEvent(makeTs(yesterday, 20), 'thc', 1)];
  addEvents([...yesterdayEvents, ...events]);
  
  const badges = Badges.calculate(events, yesterdayEvents, { appStartDate: daysAgoKey(5) });
  includes(badges, 'gap-2h'); // 2h gap between 10 and 12
});

test('awards only highest gap milestone', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 8), 'thc', 1),
    makeUsedEvent(makeTs(today, 17), 'thc', 1), // 9h gap
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'gap-8h');
  notIncludes(badges, 'gap-1h');
  notIncludes(badges, 'gap-2h');
  notIncludes(badges, 'gap-4h');
});

group('Badges.calculate - time-of-day skips');

test('awards night-skip when no use between 0-6am (completed day)', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'thc', 1)]; // use at 10am only
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  includes(badges, 'night-skip');
});

test('does not award night-skip when use at 3am', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 3), 'thc', 1),
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'night-skip');
});

test('awards all 4 skip badges on zero-use completed day', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [makeHabitEvent(makeTs(today, 10), 'water')]; // habit only, no use
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  includes(badges, 'night-skip');
  includes(badges, 'morning-skip');
  includes(badges, 'day-skip');
  includes(badges, 'evening-skip');
});

group('Badges.calculate - comparison');

test('awards lower-amount when today < yesterday', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  
  const todayEvents = [makeUsedEvent(makeTs(today, 10), 'thc', 1)];
  const yesterdayEvents = [makeUsedEvent(makeTs(yesterday, 10), 'thc', 3)];
  addEvents([...todayEvents, ...yesterdayEvents]);
  
  const badges = Badges.calculate(todayEvents, yesterdayEvents, { appStartDate: daysAgoKey(5) });
  includes(badges, 'lower-amount');
});

test('does not award lower-amount when today > yesterday', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  
  const todayEvents = [makeUsedEvent(makeTs(today, 10), 'thc', 5)];
  const yesterdayEvents = [makeUsedEvent(makeTs(yesterday, 10), 'thc', 1)];
  addEvents([...todayEvents, ...yesterdayEvents]);
  
  const badges = Badges.calculate(todayEvents, yesterdayEvents, { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'lower-amount');
});

group('Badges.calculate - good start');

test('awards good-start when first daytime event is habit', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeHabitEvent(makeTs(today, 7), 'water'),
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  includes(badges, 'good-start');
});

test('awards good-start when first daytime event is resist', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeResistEvent(makeTs(today, 7)),
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  includes(badges, 'good-start');
});

test('does not award good-start when first daytime event is use', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 7), 'thc', 1),
    makeHabitEvent(makeTs(today, 10), 'water'),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { completedDay: true, forDate: today, appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'good-start');
});

group('Badges.calculate - streaks');

test('awards resist-streak for 2+ consecutive days of resists', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  
  const todayEvents = [makeResistEvent(makeTs(today, 10))];
  const yesterdayEvents = [makeResistEvent(makeTs(yesterday, 10))];
  addEvents([...todayEvents, ...yesterdayEvents]);
  
  const badges = Badges.calculate(todayEvents, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'resist-streak');
});

test('awards habit-streak for 3+ consecutive days of habits', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const day1 = daysAgoKey(1);
  const day2 = daysAgoKey(2);
  
  const todayEvents = [makeHabitEvent(makeTs(today, 10), 'water')];
  const day1Events = [makeHabitEvent(makeTs(day1, 10), 'water')];
  const day2Events = [makeHabitEvent(makeTs(day2, 10), 'water')];
  addEvents([...todayEvents, ...day1Events, ...day2Events]);
  
  const badges = Badges.calculate(todayEvents, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'habit-streak');
});

test('does not award habit-streak for only 2 days', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const day1 = daysAgoKey(1);
  
  const todayEvents = [makeHabitEvent(makeTs(today, 10), 'water')];
  const day1Events = [makeHabitEvent(makeTs(day1, 10), 'water')];
  addEvents([...todayEvents, ...day1Events]);
  
  const badges = Badges.calculate(todayEvents, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'habit-streak');
});

group('Badges.calculate - taper');

test('awards taper for 3+ consecutive days of decreasing use', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const day1 = daysAgoKey(1);
  const day2 = daysAgoKey(2);
  
  // Day -2: 5, Day -1: 3, Today: 1 (decreasing = tapering)
  const todayEvents = [makeUsedEvent(makeTs(today, 10), 'thc', 1)];
  const day1Events = [makeUsedEvent(makeTs(day1, 10), 'thc', 3)];
  const day2Events = [makeUsedEvent(makeTs(day2, 10), 'thc', 5)];
  addEvents([...todayEvents, ...day1Events, ...day2Events]);
  
  const badges = Badges.calculate(todayEvents, day1Events, { appStartDate: daysAgoKey(5) });
  includes(badges, 'taper');
});

group('Badges.calculate - t-break');

test('awards tbreak-1d after 1 day with no use and prior use exists', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const twoDaysAgo = daysAgoKey(2);
  
  // Use 2 days ago, nothing yesterday or today
  const oldEvents = [makeUsedEvent(makeTs(twoDaysAgo, 10), 'thc', 1)];
  const todayEvents = [makeHabitEvent(makeTs(today, 10), 'water')]; // habit only
  addEvents([...oldEvents, ...todayEvents]);
  
  const badges = Badges.calculate(todayEvents, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'zero-use');
  // tbreak-1d requires daysSinceLastUse >= 1
  includes(badges, 'tbreak-1d');
});

test('awards tbreak-1d when used today but 24h+ gap from yesterday', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  
  // Yesterday 1:00 PM use, today 1:15 PM use = 24h 15min gap
  const yesterdayEvents = [makeUsedEvent(makeTs(yesterday, 13, 0), 'thc', 1)];
  const todayEvents = [makeUsedEvent(makeTs(today, 13, 15), 'thc', 1)];
  addEvents([...yesterdayEvents, ...todayEvents]);
  
  const badges = Badges.calculate(todayEvents, yesterdayEvents, { appStartDate: daysAgoKey(5) });
  includes(badges, 'tbreak-1d'); // Gap is over 24 hours
  notIncludes(badges, 'zero-use'); // Used today
});

group('Badges.calculate - smoking profile');

test('awards vape-only for smoking profile when substance is vape', () => {
  resetState();
  setSettings({ addictionProfile: 'smoking' });
  const today = todayKey();
  const events = [makeUsedEvent(makeTs(today, 10), 'vape', 2)];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  includes(badges, 'vape-only');
  includes(badges, 'harm-reduction-vape');
});

test('does not award vape-only for smoking profile with cigarette', () => {
  resetState();
  setSettings({ addictionProfile: 'smoking' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'vape', 1),
    makeUsedEvent(makeTs(today, 12), 'cigarette', 1),
  ];
  addEvents(events);
  
  const badges = Badges.calculate(events, [], { appStartDate: daysAgoKey(5) });
  notIncludes(badges, 'vape-only');
});

group('Badges.calculate - welcome back');

test('awards welcome-back after 24h+ absence', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const threeDaysAgo = daysAgoKey(3);
  
  const oldEvents = [makeUsedEvent(makeTs(threeDaysAgo, 10), 'thc', 1)];
  const todayEvents = [makeUsedEvent(makeTs(today, 10), 'thc', 1)];
  addEvents([...oldEvents, ...todayEvents]);
  
  const badges = Badges.calculate(todayEvents, [], { 
    appStartDate: daysAgoKey(5),
    installDate: daysAgoKey(5)
  });
  includes(badges, 'welcome-back');
});

// ========== TESTS: calculateAndUpdateBadges integration ==========

group('calculateAndUpdateBadges');

test('saves and retrieves badge data', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
    makeHabitEvent(makeTs(today, 11), 'water'),
  ];
  addEvents(events);
  
  const result = calculateAndUpdateBadges();
  ok(result.todayDate === today);
  ok(result.todayBadges.length > 0);
  ok(Array.isArray(result.lifetimeBadges));
  ok(Array.isArray(result.yesterdayBadges));
  
  // Should have daily-checkin at minimum
  ok(result.todayBadges.some(b => b.id === 'daily-checkin'));
});

test('lifetime badges accumulate across days', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  
  // Simulate a previous day with badges already stored
  const yesterday = daysAgoKey(1);
  const prevEvents = [makeUsedEvent(makeTs(yesterday, 10), 'thc', 1)];
  addEvents(prevEvents);
  
  // Store badge data as if yesterday was tracked
  const prevBadgeData = {
    todayDate: yesterday,
    todayBadges: [{ id: 'daily-checkin', count: 1 }],
    yesterdayBadges: [],
    lifetimeBadges: [{ id: 'daily-checkin', count: 5 }],
    todayUndoCount: 0
  };
  localStorage.setItem(STORAGE_BADGES, JSON.stringify(prevBadgeData));
  
  // Now add today's events
  const today = todayKey();
  const todayEvts = [makeHabitEvent(makeTs(today, 9), 'water')];
  addEvents([...prevEvents, ...todayEvts]);
  DB._events = null;
  DB._dateIndex = null;
  
  const result = calculateAndUpdateBadges();
  eq(result.todayDate, today);
  
  // Lifetime should have carried over + yesterday's recalculated badges
  ok(result.lifetimeBadges.length > 0);
});

// ========== TESTS: FILTER & STATS FUNCTIONS ==========

group('filterByType');

test('filters events by type', () => {
  const events = [
    { type: 'used', ts: 1 },
    { type: 'resisted', ts: 2 },
    { type: 'used', ts: 3 },
    { type: 'habit', ts: 4 },
  ];
  const result = filterByType(events, 'used');
  eq(result.length, 2);
  ok(result.every(e => e.type === 'used'));
});

test('returns empty for no matches', () => {
  const events = [{ type: 'used', ts: 1 }];
  deepEq(filterByType(events, 'resisted'), []);
});

group('filterUsed');

test('returns only used events', () => {
  const events = [
    { type: 'used', ts: 1 },
    { type: 'resisted', ts: 2 },
    { type: 'used', ts: 3 },
  ];
  const result = filterUsed(events);
  eq(result.length, 2);
});

group('filterTHC / filterCBD');

test('filterTHC returns only thc events', () => {
  const events = [
    { type: 'used', substance: 'thc', ts: 1 },
    { type: 'used', substance: 'cbd', ts: 2 },
    { type: 'used', substance: 'thc', ts: 3 },
  ];
  eq(filterTHC(events).length, 2);
});

test('filterCBD returns only cbd events', () => {
  const events = [
    { type: 'used', substance: 'thc', ts: 1 },
    { type: 'used', substance: 'cbd', ts: 2 },
  ];
  const result = filterCBD(events);
  eq(result.length, 1);
  eq(result[0].substance, 'cbd');
});

group('sumAmount');

test('sums amount field of events', () => {
  const events = [
    { amount: 2 },
    { amount: 3.5 },
    { amount: 1 },
  ];
  eq(sumAmount(events), 6.5);
});

test('returns 0 for empty array', () => {
  eq(sumAmount([]), 0);
});

test('treats missing amount as 1 (default dose)', () => {
  const events = [{ amount: 2 }, {}];
  eq(sumAmount(events), 3); // missing amount defaults to 1
});

group('getHabits');

test('returns only habit events', () => {
  const events = [
    { type: 'habit', ts: 1, habit: 'water' },
    { type: 'used', ts: 2, substance: 'thc' },
    { type: 'habit', ts: 3, habit: 'exercise' },
  ];
  const result = getHabits(events);
  eq(result.length, 2);
  ok(result.every(e => e.type === 'habit'));
});

group('sortedByTime');

test('sorts events ascending by ts', () => {
  const events = [{ ts: 300 }, { ts: 100 }, { ts: 200 }];
  const result = sortedByTime(events);
  eq(result[0].ts, 100);
  eq(result[1].ts, 200);
  eq(result[2].ts, 300);
});

test('does not mutate original array', () => {
  const events = [{ ts: 300 }, { ts: 100 }];
  const result = sortedByTime(events);
  eq(events[0].ts, 300); // original unchanged
  eq(result[0].ts, 100);
});

group('filterProfileUsed');

test('filters used events for current profile substances', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const events = [
    { type: 'used', substance: 'thc', ts: 1 },
    { type: 'used', substance: 'beer', ts: 2 }, // not cannabis profile
    { type: 'used', substance: 'cbd', ts: 3 },
  ];
  addEvents(events);
  const result = filterProfileUsed(events);
  eq(result.length, 2); // thc + cbd
  ok(result.every(e => e.substance === 'thc' || e.substance === 'cbd'));
});

group('avgDailyAmount');

test('calculates average daily amount across day keys', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  const events = [
    makeUsedEvent(makeTs(today, 10), 'thc', 3),
    makeUsedEvent(makeTs(today, 14), 'thc', 1),    // today total: 4
    makeUsedEvent(makeTs(yesterday, 10), 'thc', 2), // yesterday total: 2
  ];
  addEvents(events);
  // avgDailyAmount takes (dayKeys[], filterFn) — averages over days with use
  const result = avgDailyAmount([today, yesterday], filterUsed);
  eq(result, 3); // (4+2)/2 = 3
});

group('getProfile');

test('returns profile for cannabis', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const profile = getProfile();
  ok(profile);
  ok(profile.substances.includes('thc'));
  ok(profile.substances.includes('cbd'));
});

test('returns profile for alcohol', () => {
  resetState();
  setSettings({ addictionProfile: 'alcohol' });
  const profile = getProfile();
  ok(profile);
  ok(profile.substances.includes('beer'));
  ok(profile.substances.includes('liquor'));
});

group('createUsedEvent / createResistedEvent / createHabitEvent');

test('createUsedEvent produces valid event', () => {
  // signature: createUsedEvent(substance, method, amount, reason)
  const evt = createUsedEvent('thc', 'vape', 2, 'test');
  eq(evt.type, 'used');
  eq(evt.substance, 'thc');
  eq(evt.amount, 2);
  eq(evt.method, 'vape');
  eq(evt.reason, 'test');
  ok(evt.id);
  ok(evt.ts > 0);
});

test('createResistedEvent produces valid event', () => {
  // signature: createResistedEvent(intensity, trigger)
  const evt = createResistedEvent(3, 'stress');
  eq(evt.type, 'resisted');
  eq(evt.intensity, 3);
  eq(evt.trigger, 'stress');
  ok(evt.id);
  ok(evt.ts > 0);
});

test('createHabitEvent produces valid event', () => {
  const evt = createHabitEvent('water');
  eq(evt.type, 'habit');
  eq(evt.habit, 'water');
  ok(evt.id);
  ok(evt.ts > 0);
});

group('getBadgeDef');

test('returns definition for known badge', () => {
  const def = getBadgeDef('daily-checkin');
  ok(def);
  ok(def.label);
  ok(def.icon);
});

test('returns fallback for unknown badge', () => {
  const def = getBadgeDef('nonexistent-badge-xyz');
  eq(def.label, 'Unknown Badge');
});

group('getLastNDays');

test('returns correct date keys (oldest first)', () => {
  const days = getLastNDays(3);
  eq(days.length, 3);
  // getLastNDays returns oldest → newest
  eq(days[0], daysAgoKey(2));
  eq(days[1], daysAgoKey(1));
  eq(days[2], todayKey());
});

group('loadBadgeData / saveBadgeData');

test('round-trips badge data through localStorage', () => {
  resetState();
  const data = {
    todayDate: todayKey(),
    todayBadges: [{ id: 'daily-checkin', count: 1 }],
    yesterdayBadges: [],
    lifetimeBadges: [{ id: 'daily-checkin', count: 3 }],
    todayUndoCount: 0,
  };
  saveBadgeData(data);
  const loaded = loadBadgeData();
  eq(loaded.todayDate, data.todayDate);
  eq(loaded.todayBadges.length, 1);
  eq(loaded.todayBadges[0].id, 'daily-checkin');
  eq(loaded.lifetimeBadges[0].count, 3);
});

group('BADGE_DEFINITIONS integrity');

test('all badge definitions have required fields', () => {
  const ids = Object.keys(BADGE_DEFINITIONS);
  ok(ids.length > 0, 'BADGE_DEFINITIONS should not be empty');
  for (const id of ids) {
    const def = BADGE_DEFINITIONS[id];
    ok(def.label, `Badge ${id} missing label`);
    ok(def.icon, `Badge ${id} missing icon`);
  }
});

test('no empty badge IDs or labels', () => {
  const ids = Object.keys(BADGE_DEFINITIONS);
  for (const id of ids) {
    ok(id.length > 0, 'Badge ID should not be empty');
    ok(id === id.trim(), `Badge ID '${id}' has whitespace`);
    ok(BADGE_DEFINITIONS[id].label.length > 0, `Badge ${id} has empty label`);
  }
});

group('filterDaytime');

test('excludes events before 6am', () => {
  const events = [
    { ts: makeTs('2025-06-15', 3, 0), type: 'used' },  // 3am — excluded
    { ts: makeTs('2025-06-15', 5, 30), type: 'used' },  // 5:30am — excluded
    { ts: makeTs('2025-06-15', 6, 0), type: 'used' },   // 6am — included
    { ts: makeTs('2025-06-15', 14, 0), type: 'used' },  // 2pm — included
  ];
  const result = filterDaytime(events);
  eq(result.length, 2);
  ok(result.every(e => new Date(e.ts).getHours() >= EARLY_HOUR));
});

test('returns all events when none before 6am', () => {
  const events = [
    { ts: makeTs('2025-06-15', 8, 0), type: 'used' },
    { ts: makeTs('2025-06-15', 20, 0), type: 'used' },
  ];
  eq(filterDaytime(events).length, 2);
});

group('avgWithinDayGapMs');

test('averages gaps across multiple days', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  const yesterday = daysAgoKey(1);
  // Today: 10am and 12pm = 2h gap
  // Yesterday: 9am and 12pm = 3h gap
  addEvents([
    makeUsedEvent(makeTs(today, 10), 'thc', 1),
    makeUsedEvent(makeTs(today, 12), 'thc', 1),
    makeUsedEvent(makeTs(yesterday, 9), 'thc', 1),
    makeUsedEvent(makeTs(yesterday, 12), 'thc', 1),
  ]);
  const result = avgWithinDayGapMs([today, yesterday], filterUsed);
  // Average of 2h and 3h = 2.5h = 9_000_000 ms
  eq(result, 2.5 * 3600000);
});

test('returns 0 when no gaps exist', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const today = todayKey();
  addEvents([makeUsedEvent(makeTs(today, 10), 'thc', 1)]); // single event = no gap
  eq(avgWithinDayGapMs([today], filterUsed), 0);
});

// ========== TESTS: STRIP NULLS ==========

group('stripNulls');

test('removes null-valued keys', () => {
  const obj = { id: '123', type: 'used', note: null, reason: null, amount: 1 };
  const changed = stripNulls(obj);
  ok(changed, 'should report changes');
  eq(obj.note, undefined, 'note removed');
  eq(obj.reason, undefined, 'reason removed');
  eq(obj.id, '123', 'id preserved');
  eq(obj.amount, 1, 'amount preserved');
});

test('returns false when no nulls', () => {
  const obj = { id: '123', type: 'used', amount: 1 };
  const changed = stripNulls(obj);
  ok(!changed, 'no changes');
  eq(Object.keys(obj).length, 3, 'all keys preserved');
});

test('preserves falsy non-null values', () => {
  const obj = { a: 0, b: false, c: '', d: undefined, e: null };
  stripNulls(obj);
  eq(obj.a, 0, 'zero preserved');
  eq(obj.b, false, 'false preserved');
  eq(obj.c, '', 'empty string preserved');
  eq(obj.d, undefined, 'undefined preserved (not a key issue)');
  eq(obj.e, undefined, 'null removed');
  ok(!('e' in obj), 'null key deleted');
});

// ========== TESTS: CONSOLIDATION ==========

group('consolidateDay');

test('merges multiple used events for same substance', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeUsedEvent(makeTs(day, 10), 'thc', 2, { method: 'vape', reason: 'stress' }),
    makeUsedEvent(makeTs(day, 14), 'thc', 3, { method: 'vape', reason: 'stress' }),
    makeUsedEvent(makeTs(day, 20), 'thc', 1, { method: 'edible', reason: 'fun' }),
  ]);
  const changed = consolidateDay(day);
  ok(changed, 'should report changes');
  const evts = DB.forDate(day);
  eq(evts.length, 1, 'should merge to one event');
  eq(evts[0].amount, 6, 'should sum amounts');
  eq(evts[0].method, 'mixed', 'mixed methods');
  eq(evts[0].reason, 'mixed', 'mixed reasons');
  eq(evts[0].consolidated, 3, 'consolidated count = 3 events');
});

test('keeps separate groups for different substances', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeUsedEvent(makeTs(day, 10), 'thc', 2),
    makeUsedEvent(makeTs(day, 14), 'cbd', 1),
    makeUsedEvent(makeTs(day, 18), 'thc', 3),
  ]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts.length, 2, 'should have two groups');
  const thc = evts.find(e => e.substance === 'thc');
  const cbd = evts.find(e => e.substance === 'cbd');
  eq(thc.amount, 5, 'thc summed');
  eq(thc.consolidated, 2, 'thc consolidated count = 2');
  eq(cbd.amount, 1, 'cbd unchanged');
  eq(cbd.consolidated, 1, 'cbd consolidated count = 1');
});

test('merges resisted events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeResistEvent(makeTs(day, 10), { intensity: 3, trigger: 'boredom' }),
    makeResistEvent(makeTs(day, 15), { intensity: 5, trigger: 'boredom' }),
    makeResistEvent(makeTs(day, 20), { intensity: 2, trigger: 'stress' }),
  ]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts.length, 1, 'all resisted merge to one');
  eq(evts[0].intensity, 10, 'intensities summed');
  eq(evts[0].trigger, 'mixed', 'different triggers become mixed');
  eq(evts[0].consolidated, 3, 'consolidated count = 3');
});

test('merges water habits with count', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeHabitEvent(makeTs(day, 8), 'water'),
    makeHabitEvent(makeTs(day, 12), 'water'),
    makeHabitEvent(makeTs(day, 18), 'water'),
  ]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts.length, 1, 'water merged to one');
  eq(evts[0].count, 3, 'count = 3');
  eq(evts[0].minutes, undefined, 'no minutes for water');
  eq(evts[0].consolidated, 3, 'consolidated count = 3');
});

test('merges exercise habits with summed minutes', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeHabitEvent(makeTs(day, 8), 'exercise', { minutes: 30 }),
    makeHabitEvent(makeTs(day, 17), 'exercise', { minutes: 20 }),
  ]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts.length, 1);
  eq(evts[0].minutes, 50, 'minutes summed');
  eq(evts[0].consolidated, 2, 'consolidated count = 2');
});

test('exercise with no minutes uses 5-min default', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeHabitEvent(makeTs(day, 8), 'exercise', { minutes: 30 }),
    makeHabitEvent(makeTs(day, 17), 'exercise'), // no minutes
  ]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts[0].minutes, 35, '30 + 5 default');
});

test('single event still gets consolidated flag', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([makeUsedEvent(makeTs(day, 10), 'thc', 2)]);
  const changed = consolidateDay(day);
  ok(changed, 'marks single event as consolidated');
  const evts = DB.forDate(day);
  eq(evts.length, 1);
  eq(evts[0].amount, 2, 'amount unchanged');
  eq(evts[0].consolidated, 1, 'single event consolidated count = 1');
});

test('no-op if all events already consolidated', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  const e = makeUsedEvent(makeTs(day, 10), 'thc', 5);
  e.consolidated = 1;
  addEvents([e]);
  const changed = consolidateDay(day);
  ok(!changed, 'should report no changes');
});

test('does not touch events on other days', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day1 = '2025-10-15';
  const day2 = '2025-10-16';
  addEvents([
    makeUsedEvent(makeTs(day1, 10), 'thc', 2),
    makeUsedEvent(makeTs(day1, 14), 'thc', 3),
    makeUsedEvent(makeTs(day2, 10), 'thc', 7),
  ]);
  consolidateDay(day1);
  const evtsDay2 = DB.forDate(day2);
  eq(evtsDay2.length, 1, 'day2 untouched');
  eq(evtsDay2[0].amount, 7, 'day2 amount untouched');
  ok(!evtsDay2[0].consolidated, 'day2 not consolidated');
});

test('keeps most recent event as keeper', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  const e1 = makeUsedEvent(makeTs(day, 10), 'thc', 1);
  const e2 = makeUsedEvent(makeTs(day, 20), 'thc', 1);
  addEvents([e1, e2]);
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts[0].id, e2.id, 'most recent event kept');
});

test('discards strays when keeper already consolidated', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  // Simulate sync strays landing on an already-consolidated day
  const stray1 = makeUsedEvent(makeTs(day, 10), 'thc', 1);
  const stray2 = makeUsedEvent(makeTs(day, 14), 'thc', 1);
  const keeper = makeUsedEvent(makeTs(day, 20), 'thc', 3);
  keeper.consolidated = 3;
  addEvents([stray1, stray2, keeper]);
  const changed = consolidateDay(day);
  ok(changed, 'strays removed');
  const evts = DB.forDate(day);
  eq(evts.length, 1, 'only keeper remains');
  eq(evts[0].id, keeper.id, 'keeper preserved');
  eq(evts[0].amount, 3, 'amount NOT re-summed — strays discarded');
  eq(evts[0].consolidated, 3, 'consolidated count unchanged');
});

test('no tombstones created during consolidation', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  const e1 = makeUsedEvent(makeTs(day, 10), 'thc', 1);
  const e2 = makeUsedEvent(makeTs(day, 14), 'thc', 1);
  const e3 = makeUsedEvent(makeTs(day, 20), 'thc', 1);
  addEvents([e1, e2, e3]);
  consolidateDay(day);
  const tombstones = JSON.parse(localStorage.getItem(STORAGE_DELETED_IDS) || '{}');
  eq(Object.keys(tombstones).length, 0, 'no tombstones created');
});

test('consolidated events get modifiedAt timestamp', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day = '2025-10-15';
  addEvents([
    makeUsedEvent(makeTs(day, 10), 'thc', 2),
    makeUsedEvent(makeTs(day, 14), 'thc', 3),
  ]);
  const before = Date.now();
  consolidateDay(day);
  const evts = DB.forDate(day);
  eq(evts.length, 1);
  ok(evts[0].modifiedAt >= before, 'modifiedAt set on merged keeper');

  // Also verify a single-event consolidation gets modifiedAt
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const day2 = '2025-10-16';
  addEvents([makeHabitEvent(makeTs(day2, 8), 'water')]);
  consolidateDay(day2);
  const evts2 = DB.forDate(day2);
  ok(evts2[0].modifiedAt >= before, 'modifiedAt set on single-event consolidation');
});

group('consolidateOldEvents');

test('consolidates days older than cutoff only', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  // Create events: one old day (90 days ago) and one recent day (today)
  const oldDay = daysAgoKey(90);
  const recentDay = todayKey();
  addEvents([
    makeUsedEvent(makeTs(oldDay, 10), 'thc', 2),
    makeUsedEvent(makeTs(oldDay, 14), 'thc', 3),
    makeUsedEvent(makeTs(recentDay, 10), 'thc', 7),
    makeUsedEvent(makeTs(recentDay, 14), 'thc', 8),
  ]);
  consolidateOldEvents();
  // Old day should be consolidated
  const oldEvts = DB.forDate(oldDay);
  eq(oldEvts.length, 1, 'old day merged');
  eq(oldEvts[0].amount, 5, 'old day amounts summed');
  eq(oldEvts[0].consolidated, 2, 'consolidated count = 2');
  // Recent day should be untouched
  const recentEvts = DB.forDate(recentDay);
  eq(recentEvts.length, 2, 'recent day not merged');
  ok(!recentEvts[0].consolidated, 'recent not flagged');
});

test('skips already-consolidated days', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const oldDay = daysAgoKey(90);
  const e = makeUsedEvent(makeTs(oldDay, 10), 'thc', 5);
  e.consolidated = 1;
  addEvents([e]);
  // Should not trigger a save (no changes)
  consolidateOldEvents();
  const evts = DB.forDate(oldDay);
  eq(evts.length, 1);
  eq(evts[0].amount, 5, 'amount unchanged');
});

test('strips null values from all events', () => {
  resetState();
  setSettings({ addictionProfile: 'cannabis' });
  const recentDay = todayKey();
  const e1 = makeUsedEvent(makeTs(recentDay, 10), 'thc', 2);
  e1.note = null;
  e1.didInstead = null;
  e1.reason = null;
  const e2 = makeHabitEvent(makeTs(recentDay, 12), 'water');
  e2.minutes = null;
  addEvents([e1, e2]);
  consolidateOldEvents();
  const evts = DB.forDate(recentDay);
  // Even recent events should have nulls stripped
  ok(!('note' in evts.find(e => e.type === 'used')), 'note null removed');
  ok(!('didInstead' in evts.find(e => e.type === 'used')), 'didInstead null removed');
  ok(!('reason' in evts.find(e => e.type === 'used')), 'reason null removed');
  ok(!('minutes' in evts.find(e => e.type === 'habit')), 'minutes null removed');
});

// ========== REPORT RESULTS ==========

// Per-group summary
const groups = Object.entries(_groupCounts);
const maxNameLen = Math.max(...groups.map(([n]) => n.length));
for (const [name, { passed, failed }] of groups) {
  const status = failed ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
  const count = failed ? `${passed}/${passed + failed}` : `${passed}`;
  console.log(`  ${status} ${name.padEnd(maxNameLen)}  ${count}`);
}

console.log('');
if (_failed === 0) {
  console.log(`\x1b[32m✅ All ${_passed} tests passed!\x1b[0m`);
} else {
  console.log(`\x1b[31m❌ ${_failed} of ${_passed + _failed} tests failed\x1b[0m`);
  process.exit(1);
}
