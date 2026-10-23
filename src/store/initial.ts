import type { ClassInfo, Mode, RecordDoc, Settings, Student } from '../domain/types';
import { DEFAULT_COUNT, DEFAULT_SETTINGS } from '../domain/constants';
import { todayISO } from '../domain/date';
import { recordKey } from '../utils/id';

/** 生成 1..n 的学号列表，保留已有姓名（INV-8：只增删展示，不动 entries） */
export function createStudents(n: number, existing?: Student[]): Student[] {
  const byNo = new Map<number, Student>();
  for (const s of existing ?? []) byNo.set(s.no, s);
  const out: Student[] = [];
  for (let i = 1; i <= n; i++) {
    const prev = byNo.get(i);
    out.push(prev?.name ? { no: i, name: prev.name } : { no: i });
  }
  return out;
}

export function createInitialClass(count = DEFAULT_COUNT): ClassInfo {
  return {
    id: 'class-1',
    name: '我的班级',
    school: '',
    teacher: '刘露',
    subject: '语文',
    students: createStudents(count),
  };
}

export function createEmptyRecord(date: string, content: string, mode: Mode, now = Date.now()): RecordDoc {
  return {
    id: recordKey(date, content, mode),
    date,
    content,
    mode,
    entries: {},
    createdAt: now,
    updatedAt: now,
  };
}

export interface InitialData {
  classInfo: ClassInfo;
  drafts: Record<string, RecordDoc>;
  activeKey: string;
  history: [];
  settings: Settings;
}

export function createInitialData(today = todayISO()): InitialData {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const record = createEmptyRecord(today, '', 'homework');
  return {
    classInfo: createInitialClass(settings.count),
    drafts: { [record.id]: record },
    activeKey: record.id,
    history: [],
    settings,
  };
}
