// Google Drive auto-sync (client-side, no server).
// Stores the whole app data as a single JSON file "karan-fleet-data.json"
// inside the app's private Drive appDataFolder (hidden from the user's Drive UI,
// so it never clutters their Drive but is tied to their Google account).
//
// Needs a Google OAuth *Client ID* (Web type) created once in Google Cloud Console.
// See README for the 5-minute setup.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
// appdata = hidden JSON backup · drive.file = app-created folders/PDFs visible in the user's Drive.
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const SCOPE_V = 'v2';               // bump when SCOPE changes, to force one clean re-login
const FILE_NAME = 'karan-fleet-data.json';
const LS_TOKEN = 'kf_drive_token';
const LS_CLIENT = 'kf_drive_client_id';
const LS_EMAIL = 'kf_drive_email';
const LS_SCOPE = 'kf_drive_scope';

let tokenClient = null;
let gisLoaded = false;
let accessToken = null;
let tokenExpiry = 0;
let listeners = [];
let folderCache = {};   // "parentId/Name" -> folderId, reset on sign-in/out

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
    // Ignore tokens granted under an older scope set so the app re-prompts for the new permissions once.
    if (localStorage.getItem(LS_SCOPE) !== SCOPE_V) return;
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
            try { localStorage.setItem(LS_SCOPE, SCOPE_V); } catch (e) {}
            folderCache = {};
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
  accessToken = null; tokenExpiry = 0; folderCache = {};
  try { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_EMAIL); localStorage.removeItem(LS_SCOPE); } catch (e) {}
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

/* ---------------- visible Drive folders + PDF upload (drive.file scope) ---------------- */
function qEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

async function findFolder(name, parentId) {
  let q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + qEsc(name) + "'";
  q += parentId ? " and '" + parentId + "' in parents" : " and 'root' in parents";
  const r = await api('https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=' + encodeURIComponent(q));
  const j = await r.json();
  return (j.files && j.files[0]) ? j.files[0].id : null;
}

async function ensureFolder(name, parentId) {
  const key = (parentId || 'root') + '/' + name;
  if (folderCache[key]) return folderCache[key];
  let id = await findFolder(name, parentId);
  if (!id) {
    const meta = { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] };
    const r = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
    });
    id = (await r.json()).id;
  }
  folderCache[key] = id;
  return id;
}

// Walks/creates a path like ['Karan Fleet','Bills','BR01PR 8395'] and returns the leaf folder id.
async function ensurePath(parts) {
  let parent = null;
  for (const raw of (parts || [])) { const p = String(raw || '').trim().slice(0, 120); if (!p) continue; parent = await ensureFolder(p, parent); }
  return parent;
}

function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('file read fail')); r.readAsDataURL(blob); });
}

// Uploads a PDF blob into <pathParts> (created if missing). Overwrites an existing file of the same name in that folder.
export async function uploadPdf(blob, name, pathParts) {
  const folderId = await ensurePath(pathParts);
  const b64 = await blobToBase64(blob);
  let existingId = null;
  try {
    const q = "trashed=false and name='" + qEsc(name) + "'" + (folderId ? " and '" + folderId + "' in parents" : '');
    const r = await api('https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=' + encodeURIComponent(q));
    const j = await r.json(); existingId = (j.files && j.files[0]) ? j.files[0].id : null;
  } catch (e) {}
  const boundary = 'kf' + Date.now();
  const meta = existingId ? {} : { name, parents: folderId ? [folderId] : [] };
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n' +
    '--' + boundary + '\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64 + '\r\n--' + boundary + '--';
  const url = existingId
    ? 'https://www.googleapis.com/upload/drive/v3/files/' + existingId + '?uploadType=multipart&fields=id,webViewLink'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
  const r = await api(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
  return r.json();
}

// Ensures the root "Karan Fleet" folder exists and returns a link to open it in Drive.
export async function appFolderUrl() {
  const id = await ensureFolder('Karan Fleet', null);
  return 'https://drive.google.com/drive/folders/' + id;
}

export function init() { loadToken(); }
