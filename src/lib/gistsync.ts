// src/lib/gistsync.ts
// Sincronizzazione tramite GitHub Gist privato.
// Nessun OAuth, nessun Cloud Console — solo un Personal Access Token.
//
// Ogni utente crea il proprio token GitHub (scope: gist) e lo incolla
// nelle impostazioni. I dati vanno in un Gist privato dell'account GitHub
// dell'utente → dati completamente separati tra utenti diversi.

const TOKEN_KEY   = 'gist-token-v1';
const GIST_ID_KEY = 'gist-id-v1';
const GIST_FILE   = 'training-log.json';
const GIST_DESC   = 'Arise — Training Log Sync';

// ── Token ─────────────────────────────────────────────────────────────────────

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}
export function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || null;
}
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
}
export function isConnected(): boolean {
  return !!loadToken();
}

// ── Gist ID cache ─────────────────────────────────────────────────────────────

function loadGistId(): string | null {
  return localStorage.getItem(GIST_ID_KEY) || null;
}
function saveGistId(id: string): void {
  localStorage.setItem(GIST_ID_KEY, id);
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function ghFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = loadToken();
  if (!token) throw new Error('Token GitHub non configurato');
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// ── Trova o crea il Gist di sync ──────────────────────────────────────────────

async function findOrCreateGist(): Promise<string> {
  // Prima controlla la cache
  const cached = loadGistId();
  if (cached) return cached;

  // Cerca tra i Gist esistenti
  const res = await ghFetch('/gists?per_page=100');
  if (!res.ok) throw new Error(`Errore GitHub ${res.status}: controlla il token`);

  const gists = await res.json() as Array<{
    id: string;
    description: string;
    files: Record<string, unknown>;
  }>;

  const existing = gists.find(
    g => g.description === GIST_DESC && GIST_FILE in g.files,
  );
  if (existing) {
    saveGistId(existing.id);
    return existing.id;
  }

  // Crea un nuovo Gist privato
  const create = await ghFetch('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [GIST_FILE]: { content: '{}' } },
    }),
  });
  if (!create.ok) throw new Error(`Errore creazione Gist: ${create.status}`);
  const newGist = await create.json() as { id: string };
  saveGistId(newGist.id);
  return newGist.id;
}

// ── Leggi dal Gist ────────────────────────────────────────────────────────────

export async function readFromGist(): Promise<string | null> {
  try {
    const gistId = await findOrCreateGist();
    const res = await ghFetch(`/gists/${gistId}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      files: Record<string, { content?: string }>;
    };
    const content = data.files[GIST_FILE]?.content;
    if (!content || content === '{}') return null;
    return content;
  } catch { return null; }
}

// ── Scrivi sul Gist ───────────────────────────────────────────────────────────

export async function writeToGist(content: string): Promise<void> {
  const gistId = await findOrCreateGist();
  const res = await ghFetch(`/gists/${gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      files: { [GIST_FILE]: { content } },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Errore scrittura Gist ${res.status}: ${detail}`);
  }
}

// ── Verifica token (controlla che sia valido) ─────────────────────────────────

export async function verifyToken(): Promise<string> {
  const res = await ghFetch('/user');
  if (!res.ok) throw new Error(`Token non valido (${res.status})`);
  const user = await res.json() as { login: string };
  return user.login; // username GitHub
}
