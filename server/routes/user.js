import { Router } from 'express';
import { db, logTx, publicUser, DAILY_CLAIM } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function claimAmount(u) {
  let bonus = 0;
  const vipActive = u.vip_until ? new Date(u.vip_until + 'Z') > new Date() : false;
  if (vipActive) {
    if (u.svip_level > 0) {
      bonus = db.prepare("SELECT daily_bonus b FROM vip_tiers WHERE kind='svip' AND level=?").get(u.svip_level)?.b ?? 0;
    } else if (u.vip_level > 0) {
      bonus = db.prepare("SELECT daily_bonus b FROM vip_tiers WHERE kind='vip' AND level=?").get(u.vip_level)?.b ?? 0;
    }
  }
  return { base: DAILY_CLAIM, bonus, total: DAILY_CLAIM + bonus };
}

r.get('/claim/status', (req, res) => {
  const u = req.user;
  const claimed = u.last_claim === todayKey();
  res.json({ claimed, streak: u.claim_streak, ...claimAmount(u) });
});

r.post('/claim', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const today = todayKey();
  if (u.last_claim === today) return res.status(409).json({ error: 'Klaim harian hari ini sudah diambil.' });

  const yesterday = todayKey(new Date(Date.now() - 86_400_000));
  const streak = u.last_claim === yesterday ? u.claim_streak + 1 : 1;
  const { total } = claimAmount(u);

  db.transaction(() => {
    db.prepare('UPDATE users SET coins = coins + ?, last_claim = ?, claim_streak = ?, activity = activity + 10 WHERE id = ?').run(
      total,
      today,
      streak,
      u.id,
    );
    logTx(u.id, null, 'daily_claim', total, `Klaim harian (hari ke-${streak})`);
  })();

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ ok: true, amount: total, streak, user: publicUser(fresh) });
});

r.patch('/profile', (req, res) => {
  const displayName = String(req.body.displayName ?? req.user.display_name).trim().slice(0, 24);
  const bio = String(req.body.bio ?? req.user.bio).trim().slice(0, 160);
  const country = String(req.body.country ?? req.user.country).trim().toUpperCase().slice(0, 2);
  const avatar = String(req.body.avatar ?? req.user.avatar).slice(0, 300);
  if (!displayName) return res.status(400).json({ error: 'Nama tampilan wajib diisi.' });
  db.prepare('UPDATE users SET display_name=?, bio=?, country=?, avatar=? WHERE id=?').run(
    displayName,
    bio,
    country || 'ID',
    avatar,
    req.user.id,
  );
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

r.get('/profile/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ? OR uid = ?').get(req.params.id, req.params.id);
  if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  const following = !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?').get(req.user.id, u.id);
  const stats = {
    following: db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id=?').get(u.id).c,
    fans: db.prepare('SELECT COUNT(*) c FROM follows WHERE followee_id=?').get(u.id).c,
  };
  const cp = db
    .prepare(
      `SELECT c.*, ua.display_name na, ub.display_name nb FROM cp_pairs c
       JOIN users ua ON ua.id=c.user_a JOIN users ub ON ub.id=c.user_b
       WHERE c.status='active' AND (c.user_a=? OR c.user_b=?)`,
    )
    .get(u.id, u.id);
  const pub = publicUser(u);
  if (u.id !== req.user.id) {
    pub.coins = undefined;
    pub.diamonds = undefined;
  }
  res.json({ user: pub, stats, following, cp: cp ? { id: cp.id, intimacy: cp.intimacy, partner: cp.user_a === u.id ? cp.nb : cp.na } : null });
});

r.post('/follow/:id', (req, res) => {
  const target = Number(req.params.id);
  if (target === req.user.id) return res.status(400).json({ error: 'Tidak bisa mengikuti diri sendiri.' });
  if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(target)) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  const exists = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?').get(req.user.id, target);
  if (exists) {
    db.prepare('DELETE FROM follows WHERE follower_id=? AND followee_id=?').run(req.user.id, target);
    return res.json({ following: false });
  }
  db.prepare('INSERT INTO follows (follower_id, followee_id) VALUES (?,?)').run(req.user.id, target);
  res.json({ following: true });
});

r.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [], rooms: [] });
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const users = db
    .prepare('SELECT * FROM users WHERE banned=0 AND (uid = ? OR username LIKE ? OR display_name LIKE ?) LIMIT 20')
    .all(q, like, like)
    .map(publicUser)
    .map((u) => ({ ...u, coins: undefined, diamonds: undefined }));
  const rooms = db
    .prepare('SELECT id, code, title, cover, country FROM rooms WHERE closed=0 AND (code=? OR title LIKE ?) LIMIT 20')
    .all(q.toLowerCase(), like);
  res.json({ users, rooms });
});

r.get('/wallet', (req, res) => {
  const log = db.prepare('SELECT kind, amount, note, created_at FROM tx_log WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id);
  res.json({ coins: req.user.coins, diamonds: req.user.diamonds, log });
});

export default r;
