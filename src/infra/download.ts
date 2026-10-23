/** 通用下载（设计 04 §6.11，csv / zip / png 共用） */

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

/** 生成文件名安全片段（去掉 Windows 非法字符） */
export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名';
}
