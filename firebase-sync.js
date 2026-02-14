// LENTANDO - Progress At Your Pace
// Copyright (c) 2026 Frank Force

// ============================================================
// FIREBASE AUTH + CLOUD SYNC FOR LENTANDO
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail, deleteUser } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

// ==========================================================
// 🔧 FIREBASE CONFIG — Replace with your Firebase project values
//    1. Go to https://console.firebase.google.com/
//    2. Create a project (or use an existing one)
//    3. Go to Project Settings → General → Your apps → Web app
//    4. Copy the firebaseConfig object and paste it below
//    5. Enable Authentication → Sign-in method → Google + Email/Password
//    6. Create a Firestore Database (production mode)
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyBVw-6E3tfr8NCbPtIgOqXWVvhDYnU2Twg",
  authDomain: "lentando-571ad.firebaseapp.com",
  projectId: "lentando-571ad",
  storageBucket: "lentando-571ad.firebasestorage.app",
  messagingSenderId: "578652158358",
  appId: "1:578652158358:web:10936f6ce9556fb7bb45b7",
  measurementId: "G-3KYH9VBGXX"
};


const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db, provider;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
} else {
  console.warn('[Firebase] Not configured. Edit firebase-sync.js with your Firebase project config.');
}

// ========== AUTH FUNCTIONS ==========

let isSigningIn = false;

async function loginWithGoogle() {
  if (!isConfigured) return alert('⚠️ Firebase not configured yet. See firebase-sync.js.');
  if (isSigningIn) return;
  
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    // Check if this is a brand new user
    if (result?._tokenResponse?.isNewUser) {
      showWelcomeMessage(result.user.displayName || result.user.email);
    }
    return result.user;
  } catch (err) {
    // Only log error if it's not a cancelled popup (user closed it or clicked again)
    if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
      console.error('[Auth] Google sign-in failed:', err);
    }
    // Don't re-throw on cancelled popup - just return quietly
    if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
      return null;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

async function loginWithEmail(email, password) {
  if (!isConfigured) return alert('⚠️ Firebase not configured yet. See firebase-sync.js.');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

async function signupWithEmail(email, password) {
  if (!isConfigured) return alert('⚠️ Firebase not configured yet. See firebase-sync.js.');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await sendEmailVerification(result.user);
    console.log('[Auth] Verification email sent to', email);
  } catch (e) {
    console.warn('[Auth] Could not send verification email:', e);
  }
  return result.user;
}

async function logout() {
  if (!isConfigured) return;
  await signOut(auth);
}

async function resetPassword(email) {
  if (!isConfigured) return alert('⚠️ Firebase not configured yet. See firebase-sync.js.');
  await sendPasswordResetEmail(auth, email);
}

async function deleteAccountAndData() {
  if (!isConfigured || !currentUser) return;
  // Best effort: flush any pending local changes before wiping
  try {
    if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
    setLocalUpdatedAt();
    await pushToCloud(currentUser.uid);
  } catch (err) {
    console.warn('[Auth] Could not flush before delete:', err);
  }
  // Delete Firestore user doc first
  try {
    const userDoc = doc(db, 'users', currentUser.uid);
    await deleteDoc(userDoc);
  } catch (err) {
    console.warn('[Auth] Could not delete Firestore data:', err);
  }
  // Delete the Firebase auth account
  try {
    await deleteUser(currentUser);
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      alert('⚠️ For security, please sign out, sign back in, and try deleting again.');
      return;
    }
    throw err;
  }
  currentUser = null;

  if (window.clearAllStorage) {
    window.clearAllStorage();
  }
  if (window.stopTimers) window.stopTimers();
  document.documentElement.setAttribute('data-theme', 'dark');
  updateAuthUI(null);
  if (typeof window.showLoginScreen === 'function') {
    window.showLoginScreen();
  }
}

// ========== HELPER FUNCTIONS ==========

/** Invalidate DB caches so the app re-reads from localStorage */
function invalidateDBCaches() {
  if (window.DB) {
    window.DB._events = null;
    window.DB._settings = null;
    window.DB._dateIndex = null;
  }
}

function showSyncWarning(message) {
  if (typeof window.showToast === 'function') {
    window.showToast(`⚠️ ${message}`, 4000);
    return;
  }
  alert(`⚠️ ${message}`);
}

// ========== SYNC FUNCTIONS ==========

