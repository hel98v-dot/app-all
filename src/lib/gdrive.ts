// src/lib/gdrive.ts
// Integrazione Google Drive per sync automatico del log di allenamento.
//
// Flusso OAuth: GIS (Google Identity Services) con token implicito.
//   — Ogni utente si autentica con il suo account Google.
//   — I file vanno nell'appDataFolder (cartella nascosta e privata per app+account):
//     account A e account B hanno due appDataFolder distinti → zero contaminazione.
//   — Client ID: pubblico, non segreto. Va inserito una volta in Impostazioni.

// ── Chiavi localStorage ───────────────────────────────────────────────────────
const CLIENT_ID_KEY = 'gdrive-client-id-v1';
const TOKEN_KEY     = 'gdrive-token-v1';
const EMAIL_KEY     = 'gdrive-email-v1';

/** Nome del file JSON su Drive (appDataFolder). */
export const DRIVE_FILE_NAME = 'training-log.json';

// ── Client ID ─────────────────────────────────────────────────────────────────

export function saveClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}
export function loadClientId(): string | null {
  return localStorage.getItem(CLIENT_ID_KEY) || null;
}
export function removeClientId(): void {
  localStorage.removeItem(CLIENT_ID_KEY);
}

// ── Token ─────────────────────────────────────────────────────────────────────

interface StoredToken {
  access_token: string;
  expires_at:   number; // unix ms
}

function saveToken(resp: GisTokenResponse): void {
  const stored: StoredToken = {
    access_token: resp.access_token,
    expires_at:   Date.now() + Number(resp.expires_in) * 1000 - 60_000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    return Date.now() < t.expires_at ? t : null;
  } catch { return null; }
}

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

/** True se c'è un token non scaduto in localStorage. */
export function isConnected(): boolean {
  return loadToken() !== null;
}

/** Email dell'account connesso (null se non connesso). */
export function getConnectedEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY) ?? null;
}

// ── GIS token client ──────────────────────────────────────────────────────────

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient: GisTokenClient | null = null;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject:  ((err: Error) => void)    | null = null;

/** Attende che window.google sia disponibile (script GIS caricato). */
function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return; }
    let tries = 0;
    const id = setInterval(() => {
      if (window.google?.accounts) { clearInterval(id); resolve(); return; }
      if (++tries > 40) { clearInterval(id); reject(new Error('Google Identity Services non caricato')); }
    }, 250);
  });
}

/** Ottieni un access token valido (usa cache o apre il popup GIS). */
export async function getAccessToken(prompt: '' | 'consent' = ''): Promise<string> {
  // Usa il token cached se ancora valido
  const stored = loadToken();
  if (stored) return stored.access_token;

  const clientId = loadClientId();
  if (!clientId) throw new Error('Client ID Google non configurato');

  await waitForGis();

  // Ricrea il client se necessario (es. dopo signOut o cambio clientId)
  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (resp: GisTokenResponse) => {
      if (resp.error) {
        pendingReject?.(new Error(resp.error_description ?? resp.error));
        return;
      }
      saveToken(resp);
      // Recupera l'email tramite tokeninfo (best-effort)
      fetchEmail(resp.access_token)
        .then(email => {
          if (email) localStorage.setItem(EMAIL_KEY, email);
          pendingResolve?.(resp.access_token);
        })
        .catch(() => pendingResolve?.(resp.access_token));
    },
    error_callback: (err) => pendingReject?.(new Error(err.type)),
  });

  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject  = reject;
    tokenClient!.requestToken({ prompt });
  });
}

async function fetchEmail(token: string): Promise<string | null> {
  try {
    const res  = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    const data = await res.json() as { email?: string };
    return data.email ?? null;
  } catch { return null; }
}

// ── Sign in / out ─────────────────────────────────────────────────────────────

/** Avvia il popup di autenticazione Google. */
export async function signIn(): Promise<void> {
  tokenClient = null; // forza ricreazione con il clientId corrente
  await getAccessToken('consent');
}

/** Revoca il token e pulisce localStorage. */
export function signOut(): void {
  const t = loadToken();
  if (t) {
    try { window.google?.accounts.oauth2.revoke(t.access_token, () => {}); } catch { /* ignore */ }
  }
  clearAuth();
  tokenClient = null;
}

// ── Drive REST API (appDataFolder) ────────────────────────────────────────────

/** Trova l'ID del file di log su Drive (null se non esiste). */
async function findFileId(): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const url   = `https://www.googleapis.com/drive/v3/files`
                + `?spaces=appDataFolder`
                + `&q=name%3D%27${encodeURIComponent(DRIVE_FILE_NAME)}%27`
                + `&fields=files(id)`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json() as { files: { id: string }[] };
    return data.files[0]?.id ?? null;
  } catch { return null; }
}

/**
 * Legge il JSON grezzo del log da Drive.
 * Restituisce null se il file non esiste o si verifica un errore.
 */
export async function readFromDrive(): Promise<string | null> {
  try {
    const token  = await getAccessToken();
    const fileId = await findFileId();
    if (!fileId) return null;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

/**
 * Scrive (crea o sovrascrive) il file JSON del log su Drive.
 * Usa il multipart upload per impostare metadati e contenuto in un'unica request.
 */
export async function writeToDrive(content: string): Promise<void> {
  const token  = await getAccessToken();
  const fileId = await findFileId();

  const metadata = JSON.stringify({
    name:    DRIVE_FILE_NAME,
    ...(fileId ? {} : { parents: ['appDataFolder'] }),
  });

  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('media',    new Blob([content],  { type: 'application/json' }));

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const res = await fetch(url, {
    method:  fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Drive write error ${res.status}: ${detail}`);
  }
}
