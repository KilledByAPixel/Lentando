// ============================================================
// FIREBASE AUTH + CLOUD SYNC FOR LENTANDO
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

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

async function loginWithGoogle() {
  if (!isConfigured) return alert('Firebase not configured yet. See firebase-sync.js.');
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error('[Auth] Google sign-in failed:', err);
    throw err;
  }
}

async function loginWithEmail(email, password) {
  if (!isConfigured) return alert('Firebase not configured yet. See firebase-sync.js.');
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Auto-create account for new users
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    }
    throw err;
  }
}

async function logout() {
  if (!isConfigured) return;
  await signOut(auth);
}

// ========== SYNC FUNCTIONS ==========

// Storage keys (must match code.js constants)
const STORAGE_KEYS = {
  events: 'ht_events',
  settings: 'ht_settings',
  wins: 'ht_wins',
  todos: 'ht_todos',
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

  // --- Settings: cloud wins (but preserve local addictionProfile if set) ---
  if (cloud.settings) {
    const localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    const mergedSettings = { ...localSettings, ...cloud.settings };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(mergedSettings));
  }

  // --- Todos: cloud wins ---
  if (cloud.todos) {
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(cloud.todos));
  }

  // Invalidate DB caches so the app re-reads from localStorage
  if (window.DB) {
    window.DB._events = null;
    window.DB._settings = null;
    window.DB._dateIndex = null;
  }

  console.log('[Sync] Pulled from cloud, merged', mergedEvents.length, 'events');
}

// ========== AUTH STATE LISTENER ==========

let currentUser = null;

if (isConfigured) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthUI(user);

    if (user) {
      try {
        await pullFromCloud(user.uid);
        // Re-render the app with merged data
        if (typeof render === 'function') {
          window.DB?._events && (window.DB._events = null);
          render();
        }
      } catch (err) {
        console.error('[Sync] Pull failed:', err);
      }
    }
  });
} else {
  // Not configured — show setup instructions
  setTimeout(() => updateAuthUI(null), 100);
}

// ========== AUTH UI ==========

function updateAuthUI(user) {
  const el = document.getElementById('auth-status');
  if (!el) return;

  if (!isConfigured) {
    el.innerHTML = `
      <div style="text-align:center;color:var(--muted);font-size:13px;line-height:1.5">
        <div style="font-size:18px;margin-bottom:4px">🔧</div>
        <strong>Firebase not configured yet</strong><br>
        Edit <code>firebase-sync.js</code> with your Firebase project config to enable login &amp; cloud sync.
      </div>`;
    return;
  }

  if (user) {
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
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="export-btn" style="margin:0" onclick="FirebaseSync.loginWithGoogle()">🔑 Sign in with Google</button>
        <div style="display:flex;gap:6px;align-items:stretch">
          <input type="email" id="auth-email" placeholder="Email" 
            style="flex:1;padding:10px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px">
          <input type="password" id="auth-password" placeholder="Password" 
            style="flex:1;padding:10px;border:1px solid var(--card-border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px">
          <button class="export-btn" style="flex:none;padding:10px 16px;margin:0;font-size:13px" onclick="FirebaseSync.loginWithEmailForm()">Go</button>
        </div>
      </div>`;
  }
}

/** Simple HTML escape (standalone, doesn't depend on code.js) */
function escapeHTMLSync(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== DEBOUNCED SYNC ==========

let _syncTimer = null;

function debouncedSync() {
  if (!currentUser) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    pushToCloud(currentUser.uid).catch(err => console.error('[Sync] Push failed:', err));
  }, 3000); // Wait 3 seconds after last change before syncing
}

// ========== PUBLIC API ==========

window.FirebaseSync = {
  loginWithGoogle,
  loginWithEmail,

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

  async logout() {
    await logout();
    currentUser = null;
    updateAuthUI(null);
  },

  async sync() {
    if (!currentUser) return alert('Sign in first');
    try {
      await pushToCloud(currentUser.uid);
      alert('✅ Synced to cloud!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  },

  getUser() { return currentUser; },

  /** Called by code.js whenever data changes */
  onDataChanged() {
    debouncedSync();
  }
};
