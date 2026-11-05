import { useState } from 'react';
import { auth, post, API_BASE, setApiBase, type Me } from '../lib/api';
import { useApp } from '../lib/ctx';

export default function AuthPage() {
  const { setMe, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await post<{ token: string; user: Me; welcomeBonus?: number }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        { username, password, displayName: displayName || username },
      );
      auth.set(r.token);
      setMe(r.user);
      if (r.welcomeBonus) toast('Selamat datang! Kamu dapat bonus 10.000.000 koin 🎉');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="logo">
        <div className="crown">👑</div>
        <h1>Kahfi Party Star</h1>
        <p>Ngobrol, kirim gift, dan jadi bintang di party.</p>
      </div>
      <form className="box" onSubmit={submit}>
        {mode === 'register' && <div className="bonus">🎁 Daftar sekarang, langsung dapat 10.000.000 koin!</div>}
        {error && <div className="err">{error}</div>}
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="huruf kecil, angka, _" autoComplete="username" required />
        </div>
        {mode === 'register' && (
          <div className="field">
            <label>Nama tampilan</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nama yang dilihat orang lain" maxLength={24} />
          </div>
        )}
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="minimal 6 karakter" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        </div>
        <button className="btn gold block" disabled={busy} type="submit">
          {busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar & ambil 10M koin'}
        </button>
        <div className="switch">
          {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </div>
      </form>
    </div>
  );

        <button
          type="button"
          className="link btn-plain"
          style={{ marginTop: 14, fontSize: 11, opacity: 0.55 }}
          onClick={() => {
            const next = window.prompt('Alamat server Kahfi Party Star (contoh: https://server.contoh.com)', API_BASE);
            if (next !== null) setApiBase(next);
          }}
        >
          Server: {API_BASE || 'belum diatur'}
        </button>

}