// Storage keys (must match code.js constants)
const STORAGE_KEYS = {
  events: 'ht_events',
  settings: 'ht_settings',
  badges: 'ht_badges',
  todos: 'ht_todos',
  deletedIds: 'ht_deleted_ids',
  deletedTodoIds: 'ht_deleted_todo_ids',
  clearedAt: 'ht_cleared_at',
  loginSkipped: 'ht_login_skipped',
  version: 'ht_data_version',
  updatedAt: 'ht_last_updated',
};

function setLocalUpdatedAt() {
  (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.updatedAt, Date.now().toString());
}

function readLocalJSON(key, fallbackValue) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallbackValue;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallbackValue : parsed;
  } catch (err) {
    console.warn(`[Sync] Invalid JSON in ${key}, using default`, err);
    return fallbackValue;
  }
}

function readLocalArray(key) {
  const parsed = readLocalJSON(key, []);
  if (Array.isArray(parsed)) return parsed;
  console.warn(`[Sync] Expected array in ${key}, using default`);
  return [];
}

function readLocalObject(key) {
  const parsed = readLocalJSON(key, {});
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  console.warn(`[Sync] Expected object in ${key}, using default`);
  return {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

function readTombstoneMap(key) {
  try {
    const raw = readLocalJSON(key, {});
    return (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) ? raw : {};
  } catch {
    return {};
  }
}

function normalizeTombstones(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function getLocalData() {
  return {
    events: readLocalArray(STORAGE_KEYS.events),
    settings: readLocalObject(STORAGE_KEYS.settings),
    badges: readLocalObject(STORAGE_KEYS.badges),
    todos: readLocalArray(STORAGE_KEYS.todos),
    deletedIds: readTombstoneMap(STORAGE_KEYS.deletedIds),
    deletedTodoIds: readTombstoneMap(STORAGE_KEYS.deletedTodoIds),
    clearedAt: parseInt(localStorage.getItem(STORAGE_KEYS.clearedAt), 10) || 0,
    version: parseInt(localStorage.getItem(STORAGE_KEYS.version), 10) || 0,
    updatedAt: parseInt(localStorage.getItem(STORAGE_KEYS.updatedAt), 10) || 0
  };
}

/** Extract creation timestamp from a uid()-generated ID (base36 prefix) */
function getUidTimestamp(id) {
  if (!id || typeof id !== 'string') return 0;
  const firstPart = id.split('-')[0];
  const ts = parseInt(firstPart, 36);
  return Number.isFinite(ts) ? ts : 0;
}

/** Push all localStorage data to Firestore */
async function pushToCloud(uid) {
  if (!isConfigured || !uid) return;
  const userDoc = doc(db, 'users', uid);
  const data = getLocalData();
  // Ensure updatedAt is set before pushing so the cloud can win/lose based on recency
  if (!data.updatedAt) {
    setLocalUpdatedAt();
    data.updatedAt = parseInt(localStorage.getItem(STORAGE_KEYS.updatedAt), 10) || Date.now();
  }
  await setDoc(userDoc, data, { merge: true });
  console.log('[Sync] Pushed to cloud');
}

/** Pull from Firestore and merge into localStorage */
async function pullFromCloud(uid) {
  if (!isConfigured || !uid) return;
  const userDoc = doc(db, 'users', uid);
  const snap = await getDoc(userDoc);

  if (!snap.exists()) {
    // First login — push local data up
    await pushToCloud(uid);
    return;
  }

  const cloud = asObject(snap.data());
  const localUpdatedAt = parseInt(localStorage.getItem(STORAGE_KEYS.updatedAt), 10) || 0;
  const cloudUpdatedAt = parseInt(cloud.updatedAt, 10) || 0;
  const preferCloud = cloudUpdatedAt >= localUpdatedAt;

  // Track whether the merge produces changes that cloud doesn't already have.
  // Only push back if something actually changed — saves a write operation per pull.
  let needsPushBack = false;

  // --- Merge deletedIds (tombstones): union by id, clean old ones ---
  const cloudTombstones = normalizeTombstones(cloud.deletedIds);
  const localTombstones = readTombstoneMap(STORAGE_KEYS.deletedIds);
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  const mergedTombstones = {};
  for (const [id, deletedAt] of [...Object.entries(cloudTombstones), ...Object.entries(localTombstones)]) {
    const ts = typeof deletedAt === 'number' ? deletedAt : Date.now();
    if (ts > ninetyDaysAgo) {
      const existing = mergedTombstones[id];
      if (!existing || ts > existing) mergedTombstones[id] = ts;
    }
  }
  const seenDeletedIds = new Set(Object.keys(mergedTombstones));
  (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.deletedIds, JSON.stringify(mergedTombstones));

  // Check if local had tombstones cloud didn't (compare keys, not just count)
  for (const id of Object.keys(mergedTombstones)) {
    if (!(id in cloudTombstones)) { needsPushBack = true; break; }
  }

  // --- Merge clearedAt: take the maximum (most recent clear wins) ---
  const localClearedAt = parseInt(localStorage.getItem(STORAGE_KEYS.clearedAt), 10) || 0;
  const cloudClearedAt = parseInt(cloud.clearedAt, 10) || 0;
  const mergedClearedAt = Math.max(localClearedAt, cloudClearedAt);

  // Check if local had a more recent clear
  if (localClearedAt > cloudClearedAt) {
    needsPushBack = true;
  }
  if (mergedClearedAt > 0) {
    (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.clearedAt, mergedClearedAt.toString());
  }

  // --- Events: merge by ID (union of local + cloud, deduplicated), filter deleted ---
  const cloudEvents = asArray(cloud.events);
  const localEvents = readLocalArray(STORAGE_KEYS.events);
  const seenIds = new Set();
  const merged = [];
  const orderedEvents = preferCloud ? [...cloudEvents, ...localEvents] : [...localEvents, ...cloudEvents];
  for (const e of orderedEvents) {
    if (!e || !e.id || seenIds.has(e.id) || seenDeletedIds.has(e.id)) continue;
    // Filter out events created before the last database clear
    if (mergedClearedAt > 0 && getUidTimestamp(e.id) <= mergedClearedAt) continue;
    const parsedTs = typeof e.ts === 'number' ? e.ts : parseInt(e.ts, 10);
    if (!Number.isFinite(parsedTs)) continue;
    seenIds.add(e.id);
    merged.push(parsedTs === e.ts ? e : { ...e, ts: parsedTs });
  }
  merged.sort((a, b) => a.ts - b.ts);
  (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.events, JSON.stringify(merged));

  // Check if local contributed events cloud didn't have, or if cloud events
  // were filtered out (by tombstones/clearedAt). Compare actual IDs, not just count.
  const cloudEventIds = new Set(cloudEvents.map(e => e?.id).filter(Boolean));
  for (const e of merged) {
    if (!cloudEventIds.has(e.id)) { needsPushBack = true; break; }
  }
  // Also check if merged is smaller (cloud events got filtered out by tombstones/clear)
  if (merged.length !== cloudEvents.length) {
    needsPushBack = true;
  }

  // --- Merge badges (keep higher lifetime counts) ---
  const cloudBadges = cloud.badges || cloud.wins; // backward compat: read old 'wins' field
  if (cloudBadges && (cloudBadges.lifetimeBadges || cloudBadges.lifetimeWins)) {
    const localBadges = readLocalObject(STORAGE_KEYS.badges);
    const localLifetime = new Map((localBadges.lifetimeBadges || localBadges.lifetimeWins || []).map(w => [w.id, w.count]));
    const cloudLifetime = new Map((cloudBadges.lifetimeBadges || cloudBadges.lifetimeWins || []).map(w => [w.id, w.count]));

    // Union of all badge IDs, take the higher count
    const allIds = new Set([...localLifetime.keys(), ...cloudLifetime.keys()]);
    const mergedLifetime = [];
    for (const id of allIds) {
      mergedLifetime.push({ id, count: Math.max(localLifetime.get(id) || 0, cloudLifetime.get(id) || 0) });
    }

    const mergedBadgeData = preferCloud
      ? { ...localBadges, ...cloudBadges, lifetimeBadges: mergedLifetime }
      : { ...cloudBadges, ...localBadges, lifetimeBadges: mergedLifetime };
    // Keep the earliest appStartDate from either source
    if (localBadges.appStartDate && cloudBadges.appStartDate) {
      mergedBadgeData.appStartDate = localBadges.appStartDate < cloudBadges.appStartDate
        ? localBadges.appStartDate : cloudBadges.appStartDate;
    }
    // Keep the earliest appStartTs from either source
    if (localBadges.appStartTs && cloudBadges.appStartTs) {
      mergedBadgeData.appStartTs = Math.min(localBadges.appStartTs, cloudBadges.appStartTs);
    }
    (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.badges, JSON.stringify(mergedBadgeData));
  }

  // --- Settings: cloud takes precedence ---
  const cloudSettings = asObject(cloud.settings);
  if (Object.keys(cloudSettings).length > 0) {
    const localSettings = readLocalObject(STORAGE_KEYS.settings);
    // Prefer the more recent source
    const primarySettings = preferCloud ? cloudSettings : localSettings;
    const secondarySettings = preferCloud ? localSettings : cloudSettings;
    const mergedSettings = { ...secondarySettings, ...primarySettings };

    if (localSettings.customProfile || cloudSettings.customProfile) {
      const primaryCustom = asObject(primarySettings.customProfile);
      const secondaryCustom = asObject(secondarySettings.customProfile);
      mergedSettings.customProfile = { ...secondaryCustom, ...primaryCustom };
    }

    (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.settings, JSON.stringify(mergedSettings));
  }

  // --- Todos: per-item merge by ID with tombstones ---
  const cloudTodoTombstones = normalizeTombstones(cloud.deletedTodoIds);
  const localTodoTombstones = readTombstoneMap(STORAGE_KEYS.deletedTodoIds);
  const mergedTodoTombstones = {};
  for (const [id, deletedAt] of [...Object.entries(cloudTodoTombstones), ...Object.entries(localTodoTombstones)]) {
    const ts = typeof deletedAt === 'number' ? deletedAt : Date.now();
    if (ts > ninetyDaysAgo) {
      const existing = mergedTodoTombstones[id];
      if (!existing || ts > existing) mergedTodoTombstones[id] = ts;
    }
  }
  const deletedTodoIds = new Set(Object.keys(mergedTodoTombstones));
  (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.deletedTodoIds, JSON.stringify(mergedTodoTombstones));

  // Check if local had todo tombstones cloud didn't
  for (const id of Object.keys(mergedTodoTombstones)) {
    if (!(id in cloudTodoTombstones)) { needsPushBack = true; break; }
  }

  const cloudTodos = asArray(cloud.todos);
  const localTodos = readLocalArray(STORAGE_KEYS.todos);

  // Detect pre-migration cloud data (old { text, done } format without IDs).
  // Per-item merge requires IDs; fall back to most-recent-writer-wins for transition.
  const cloudNeedsMigration = cloudTodos.length > 0 && !cloudTodos.some(t => t?.id);

  if (cloudNeedsMigration) {
    // Legacy cloud format — use recency to pick a winner; loadTodos() will migrate on read
    if (preferCloud) {
      (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.todos, JSON.stringify(cloudTodos));
    } else {
      needsPushBack = true;
    }
  } else {
    // Normal per-item merge
    const mergedTodos = [];
    const allTodos = [...cloudTodos, ...localTodos];
    const todoById = new Map();
    for (const t of allTodos) {
      if (!t || !t.id || deletedTodoIds.has(t.id)) continue;
      // Filter out todos created before the last database clear
      if (mergedClearedAt > 0 && getUidTimestamp(t.id) <= mergedClearedAt) continue;
      const existing = todoById.get(t.id);
      if (!existing || (t.modifiedAt || 0) > (existing.modifiedAt || 0)) {
        todoById.set(t.id, t);
      }
    }
    for (const [, t] of todoById) {
      mergedTodos.push(t);
    }
    mergedTodos.sort((a, b) => (a.position || 0) - (b.position || 0));
    (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.todos, JSON.stringify(mergedTodos));

    // Check if local contributed todos cloud didn't have
    const cloudTodoIds = new Set(cloudTodos.map(t => t?.id).filter(Boolean));
    for (const t of mergedTodos) {
      if (!cloudTodoIds.has(t.id)) { needsPushBack = true; break; }
    }
    if (mergedTodos.length !== cloudTodos.length) {
      needsPushBack = true;
    }
  }

  // --- Version: take the higher version (most migrated) ---
  if (cloud.version !== undefined) {
    const localVersion = parseInt(localStorage.getItem(STORAGE_KEYS.version), 10) || 0;
    const cloudVersion = parseInt(cloud.version, 10) || 0;
    const maxVersion = Math.max(localVersion, cloudVersion);
    (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.version, maxVersion.toString());
  }

  // Stamp merge time so future pulls from other devices know this device is up-to-date
  (window.safeSetItem || localStorage.setItem.bind(localStorage))(STORAGE_KEYS.updatedAt, Date.now().toString());

  // If local is newer overall, settings/badges/todos may need pushing
  if (!preferCloud) {
    needsPushBack = true;
  }

  // Invalidate DB caches immediately after localStorage is updated
  // This ensures continueToApp() will read fresh data
  invalidateDBCaches();

  // Only push merged state back if the merge produced changes cloud doesn't have
  if (needsPushBack) {
    await pushToCloud(uid);
    console.log('[Sync] Pulled & merged,', merged.length, 'events (pushed changes back)');
  } else {
    console.log('[Sync] Pulled & merged,', merged.length, 'events (cloud was up-to-date)');
  }
}

// ========== AUTH STATE LISTENER ==========

let currentUser = null;
let authCheckComplete = false;

if (isConfigured) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthUI(user);

    if (user) {
      try {
        // Pull from cloud (which now invalidates caches internally)
        await pullFromCloud(user.uid);
        
        if (typeof window.hideLoginScreen === 'function') {
          window.hideLoginScreen();
        }
        
        // Continue to app after successful login (caches already invalidated by pullFromCloud)
        if (typeof window.continueToApp === 'function') {
          window.continueToApp();
        }
      } catch (err) {
        console.error('[Sync] Pull failed:', err);
        // Fallback: continue with local data so login never blocks app access
        if (typeof window.hideLoginScreen === 'function') {
          window.hideLoginScreen();
        }
        if (typeof window.continueToApp === 'function') {
          window.continueToApp();
        }
        showSyncWarning('Cloud sync failed. Loaded local data; sync will retry when online.');
      }
    } else if (!authCheckComplete) {
      // First auth check complete, user is not logged in
      authCheckComplete = true;
      checkAuthAndContinue();
    }
  });
} else {
  // Not configured — show setup instructions after delay
  setTimeout(() => {
    updateAuthUI(null);
    checkAuthAndContinue();
  }, 100);
}

