import type {
  CellValue,
  Entries,
  Entry,
  EntryStatus,
  PointLedgerEntry,
  RecordDoc,
  ScoringScheme,
} from '../domain/types';
import { TEXT_MAX } from '../domain/constants';
import { canMakeup } from '../domain/makeup';
import { evaluatePoints } from '../domain/points';
import type { VoiceCommand } from '../domain/voice/parse';
import type { AppState, StoreGet, StoreSet } from './store-types';
import { cloneEntries, emptyEntry } from './initial';

type EntrySlice = Pick<
  AppState,
  | 'commitValue' | 'commitText' | 'clearCell' | 'toggleStamp' | 'batchStamp' | 'batchClear'
  | 'togglePass' | 'setStatus' | 'setMakeup' | 'clearMakeup' | 'applyVoiceCommands'
>;

/** 写入时的状态收敛（设计 04 §4.5，唯一入口） */
export function normalizeEntry(e: Entry, scheme: ScoringScheme): Entry {
  void scheme;
  const next: Entry = { ...e, value: e.value ? { ...e.value } : null, makeup: e.makeup ? { ...e.makeup } : null };

  if (next.status === 'leave' || next.status === 'missing') {
    next.value = null;
    next.pass = false;
    return next;
  }
  if (next.value) {
    next.status = 'normal';
    // 有值时过关勾不再成立（PRD 边界：录值即 pass=false）
    return next;
  }
  if (next.pass) {
    // 过关是布尔位，不合成值（PRD FR-21-2：pass=true 时值清空）
    next.value = null;
    return next;
  }
  next.status = 'normal';
  return next;
}

function hasAny(e: Entry): boolean {
  return e.value !== null || e.status !== 'normal' || e.pass || e.stamp !== 'none' || e.makeup !== null;
}

