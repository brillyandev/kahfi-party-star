import { Router } from 'express';
import { db, logTx, publicUser } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

/* ---------------- Ranking ---------------- */

function sinceExpr(period) {
  if (period === 'day') return "datetime('now','start of day')";
  if (period === 'week') return "datetime('now','-7 days')";
  if (period === 'month') return "datetime('now','-30 days')";
  return null;
}

function slim(u) {
  return {
    id: u.id,
    uid: u.uid,
    displayName: u.display_name,
    avatar: u.avatar,
    country: u.country,
    role: u.role,
    frame: u.frame_id ? db.prepare('SELECT id, file, file_kind FROM items WHERE id=?').get(u.frame_id) : null,
  };
}

/**
 * kind:
 *  gift_received = top penerima gift (pesona dari gift pada periode)
 *  gift_sent     = top pengirim gift (kekayaan periode)
 *  charm         = pesona total
 *  wealth        = kekayaan total
 *  activity      = keaktifan total
 */
r.get('/ranking', (req, res) => {
  const kind = String(req.query.kind || 'gift_received');
  const period = String(req.query.period || 'week');
  const since = sinceExpr(period);
  let rows = [];

  if (kind === 'gift_received' || kind === 'gift_sent') {
    const col = kind === 'gift_received' ? 'receiver_id' : 'sender_id';
    const metric = kind === 'gift_received' ? 'SUM(g.charm)' : 'SUM(g.coins)';
    const where = since ? `WHERE g.created_at >= ${since}` : '';
    rows = db
      .prepare(
        `SELECT u.*, ${metric} score FROM gift_log g JOIN users u ON u.id=g.${col}
         ${where} GROUP BY u.id ORDER BY score DESC LIMIT 50`,
      )
      .all();
  } else {
    const col = { charm: 'charm', wealth: 'wealth', activity: 'activity' }[kind];
    if (!col) return res.status(400).json({ error: 'Jenis ranking tidak dikenal.' });
    rows = db.prepare(`SELECT *, ${col} score FROM users WHERE banned=0 AND ${col} > 0 ORDER BY ${col} DESC LIMIT 50`).all();
  }

  res.json({
    kind,
    period,
    list: rows.map((u, i) => ({ rank: i + 1, score: u.score, ...slim(u) })),
  });
});

/* ---------------- CP (pasangan) ---------------- */

function cpRow(row, meId) {
  const partnerId = row.user_a === meId ? row.user_b : row.user_a;
  const p = db.prepare('SELECT * FROM users WHERE id=?').get(partnerId);
  return {
    id: row.id,
    status: row.status,
    intimacy: row.intimacy,
    incoming: row.status === 'pending' && row.user_b === meId,
    partner: slim(p),
    createdAt: row.created_at,
  };
}

r.get('/cp', (req, res) => {
  const rows = db
    .prepare("SELECT * FROM cp_pairs WHERE status IN ('pending','active') AND (user_a=? OR user_b=?) ORDER BY id DESC")
    .all(req.user.id, req.user.id);
  res.json({ pairs: rows.map((x) => cpRow(x, req.user.id)) });
});

r.get('/cp/top', (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM cp_pairs WHERE status='active' ORDER BY intimacy DESC LIMIT 30")
    .all();
  res.json({
    list: rows.map((x, i) => ({
      rank: i + 1,
      intimacy: x.intimacy,
      a: slim(db.prepare('SELECT * FROM users WHERE id=?').get(x.user_a)),
      b: slim(db.prepare('SELECT * FROM users WHERE id=?').get(x.user_b)),
    })),
  });
});

const CP_FEE = 520_000;

r.post('/cp/request', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=? OR uid=?').get(req.body.userId, String(req.body.userId));
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Target tidak valid.' });

  const busy = (uid) =>
    db.prepare("SELECT 1 FROM cp_pairs WHERE status='active' AND (user_a=? OR user_b=?)").get(uid, uid);
  if (busy(req.user.id)) return res.status(400).json({ error: 'Kamu sudah punya CP aktif.' });
  if (busy(target.id)) return res.status(400).json({ error: 'Pengguna itu sudah punya CP.' });

  const dup = db
    .prepare("SELECT 1 FROM cp_pairs WHERE status='pending' AND ((user_a=? AND user_b=?) OR (user_a=? AND user_b=?))")
    .get(req.user.id, target.id, target.id, req.user.id);
  if (dup) return res.status(409).json({ error: 'Sudah ada permintaan CP yang menunggu.' });

  db.prepare("INSERT INTO cp_pairs (user_a, user_b, status) VALUES (?,?, 'pending')").run(req.user.id, target.id);
  res.json({ ok: true });
});

