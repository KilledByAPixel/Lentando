# AI Development Guide for Lentando

## Project Overview
Lentando is a **zero-friction habit tracker** focused on tracking addiction-related behaviors (cannabis, alcohol, nicotine, etc.) with minimal user input. It's a Progressive Web App (PWA) with Firebase authentication and cloud sync capabilities.

**Core Philosophy:**
- Minimal clicks to log events (1-2 taps max)
- Mobile-first, responsive design
- Offline-capable with service worker
- localStorage primary, Firebase backup/sync
- No external dependencies (vanilla JS)

## Architecture

### File Structure
- **index.html** - Single-page app structure, all UI elements
- **code.js** (2000+ lines) - Core app logic, event tracking, UI rendering
- **firebase-sync.js** (433 lines) - Firebase auth and cloud sync module
- **sw.js** - Service worker for offline caching (PWA)
- **manifest.json** - PWA manifest
- **local/** - Local development notes (not deployed)

### Storage Architecture
**Primary Storage:** localStorage (fast, synchronous, always available)
- Keys: `ht_events`, `ht_settings`, `ht_todos`, `ht_theme`, `ht_wins`, `ht_login_skipped`
- Data structure: JSON arrays/objects
- DB module provides sync API over localStorage

**Secondary Storage:** Cloud Firestore (backup, cross-device sync)
- Document path: `users/{uid}` 
- Merged on pull: union events by ID, max win counts, cloud wins for settings/todos
- Auto-sync with 3-second debounce on changes
- Manual sync available in Settings

### Critical Pattern: Cache Invalidation
The DB module caches loaded data in memory (`DB._events`, `DB._settings`, `DB._dateIndex`). When data changes:

1. **Always invalidate caches** after modifying localStorage
2. Use `invalidateDBCaches()` helper function (defined in firebase-sync.js)
3. **IMPORTANT:** Cache invalidation must happen INSIDE async functions before they return, not after they complete
4. Example pattern:
   ```javascript
   function pullFromCloud(userData) {
     // ... merge logic ...
     localStorage.setItem(STORAGE_EVENTS, JSON.stringify(mergedEvents));
     invalidateDBCaches(); // MUST be here, not after pullFromCloud() call
     return true;
   }
   ```

## Code Conventions

### Constants
All magic numbers and strings should be constants at the top of code.js:
```javascript
const FLASH_ANIMATION_MS = 300;
const CHIP_TIMEOUT_MS = 5000;
const STORAGE_EVENTS = 'ht_events';
```

### Memory Management
- Clear intervals/timeouts when switching contexts:
  ```javascript
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  ```
- Use `eventsAreBound` flag to prevent duplicate event listeners
- Clean up before re-binding events

### Event Listener Patterns
```javascript
// Check flag before binding
if (!eventsAreBound) {
  document.getElementById('someBtn').addEventListener('click', handler);
  eventsAreBound = true;
}
```

### Error Handling
- Wrap risky operations in try-catch (especially date parsing)
- Provide fallback UI for empty states
- Log errors but don't break the app

## Addiction Profile System

Profiles are defined in `ADDICTION_PROFILES` constant:
- **cannabis** - Cannabis/THC tracking
- **alcohol** - Alcohol consumption
- **nicotine** - Smoking/vaping
- **other** - Generic tracker

Each profile has:
- `name`: Display name
- `sessionLabel`: Button text ("Used", "Drank", etc.)
- `substances`: Array of substance types
- `substanceDisplay`: Human-readable labels
- `methods`: Consumption methods
- `amounts`: Predefined quantities
- `amountUnit`: Unit label
- `icons`: Emoji per substance type

**User Flow:**
1. First load → onboarding overlay → select profile
2. Profile stored in `ht_settings` localStorage
3. All UI adapts to selected profile (labels, options, icons)

## Firebase Integration

### Authentication
- Google OAuth (primary)
- Email/Password (with email verification)
- Auth state managed by `onAuthStateChanged` listener
- Sign-in prevention flag (`isSigningIn`) prevents duplicate popup attempts

### Auth UI Isolation
Auth inputs MUST be wrapped in a `<form>` element to prevent browser password managers from autofilling other inputs:
```javascript
<form id="auth-form" onsubmit="return false">
  <input type="email" name="email" autocomplete="username">
  <input type="password" name="password" autocomplete="current-password">
</form>
```

### Sync Flow
**On Login:**
1. `onAuthStateChanged` fires
2. `pullFromCloud()` called (fetches Firestore data)
3. Cache invalidation happens INSIDE `pullFromCloud()`
4. `continueToApp()` renders UI

**On Changes:**
1. User action modifies localStorage
2. `queueAutoSync()` called (3-second debounce)
3. After debounce, `pushToCloud()` uploads data

**Manual Sync (Settings button):**
1. Pull from cloud (download + merge)
2. Push to cloud (upload current state)
3. Re-render UI

### Merge Strategy
- **Events:** Union by unique ID (keep all, dedupe by `id` field)
- **Wins:** Take max count for each win type
- **Settings/Todos:** Cloud always wins (most recent state)

## UI Patterns

### Placeholder Tiles
On initial page load, show empty placeholder tiles before data loads:
```javascript
function renderPlaceholderTiles() {
  const metricsGrid = document.getElementById('metrics-grid');
  const progressGrid = document.getElementById('progress-grid');
  metricsGrid.innerHTML = '<div class="metric-tile placeholder"></div>'.repeat(6);
  progressGrid.innerHTML = '<div class="progress-tile placeholder"></div>'.repeat(6);
}
```
Call this in `DOMContentLoaded` BEFORE `DB.loadSettings()` or `DB.loadEvents()`

### Date Rendering
Always wrap in try-catch:
```javascript
try {
  renderDate();
} catch (e) {
  console.error('Failed to render date:', e);
}
```

### Mobile Responsiveness
- Use `flex-direction: column` for narrow layouts
- Set `width: 100%` on inputs in vertical stacks
- Test on mobile viewport (password inputs often overflow)

### Flash Animations
Use consistent timing constant:
```javascript
element.classList.add('flash-success');
setTimeout(() => element.classList.remove('flash-success'), FLASH_ANIMATION_MS);
```

## Common Tasks

### Adding a New Metric Tile
1. Add calculation logic in `renderMetrics()` or `renderProgress()`
2. Use existing tile structure:
   ```javascript
   html += `<div class="metric-tile">
     <div class="metric-label">🏆 Label</div>
     <div class="metric-value">${value}</div>
   </div>`;
   ```
3. Test with empty data (show 0 or "—" fallback)

### Adding a New Win Type
1. Define in `WIN_DEFINITIONS` constant
2. Add calculation logic in `calculateWins()`
3. Update `STORAGE_WINS` localStorage on change
4. Ensure wins are merged correctly in `pullFromCloud()` (max logic)

### Modifying Event Structure
**NEVER break backwards compatibility!**
- Events in localStorage may be old format
- Always provide defaults for new fields
- Use optional chaining: `evt?.newField ?? defaultValue`

### Service Worker Updates
1. Increment version in `sw.js`: `const CACHE_NAME = 'ht-v33'`
2. Service worker will auto-update on next page load
3. Old cache will be deleted in `activate` event

## Critical Gotchas

### ❌ DON'T load DB caches in DOMContentLoaded
```javascript
// WRONG - loads stale cache before cloud sync
document.addEventListener('DOMContentLoaded', () => {
  DB.loadSettings(); // BAD!
  DB.loadEvents();   // BAD!
});

// RIGHT - let auth flow handle initial load
document.addEventListener('DOMContentLoaded', () => {
  renderPlaceholderTiles(); // Show placeholders
  renderDate();             // Show date immediately
  // Wait for auth → pullFromCloud → continueToApp → render
});
```

### ❌ DON'T invalidate caches after async calls
```javascript
// WRONG - invalidation happens after render
await pullFromCloud(userData);
invalidateDBCaches(); // TOO LATE!
continueToApp();      // Uses old cached data

// RIGHT - invalidation inside pullFromCloud
function pullFromCloud(userData) {
  // ... merge logic ...
  invalidateDBCaches(); // Clears cache before returning
  return true;
}
```

### ❌ DON'T forget to clear intervals
```javascript
// WRONG - creates multiple timers
function selectProfile(profile) {
  timerInterval = setInterval(updateTimer, 1000); // Leaks old interval!
}

// RIGHT - clear before setting
function selectProfile(profile) {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
}
```

### ❌ DON'T use innerHTML for user input without escaping
```javascript
// WRONG - XSS vulnerability
el.innerHTML = userInput;

// RIGHT - escape HTML
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## Testing Checklist

When making changes, always test:
- ✅ Fresh browser (clear localStorage)
- ✅ Returning user (existing data)
- ✅ Login with Google
- ✅ Login with email/password
- ✅ Logout → login again
- ✅ Cancel sign-in popup (should still work on retry)
- ✅ Mobile viewport (320px width)
- ✅ Offline mode (service worker)
- ✅ Data renders without refresh after login
- ✅ Manual sync button works
- ✅ Auto-sync triggers after changes (check Network tab)

## Performance Considerations

- **Minimize re-renders:** Only re-render when data actually changes
- **Debounce auto-sync:** 3 seconds prevents excessive Firestore writes
- **Cache locally:** Always read from localStorage first, Firestore as backup
- **Lazy load graphs:** Only render complex visualizations when tab is active
- **Optimize loops:** Pre-calculate frequently used values (date ranges, etc.)

## Security Notes

- Firebase config in `firebase-sync.js` is public (expected for client-side apps)
- Firestore rules MUST restrict access to `users/{uid}` documents to owner only
- Email verification required for email/password signups
- Never store sensitive data unencrypted
- Sanitize all user input before rendering

## Future Considerations

- Consider IndexedDB for larger datasets (>10MB localStorage limit)
- Consider Firebase Cloud Functions for server-side merge logic
- Consider React/Vue if app grows beyond 3000 lines
- Consider TypeScript for better maintainability
- Consider end-to-end encryption for cloud data

---

**Last Updated:** February 8, 2026
