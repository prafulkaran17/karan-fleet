// Google Drive auto-sync (client-side, no server).
// Stores the whole app data as a single JSON file "karan-fleet-data.json"
// inside the app's private Drive appDataFolder (hidden from the user's Drive UI,
// so it never clutters their Drive but is tied to their Google account).
//
// Needs a Google OAuth *Client ID* (Web type) created once in Google Cloud Console.
// See README for the 5-minute setup.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'karan-fleet-data.json';
const LS_TOKEN = 'kf_drive_token';
const LS_CLIENT = 'kf_drive_client_id';
const LS_EMAIL = 'kf_drive_email';

let tokenClient = null;
let gisLoaded = false;
let accessToken = null;
let tokenExpiry = 0;
let listeners = [];

function emit() { listeners.forEach(fn => { try { fn(status()); } catch (e) {} }); }
export function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter(x => x !== fn); }; }

export function getClientId() { try { return localStorage.getItem(LS_CLIENT) || ''; } catch (e) { return ''; } }
export function setClientId(id) { try { localStorage.setItem(LS_CLIENT, (id || '').trim()); } catch (e) {} tokenClient = null; emit(); }
export function isConfigured() { return !!getClientId(); }
export function email() { try { return localStorage.getItem(LS_EMAIL) || ''; } catch (e) { return ''; } }

function loadToken() {
  try {
    const raw = localStorage.getItem(LS_TOKEN);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && o.token && o.expiry > Date.now() + 60000) { accessToken = o.token; tokenExpiry = o.expiry; }
  } catch (e) {}
}
function saveToken() { try { localStorage.setItem(LS_TOKEN, JSON.stringify({ token: accessToken, expiry: tokenExpiry })); } catch (e) {} }

export function isSignedIn() { return !!accessToken && tokenExpiry > Date.now() + 10000; }

export function status() {
  if (!isConfigured()) return 'unconfigured';
  if (isSignedIn()) return 'signed-in';
  return 'signed-out';
}

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (gisLoaded && window.google && window.google.accounts) return resolve();
    const existing = document.querySelector('script[data-gis]');
    if (existing) { existing.addEventListener('load', () => { gisLoaded = true; resolve(); }); return; }
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true; s.setAttribute('data-gis', '1');
    s.onload = () => { gisLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Google script load नहीं हुआ — internet जाँचें'));
    document.head.appendChild(s);
  });
}

export async function signIn(interactive = true) {
  const clientId = getClientId();
  if (!clientId) throw new Error('पहले Settings में Google Client ID डालें');
  await loadGIS();
  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp && resp.access_token) {
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (Number(resp.expires_in || 3600) * 1000);
            saveToken();
            emit();
            resolve(true);
          } else {
            reject(new Error('Login पूरा नहीं हुआ'));
          }
        },
        error_callback: (err) => reject(new Error((err && err.type) || 'Login रद्द/असफल')),
      });
      tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch (e) { reject(e); }
  });
}

export function signOut() {
  try {
    if (accessToken && window.google && window.google.accounts) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
  } catch (e) {}
  accessToken = null; tokenExpiry = 0;
  try { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_EMAIL); } catch (e) {}
  emit();
}

async function api(url, opts = {}) {
  if (!isSignedIn()) throw new Error('not-signed-in');
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + accessToken, ...(opts.headers || {}) } });
  if (r.status === 401) { accessToken = null; tokenExpiry = 0; emit(); throw new Error('session खत्म — दोबारा login करें'); }
  if (!r.ok) throw new Error('Drive error ' + r.status);
  return r;
}

async function findFileId() {
  const url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=' + encodeURIComponent("name='" + FILE_NAME + "'");
  const r = await api(url);
  const j = await r.json();
  return (j.files && j.files[0]) ? j.files[0].id : null;
}

// Returns parsed data object from Drive, or null if none yet.
export async function pull() {
  const id = await findFileId();
  if (!id) return null;
  const r = await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media');
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) { return null; }
}

// Uploads the whole data object (create or overwrite).
export async function push(dataObj) {
  const body = JSON.stringify(dataObj);
  const id = await findFileId();
  if (id) {
    await api('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body,
    });
  } else {
    const boundary = 'kf' + Date.now();
    const meta = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n' +
      '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
      body + '\r\n--' + boundary + '--';
    await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart,
    });
  }
  return true;
}

export function init() { loadToken(); }
