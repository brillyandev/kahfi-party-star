import { Router } from 'express';
import crypto from 'node:crypto';
import { db, logTx, publicUser } from '../db.js';
import { requireAuth, rankOf } from '../auth.js';
import { presence } from '../presence.js';

const r = Router();
r.use(requireAuth);

function roomCard(row) {
  const owner = db.prepare('SELECT id, uid, display_name, avatar FROM users WHERE id=?').get(row.owner_id);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    cover: row.cover,
    country: row.country,
    isHot: !!row.is_hot,
    owner: { id: owner.id, uid: owner.uid, displayName: owner.display_name, avatar: owner.avatar },
    online: presence.count(row.code),
  };
}

r.get('/', (req, res) => {
  const tab = String(req.query.tab || 'hot');
  const country = String(req.query.country || '');
  let rows = db.prepare('SELECT * FROM rooms WHERE closed=0 ORDER BY id DESC LIMIT 100').all();
  if (country) rows = rows.filter((x) => x.country === country.toUpperCase());

  let list = rows.map(roomCard);
  if (tab === 'hot') list.sort((a, b) => b.online - a.online || Number(b.isHot) - Number(a.isHot));
  res.json({ rooms: list });
});

r.get('/mine', (req, res) => {
  const rows = db.prepare('SELECT * FROM rooms WHERE owner_id=? AND closed=0 ORDER BY id DESC').all(req.user.id);
  res.json({ rooms: rows.map(roomCard) });
});

r.post('/', (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 40);
  if (!title) return res.status(400).json({ error: 'Judul room wajib diisi.' });
  const owned = db.prepare('SELECT COUNT(*) c FROM rooms WHERE owner_id=? AND closed=0').get(req.user.id).c;
  if (owned >= 3 && rankOf(req.user.role) < rankOf('admin')) {
    return res.status(400).json({ error: 'Maksimal 3 room aktif per akun.' });
  }
  const code = crypto.randomBytes(3).toString('hex');
  const info = db
    .prepare('INSERT INTO rooms (code, title, cover, owner_id, country) VALUES (?,?,?,?,?)')
    .run(code, title, String(req.body.cover || '').slice(0, 300), req.user.id, req.user.country);
  res.json({ room: roomCard(db.prepare('SELECT * FROM rooms WHERE id=?').get(info.lastInsertRowid)) });
});

r.get('/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM rooms WHERE code=? AND closed=0').get(req.params.code);
  if (!row) return res.status(404).json({ error: 'Room tidak ditemukan atau sudah ditutup.' });
  res.json({ room: roomCard(row) });
});

r.delete('/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM rooms WHERE code=?').get(req.params.code);
  if (!row) return res.status(404).json({ error: 'Room tidak ditemukan.' });
  const isOwner = row.owner_id === req.user.id;
  if (!isOwner && rankOf(req.user.role) < rankOf('admin')) return res.status(403).json({ error: 'Bukan room kamu.' });
  db.prepare('UPDATE rooms SET closed=1 WHERE id=?').run(row.id);
  req.app.get('io')?.to(`room:${row.code}`).emit('room-closed');
  res.json({ ok: true });
});

/**
 * Kirim gift. Semua perubahan saldo dalam satu transaksi database
 * supaya tidak ada koin yang hilang atau ganda.
 */
r.post('/:code/gift', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE code=? AND closed=0').get(req.params.code);
  if (!room) return res.status(404).json({ error: 'Room tidak ditemukan.' });

  const qty = Math.max(1, Math.min(999, Math.floor(Number(req.body.qty) || 1)));
  const gift = db.prepare("SELECT * FROM items WHERE id=? AND type='gift' AND active=1").get(req.body.itemId);
  if (!gift) return res.status(404).json({ error: 'Gift tidak ditemukan.' });

  const receiver = db.prepare('SELECT * FROM users WHERE id=? AND banned=0').get(req.body.toUserId);
  if (!receiver) return res.status(404).json({ error: 'Penerima tidak ditemukan.' });
  if (receiver.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa mengirim gift ke diri sendiri.' });

  const total = gift.price * qty;
  const charm = gift.charm_value * qty || Math.floor(total / 10);

  try {
    db.transaction(() => {
      const sender = db.prepare('SELECT coins FROM users WHERE id=?').get(req.user.id);
      if (sender.coins < total) throw new Error('Koin kamu tidak cukup.');

      db.prepare('UPDATE users SET coins = coins - ?, wealth = wealth + ?, activity = activity + 1 WHERE id=?').run(
        total,
        total,
        req.user.id,
      );
      db.prepare('UPDATE users SET charm = charm + ?, diamonds = diamonds + ? WHERE id=?').run(
        charm,
        Math.floor(total * 0.5),
        receiver.id,
      );
      db.prepare(
        'INSERT INTO gift_log (sender_id, receiver_id, room_id, item_id, qty, coins, charm) VALUES (?,?,?,?,?,?,?)',
      ).run(req.user.id, receiver.id, room.id, gift.id, qty, total, charm);
      logTx(req.user.id, null, 'gift_sent', -total, `${gift.name} x${qty}`);
      logTx(receiver.id, req.user.id, 'gift_received', Math.floor(total * 0.5), `${gift.name} x${qty} (diamond)`);

      // Gift antar pasangan CP menambah keintiman
      db.prepare(
        "UPDATE cp_pairs SET intimacy = intimacy + ? WHERE status='active' AND ((user_a=? AND user_b=?) OR (user_a=? AND user_b=?))",
      ).run(Math.floor(total / 100), req.user.id, receiver.id, receiver.id, req.user.id);
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  req.app.get('io')?.to(`room:${room.code}`).emit('gift', {
    from: { id: req.user.id, name: req.user.display_name },
    to: { id: receiver.id, name: receiver.display_name },
    gift: { id: gift.id, name: gift.name, file: gift.file, fileKind: gift.file_kind, icon: gift.icon },
    qty,
    total,
  });

  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

export default r;
