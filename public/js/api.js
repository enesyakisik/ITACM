/* API client + auth/session handling (postgres JWT or Firebase Web SDK). */
'use strict';

const Auth = {
  token: localStorage.getItem('itacm_token') || null,
  profile: JSON.parse(localStorage.getItem('itacm_profile') || 'null'),
  save(token, profile) {
    this.token = token;
    this.profile = profile;
    localStorage.setItem('itacm_token', token);
    localStorage.setItem('itacm_profile', JSON.stringify(profile));
  },
  clear() {
    this.token = null;
    this.profile = null;
    localStorage.removeItem('itacm_token');
    localStorage.removeItem('itacm_profile');
  },
  can(perm) { return !!(this.profile && this.profile.permissions && this.profile.permissions[perm]); },
};

let AppConfig = { backend: 'postgres', firebaseWebConfig: null };

async function loadAppConfig() {
  try {
    const res = await fetch('/api/config');
    const json = await res.json();
    if (json.success) AppConfig = json.data;
  } catch { /* offline default */ }
  return AppConfig;
}

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = {};
  try { json = await res.json(); } catch { /* non-JSON */ }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    Auth.clear();
    window.dispatchEvent(new Event('itacm:logout'));
    throw new ApiError(401, json.error || 'Session expired');
  }
  if (!res.ok || json.success === false) {
    throw new ApiError(res.status, json.error || ('HTTP ' + res.status), json.details);
  }
  return json.data;
}

/* ---- login flows ---- */

async function loginWithPassword(email, password) {
  if (AppConfig.backend === 'firebase') return loginWithFirebase(email, password);

  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  Auth.token = data.token;
  const profile = await api('/auth/verify-token', { method: 'POST' });
  Auth.save(data.token, profile);
  return profile;
}

let firebaseApp = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function loginWithFirebase(email, password) {
  if (!AppConfig.firebaseWebConfig) {
    throw new ApiError(400,
      'Firebase mode: set FIREBASE_WEB_CONFIG on the server so the UI can sign in ' +
      '(Firebase Console → Project settings → Your apps → Web app config).');
  }
  if (!window.firebase) {
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');
  }
  if (!firebaseApp) {
    firebaseApp = window.firebase.initializeApp(AppConfig.firebaseWebConfig);
    // Keep the Bearer token fresh: Firebase rotates ID tokens ~hourly.
    window.firebase.auth().onIdTokenChanged(async (user) => {
      if (user && Auth.profile) {
        Auth.token = await user.getIdToken();
        localStorage.setItem('itacm_token', Auth.token);
      }
    });
  }
  const cred = await window.firebase.auth().signInWithEmailAndPassword(email, password);
  Auth.token = await cred.user.getIdToken();
  const profile = await api('/auth/verify-token', { method: 'POST' });
  Auth.save(Auth.token, profile);
  return profile;
}

async function logout() {
  if (AppConfig.backend === 'firebase' && window.firebase && firebaseApp) {
    try { await window.firebase.auth().signOut(); } catch { /* ignore */ }
  }
  Auth.clear();
  window.dispatchEvent(new Event('itacm:logout'));
}