r.post('/cp/:id/accept', (req, res) => {
  const row = db.prepare("SELECT * FROM cp_pairs WHERE id=? AND status='pending' AND user_b=?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });

  try {
    db.transaction(() => {
      const busy = db.prepare("SELECT 1 FROM cp_pairs WHERE status='active' AND (user_a IN (?,?) OR user_b IN (?,?))").get(row.user_a, row.user_b, row.user_a, row.user_b);
      if (busy) throw new Error('Salah satu pihak sudah punya CP aktif.');
      const a = db.prepare('SELECT coins FROM users WHERE id=?').get(row.user_a);
      if (a.coins < CP_FEE) throw new Error('Pengaju belum punya cukup koin untuk biaya CP.');
      db.prepare('UPDATE users SET coins = coins - ? WHERE id=?').run(CP_FEE, row.user_a);
      logTx(row.user_a, null, 'cp_fee', -CP_FEE, 'Biaya daftar CP');
      db.prepare("UPDATE cp_pairs SET status='active' WHERE id=?").run(row.id);
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.json({ ok: true });
});

r.post('/cp/:id/end', (req, res) => {
  const row = db.prepare("SELECT * FROM cp_pairs WHERE id=? AND (user_a=? OR user_b=?)").get(req.params.id, req.user.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'CP tidak ditemukan.' });
  db.prepare("UPDATE cp_pairs SET status='ended' WHERE id=?").run(row.id);
  res.json({ ok: true });
});

/* ---------------- Pesan ---------------- */

r.get('/messages', (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END other_id
       FROM messages m WHERE m.id IN (
         SELECT MAX(id) FROM messages WHERE from_id=? OR to_id=?
         GROUP BY CASE WHEN from_id=? THEN to_id ELSE from_id END)
       ORDER BY m.id DESC LIMIT 50`,
    )
    .all(req.user.id, req.user.id, req.user.id, req.user.id);
  res.json({
    threads: rows.map((m) => ({
      user: slim(db.prepare('SELECT * FROM users WHERE id=?').get(m.other_id)),
      last: m.body,
      at: m.created_at,
      unread: db.prepare('SELECT COUNT(*) c FROM messages WHERE from_id=? AND to_id=? AND read=0').get(m.other_id, req.user.id).c,
    })),
  });
});

r.get('/messages/unread', (req, res) => {
  res.json({ unread: db.prepare('SELECT COUNT(*) c FROM messages WHERE to_id=? AND read=0').get(req.user.id).c });
});

r.get('/messages/:userId', (req, res) => {
  const other = Number(req.params.userId);
  db.prepare('UPDATE messages SET read=1 WHERE from_id=? AND to_id=?').run(other, req.user.id);
  const rows = db
    .prepare('SELECT * FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100')
    .all(req.user.id, other, other, req.user.id)
    .reverse();
  res.json({ messages: rows.map((m) => ({ id: m.id, mine: m.from_id === req.user.id, body: m.body, at: m.created_at })) });
});

r.post('/messages/:userId', (req, res) => {
  const to = Number(req.params.userId);
  const body = String(req.body.body || '').trim().slice(0, 500);
  if (!body) return res.status(400).json({ error: 'Pesan kosong.' });
  if (!db.prepare('SELECT 1 FROM users WHERE id=? AND banned=0').get(to)) return res.status(404).json({ error: 'Penerima tidak ditemukan.' });
  const info = db.prepare('INSERT INTO messages (from_id, to_id, body) VALUES (?,?,?)').run(req.user.id, to, body);
  req.app.get('io')?.to(`user:${to}`).emit('dm', { id: info.lastInsertRowid, fromId: req.user.id, fromName: req.user.display_name, body });
  res.json({ ok: true });
});

/* ---------------- Beranda (banner + jackpot) ---------------- */

r.get('/home', (_req, res) => {
  const banners = db.prepare('SELECT * FROM banners WHERE active=1 ORDER BY id DESC LIMIT 8').all();
  const pool = db.prepare("SELECT COALESCE(SUM(coins),0) s FROM gift_log WHERE created_at >= datetime('now','start of day')").get().s;
  res.json({
    banners: banners.map((b) => ({ id: b.id, title: b.title, image: b.image, link: b.link })),
    prizePool: 11_000_000 + Math.floor(pool * 0.01),
  });
});

export { slim };
export default r;
