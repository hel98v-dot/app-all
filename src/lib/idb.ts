// src/lib/idb.ts
// Mini-wrapper IndexedDB per salvare gli sfondi (Blob immagine) offline.
// Nessuna dipendenza esterna.

const DB_NAME  = 'sl-theme';
const STORE    = 'backgrounds';
const VERSION  = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

/** Legge tutte le coppie chiave→Blob presenti nello store. */
export async function idbGetAll(): Promise<Record<string, Blob>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx     = db.transaction(STORE, 'readonly');
    const store  = tx.objectStore(STORE);
    const result: Record<string, Blob> = {};

    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();

    tx.oncomplete = () => {
      const keys = keysReq.result as IDBValidKey[];
      const vals = valsReq.result as Blob[];
      keys.forEach((k, i) => { result[String(k)] = vals[i]; });
      db.close();
      resolve(result);
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
