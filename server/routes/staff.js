import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, logTx, publicUser, ROLES } from '../db.js';
import { requireAuth, requireRole, requireMinRank, canManage, assignableRoles, rankOf } from '../auth.js';
import { upload, sanitizeSvg, kindOf, uploadDir } from '../upload.js';

const r = Router();
r.use(requireAuth);

const ITEM_TYPES = ['frame', 'effect', 'gift', 'entrance', 'badge'];
const MAX_GRANT = 1_000_000_000_000;

function findUser(ref) {
  const s = String(ref ?? '').trim();
  if (!s) return null;
  return db.prepare('SELECT * FROM users WHERE uid = ? OR username = ? OR id = ?').get(s, s.toLowerCase(), Number(s) || -1);
}

function parseAmount(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_GRANT) return null;
  return n;
}

/* =========================================================
 * DEVELOPER: kelola aset toko (bingkai, efek, gift, dll)
 * ========================================================= */

const assetFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'icon', maxCount: 1 },
]);

r.post('/items', requireRole('developer'), (req, res) => {
  assetFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const type = String(req.body.type || '');
    const name = String(req.body.name || '').trim().slice(0, 40);
    const price = Math.max(0, Math.floor(Number(req.body.price) || 0));
    const durationDays = Math.max(0, Math.floor(Number(req.body.durationDays) || 0));
    const charmValue = Math.max(0, Math.floor(Number(req.body.charmValue) || 0));

    const cleanup = () => Object.values(req.files || {}).flat().forEach((f) => fs.rm(f.path, () => {}));

    if (!ITEM_TYPES.includes(type)) {
      cleanup();
      return res.status(400).json({ error: 'Tipe item tidak valid.' });
    }
    if (!name) {
      cleanup();
      return res.status(400).json({ error: 'Nama item wajib diisi.' });
    }

    const main = req.files?.file?.[0];
    const icon = req.files?.icon?.[0];
    if (!main) {
      cleanup();
      return res.status(400).json({ error: 'File aset (PNG, WEBP, SVGA, SVG) wajib diunggah.' });
    }

    for (const f of [main, icon].filter(Boolean)) {
      if (f.originalname.toLowerCase().endsWith('.svg')) sanitizeSvg(f.path);
    }

    const info = db
      .prepare(
        `INSERT INTO items (type, name, price, file, file_kind, icon, duration_days, charm_value, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        type,
        name,
        price,
        `/uploads/${main.filename}`,
        kindOf(main.originalname),
        icon ? `/uploads/${icon.filename}` : '',
        durationDays,
        charmValue,
        req.user.id,
      );

    res.json({ ok: true, id: info.lastInsertRowid });
  });
});

r.patch('/items/:id', requireRole('developer'), (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
  const name = String(req.body.name ?? item.name).trim().slice(0, 40);
  const price = Math.max(0, Math.floor(Number(req.body.price ?? item.price)));
  const active = req.body.active === undefined ? item.active : req.body.active ? 1 : 0;
  db.prepare('UPDATE items SET name=?, price=?, active=? WHERE id=?').run(name, price, active, item.id);
  res.json({ ok: true });
});

r.delete('/items/:id', requireRole('developer'), (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
  // Soft delete supaya riwayat gift/inventori tetap utuh
  db.prepare('UPDATE items SET active=0 WHERE id=?').run(item.id);
  res.json({ ok: true });
});

r.get('/items', requireMinRank('admin'), (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM items ORDER BY id DESC LIMIT 300').all() });
});

r.post('/banners', requireRole('developer', 'super_admin'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const title = String(req.body.title || '').trim().slice(0, 60);
    if (!title) return res.status(400).json({ error: 'Judul banner wajib diisi.' });
    if (req.file && req.file.originalname.toLowerCase().endsWith('.svg')) sanitizeSvg(req.file.path);
    db.prepare('INSERT INTO banners (title, image, link) VALUES (?,?,?)').run(
      title,
      req.file ? `/uploads/${req.file.filename}` : '',
      String(req.body.link || '').slice(0, 300),
    );
    res.json({ ok: true });
  });
});

r.delete('/banners/:id', requireRole('developer', 'super_admin'), (req, res) => {
  db.prepare('UPDATE banners SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* =========================================================
 * Koin: developer bebas mencetak. Coin seller menjual dari saldo sendiri.
 * ========================================================= */

r.post('/coins/grant', requireRole('developer'), (req, res) => {
  const target = findUser(req.body.user);
  const amount = parseAmount(req.body.amount);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (!amount) return res.status(400).json({ error: 'Jumlah koin tidak valid.' });

  db.transaction(() => {
    db.prepare('UPDATE users SET coins = coins + ? WHERE id=?').run(amount, target.id);
    logTx(target.id, req.user.id, 'dev_grant', amount, String(req.body.note || 'Tambah koin oleh developer').slice(0, 100));
  })();
  res.json({ ok: true, coins: db.prepare('SELECT coins FROM users WHERE id=?').get(target.id).coins });
});

r.post('/coins/deduct', requireRole('developer'), (req, res) => {
  const target = findUser(req.body.user);
  const amount = parseAmount(req.body.amount);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (!amount) return res.status(400).json({ error: 'Jumlah koin tidak valid.' });

  db.transaction(() => {
    const take = Math.min(amount, target.coins);
    db.prepare('UPDATE users SET coins = coins - ? WHERE id=?').run(take, target.id);
    logTx(target.id, req.user.id, 'dev_deduct', -take, String(req.body.note || 'Pengurangan koin').slice(0, 100));
  })();
  res.json({ ok: true });
});

/** Coin seller memindahkan koin dari saldonya sendiri ke pembeli. */
r.post('/coins/sell', requireRole('coin_seller', 'developer'), (req, res) => {
  const buyer = findUser(req.body.user);
  const amount = parseAmount(req.body.amount);
  if (!buyer) return res.status(404).json({ error: 'Pembeli tidak ditemukan.' });
  if (buyer.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa menjual ke diri sendiri.' });
  if (!amount) return res.status(400).json({ error: 'Jumlah koin tidak valid.' });

  try {
    db.transaction(() => {
      const seller = db.prepare('SELECT coins FROM users WHERE id=?').get(req.user.id);
      if (seller.coins < amount) throw new Error('Saldo koin kamu tidak cukup.');
      db.prepare('UPDATE users SET coins = coins - ? WHERE id=?').run(amount, req.user.id);
      db.prepare('UPDATE users SET coins = coins + ? WHERE id=?').run(amount, buyer.id);
      logTx(req.user.id, buyer.id, 'seller_out', -amount, `Jual ke ${buyer.username}`);
      logTx(buyer.id, req.user.id, 'seller_in', amount, `Beli dari ${req.user.username}`);
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true });
});

/* =========================================================
 * Manajemen pengguna & peran
 * ========================================================= */

r.get('/users', requireMinRank('admin'), (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = q
    ? db.prepare('SELECT * FROM users WHERE uid=? OR username LIKE ? OR display_name LIKE ? ORDER BY id DESC LIMIT 50').all(q, like, like)
    : db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 50').all();
  res.json({ users: rows.map(publicUser) });
});

r.post('/users/role', requireMinRank('super_admin'), (req, res) => {
  const target = findUser(req.body.user);
  const role = String(req.body.role || '');
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Peran tidak valid.' });
  if (!assignableRoles(req.user.role).includes(role)) {
    return res.status(403).json({ error: 'Kamu tidak boleh memberikan peran ini.' });
  }
  if (target.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa mengubah peran sendiri.' });
  if (!canManage(req.user.role, target.role)) {
    return res.status(403).json({ error: 'Kamu tidak boleh mengubah pengguna dengan peran setara atau lebih tinggi.' });
  }

  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, target.id);
  logTx(target.id, req.user.id, 'role_change', 0, `${target.role} -> ${role}`);
  res.json({ ok: true });
});

r.post('/users/ban', requireMinRank('admin'), (req, res) => {
  const target = findUser(req.body.user);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (!canManage(req.user.role, target.role)) {
    return res.status(403).json({ error: 'Kamu tidak boleh memblokir pengguna dengan peran setara atau lebih tinggi.' });
  }
  const banned = req.body.banned ? 1 : 0;
  db.prepare('UPDATE users SET banned=? WHERE id=?').run(banned, target.id);
  logTx(target.id, req.user.id, banned ? 'ban' : 'unban', 0, String(req.body.reason || '').slice(0, 100));
  if (banned) req.app.get('io')?.to(`user:${target.id}`).emit('banned');
  res.json({ ok: true });
});

r.post('/users/vip', requireMinRank('super_admin'), (req, res) => {
  const target = findUser(req.body.user);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  const vip = Math.max(0, Math.min(3, Math.floor(Number(req.body.vip) || 0)));
  const svip = Math.max(0, Math.min(3, Math.floor(Number(req.body.svip) || 0)));
  const days = Math.max(1, Math.min(3650, Math.floor(Number(req.body.days) || 30)));
  const until = db.prepare(`SELECT datetime('now', '+${days} days') d`).get().d;
  db.prepare('UPDATE users SET vip_level=?, svip_level=?, vip_until=? WHERE id=?').run(vip, svip, vip || svip ? until : null, target.id);
  logTx(target.id, req.user.id, 'vip_grant', 0, `VIP ${vip} / SVIP ${svip} / ${days} hari`);
  res.json({ ok: true });
});

r.post('/rooms/hot', requireMinRank('admin'), (req, res) => {
  db.prepare('UPDATE rooms SET is_hot=? WHERE code=?').run(req.body.hot ? 1 : 0, String(req.body.code || ''));
  res.json({ ok: true });
});

r.get('/stats', requireMinRank('admin'), (_req, res) => {
  const one = (sql) => db.prepare(sql).get().c;
  res.json({
    users: one('SELECT COUNT(*) c FROM users'),
    banned: one('SELECT COUNT(*) c FROM users WHERE banned=1'),
    rooms: one('SELECT COUNT(*) c FROM rooms WHERE closed=0'),
    items: one('SELECT COUNT(*) c FROM items WHERE active=1'),
    giftVolume: one('SELECT COALESCE(SUM(coins),0) c FROM gift_log'),
    byRole: db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all(),
  });
});

r.get('/audit', requireMinRank('super_admin'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.kind, t.amount, t.note, t.created_at, u.username target, a.username actor
       FROM tx_log t JOIN users u ON u.id=t.user_id LEFT JOIN users a ON a.id=t.actor_id
       WHERE t.actor_id IS NOT NULL ORDER BY t.id DESC LIMIT 100`,
    )
    .all();
  res.json({ log: rows });
});

export default r;
