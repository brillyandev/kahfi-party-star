import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, logTx, makeUid, publicUser, NEW_USER_COINS } from '../db.js';
import { requireAuth, signToken } from '../auth.js';

const r = Router();

const attempts = new Map();
function throttle(key, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  return list.length > max;
}

r.post('/register', (req, res) => {
  const ip = req.ip || 'x';
  if (throttle(`reg:${ip}`, 8)) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });

  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || username).trim().slice(0, 24);

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username 3-20 karakter: huruf kecil, angka, atau underscore.' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Username sudah dipakai.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const uid = makeUid();

  const create = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO users (uid, username, display_name, password_hash, coins) VALUES (?,?,?,?,?)')
      .run(uid, username, displayName || username, hash, NEW_USER_COINS);
    logTx(info.lastInsertRowid, null, 'welcome_bonus', NEW_USER_COINS, 'Bonus pendaftaran 10M koin');
    return info.lastInsertRowid;
  });

  const id = create();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ token: signToken(user), user: publicUser(user), welcomeBonus: NEW_USER_COINS });
});

r.post('/login', (req, res) => {
  const ip = req.ip || 'x';
  if (throttle(`login:${ip}`, 15)) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });

  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  if (user.banned) return res.status(403).json({ error: 'Akun ini diblokir.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default r;
