import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

/** Format aset yang diizinkan developer. */
export const ALLOWED = {
  '.png': 'png',
  '.webp': 'webp',
  '.svga': 'svga',
  '.svg': 'svg',
  '.jpg': 'png',
  '.jpeg': 'png',
  '.gif': 'png',
};

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 15);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext]) {
      return cb(new Error('Format tidak didukung. Gunakan PNG, WEBP, SVGA, atau SVG.'));
    }
    cb(null, true);
  },
});

/** SVG bisa memuat script. Bersihkan sebelum disajikan ke pengguna lain. */
export function sanitizeSvg(filePath) {
  let svg = fs.readFileSync(filePath, 'utf8');
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  fs.writeFileSync(filePath, svg);
}

export function kindOf(filename) {
  return ALLOWED[path.extname(filename).toLowerCase()] || '';
}
