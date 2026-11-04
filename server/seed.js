import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, logTx, makeUid } from './db.js';

/** Gift bawaan memakai emoji sebagai ikon, jadi toko langsung terisi tanpa unggahan. */
const DEFAULT_GIFTS = [
  ['Mawar', 1_000, '🌹', 100],
  ['Kopi', 5_000, '☕', 500],
  ['Hati', 10_000, '💖', 1_000],
  ['Mahkota', 100_000, '👑', 10_000],
  ['Mobil Sport', 500_000, '🏎️', 50_000],
  ['Kapal Pesiar', 2_000_000, '🛥️', 200_000],
  ['Istana', 10_000_000, '🏰', 1_000_000],
  ['Roket', 50_000_000, '🚀', 5_000_000],
];

export function seedIfEmpty() {
  const hasGifts = db.prepare("SELECT COUNT(*) c FROM items WHERE type='gift'").get().c;
  if (!hasGifts) {
    const ins = db.prepare("INSERT INTO items (type, name, price, icon, charm_value) VALUES ('gift', ?, ?, ?, ?)");
    db.transaction(() => DEFAULT_GIFTS.forEach((g) => ins.run(...g)))();
  }

  const hasDev = db.prepare("SELECT COUNT(*) c FROM users WHERE role='developer'").get().c;
  if (hasDev) return;

  // Akun developer pertama. Password dari environment, atau dibuat acak dan dicetak SEKALI.
  const username = (process.env.DEV_USERNAME || 'developer').toLowerCase();
  let password = process.env.DEV_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }

  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) {
    db.prepare("UPDATE users SET role='developer' WHERE id=?").run(exists.id);
    return;
  }

  const info = db
    .prepare('INSERT INTO users (uid, username, display_name, password_hash, role, coins) VALUES (?,?,?,?,?,?)')
    .run(makeUid(), username, 'Developer', bcrypt.hashSync(password, 10), 'developer', 10_000_000);
  logTx(info.lastInsertRowid, null, 'welcome_bonus', 10_000_000, 'Akun developer awal');

  console.log('\n==============================================');
  console.log(' Akun developer pertama dibuat');
  console.log(`   username : ${username}`);
  if (generated) {
    console.log(`   password : ${password}`);
    console.log(' Simpan password ini. Ia tidak akan ditampilkan lagi.');
    console.log(' (Atau set DEV_USERNAME dan DEV_PASSWORD sebelum start pertama.)');
  } else {
    console.log('   password : (dari DEV_PASSWORD)');
  }
  console.log('==============================================\n');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedIfEmpty();
}
