// 生成 PWA 图标（离线、无第三方依赖）。用法：node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const radius = size * 0.22;
  const petalR = size * 0.135;
  const petalDist = size * 0.152;
  const centerR = size * 0.088;

  const set = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    const sa = a / 255;
    const da = px[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa);
    px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa);
    px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa);
    px[i + 3] = Math.round(oa * 255);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 圆角矩形底（渐变粉）
      const dx = Math.max(Math.abs(x - c) - (c - radius), 0);
      const dy = Math.max(Math.abs(y - c) - (c - radius), 0);
      const dist = Math.hypot(dx, dy);
      const inside = dist <= radius;
      const edge = Math.min(1, Math.max(0, radius - dist + 0.5));
      if (!inside && edge <= 0) continue;
      const t = (x + y) / (2 * size);
      const r = Math.round(253 - 4 * t);
      const g = Math.round(180 + 30 * t);
      const b = Math.round(205 + 25 * t);
      set(x, y, r, g, b, Math.round(255 * edge));
    }
  }

  // 五瓣花（白色）
  for (let k = 0; k < 5; k++) {
    const ang = (-Math.PI / 2) + (k * Math.PI * 2) / 5;
    const px0 = c + Math.cos(ang) * petalDist;
    const py0 = c + Math.sin(ang) * petalDist;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - px0, y - py0);
        const a = Math.min(1, Math.max(0, petalR - d + 0.5));
        if (a > 0) set(x, y, 255, 250, 252, Math.round(255 * a));
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const a = Math.min(1, Math.max(0, centerR - d + 0.5));
      if (a > 0) set(x, y, 255, 214, 231, Math.round(255 * a));
    }
  }

  return png(size, px);
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), drawIcon(size));
  console.log(`icon-${size}.png generated`);
}