export function createEntrySlice(set: StoreSet, get: StoreGet): EntrySlice {
  /** 统一写入口：一次操作一条撤销记录 + 一次积分评估 */
  function apply(
    nextEntries: Entries,
    label: string,
    changedNos: number[],
    opts: { silentPoints?: boolean } = {},
  ) {
    const s = get();
    if (s.readOnly) {
      s.showToast('数据升级失败进入只读模式，请先导出备份', 'warn');
      return;
    }
    const rec = s.draft;
    const before = cloneEntries(rec.entries);
    const now = Date.now();

    // 积分：对改动过的学生逐条评估
    let ledger = s.pointLedger;
    const hits: PointLedgerEntry[] = [];
    if (!opts.silentPoints) {
      const prevRecords = s.history
        .filter((h) => h.classId === rec.classId && h.templateId === rec.templateId)
        .sort((a, b) => b.date.localeCompare(a.date));
      for (const no of changedNos) {
        const entry = nextEntries[String(no)];
        if (!entry) continue;
        const rows = evaluatePoints({
          entry,
          passRule: s.settings.passRule,
          studentNo: no,
          record: rec,
          prevRecords,
          rules: s.pointRules,
          ledger,
          date: rec.date,
          now,
        });
        if (rows.length) {
          ledger = [...ledger, ...rows];
          hits.push(...rows);
        }
      }
    }

    const updated: RecordDoc = { ...rec, entries: nextEntries, updatedAt: now };
    s.pushUndo(label, before, nextEntries, s.pointLedger.length);
    set({
      records: { ...s.records, [rec.key]: updated },
      draft: updated,
      pointLedger: ledger,
      buffer: null,
    });

    if (hits.length) {
      const text = hits.slice(0, 2).map((h) => `${h.studentNo}号 ${h.reason} ${h.delta > 0 ? '+' : ''}${h.delta}`).join('；');
      s.showToast(text, hits.some((h) => h.delta < 0) ? 'warn' : 'ok');
    }
  }

  function writeOne(no: number, mutate: (e: Entry) => Entry, label: string) {
    const s = get();
    const rec = s.draft;
    if (!Number.isInteger(no) || no < 1 || no > classCount(s)) return;
    const prev = rec.entries[String(no)] ?? emptyEntry();
    const next = normalizeEntry(mutate({ ...prev }), rec.scheme);
    const entries = { ...rec.entries, [String(no)]: { ...next, updatedAt: Date.now() } };
    if (!hasAny(next)) delete entries[String(no)];
    apply(entries, label, [no]);
  }

  function writeMany(nos: number[], mutate: (e: Entry) => Entry, label: string) {
    const s = get();
    const rec = s.draft;
    const entries = { ...rec.entries };
    const changed: number[] = [];
    for (const no of nos) {
      if (!Number.isInteger(no) || no < 1 || no > classCount(s)) continue;
      const prev = entries[String(no)] ?? emptyEntry();
      const next = normalizeEntry(mutate({ ...prev }), rec.scheme);
      if (!hasAny(next)) delete entries[String(no)];
      else entries[String(no)] = { ...next, updatedAt: Date.now() };
      changed.push(no);
    }
    if (!changed.length) return;
    apply(entries, label, changed);
  }

  return {
    commitValue(no, value: CellValue | null) {
      writeOne(no, (e) => ({ ...e, value: value ? { ...value } : null, status: 'normal', pass: false }), '录入');
    },

    commitText(no, text: string) {
      const t = text.trim().slice(0, TEXT_MAX);
      writeOne(no, (e) => ({
        ...e,
        value: t ? { kind: 'text', text: t } : null,
        status: 'normal',
        pass: false,
      }), '录入文字');
    },

    clearCell(no) {
      writeOne(no, () => emptyEntry(), '清空一格');
    },

    toggleStamp(no) {
      const s = get();
      const cur = s.draft.entries[String(no)]?.stamp ?? 'none';
      const next = cur === s.currentStamp ? 'none' : s.currentStamp;
      writeOne(no, (e) => ({ ...e, stamp: next }), '盖章');
    },

    batchStamp(nos) {
      const s = get();
      const stamp = s.currentStamp;
      writeMany(nos, (e) => ({ ...e, stamp: e.stamp === stamp ? 'none' : stamp }), `批量盖章 ${nos.length} 人`);
      if (nos.length > 1) s.showToast(`已对 ${nos.length} 人${stamp === 'corrected' ? '盖「已更正」' : '盖「优秀」'}`, 'ok');
    },

    batchClear(nos) {
      const s = get();
      writeMany(nos, () => emptyEntry(), `批量清空 ${nos.length} 人`);
      if (nos.length > 1) s.showToast(`已清空 ${nos.length} 人（仅针对可见的 ${nos.length} 人）`, 'ok');
    },

    togglePass(no) {
      writeOne(no, (e) => {
        const on = !e.pass;
        return on
          ? { ...e, pass: true, value: null, status: 'normal' }
          : { ...e, pass: false, value: null };
      }, '过关');
    },

    setStatus(no, status: EntryStatus) {
      writeOne(no, (e) => {
        const next = e.status === status ? 'normal' : status;
        return { ...e, status: next, value: null, pass: false };
      }, status === 'leave' ? '请假' : '缺交');
    },

    setMakeup(nos, note) {
      const s = get();
      const now = Date.now();
      const text = note.trim().slice(0, 30);
      // 门禁（INV-18）：只有缺交/请假可以补交
      const allowed = nos.filter((no) => canMakeup(s.draft.entries[String(no)]));
      if (!allowed.length) {
        s.showToast('只有缺交或请假可以补交', 'warn');
        return;
      }
      if (allowed.length < nos.length) {
        s.showToast(`已忽略 ${nos.length - allowed.length} 名不符合条件的学生`, 'warn');
      }
      // 保留 status='missing'：roster 的规则 3 靠「缺交 + 有补交」识别【已补交】；
      // 一旦补录了值，normalizeEntry 会把 status 收回 normal。
      writeMany(allowed, (e) => ({ ...e, makeup: { at: now, note: text } }), `补交 ${allowed.length} 人`);
      s.showToast(`已标记 ${allowed.length} 人补交`, 'ok');
    },

    clearMakeup(nos) {
      writeMany(nos, (e) => ({ ...e, makeup: null }), '取消补交');
    },

    applyVoiceCommands(commands) {
      const s = get();
      if (!commands.length) return;
      const rec = s.draft;
      const before = cloneEntries(rec.entries);
      const entries = { ...rec.entries };
      const changed: number[] = [];
      const now = Date.now();

      for (const c of commands as VoiceCommand[]) {
        if (c.no < 1 || c.no > classCount(s)) continue;
        const prev = entries[String(c.no)] ?? emptyEntry();
        let next: Entry = { ...prev };

        if (c.status) next = { ...next, status: c.status, value: null, pass: false };
        if (c.pass !== undefined) next = { ...next, pass: c.pass, value: c.pass ? null : next.value, status: 'normal' };
        if (c.value) next = { ...next, value: { ...c.value }, status: 'normal', pass: false };
        if (c.stamp) next = { ...next, stamp: c.stamp };
        if (c.makeup) next = { ...next, makeup: { at: now, note: '语音标记' }, status: next.status === 'missing' ? 'normal' : next.status };

        next = normalizeEntry({ ...next, updatedAt: now }, rec.scheme);
        entries[String(c.no)] = next;
        changed.push(c.no);
      }

      if (!changed.length) return;
      const updated: RecordDoc = { ...rec, entries, updatedAt: now };
      s.pushUndo('语音录入', before, entries, s.pointLedger.length);

      // 语音批量也要触发积分（同一批一次评估）
      let ledger = s.pointLedger;
      const prevRecords = s.history
        .filter((h) => h.classId === rec.classId && h.templateId === rec.templateId)
        .sort((a, b) => b.date.localeCompare(a.date));
      for (const no of changed) {
        ledger = [...ledger, ...evaluatePoints({
          entry: entries[String(no)],
          passRule: s.settings.passRule,
          studentNo: no,
          record: updated,
          prevRecords,
          rules: s.pointRules,
          ledger,
          date: rec.date,
          now,
        })];
      }

      set({ records: { ...s.records, [rec.key]: updated }, draft: updated, pointLedger: ledger, buffer: null });
    },
  };
}

/** 当前班级人数（唯一人数来源） */
export function classCount(s: AppState): number {
  return s.classes.find((c) => c.id === s.activeClassId)?.count ?? 0;
}