function checkAuthAndContinue() {
  const hasSkippedLogin = localStorage.getItem(STORAGE_KEYS.loginSkipped) === 'true';
  const hasEvents = !!localStorage.getItem(STORAGE_KEYS.events);
  
  if (!currentUser && !hasSkippedLogin) {
    // Not logged in and hasn't skipped
    if (!hasEvents && typeof window.showLandingPage === 'function') {
      // Brand new user — show landing page first
      window.showLandingPage();
    } else if (typeof window.showLoginScreen === 'function') {
      // Returning user (has data but not logged in) — go straight to login
      window.showLoginScreen();
    }
  } else {
    // User is logged in or has skipped - continue to app
    if (typeof window.continueToApp === 'function') {
      window.continueToApp();
    }
  }
}

// Pull fresh data when app regains focus (e.g., switching back from another tab/app)
let _lastFocusPull = 0;
if (isConfigured) {
  window.addEventListener('focus', async () => {
    if (currentUser && Date.now() - _lastFocusPull > 30000) {
      _lastFocusPull = Date.now();
      try {
        // Flush any pending local changes before pulling to avoid cloud overwriting them
        // (e.g., confirm() dialogs trigger blur/focus, and the debounced push hasn't fired yet)
        if (_syncTimer) {
          clearTimeout(_syncTimer);
          _syncTimer = null;
          await pushToCloud(currentUser.uid);
        }
        await pullFromCloud(currentUser.uid);
        if (typeof window.render === 'function') {
          window.render();
        }
        console.log('[Sync] Refreshed data on focus');
      } catch (err) {
        console.error('[Sync] Focus refresh failed:', err);
      }
    }
  });
}

