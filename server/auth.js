import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const dir = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '.jwt-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

export function signToken(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function userFromToken(token) {
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  if (!user || user.banned) return null;
  return user;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk lagi.' });
  req.user = user;
  next();
}

/**
 * Hierarki peran. Developer paling tinggi, lalu super admin, admin.
 * Coin seller bukan bagian hierarki moderasi, hanya punya izin jual koin.
 */
const RANK = { user: 0, coin_seller: 1, admin: 2, super_admin: 3, developer: 4 };

export function rankOf(role) {
  return RANK[role] ?? 0;
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum masuk.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Kamu tidak punya izin untuk aksi ini.' });
    }
    next();
  };
}

export function requireMinRank(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum masuk.' });
    if (rankOf(req.user.role) < rankOf(role)) {
      return res.status(403).json({ error: 'Kamu tidak punya izin untuk aksi ini.' });
    }
    next();
  };
}

/** Apakah actor boleh mengubah target (tidak boleh menyentuh yang setara/lebih tinggi). */
export function canManage(actorRole, targetRole) {
  return rankOf(actorRole) > rankOf(targetRole);
}

/** Peran apa yang boleh diberikan oleh actor. */
export function assignableRoles(actorRole) {
  if (actorRole === 'developer') return ['user', 'coin_seller', 'admin', 'super_admin', 'developer'];
  if (actorRole === 'super_admin') return ['user', 'coin_seller', 'admin'];
  return [];
}
