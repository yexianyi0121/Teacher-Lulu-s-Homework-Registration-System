/** 极简 IDB 封装（设计 §6.7.4，不引入 idb 库） */

export interface Snapshot {
  id: string;
  at: number;
  payload: string;
}

const DB_NAME = 'xq-backup';
const STORE = 'snapshots';
const KEEP = 5;

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIdb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
}

export async function putSnapshot(s: Snapshot): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB put failed'));
    });
    db.close();
    await prune();
  } catch {
    // 备份是增强能力，失败不阻断主流程
  }
}

export async function getSnapshots(): Promise<Snapshot[]> {
  if (!hasIdb()) return [];
  try {
    const db = await openDb();
    const all = await new Promise<Snapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as Snapshot[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IDB read failed'));
    });
    db.close();
    return all.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function prune(): Promise<void> {
  if (!hasIdb()) return;
  try {
    const all = await getSnapshots();
    if (all.length <= KEEP) return;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const item of all.slice(KEEP)) store.delete(item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB prune failed'));
    });
    db.close();
  } catch {
    // ignore
  }
}