// ========== AUTH UI ==========

// Auth form HTML kept out of DOM until Settings tab is visible
const AUTH_FORM_HTML = `
  <div style="display:flex;flex-direction:column;gap:8px">
    <button class="action-btn google-btn" style="margin:0" onclick="FirebaseSync.loginWithGoogle()">Sign in with Google</button>
    <form id="auth-form" onsubmit="FirebaseSync.loginWithEmailForm(); return false" style="display:flex;flex-direction:column;gap:6px">
      <input type="email" id="auth-email" name="email" autocomplete="username" placeholder="Email" 
        style="width:100%;padding:10px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:14px">
      <div class="password-wrap">
        <input type="password" id="auth-password" name="password" autocomplete="current-password" placeholder="Password" 
          style="width:100%;padding:10px;padding-right:40px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:14px">
        <button type="button" class="password-toggle" onclick="App.togglePasswordVisibility(this)" title="Show password">👁️</button>
      </div>
      <button type="submit" style="display:none"></button>
    </form>
    <div style="display:flex;gap:6px">
      <button class="action-btn" style="flex:1;margin:0" onclick="FirebaseSync.loginWithEmailForm()">🔓 Log In</button>
      <button class="action-btn" style="flex:1;margin:0" onclick="FirebaseSync.signupWithEmailForm()">✨ Sign Up</button>
    </div>
    <button style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:2px 0;text-decoration:underline" onclick="FirebaseSync.forgotPasswordForm()">Forgot password?</button>
  </div>`;

