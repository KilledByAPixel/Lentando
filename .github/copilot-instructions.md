# Lentando - AI Agent Instructions

## Project Overview
**Zero-friction substance use & habit tracker**. PWA. Vanilla JS (no frameworks). Mobile-first. Privacy-first (localStorage + optional Firebase sync). Target: 1-2 tap logging.

## Architecture

### Core Files
- `code.js` (3000+ lines) - All app logic, rendering, win calculations, event tracking
- `index.html` - Single-page app with inline CSS, all UI components
- `firebase-sync.js` - Firebase Auth + Firestore merge logic
- `sw.js` - Service worker (cache: `lentando-v{N}`, increment on deploy)
- `build.js` - Minifies JS, copies static files to `dist/`

### Storage Strategy
**localStorage is truth, Firestore is backup**. Never block UI on network.

**Keys:** `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`, `ht_wins`, `ht_login_skipped`

**DB module:** Wraps localStorage with in-memory caches (`DB._events`, `DB._settings`, `DB._dateIndex`). The `_dateIndex` is a Map of `dateKey → events[]` built lazily.

**Critical cache invalidation rule:** After ANY firebase sync that modifies localStorage, call `DB._events = null; DB._settings = null; DB._dateIndex = null;` INSIDE the function that writes, not after it returns. Example:
```javascript
function pullFromCloud(cloudData) {
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(merged));
  DB._events = null; DB._dateIndex = null; // HERE, critical!
  return true;
}
```

### Data Model
- **Events** - Array of `{id, type, ts, ...}`. Types: `used`, `resisted`, `habit`
- **Settings** - Single object with profile, last selections, theme
- **Wins** - `{todayDate, todayWins: [{id, count}], lifetimeWins: [{id, count}]}`
- **Date keys** - `YYYY-MM-DD` format for indexing events by day

### Time Boundaries (Important!)
- **Day boundaries:** 6am (not midnight). `EARLY_HOUR = 6`
- **Gap wins:** Exclude gaps crossing 6am (overnight sleep)
- **Morning Skip:** No use 6am-noon, awarded at 6am
- **Night Skip:** No use midnight-6am, awarded at 6am

## Development Workflows

### Build & Deploy
```bash
npm run build      # Minifies to dist/, ready for deploy
npm run clean      # Removes dist/
```

### Testing Tips
- Use browser DevTools localStorage viewer to inspect `ht_*` keys
- Test data generators (commented at bottom of code.js):
  - `generateAllTestData()` - Mix of events/habits/wins
  - `debugAddUseEvent(7)` - Add use event 7 days ago
- Uncomment exports: `window.generateAllTestData = generateAllTestData;`

### Debugging Common Issues
1. **Badges not showing after sync?** → Check cache invalidation in pullFromCloud
2. **Timer display stuck?** → `timerInterval` not cleared before re-setting
3. **Duplicate event listeners?** → `eventsAreBound` flag prevents double-binding
4. **Empty state not rendering?** → Check for `events.length === 0` in render functions

## Code Patterns

### Constants for Magic Numbers
All timing/thresholds at top of code.js:
```javascript
const COOLDOWN_MS = 60 * 1000;
const EARLY_HOUR = 6;
const CHIP_TIMEOUT_MS = 5000;
```

### Event Lifecycle
1. User action → `logUsed()`, `logResisted()`, or `logHabit()`
2. Creates event object → `DB.addEvent(evt)`
3. `stampActivity()` (updates last activity timestamp)
4. `calculateAndUpdateWins()` (recalculates all badges)
5. `render()` (updates UI)
6. `FirebaseSync.onDataChanged()` → debounced push to cloud (3s)

### Undo System
- `lastUndoEventId` persists during cooldown period (1 min)
- `showUndo(id)` / `hideUndo()` toggle visibility
- Tab switching: Preserve ID when switching away, restore if cooldown active on return
- After actual undo, clear ID immediately so it won't restore

### Win Calculation
`calculateAndUpdateWins()` is the brain. Runs on every event change. Compares today vs yesterday, checks streaks, gaps, habits. Wins stored separately from events (prevents recalculating history on every pull). Merge strategy: max count per win ID.

### Firebase Sync Flow
**Pull:** `onAuthStateChanged` → `pullFromCloud()` → merge events (union by ID), max wins, replace settings → **invalidate caches** → `continueToApp()`

**Push:** Data change → `onDataChanged()` → `debouncedSync(3s)` → `pushToCloud()`

**Manual sync button:** Pull then push, show status.

## Addiction Profiles
`ADDICTION_PROFILES` constant defines 4 profiles (cannabis, alcohol, smoking, other). Each has: substances, methods, amounts, icons, labels. Selected during onboarding, drives all UI text/options. Access via `getProfile()`.

## Adding Features

### New Metric Tile
Add to `renderProgress()`:
```javascript
tileHTML(value, 'Label', subtitle, 'Tooltip description')
```
Handle empty data (`value = '—'` if no events).

### New Badge
1. Add to `WIN_DEFINITIONS` object
2. Add logic in `calculateAndUpdateWins()` using `addWin(condition, 'win-id')`
3. Wins auto-merge on cloud sync via max count

### New Profile
Add to `ADDICTION_PROFILES` constant. Ensure all substances have icons.

## Testing Before Release
- [ ] Test offline mode (disable network in DevTools)
- [ ] Test sync between 2 devices
- [ ] Increment service worker version in `sw.js`
- [ ] Test PWA install on mobile
- [ ] Check localStorage quota on long-running test data
- [ ] Verify undo button persists during cooldown across tab switches

## Common Gotchas
- **Don't pre-load DB in DOMContentLoaded** - Let Firebase auth flow handle it
- **Always escape user input** with `escapeHTML()` before innerHTML
- **Old events may lack new fields** - Use `evt?.newField ?? defaultValue`
- **Firestore merge is NOT a true merge** - Last write wins, except events (union by ID) and wins (max count)
- **Tab switching hides chips/undo** - But undo restores if cooldown active when returning to 'today' tab
- **6am is the day boundary** - Not midnight. Critical for gap calculations.

## Code Style
- Vanilla JS, ES6+ features OK (arrow functions, destructuring, optional chaining)
- No JSX, no build-time transforms (just terser minify)
- Mobile-first CSS: `flex-direction: column`, `width: 100%` for inputs
- Test at 320px viewport
- Use semantic HTML when possible
- Keep functions focused, max ~50 lines
