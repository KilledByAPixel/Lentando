# AI Development Guide for Lentando

Lentando is a **zero-friction habit tracker** for addiction-related behaviors. PWA, vanilla JS, no frameworks. Mobile-first, offline-capable. localStorage primary, Firebase backup. Minimal clicks to log (1-2 taps).

## Architecture

### Files
- **index.html** — Single-page app, all UI
- **code.js** — Core logic, rendering, event tracking
- **firebase-sync.js** — Firebase auth + Firestore sync
- **sw.js** — Service worker (cache name: `lentando-v{N}`, increment on deploy)
- **local/** — Dev notes, not deployed

### Storage
**localStorage (primary):** Keys: `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`, `ht_wins`, `ht_login_skipped`. `DB` module wraps localStorage with in-memory caches (`DB._events`, `DB._settings`, `DB._dateIndex`).

**Firestore (sync/backup):** Document at `users/{uid}`. Merge on pull: union events by ID, max win counts, cloud wins for settings/todos. Auto-sync via `debouncedSync()` (3s). Manual sync in Settings.

### Cache Invalidation (Critical)
After modifying localStorage, call `invalidateDBCaches()`. **Must happen inside the function that writes data**, not after it returns:
```javascript
function pullFromCloud(userData) {
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(merged));
  invalidateDBCaches(); // HERE, not after pullFromCloud() returns
  return true;
}
```

## Code Conventions
- **Constants** at top of code.js for magic numbers (`FLASH_ANIMATION_MS`, `CHIP_TIMEOUT_MS`, etc.)
- **Clear intervals** before setting new ones — prevents timer leaks
- **`eventsAreBound` flag** prevents duplicate event listeners
- **try-catch** risky operations (date parsing), fallback UI for empty states
- **`escapeHTML()`** before inserting user text via innerHTML
- **Backwards compat:** old events may lack new fields — use `evt?.newField ?? default`
- **Don't pre-load DB caches in DOMContentLoaded** — let auth flow handle it

## Firebase
Google OAuth + Email/Password (with verification). State via `onAuthStateChanged`. `isSigningIn` flag prevents duplicate popups. Auth inputs **must** be in `<form id="auth-form">` to isolate from browser password managers.

- **Login:** `onAuthStateChanged` → `pullFromCloud()` (merges + invalidates caches) → `continueToApp()` → render
- **Data changes:** `FirebaseSync.onDataChanged()` → `debouncedSync()` (3s) → `pushToCloud()`
- **Manual sync:** pull → push → re-render

## Profiles
`ADDICTION_PROFILES` constant (cannabis, alcohol, nicotine, other). Each has substances, methods, amounts, icons. Selected during onboarding, stored in `ht_settings`, all UI adapts.

## Common Tasks
- **New metric tile:** Add to `renderMetrics()` or `renderProgress()`. Handle empty data.
- **New win type:** Define in `WIN_DEFINITIONS`. Merged in `pullFromCloud()` via max-count.
- **Service worker update:** Increment version in `sw.js`. Old cache auto-deletes.

## General Rules
- localStorage first, Firestore as backup — never block UI on network
- Mobile-first: `flex-direction: column`, `width: 100%` for inputs, test at 320px
- Firestore rules must restrict `users/{uid}` to owner only
- Firebase config is intentionally public (standard for client-side apps)