let _authUIState = null; // 'logged-in', 'logged-out', or 'not-configured'

function updateAuthUI(user) {
  const el = document.getElementById('auth-status');
  if (!el) return;

  if (!isConfigured) {
    _authUIState = 'not-configured';
    el.innerHTML = `
      <div style="text-align:center;color:var(--muted);font-size:13px;line-height:1.5">
        <div style="font-size:18px;margin-bottom:4px">🔧</div>
        <strong>Firebase not configured yet</strong><br>
        Edit <code>firebase-sync.js</code> with your Firebase project config to enable login &amp; cloud sync.
      </div>`;
    return;
  }

  if (user) {
    _authUIState = 'logged-in';
    const name = escapeHTMLSync(user.displayName || user.email || 'User');
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap">
        <span style="font-size:14px">✅ <strong>${name}</strong></span>
        <div style="display:flex;gap:6px">
          <button class="action-btn" style="flex:none;padding:8px 12px;font-size:12px;margin:0" onclick="FirebaseSync.sync()">🔄 Sync</button>
          <button class="action-btn" style="flex:none;padding:8px 12px;font-size:12px;margin:0" onclick="FirebaseSync.logout()">Sign Out</button>
        </div>
      </div>`;
    const deleteAccountBar = document.getElementById('delete-account-bar');
    if (deleteAccountBar) deleteAccountBar.classList.remove('hidden');
  } else {
    _authUIState = 'logged-out';
    const deleteAccountBar = document.getElementById('delete-account-bar');
    if (deleteAccountBar) deleteAccountBar.classList.add('hidden');
    
    // Don't inject auth form here — only mount it when Settings tab is visible
    // Show a placeholder; mountAuthForm() will replace it if Settings is open
    const settingsPanel = document.getElementById('tab-settings');
    const isSettingsVisible = settingsPanel && settingsPanel.classList.contains('active');
    if (isSettingsVisible) {
      el.innerHTML = AUTH_FORM_HTML;
    } else {
      el.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:8px">Sign in from the Settings tab</div>`;
    }
  }
}

