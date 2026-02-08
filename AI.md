# AI Development Guide for Lentando

## Project Overview
Lentando is a **zero-friction habit tracker** for addiction-related behaviors (cannabis, alcohol, nicotine, etc.). PWA with Firebase auth and cloud sync. Vanilla JS, no frameworks.

**Core Philosophy:** Minimal clicks to log (1-2 taps), mobile-first, offline-capable, localStorage primary with Firebase backup.

## Architecture

### Files
- **index.html** — Single-page app, all UI
- **code.js** — Core logic, rendering, event tracking (~2000 lines)
- **firebase-sync.js** — Firebase auth + Firestore sync (~430 lines)
- **sw.js** — Service worker (cache name: `lentando-v{N}`, increment on deploy)
- **manifest.json** — PWA manifest
- **local/** — Dev notes, not deployed

### Storage
**localStorage (primary):** Keys are `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`, `ht_wins`, `ht_login_skipped`. The `DB` module wraps localStorage with in-memory caches (`DB._events`, `DB._settings`, `DB._dateIndex`).

**Firestore (sync/backup):** Document at `users/{uid}`. Merge strategy on pull: union events by ID, max win counts, cloud wins for settings/todos. Auto-sync via `debouncedSync()` (3-second delay after changes). Manual sync in Settings.

### Cache Invalidation (Critical)
The DB module caches data in memory. After modifying localStorage, always call `invalidateDBCaches()` (defined in firebase-sync.js). **This MUST happen inside the function that writes data**, not after it returns:
```javascript
// CORRECT — invalidate before returning
function pullFromCloud(userData) {
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(merged));
  invalidateDBCaches(); // HERE, not after pullFromCloud() returns
  return true;
}
```

## Code Conventions
- **Constants** at the top of code.js for all magic numbers/strings (`FLASH_ANIMATION_MS`, `CHIP_TIMEOUT_MS`, etc.)
- **Clear intervals** before setting new ones: `if (timerInterval) clearInterval(timerInterval);`
- **`eventsAreBound` flag** prevents duplicate event listeners — check before binding
- **Error handling:** Wrap risky operations (especially date parsing) in try-catch. Provide fallback UI for empty states.
- **HTML escaping:** Always use `escapeHTML()` (regex-based, in code.js) before inserting user text via innerHTML

## Addiction Profiles
Defined in `ADDICTION_PROFILES` constant. Each profile (cannabis, alcohol, nicotine, other) has: `name`, `sessionLabel`, `substances`, `substanceDisplay`, `methods`, `amounts`, `amountUnit`, `icons`.

**Flow:** First load → onboarding overlay → select profile → stored in `ht_settings` → all UI adapts.

## Firebase

### Auth
Google OAuth + Email/Password (with email verification). State managed by `onAuthStateChanged`. The `isSigningIn` flag prevents duplicate sign-in popups.

Auth inputs **must** be wrapped in `<form id="auth-form" onsubmit="return false">` to isolate them from browser password managers autofilling other inputs on the page.

### Sync Flow
- **Login:** `onAuthStateChanged` → `pullFromCloud()` (merges + invalidates caches) → `continueToApp()` → render
- **Data changes:** code.js calls `FirebaseSync.onDataChanged()` → `debouncedSync()` (3s) → `pushToCloud()`
- **Manual sync:** pull → push → re-render

## Key Gotchas

1. **Don't pre-load DB caches in DOMContentLoaded** — let the auth flow handle it. Loading early caches stale data before Firebase sync completes.
2. **Don't invalidate caches after async calls** — do it inside the function that writes to localStorage (see Cache Invalidation above).
3. **Don't forget to clear intervals** — always `clearInterval()` before `setInterval()` to prevent timer leaks.
4. **Don't break backwards compatibility** on event structure — old events in localStorage may lack new fields. Use `evt?.newField ?? default`.
5. **Don't use innerHTML with raw user input** — always pass through `escapeHTML()` first.

## Common Tasks

### New Metric/Progress Tile
Add calculation in `renderMetrics()` or `renderProgress()`. Use existing tile structure. Always handle empty data (show 0 or "—").

### New Win Type
Define in `WIN_DEFINITIONS` constant. Wins are merged in `pullFromCloud()` using max-count logic.

### Service Worker Update
Increment version number in `sw.js`: `const CACHE_NAME = 'lentando-v{N+1}'`. Old cache auto-deletes on activate.

## General Rules
- localStorage first, Firestore as backup — never block UI on network
- Debounce writes (3s) to avoid excessive Firestore calls
- Mobile-first: use `flex-direction: column`, `width: 100%` for inputs, test at 320px
- Firestore rules must restrict `users/{uid}` to owner only
- Firebase config is intentionally public (standard for client-side apps)
