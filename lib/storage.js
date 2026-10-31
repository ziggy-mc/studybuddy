const DB_NAME = 'studydeck-browser';
const DB_VERSION = 1;
const STORE_NAME = 'sets';

function openDatabase() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser storage is unavailable on the server.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error || new Error('Browser storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Browser storage transaction was cancelled.'));
  });
}

export async function getAllSets() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Could not read study sets.'));
  });
}

export async function getSet(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read this study set.'));
  });
}

export async function saveSet(set) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(set);
    transaction.oncomplete = () => resolve(set);
    transaction.onerror = () => reject(transaction.error || new Error('Could not save this study set.'));
  });
}

export async function deleteSet(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error('Could not delete this study set.'));
  });
}

export async function clearAllLocalData() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error || new Error('Could not clear browser storage.'));
  });
}

export async function estimateStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}

export function createEmptySet(title = 'Untitled study set') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    description: '',
    category: 'Uncategorized',
    tags: [],
    createdAt: now,
    updatedAt: now,
    lastStudiedAt: null,
    cards: [{ id: crypto.randomUUID(), term: '', definition: '', notes: '', starred: false, order: 0 }],
    progress: { known: [], review: [], attempts: 0, correct: 0 },
    source: 'local',
  };
}
