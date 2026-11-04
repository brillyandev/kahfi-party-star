import { Router } from 'express';
import { db, logTx, publicUser } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

function itemRow(i) {
  return {
    id: i.id,
    type: i.type,
    name: i.name,
    price: i.price,
    file: i.file,
    fileKind: i.file_kind,
    icon: i.icon,
    durationDays: i.duration_days,
    charmValue: i.charm_value,
  };
}

/** Daftar toko. type: frame | effect | gift | entrance | badge */
r.get('/items', (req, res) => {
  const type = String(req.query.type || '');
  const rows = type
    ? db.prepare('SELECT * FROM items WHERE active=1 AND type=? ORDER BY price ASC').all(type)
    : db.prepare('SELECT * FROM items WHERE active=1 ORDER BY type, price ASC').all();
  res.json({ items: rows.map(itemRow) });
});

r.get('/inventory', (req, res) => {
  const rows = db
    .prepare(
      `SELECT inv.id inv_id, inv.expires_at, i.* FROM inventory inv
       JOIN items i ON i.id = inv.item_id
       WHERE inv.user_id=? AND (inv.expires_at IS NULL OR inv.expires_at > datetime('now'))
       ORDER BY inv.id DESC`,
    )
    .all(req.user.id);
  res.json({
    items: rows.map((x) => ({ ...itemRow(x), invId: x.inv_id, expiresAt: x.expires_at, equipped: req.user.frame_id === x.id })),
  });
});

r.post('/buy/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id=? AND active=1').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan.' });
  if (item.type === 'gift') return res.status(400).json({ error: 'Gift dikirim langsung di dalam room.' });

  try {
    db.transaction(() => {
      const u = db.prepare('SELECT coins FROM users WHERE id=?').get(req.user.id);
      if (u.coins < item.price) throw new Error('Koin kamu tidak cukup.');

      const owned = db
        .prepare(
          "SELECT 1 FROM inventory WHERE user_id=? AND item_id=? AND (expires_at IS NULL OR expires_at > datetime('now'))",
        )
        .get(req.user.id, item.id);
      if (owned) throw new Error('Kamu sudah memiliki item ini.');

      db.prepare('UPDATE users SET coins = coins - ?, wealth = wealth + ? WHERE id=?').run(item.price, item.price, req.user.id);
      const expires = item.duration_days > 0 ? `datetime('now', '+${Number(item.duration_days)} days')` : 'NULL';
      db.prepare(`INSERT INTO inventory (user_id, item_id, expires_at) VALUES (?, ?, ${expires})`).run(req.user.id, item.id);
      logTx(req.user.id, null, 'purchase', -item.price, item.name);
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

r.post('/equip/:id', (req, res) => {
  const itemId = Number(req.params.id);
  if (itemId === 0) {
    db.prepare('UPDATE users SET frame_id=NULL WHERE id=?').run(req.user.id);
  } else {
    const has = db
      .prepare(
        `SELECT i.type FROM inventory inv JOIN items i ON i.id=inv.item_id
         WHERE inv.user_id=? AND inv.item_id=? AND (inv.expires_at IS NULL OR inv.expires_at > datetime('now'))`,
      )
      .get(req.user.id, itemId);
    if (!has) return res.status(400).json({ error: 'Item belum kamu miliki.' });
    if (has.type !== 'frame') return res.status(400).json({ error: 'Hanya bingkai yang bisa dipasang di profil.' });
    db.prepare('UPDATE users SET frame_id=? WHERE id=?').run(itemId, req.user.id);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

/* ---------------- VIP / SVIP ---------------- */

r.get('/vip', (_req, res) => {
  const tiers = db.prepare('SELECT * FROM vip_tiers ORDER BY kind DESC, level').all();
  res.json({
    tiers: tiers.map((t) => ({
      kind: t.kind,
      level: t.level,
      name: t.name,
      price: t.price,
      days: t.days,
      dailyBonus: t.daily_bonus,
      perks: t.perks.split(','),
    })),
  });
});

r.post('/vip/buy', (req, res) => {
  const kind = req.body.kind === 'svip' ? 'svip' : 'vip';
  const level = Number(req.body.level);
  const tier = db.prepare('SELECT * FROM vip_tiers WHERE kind=? AND level=?').get(kind, level);
  if (!tier) return res.status(404).json({ error: 'Paket tidak ditemukan.' });

  try {
    db.transaction(() => {
      const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
      if (u.coins < tier.price) throw new Error('Koin kamu tidak cukup.');

      const stillActive = u.vip_until ? new Date(u.vip_until + 'Z') > new Date() : false;
      const currentLevel = kind === 'svip' ? u.svip_level : u.vip_level;
      if (stillActive && currentLevel > level) throw new Error('Kamu sudah punya paket yang lebih tinggi.');

      const base = stillActive && u.vip_until ? `'${u.vip_until}'` : "datetime('now')";
      const newUntil = db.prepare(`SELECT datetime(${base}, '+${tier.days} days') d`).get().d;

      const vipLevel = kind === 'vip' ? level : stillActive ? u.vip_level : 0;
      const svipLevel = kind === 'svip' ? level : stillActive ? u.svip_level : 0;

      db.prepare(
        'UPDATE users SET coins = coins - ?, wealth = wealth + ?, vip_level=?, svip_level=?, vip_until=? WHERE id=?',
      ).run(tier.price, tier.price, vipLevel, svipLevel, newUntil, u.id);
      logTx(u.id, null, 'vip_purchase', -tier.price, tier.name);
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

export default r;