/** Mount auth form into DOM (call when Settings tab opens) */
function mountAuthForm() {
  if (_authUIState !== 'logged-out') return;
  const el = document.getElementById('auth-status');
  if (!el) return;
  // Only inject if not already mounted
  if (!document.getElementById('auth-form')) {
    el.innerHTML = AUTH_FORM_HTML;
  }
}

/** Remove auth form from DOM (call when leaving Settings tab) */
function unmountAuthForm() {
  if (_authUIState !== 'logged-out') return;
  const el = document.getElementById('auth-status');
  if (!el) return;
  const form = document.getElementById('auth-form');
  if (form) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:8px">Sign in from the Settings tab</div>`;
  }
}

/** Simple HTML escape (standalone copy - code.js has its own version) */
function escapeHTMLSync(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ========== DEBOUNCED SYNC ==========

let _syncTimer = null;
let _manualSyncInFlight = false;

function debouncedSync() {
  if (!currentUser) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    pushToCloud(currentUser.uid).catch(err => console.error('[Sync] Push failed:', err));
  }, 3000); // Wait 3 seconds after last change before syncing
}

/** Flush any pending sync immediately (best-effort on tab hide / close) */
function flushPendingSync() {
  if (!_syncTimer || !currentUser) return;
  clearTimeout(_syncTimer);
  _syncTimer = null;
  pushToCloud(currentUser.uid).catch(err => console.error('[Sync] Flush on close failed:', err));
}

// Flush pending writes when the user hides or closes the tab
if (isConfigured) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSync();
  });
  window.addEventListener('beforeunload', () => flushPendingSync());
}

// ========== WELCOME MESSAGE ==========

