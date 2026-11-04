import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'kahfi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const ROLES = ['user', 'admin', 'super_admin', 'coin_seller', 'developer'];
export const NEW_USER_COINS = 10_000_000;
export const DAILY_CLAIM = 500_000;

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  avatar TEXT DEFAULT '',
  country TEXT DEFAULT 'ID',
  bio TEXT DEFAULT '',
  coins INTEGER NOT NULL DEFAULT 0,
  diamonds INTEGER NOT NULL DEFAULT 0,
  charm INTEGER NOT NULL DEFAULT 0,
  wealth INTEGER NOT NULL DEFAULT 0,
  activity INTEGER NOT NULL DEFAULT 0,
  vip_level INTEGER NOT NULL DEFAULT 0,
  svip_level INTEGER NOT NULL DEFAULT 0,
  vip_until TEXT,
  frame_id INTEGER,
  banned INTEGER NOT NULL DEFAULT 0,
  last_claim TEXT,
  claim_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  cover TEXT DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  country TEXT DEFAULT 'ID',
  is_hot INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- frame | effect | gift | entrance | badge
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  file TEXT DEFAULT '',            -- /uploads/xxx.png|webp|svga|svg
  file_kind TEXT DEFAULT '',       -- png | webp | svga | svg
  icon TEXT DEFAULT '',
  duration_days INTEGER DEFAULT 0, -- 0 = permanen
  charm_value INTEGER DEFAULT 0,   -- untuk gift: pesona penerima
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gift_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  receiver_id INTEGER NOT NULL REFERENCES users(id),
  room_id INTEGER REFERENCES rooms(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  qty INTEGER NOT NULL DEFAULT 1,
  coins INTEGER NOT NULL,
  charm INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cp_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id),
  user_b INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | ended
  intimacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id),
  to_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id),
  followee_id INTEGER NOT NULL REFERENCES users(id),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image TEXT DEFAULT '',
  link TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tx_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  actor_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vip_tiers (
  kind TEXT NOT NULL,              -- vip | svip
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  days INTEGER NOT NULL DEFAULT 30,
  daily_bonus INTEGER NOT NULL DEFAULT 0,
  perks TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (kind, level)
);

CREATE INDEX IF NOT EXISTS idx_gift_receiver ON gift_log(receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gift_sender ON gift_log(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_to ON messages(to_id, read);
CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory(user_id);
`);

const tierCount = db.prepare('SELECT COUNT(*) c FROM vip_tiers').get().c;
if (tierCount === 0) {
  const ins = db.prepare(
    'INSERT INTO vip_tiers (kind, level, name, price, days, daily_bonus, perks) VALUES (?,?,?,?,?,?,?)',
  );
  const tiers = [
    ['vip', 1, 'VIP 1', 5_000_000, 30, 100_000, 'Lencana VIP,Bonus klaim harian +100K'],
    ['vip', 2, 'VIP 2', 15_000_000, 30, 250_000, 'Lencana VIP,Bonus klaim +250K,Efek masuk room'],
    ['vip', 3, 'VIP 3', 40_000_000, 30, 500_000, 'Lencana VIP,Bonus klaim +500K,Efek masuk,Bingkai eksklusif'],
    ['svip', 1, 'SVIP 1', 100_000_000, 30, 1_000_000, 'Lencana SVIP,Bonus klaim +1M,Efek masuk SVIP,Anti kick'],
    ['svip', 2, 'SVIP 2', 250_000_000, 30, 2_500_000, 'Semua perk SVIP 1,Bonus klaim +2.5M,Nama berwarna emas'],
    ['svip', 3, 'SVIP 3', 600_000_000, 30, 6_000_000, 'Semua perk SVIP 2,Bonus klaim +6M,Bingkai animasi eksklusif'],
  ];
  const tx = db.transaction(() => tiers.forEach((t) => ins.run(...t)));
  tx();
}

export function logTx(userId, actorId, kind, amount, note = '') {
  db.prepare('INSERT INTO tx_log (user_id, actor_id, kind, amount, note) VALUES (?,?,?,?,?)').run(
    userId,
    actorId ?? null,
    kind,
    amount,
    note,
  );
}

export function makeUid() {
  for (let i = 0; i < 20; i += 1) {
    const uid = String(10_000_000 + Math.floor(Math.random() * 89_999_999));
    const exists = db.prepare('SELECT 1 FROM users WHERE uid = ?').get(uid);
    if (!exists) return uid;
  }
  return String(Date.now()).slice(-8);
}

export function publicUser(u) {
  if (!u) return null;
  const frame = u.frame_id ? db.prepare('SELECT id, name, file, file_kind FROM items WHERE id = ?').get(u.frame_id) : null;
  const vipActive = u.vip_until ? new Date(u.vip_until + 'Z') > new Date() : false;
  return {
    id: u.id,
    uid: u.uid,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    avatar: u.avatar,
    country: u.country,
    bio: u.bio,
    coins: u.coins,
    diamonds: u.diamonds,
    charm: u.charm,
    wealth: u.wealth,
    activity: u.activity,
    wealthLevel: wealthLevel(u.wealth),
    vipLevel: vipActive ? u.vip_level : 0,
    svipLevel: vipActive ? u.svip_level : 0,
    vipUntil: u.vip_until,
    frame,
    banned: !!u.banned,
    claimStreak: u.claim_streak,
    lastClaim: u.last_claim,
    createdAt: u.created_at,
  };
}

/** Level kekayaan berdasarkan total koin yang dibelanjakan untuk gift. */
export function wealthLevel(wealth) {
  const steps = [0, 1e6, 5e6, 2e7, 5e7, 1.2e8, 3e8, 7e8, 1.5e9, 3e9, 6e9, 1e10, 2e10, 4e10, 7e10, 1.2e11, 2e11, 3.5e11, 6e11, 1e12];
  let lvl = 0;
  for (let i = 0; i < steps.length; i += 1) if (wealth >= steps[i]) lvl = i + 1;
  return Math.min(lvl, 20);
}
