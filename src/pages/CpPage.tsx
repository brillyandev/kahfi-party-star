import { useEffect, useState } from 'react';
import { get, post, fmt } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';
import { Avatar } from '../components/Avatar';

export default function CpPage() {
  const { toast } = useApp();
  const [pairs, setPairs] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [target, setTarget] = useState('');

  const load = () => {
    get('/social/cp').then((r) => setPairs(r.pairs));
    get('/social/cp/top').then((r) => setTop(r.list));
  };
  useEffect(load, []);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    try {
      const found = await get(`/user/profile/${encodeURIComponent(target.trim())}`);
      await post('/social/cp/request', { userId: found.user.id });
      toast('Permintaan CP terkirim 💞');
      setTarget('');
      load();
    } catch (err: any) { toast(err.message); }
  }
  async function act(id: number, what: 'accept' | 'end') {
    try { await post(`/social/cp/${id}/${what}`); load(); toast(what === 'accept' ? 'CP aktif! 💞' : 'CP diakhiri'); } catch (err: any) { toast(err.message); }
  }

  const active = pairs.find((p) => p.status === 'active');
  const pending = pairs.filter((p) => p.status === 'pending');

  return (
    <>
      <TopBar title="Daftar CP" />
      <div className="page" style={{ paddingTop: 12 }}>
        {active ? (
          <div className="card" style={{ marginTop: 0, background: 'linear-gradient(135deg,#ffe6f6,#efe3ff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={active.partner.displayName} src={active.partner.avatar} frame={active.partner.frame} size={56} />
              <div style={{ flex: 1 }}>
                <b>💞 {active.partner.displayName}</b>
                <div className="sub">Keintiman {fmt(active.intimacy)}</div>
              </div>
              <button className="btn ghost small" onClick={() => act(active.id, 'end')}>Akhiri</button>
            </div>
            <p className="sub" style={{ marginBottom: 0 }}>Kirim gift satu sama lain di room untuk menaikkan keintiman.</p>
          </div>
        ) : (
          <form className="card" style={{ marginTop: 0 }} onSubmit={request}>
            <h3>💞 Ajak seseorang jadi CP</h3>
            <div className="field"><label>UID atau username</label><input value={target} onChange={(e) => setTarget(e.target.value)} required /></div>
            <button className="btn block" style={{ background: 'linear-gradient(180deg,#ff7fd0,#a64dff)' }}>Kirim permintaan</button>
            <p className="sub">Biaya pendaftaran CP 520.000 koin, dibayar pengaju saat permintaan diterima.</p>
          </form>
        )}

        {pending.map((p) => (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={p.partner.displayName} src={p.partner.avatar} size={44} />
            <div style={{ flex: 1 }}><b>{p.partner.displayName}</b><div className="sub">{p.incoming ? 'Mengajakmu jadi CP' : 'Menunggu jawaban'}</div></div>
            {p.incoming ? <button className="btn small" onClick={() => act(p.id, 'accept')}>Terima</button> : <button className="btn ghost small" onClick={() => act(p.id, 'end')}>Batal</button>}
          </div>
        ))}

        <div className="card">
          <h3>🏆 Top pasangan CP</h3>
          {top.length === 0 && <div className="sub">Belum ada pasangan CP.</div>}
          {top.map((t) => (
            <div key={t.rank} className="rk-row" style={{ background: '#fafafc' }}>
              <span className="no">{t.rank}</span>
              <Avatar name={t.a.displayName} src={t.a.avatar} size={36} />
              <span>💞</span>
              <Avatar name={t.b.displayName} src={t.b.avatar} size={36} />
              <span className="nm">{t.a.displayName} & {t.b.displayName}</span>
              <span className="pt">{fmt(t.intimacy)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
