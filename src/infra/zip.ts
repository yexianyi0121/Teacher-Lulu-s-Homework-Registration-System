/**
 * 零依赖 ZIP 写入器（设计 04 §6.11.3 / ADR-16）——只做 store（不压缩）。
 * 关键：文件名置 UTF-8 flag（bit 11），否则 Windows 资源管理器解压中文名会乱码（评审 P3 / R-9）。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: date & 0xffff };
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

/** 打包成 zip 字节（同步、无压缩；Blob 由 zipStore 包装，便于单测直接比对字节） */
export function zipBytes(files: ZipFile[], mtime = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosTime(mtime);

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);      // local file header
    lv.setUint16(4, 20, true);              // version needed
    lv.setUint16(6, 0x0800, true);          // UTF-8 flag
    lv.setUint16(8, 0, true);               // method: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, f.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);      // central directory header
    cv.setUint16(4, 20, true);              // version made by
    cv.setUint16(6, 20, true);              // version needed
    cv.setUint16(8, 0x0800, true);          // UTF-8 flag
    cv.setUint16(10, 0, true);              // method
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);              // extra len
    cv.setUint16(32, 0, true);              // comment len
    cv.setUint16(34, 0, true);              // disk
    cv.setUint16(36, 0, true);              // internal attrs
    cv.setUint32(38, 0, true);              // external attrs
    cv.setUint32(42, offset, true);         // local header offset
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all = [...chunks, ...central, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of all) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/** 打包成 zip Blob（同步、无压缩） */
export function zipStore(files: ZipFile[], mtime = new Date()): Blob {
  return new Blob([zipBytes(files, mtime) as BlobPart], { type: 'application/zip' });
}

/** 文本 → UTF-8 字节（CSV 用） */
export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