function showWelcomeMessage(nameOrEmail) {
  const name = nameOrEmail ? escapeHTMLSync(nameOrEmail.split('@')[0]) : 'there';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:200;animation:fadeIn 0.2s ease';
  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:16px;padding:32px 24px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
      <div style="font-size:48px;margin-bottom:12px">🎉</div>
      <h2 style="font-size:20px;margin-bottom:8px;color:var(--text)">Welcome, ${name}!</h2>
      <p style="font-size:14px;color:var(--muted);margin-bottom:6px">Your account has been created.</p>
      <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Your data will now sync across all your devices. A verification email has been sent to your inbox.</p>
      <button onclick="this.closest('div[style]').parentElement.remove()"
        style="background:var(--primary);color:#fff;border:none;border-radius:8px;padding:12px 32px;font-size:15px;font-weight:600;cursor:pointer">
        Let's Go!
      </button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ========== PUBLIC API ==========

window.FirebaseSync = {
  loginWithGoogle,
  loginWithEmail,
  signupWithEmail,
  sendPasswordReset: resetPassword,
  deleteAccount: deleteAccountAndData,
  mountAuthForm,
  unmountAuthForm,

  async forgotPasswordForm() {
    const email = document.getElementById('auth-email')?.value;
    if (!email) return alert('⚠️ Enter your email address first');
    try {
      await resetPassword(email);
      alert('✅ Password reset email sent! Check your inbox.');
    } catch (err) {
      alert('❌ Failed to send reset email: ' + err.message);
    }
  },

  async loginWithEmailForm() {
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    if (!email || !password) return alert('⚠️ Enter email and password');
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      alert('❌ Login failed: ' + err.message);
    }
  },

  async signupWithEmailForm() {
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    if (!email || !password) return alert('⚠️ Enter email and password');
    const pwError = window.validatePassword?.(password);
    if (pwError) return alert('⚠️ ' + pwError);
    try {
      await signupWithEmail(email, password);
      showWelcomeMessage(email);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        alert('⚠️ Account already exists — use Log In instead.');
      } else {
        alert('⚠️ Sign up failed: ' + err.message);
      }
    }
  },

  async logout() {
    if (currentUser) {
      try {
        if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
        setLocalUpdatedAt();
        await pushToCloud(currentUser.uid);
      } catch (err) {
        console.warn('[Sync] Could not flush before logout:', err);
      }
    }

    await logout();
    currentUser = null;
    
    if (window.clearAllStorage) {
      window.clearAllStorage();
    }
    if (window.stopTimers) window.stopTimers();
    document.documentElement.setAttribute('data-theme', 'dark');
    updateAuthUI(null);
    if (typeof window.showLoginScreen === 'function') {
      window.showLoginScreen();
    }
  },

  async sync() {
    if (!currentUser) return alert('⚠️ Sign in first');
    if (!window.navigator.onLine) {
      alert('⚠️ You are offline. Changes are saved locally and will sync when you reconnect.');
      return;
    }
    if (_manualSyncInFlight) {
      alert('⚠️ Sync is already in progress. Please wait a moment.');
      return;
    }
    _manualSyncInFlight = true;
    try {
      await pullFromCloud(currentUser.uid);
      
      // pullFromCloud already merges and pushes; just re-render
      if (typeof window.render === 'function') {
        window.render();
      }
      
      alert('✅ Synced to cloud!');
    } catch (err) {
      const code = err && typeof err.code === 'string' ? err.code : '';
      const msg = err && typeof err.message === 'string' ? err.message : '';
      const looksOffline = !window.navigator.onLine
        || code.includes('unavailable')
        || msg.includes('offline')
        || msg.includes('network');
      if (looksOffline) {
        alert('⚠️ Sync could not run while offline. Your local changes are safe and will sync when online.');
      } else {
        alert('❌ Sync failed: ' + (msg || 'Unknown error'));
      }
    } finally {
      _manualSyncInFlight = false;
    }
  },

  getUser() { return currentUser; },

  /** Called by code.js whenever data changes */
  onDataChanged() {
    setLocalUpdatedAt();
    debouncedSync();
  },

  /** Push current localStorage to cloud immediately (used by clearDatabase) */
  async pushNow() {
    if (!currentUser) return;
    setLocalUpdatedAt();
    await pushToCloud(currentUser.uid);
  },
  
  /** Export showWelcomeMessage for use in code.js */
  showWelcome: showWelcomeMessage
};
