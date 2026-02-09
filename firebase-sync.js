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


// Check if Firebase has been configured
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db, provider;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
} else {
  console.warn('[Firebase] Not configured. Edit firebase-sync.js with your Firebase project config.');
}

// ========== AUTH FUNCTIONS ==========

let isSigningIn = false;

async function loginWithGoogle() {
  if (!isConfigured) return alert('Firebase not configured yet. See firebase-sync.js.');
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
  if (!isConfigured) return alert('Firebase not configured yet. See firebase-sync.js.');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

async function signupWithEmail(email, password) {
  if (!isConfigured) return alert('Firebase not configured yet. See firebase-sync.js.');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Send verification email
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
  if (!isConfigured) return alert('Firebase not configured yet.');
  await sendPasswordResetEmail(auth, email);
}

async function deleteAccountAndData() {
  if (!isConfigured || !currentUser) return;
  // Delete Firestore user doc first
  try {
    const userDoc = doc(db, 'users', currentUser.uid);
    await deleteDoc(userDoc);
  } catch (err) {
    console.warn('[Auth] Could not delete Firestore data:', err);
  }
  // Delete the Firebase auth account
  await deleteUser(currentUser);
  currentUser = null;
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

// ========== SYNC FUNCTIONS ==========

// Storage keys (must match code.js constants)
const STORAGE_KEYS = {
  events: 'ht_events',
  settings: 'ht_settings',
  wins: 'ht_wins',
  todos: 'ht_todos',
  loginSkipped: 'ht_login_skipped',
};

function getLocalData() {
  return {
    events: JSON.parse(localStorage.getItem(STORAGE_KEYS.events) || '[]'),
    settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}'),
    wins: JSON.parse(localStorage.getItem(STORAGE_KEYS.wins) || '{}'),
    todos: JSON.parse(localStorage.getItem(STORAGE_KEYS.todos) || '[]'),
    lastSynced: Date.now()
  };
}

/** Push all localStorage data to Firestore */
async function pushToCloud(uid) {
  if (!isConfigured || !uid) return;
  const userDoc = doc(db, 'users', uid);
  const data = getLocalData();
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

  const cloud = snap.data();

  // --- Merge events by ID (union of both, cloud wins on conflict) ---
  const localEvents = JSON.parse(localStorage.getItem(STORAGE_KEYS.events) || '[]');
  const cloudEvents = cloud.events || [];

  const merged = new Map();
  for (const e of localEvents) merged.set(e.id, e);
  for (const e of cloudEvents) merged.set(e.id, e); // cloud overwrites conflicts
  const mergedEvents = Array.from(merged.values()).sort((a, b) => a.ts - b.ts);

  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(mergedEvents));

  // --- Merge wins (keep higher lifetime counts) ---
  if (cloud.wins && cloud.wins.lifetimeWins) {
    const localWins = JSON.parse(localStorage.getItem(STORAGE_KEYS.wins) || '{}');
    const localLifetime = new Map((localWins.lifetimeWins || []).map(w => [w.id, w.count]));
    const cloudLifetime = new Map((cloud.wins.lifetimeWins || []).map(w => [w.id, w.count]));

    // Union of all win IDs, take the higher count
    const allIds = new Set([...localLifetime.keys(), ...cloudLifetime.keys()]);
    const mergedLifetime = [];
    for (const id of allIds) {
      mergedLifetime.push({ id, count: Math.max(localLifetime.get(id) || 0, cloudLifetime.get(id) || 0) });
    }

    const mergedWinData = {
      ...localWins,
      ...cloud.wins,
      lifetimeWins: mergedLifetime
    };
    localStorage.setItem(STORAGE_KEYS.wins, JSON.stringify(mergedWinData));
  }

  // --- Settings: cloud wins ---
  if (cloud.settings) {
    const localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    // Cloud settings take priority, but keep local if cloud doesn't have a value
    const mergedSettings = { ...localSettings, ...cloud.settings };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(mergedSettings));
  }

  // --- Todos: cloud wins ---
  if (cloud.todos) {
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(cloud.todos));
  }

  // Invalidate DB caches immediately after localStorage is updated
  // This ensures continueToApp() will read fresh data
  invalidateDBCaches();

  console.log('[Sync] Pulled from cloud, merged', mergedEvents.length, 'events');
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
        
        // Hide login screen and clear auth inputs from DOM
        if (typeof hideLoginScreen === 'function') {
          hideLoginScreen();
        }
        
        // Continue to app after successful login (caches already invalidated by pullFromCloud)
        if (typeof continueToApp === 'function') {
          continueToApp();
        }
      } catch (err) {
        console.error('[Sync] Pull failed:', err);
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
  
  if (!currentUser && !hasSkippedLogin) {
    // Not logged in and hasn't skipped - show login screen
    if (typeof showLoginScreen === 'function') {
      showLoginScreen();
    }
  } else {
    // User is logged in or has skipped - continue to app
    if (typeof continueToApp === 'function') {
      continueToApp();
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
        if (typeof render === 'function') {
          render();
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
    <button class="export-btn" style="margin:0" onclick="FirebaseSync.loginWithGoogle()">🔑 Sign in with Google</button>
    <form id="auth-form" onsubmit="return false" style="display:flex;flex-direction:column;gap:6px">
      <input type="email" id="auth-email" name="email" autocomplete="username" placeholder="Email" 
        style="width:100%;padding:10px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px">
      <input type="password" id="auth-password" name="password" autocomplete="current-password" placeholder="Password (8+ chars)" 
        style="width:100%;padding:10px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px">
    </form>
    <div style="display:flex;gap:6px">
      <button class="export-btn" style="flex:1;margin:0" onclick="FirebaseSync.loginWithEmailForm()">🔓 Log In</button>
      <button class="export-btn" style="flex:1;margin:0" onclick="FirebaseSync.signupWithEmailForm()">✨ Sign Up</button>
    </div>
    <button style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;padding:2px 0;text-decoration:underline" onclick="FirebaseSync.forgotPasswordForm()">Forgot password?</button>
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
          <button class="export-btn" style="flex:none;padding:8px 12px;font-size:12px;margin:0" onclick="FirebaseSync.sync()">🔄 Sync</button>
          <button class="export-btn" style="flex:none;padding:8px 12px;font-size:12px;margin:0" onclick="FirebaseSync.logout()">Sign Out</button>
        </div>
      </div>`;
  } else {
    _authUIState = 'logged-out';
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== DEBOUNCED SYNC ==========

let _syncTimer = null;

function debouncedSync() {
  if (!currentUser) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    pushToCloud(currentUser.uid).catch(err => console.error('[Sync] Push failed:', err));
  }, 3000); // Wait 3 seconds after last change before syncing
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
    if (!email) return alert('Enter your email address first');
    try {
      await resetPassword(email);
      alert('✅ Password reset email sent! Check your inbox.');
    } catch (err) {
      alert('Failed to send reset email: ' + err.message);
    }
  },

  async loginWithEmailForm() {
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    if (!email || !password) return alert('Enter email and password');
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  },

  async signupWithEmailForm() {
    const email = document.getElementById('auth-email')?.value;
    const password = document.getElementById('auth-password')?.value;
    if (!email || !password) return alert('Enter email and password');
    if (password.length < 8) return alert('Password must be at least 8 characters');
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return alert('Password must contain both letters and numbers');
    try {
      await signupWithEmail(email, password);
      showWelcomeMessage(email);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        alert('Account already exists — use Log In instead.');
      } else {
        alert('Sign up failed: ' + err.message);
      }
    }
  },

  async logout() {
    await logout();
    currentUser = null;
    updateAuthUI(null);
  },

  async sync() {
    if (!currentUser) return alert('Sign in first');
    try {
      await pullFromCloud(currentUser.uid);
      await pushToCloud(currentUser.uid);
      
      // pullFromCloud already invalidated caches; just re-render
      if (typeof render === 'function') {
        render();
      }
      
      alert('✅ Synced to cloud!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  },

  getUser() { return currentUser; },

  /** Called by code.js whenever data changes */
  onDataChanged() {
    debouncedSync();
  },

  /** Push current localStorage to cloud immediately (used by clearDatabase) */
  async pushNow() {
    if (!currentUser) return;
    await pushToCloud(currentUser.uid);
  },
  
  /** Export showWelcomeMessage for use in code.js */
  showWelcome: showWelcomeMessage
};
