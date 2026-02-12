# Lentando - AI Agent Instructions

## Project Overview
Zero-friction substance use & habit tracker. PWA, vanilla JS (no frameworks), mobile-first, offline-capable. localStorage is primary storage; Firebase is optional sync/backup. Never block UI on network.

## Architecture
- `code.js` — All app logic, rendering, badge calculations, event tracking
- `index.html` — Single-page app with inline CSS
- `firebase-sync.js` — Firebase Auth + Firestore merge logic (ES module)
- `sw.js` — Service worker (cache: `lentando-v{N}`, increment on deploy)
- `zzfx.js` — Sound effect system, do not edit.
- `build.js` — Minifies JS via terser, copies static files to `dist/`
- `local/` — Dev notes, not deployed

## Storage & Data
**localStorage keys:** `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`, `ht_badges`, `ht_login_skipped`

**DB module** wraps localStorage with in-memory caches (`DB._events`, `DB._settings`, `DB._dateIndex`). The `_dateIndex` is a lazy `Map<dateKey, events[]>`.

**Data model:**
- **Events** — `{id, type, ts, ...}` where type is `used`, `resisted`, or `habit`
- **Badges** — `{todayDate, todayBadges, lifetimeBadges, todayUndoCount}`. Merge strategy: max count per badge ID.

### Cache Invalidation (Critical)
`firebase-sync.js` uses `invalidateDBCaches()` after cloud merges — this nulls `DB._events`, `DB._settings`, `DB._dateIndex`. Must happen **inside** the function that writes to localStorage, not after it returns.

## Key Patterns

### Event Lifecycle
`logUsed()` / `logResisted()` / `logHabit()` → `DB.addEvent()` → `calculateAndUpdateBadges()` → `render()`. Cloud sync fires automatically: `DB.saveEvents()` calls `FirebaseSync.onDataChanged()` internally (debounced 3s push).

### Badge System
`calculateAndUpdateBadges()` recalculates all badges on every event change. Define new badges in `BADGE_DEFINITIONS`, add logic using `addBadge(condition, 'badge-id')` inside `calculateAndUpdateBadges()`.

### Time Boundaries
- **Day boundary:** Calendar days (midnight), BUT gap calculations exclude gaps crossing 6am (`EARLY_HOUR = 6`)
- **Gap calculations:** All gap metrics (longest gap, average gap, hour gaps) exclude gaps crossing 6am to filter out overnight sleep
- **Skip badges:** Eligible once past start time

### Firebase Sync
- **Pull:** `onAuthStateChanged` → `pullFromCloud()` → merge events (union by ID), merge settings (`{...local, ...cloud}`), max badges → `invalidateDBCaches()` → `continueToApp()`
- **Push:** Data change → `onDataChanged()` → debounced 3s → `pushToCloud()`
- **Focus-pull:** App regains focus → flush pending push, then pull fresh data

## Profiles
`ADDICTION_PROFILES`: cannabis, alcohol, smoking, custom. Each has substances, methods, amounts, icons. Selected in onboarding, access via `getProfile()`.

## Development

### Commands
```bash
npm run build      # Minifies to dist/
npm run clean      # Removes dist/
```
**Do not run node build.js during development** — only when ready to deploy.

### Test Data Generators
Defined at bottom of `code.js` (not currently exposed on `window`). To use, temporarily add `window.generateAllTestData = generateAllTestData;` etc:
- `generateAllTestData()` — Mix of everything
- `generateUseEvent(7)` — Single use event 7 days ago

## Common Gotchas
- **Don't pre-load DB in DOMContentLoaded** — Firebase auth flow handles it
- **Always `escapeHTML()`** before innerHTML with user text
- **Old events may lack new fields** — Use `evt?.field ?? default`
- **6am is a boundary for gaps** — Critical to prevent overnight sleep counting as a long gap. This way we only track gaps during the day.
- **Vanilla JS only** — ES6+ OK, no frameworks, no JSX, no build transforms
- **Mobile-first CSS** — Test at 320px viewport
- **Clear intervals before re-setting** — Prevents timer leaks
