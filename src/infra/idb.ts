/** 极简 IDB 封装（设计 04 §6.8.7 / §6.7.4，不引 idb 库） */

export interface Snapshot {
  id: string;
  at: number;
  payload: string;
}

export interface VoiceLog {
  id: string;
  raw: string;
  normalized: string;
  parsedJson: string;
  accepted: boolean;
  correctedTo: string;
  at: number;
}

const DB_NAME = 'xq-backup';
const STORE = 'snapshots';
const VOICE_STORE = 'voice_log';
const KEEP = 5;
const VOICE_KEEP = 200;

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIdb()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(VOICE_STORE)) {
        db.createObjectStore(VOICE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
  });
}

export async function putSnapshot(s: Snapshot): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s);
    await txDone(tx);
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
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const item of all.slice(KEEP)) store.delete(item.id);
    await txDone(tx);
    db.close();
  } catch {
    // ignore
  }
}

/* ---------------- 语音纠错日志（可降级） ---------------- */

export async function putVoiceLog(entry: VoiceLog): Promise<void> {
  if (!hasIdb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(VOICE_STORE, 'readwrite');
    tx.objectStore(VOICE_STORE).put(entry);
    await txDone(tx);
    db.close();
  } catch {
    // 隐私模式下静默失败
  }
}

export async function getVoiceLogs(): Promise<VoiceLog[]> {
  if (!hasIdb()) return [];
  try {
    const db = await openDb();
    const all = await new Promise<VoiceLog[]>((resolve, reject) => {
      const tx = db.transaction(VOICE_STORE, 'readonly');
      const req = tx.objectStore(VOICE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as VoiceLog[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IDB read failed'));
    });
    db.close();
    return all.sort((a, b) => b.at - a.at).slice(0, VOICE_KEEP);
  } catch {
    return [];
  }
}
