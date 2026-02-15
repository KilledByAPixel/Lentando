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

// Patch: expose const/let declarations by assigning them to window (=sandbox) at the end
const exposePatch = `
;(function(){
  var _w = typeof window !== 'undefined' ? window : this;
  _w.escapeHTML = escapeHTML;
  _w.dateKey = dateKey;
  _w.formatDuration = formatDuration;
  _w.getUidTimestamp = getUidTimestamp;
  _w.validatePassword = validatePassword;
  _w.uid = uid;
  _w.now = now;
  _w.currentDate = currentDate;
  _w.todayKey = todayKey;
  _w.daysAgoKey = daysAgoKey;
  _w.gapCrosses6am = gapCrosses6am;
  _w.getGapsMs = getGapsMs;
  _w.countUrgeSurfed = countUrgeSurfed;
  _w.countSwapCompleted = countSwapCompleted;
  _w.getMilestoneBadges = getMilestoneBadges;
  _w.validateImportData = validateImportData;
  _w.filterByType = filterByType;
  _w.filterUsed = filterUsed;
  _w.filterProfileUsed = filterProfileUsed;
  _w.filterTHC = filterTHC;
  _w.filterCBD = filterCBD;
  _w.filterDaytime = filterDaytime;
  _w.sumAmount = sumAmount;
  _w.getHabits = getHabits;
  _w.getProfile = getProfile;
  _w.sortedByTime = sortedByTime;
  _w.Badges = Badges;
  _w.calculateAndUpdateBadges = calculateAndUpdateBadges;
  _w.loadBadgeData = loadBadgeData;
  _w.saveBadgeData = saveBadgeData;
  _w.BADGE_DEFINITIONS = BADGE_DEFINITIONS;
  _w.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  _w.ADDICTION_PROFILES = ADDICTION_PROFILES;
  _w.EARLY_HOUR = EARLY_HOUR;
  _w.FIFTEEN_MINUTES_MS = FIFTEEN_MINUTES_MS;
  _w.GAP_MILESTONES = GAP_MILESTONES;
  _w.TBREAK_MILESTONES = TBREAK_MILESTONES;
  _w.APP_STREAK_MILESTONES = APP_STREAK_MILESTONES;
  _w.STORAGE_EVENTS = STORAGE_EVENTS;
  _w.STORAGE_SETTINGS = STORAGE_SETTINGS;
  _w.STORAGE_BADGES = STORAGE_BADGES;
  _w.STORAGE_DELETED_IDS = STORAGE_DELETED_IDS;
  _w.createUsedEvent = createUsedEvent;
  _w.createResistedEvent = createResistedEvent;
  _w.createHabitEvent = createHabitEvent;
  _w.getBadgeDef = getBadgeDef;
  _w.getLastNDays = getLastNDays;
  _w.avgWithinDayGapMs = avgWithinDayGapMs;
  _w.avgDailyAmount = avgDailyAmount;
  _w.calcBadAmount = calcBadAmount;
  _w.getProfileForSubstance = getProfileForSubstance;
  _w.sortByTime = sortByTime;
  _w.getHour = getHour;
  _w.dateKey = dateKey;
  _w.timeOfDayMin = timeOfDayMin;
})();
`;

try {
  vm.runInContext(patchedSource + exposePatch, sandbox, { filename: 'code.js' });
} catch (e) {
  console.error('❌ Failed to load code.js:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// Pull all needed symbols from the sandbox into our scope
const {
  escapeHTML, dateKey, formatDuration, getUidTimestamp, validatePassword,
  uid, now, currentDate, todayKey, daysAgoKey, gapCrosses6am, getGapsMs,
  countUrgeSurfed, countSwapCompleted, getMilestoneBadges, validateImportData,
  filterByType, filterUsed, filterProfileUsed, filterTHC, filterCBD,
  sumAmount, getHabits, filterDaytime, getProfile, sortedByTime,
  DB, Badges, calculateAndUpdateBadges, loadBadgeData, saveBadgeData,
  BADGE_DEFINITIONS, DEFAULT_SETTINGS, ADDICTION_PROFILES, EARLY_HOUR,
  FIFTEEN_MINUTES_MS, GAP_MILESTONES, TBREAK_MILESTONES, APP_STREAK_MILESTONES,
  STORAGE_EVENTS, STORAGE_SETTINGS, STORAGE_BADGES, STORAGE_DELETED_IDS,
  createUsedEvent, createResistedEvent, createHabitEvent,
  getBadgeDef, getLastNDays, avgWithinDayGapMs, avgDailyAmount,
} = sandbox;

// ========== TEST FRAMEWORK ==========
let _passed = 0;
let _failed = 0;
let _currentGroup = '';

function group(name) {
  _currentGroup = name;
}

function test(name, fn) {
  const label = _currentGroup ? `${_currentGroup} > ${name}` : name;
  try {
    fn();
    _passed++;
  } catch (e) {
    _failed++;
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
  // Reset in-memory caches
  DB._events = null;
  DB._settings = null;
  DB._dateIndex = null;
  // Reset uid counter
  if (typeof _uidCounter !== 'undefined') {
    // _uidCounter is a let in code.js scope — we can't reset it directly,
    // but uid generation still works fine across tests
  }
}

function setSettings(overrides) {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  localStorage.setItem('ht_settings', JSON.stringify(settings));
  DB._settings = null; // force reload
}

function addEvents(events) {
  localStorage.setItem('ht_events', JSON.stringify(events));
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
  const tombstones = JSON.parse(localStorage.getItem('ht_deleted_ids') || '{}');
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
  localStorage.setItem('ht_settings', JSON.stringify({ showCoaching: false }));
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
  localStorage.setItem('ht_badges', JSON.stringify(prevBadgeData));
  
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

// ========== REPORT RESULTS ==========

console.log('');
if (_failed === 0) {
  console.log(`\x1b[32m✅ All ${_passed} tests passed!\x1b[0m`);
} else {
  console.log(`\x1b[31m❌ ${_failed} of ${_passed + _failed} tests failed\x1b[0m`);
  process.exit(1);
}
