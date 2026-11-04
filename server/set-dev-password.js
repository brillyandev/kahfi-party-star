/**
 * Membuat atau mengatur ulang akun developer.
 * Pakai: npm run dev:pass -- <password> [username]
 */
import bcrypt from 'bcryptjs';
import { db, makeUid } from './db.js';

const password = process.argv[2];
const username = (process.argv[3] || process.env.DEV_USERNAME || 'developer').toLowerCase();

if (!password || password.length < 8) {
  console.error('Password minimal 8 karakter. Contoh: npm run dev:pass -- RahasiaSaya123');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM users WHERE username=?').get(username);

if (existing) {
  db.prepare("UPDATE users SET password_hash=?, role='developer', banned=0 WHERE id=?").run(hash, existing.id);
  console.log(`Password developer diperbarui untuk username "${username}".`);
} else {
  db.prepare('INSERT INTO users (uid, username, display_name, password_hash, role, coins) VALUES (?,?,?,?,?,?)').run(
    makeUid(), username, 'Developer', hash, 'developer', 10_000_000,
  );
  console.log(`Akun developer dibuat. Username: ${username}`);
}
console.log('Silakan login memakai username dan password tersebut.');
