import * as XLSX from 'xlsx';

/** 通用下载（设计 04 §6.11，csv / xlsx / zip / png 共用） */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadCsv(text: string, filename: string): void {
  downloadText(text, filename, 'text/csv;charset=utf-8');
}

export interface XlsxSheet {
  name: string;
  /** 单元格数据（行 × 列）；字符串一律按文本写入，不让 Excel 猜成日期/数字 */
  rows: Array<Array<string | number | null | undefined>>;
  /** 各列宽度（字符数），不传则用默认 */
  widths?: number[];
}

/**
 * 导出 Excel（v2.6.5 需求1）——xlsx 库已是项目依赖（花名册导入在用），不额外增加体积。
 * 直接给列宽：老师反馈 CSV 用 Excel 打开时日期列显示成 `#####`，本质是列太窄 + 内容被当成日期。
 */
export function downloadXlsx(sheets: XlsxSheet[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows as Array<Array<string | number | null>>);
    if (s.widths?.length) ws['!cols'] = s.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}

/** 生成文件名安全片段（去掉 Windows 非法字符） */
export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
}
