import { useEffect, useState } from 'react';
import { get, post, patch, del, api, fmt, ROLE_LABEL, type Role } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';

type TabKey = 'stats' | 'assets' | 'coins' | 'users' | 'banner' | 'audit';

export default function StaffPage() {
  const { me, toast } = useApp();
  const role = me?.role as Role;
  const isDev = role === 'developer';
  const isSuper = role === 'super_admin' || isDev;
  const isAdmin = isSuper || role === 'admin';
  const isSeller = role === 'coin_seller';

  const tabs: [TabKey, string][] = [];
  if (isAdmin) tabs.push(['stats', 'Ringkasan']);
  if (isDev) tabs.push(['assets', 'Aset toko']);
  if (isDev || isSeller) tabs.push(['coins', isDev ? 'Koin' : 'Jual koin']);
  if (isAdmin) tabs.push(['users', 'Pengguna']);
  if (isSuper) tabs.push(['banner', 'Banner']);
  if (isSuper) tabs.push(['audit', 'Audit']);
  const [tab, setTab] = useState<TabKey>(tabs[0]?.[0] ?? 'coins');

  if (!tabs.length) return <><TopBar title="Pusat staf" /><div className="empty">Kamu tidak punya akses ke halaman ini.</div></>;

  return (
    <>
      <TopBar title={`Pusat ${ROLE_LABEL[role]}`} />
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="seg" style={{ overflowX: 'auto' }}>
          {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} style={{ whiteSpace: 'nowrap', padding: '8px 12px' }} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'stats' && <Stats />}
        {tab === 'assets' && <Assets toast={toast} />}
        {tab === 'coins' && <Coins isDev={isDev} toast={toast} />}
        {tab === 'users' && <Users role={role} toast={toast} />}
        {tab === 'banner' && <Banner toast={toast} />}
        {tab === 'audit' && <Audit />}
      </div>
    </>
  );
}

function Stats() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { get('/staff/stats').then(setS).catch(() => undefined); }, []);
  if (!s) return null;
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="kpi">
        <div><b>{fmt(s.users)}</b><span>Pengguna</span></div>
        <div><b>{fmt(s.rooms)}</b><span>Room aktif</span></div>
        <div><b>{fmt(s.giftVolume)}</b><span>Volume gift (koin)</span></div>
        <div><b>{fmt(s.banned)}</b><span>Diblokir</span></div>
      </div>
      <h3 style={{ marginTop: 16 }}>Per peran</h3>
      {s.byRole.map((r: any) => <div key={r.role} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}><span>{ROLE_LABEL[r.role as Role] || r.role}</span><b>{r.c}</b></div>)}
    </div>
  );
}

function Assets({ toast }: { toast: (m: string) => void }) {
  const [type, setType] = useState('frame');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('100000');
  const [days, setDays] = useState('0');
  const [charm, setCharm] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const load = () => get('/staff/items').then((r) => setItems(r.items)).catch(() => undefined);
  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast('Pilih file aset dulu');
    const fd = new FormData();
    fd.append('type', type); fd.append('name', name); fd.append('price', price); fd.append('durationDays', days); fd.append('charmValue', charm);
    fd.append('file', file); if (icon) fd.append('icon', icon);
    setBusy(true);
    try { await api('POST', '/staff/items', fd); toast('Item ditambahkan ke toko ✅'); setName(''); setFile(null); setIcon(null); (e.target as HTMLFormElement).reset(); await load(); }
    catch (err: any) { toast(err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <form className="card" style={{ marginTop: 0 }} onSubmit={submit}>
        <h3>Tambah aset ke toko</h3>
        <div className="field"><label>Jenis</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="frame">Bingkai avatar</option><option value="effect">Efek</option><option value="gift">Gift</option>
            <option value="entrance">Efek masuk room</option><option value="badge">Lencana</option>
          </select></div>
        <div className="field"><label>Nama</label><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /></div>
        <div className="field"><label>Harga (koin)</label><input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        {type !== 'gift' && <div className="field"><label>Masa berlaku (hari, 0 = permanen)</label><input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} /></div>}
        {type === 'gift' && <div className="field"><label>Nilai pesona penerima</label><input type="number" min={0} value={charm} onChange={(e) => setCharm(e.target.value)} /></div>}
        <div className="field"><label>File aset (PNG, WEBP, SVGA, SVG)</label><input type="file" accept=".png,.webp,.svga,.svg,.jpg,.jpeg,.gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
        <div className="field"><label>Ikon pratinjau (opsional, untuk SVGA)</label><input type="file" accept=".png,.webp,.svg,.jpg,.jpeg" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} /></div>
        <button className="btn gold block" disabled={busy}>{busy ? 'Mengunggah...' : 'Unggah & terbitkan'}</button>
      </form>

      <div className="card">
        <h3>Semua item ({items.length})</h3>
        {items.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: i.active ? 1 : .45 }}>
            <span style={{ fontSize: 26, width: 40, textAlign: 'center' }}>{i.icon && !i.icon.startsWith('/') ? i.icon : i.file_kind === 'svga' ? '🎞️' : i.file ? <img src={i.icon || i.file} alt="" style={{ height: 32, maxWidth: 40, objectFit: 'contain' }} /> : '🎁'}</span>
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 14 }}>{i.name}</b><div className="sub">{i.type} · {i.file_kind || 'emoji'} · 🪙 {fmt(i.price)}</div></div>
            {i.active ? <button className="btn ghost small" onClick={async () => { await del(`/staff/items/${i.id}`); void load(); }}>Nonaktifkan</button>
              : <button className="btn small" onClick={async () => { await patch(`/staff/items/${i.id}`, { active: true }); void load(); }}>Aktifkan</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function Coins({ isDev, toast }: { isDev: boolean; toast: (m: string) => void }) {
  const { refresh } = useApp();
  const [user, setUser] = useState('');
  const [amount, setAmount] = useState('1000000');
  const run = async (path: string, ok: string) => {
    try { await post(path, { user, amount: Number(amount) }); toast(ok); await refresh(); } catch (e: any) { toast(e.message); }
  };
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <h3>{isDev ? 'Kelola koin' : 'Jual koin dari saldo kamu'}</h3>
      <div className="field"><label>UID atau username</label><input value={user} onChange={(e) => setUser(e.target.value)} /></div>
      <div className="field"><label>Jumlah koin</label><input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="btn gold" onClick={() => run('/staff/coins/sell', 'Koin terkirim ke pembeli')}>Jual dari saldo saya</button>
        {isDev && <button className="btn" onClick={() => run('/staff/coins/grant', 'Koin ditambahkan')}>Tambah koin (cetak baru)</button>}
        {isDev && <button className="btn red" onClick={() => run('/staff/coins/deduct', 'Koin dikurangi')}>Kurangi koin</button>}
      </div>
      {!isDev && <p className="sub">Koin yang kamu jual dipotong dari saldomu sendiri.</p>}
    </div>
  );
}

function Users({ role, toast }: { role: Role; toast: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const canRole = role === 'super_admin' || role === 'developer';
  const roles: Role[] = role === 'developer' ? ['user', 'coin_seller', 'admin', 'super_admin', 'developer'] : ['user', 'coin_seller', 'admin'];
  const load = () => get(`/staff/users?q=${encodeURIComponent(q)}`).then((r) => setList(r.users)).catch(() => undefined);
  useEffect(() => { const t = window.setTimeout(load, 250); return () => window.clearTimeout(t); }, [q]);

  const act = async (fn: () => Promise<any>, ok: string) => { try { await fn(); toast(ok); await load(); } catch (e: any) { toast(e.message); } };

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="field"><input placeholder="Cari UID / username / nama" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.map((u) => (
        <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div><b>{u.displayName}</b> <span className="sub">@{u.username} · {u.uid}</span></div>
            <span className={`role-chip ${u.role}`} style={{ background: u.role === 'user' ? '#999' : undefined }}>{ROLE_LABEL[u.role as Role]}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {canRole && (
              <select defaultValue={u.role} onChange={(e) => act(() => post('/staff/users/role', { user: u.uid, role: e.target.value }), 'Peran diubah')} style={{ borderRadius: 8, padding: '6px' }}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            )}
            <button className={`btn small ${u.banned ? '' : 'red'}`} onClick={() => act(() => post('/staff/users/ban', { user: u.uid, banned: !u.banned }), u.banned ? 'Blokir dibuka' : 'Pengguna diblokir')}>{u.banned ? 'Buka blokir' : 'Blokir'}</button>
            {canRole && <button className="btn gold small" onClick={() => act(() => post('/staff/users/vip', { user: u.uid, vip: 0, svip: 1, days: 30 }), 'SVIP 1 diberikan 30 hari')}>Beri SVIP</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Banner({ toast }: { toast: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(); fd.append('title', title); if (file) fd.append('image', file);
    try { await api('POST', '/staff/banners', fd); toast('Banner ditambahkan'); setTitle(''); setFile(null); } catch (err: any) { toast(err.message); }
  }
  return (
    <form className="card" style={{ marginTop: 0 }} onSubmit={submit}>
      <h3>Tambah banner beranda</h3>
      <div className="field"><label>Judul</label><input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="field"><label>Gambar (PNG / WEBP)</label><input type="file" accept=".png,.webp,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      <button className="btn gold block">Terbitkan</button>
    </form>
  );
}

function Audit() {
  const [log, setLog] = useState<any[]>([]);
  useEffect(() => { get('/staff/audit').then((r) => setLog(r.log)).catch(() => undefined); }, []);
  return (
    <div className="card" style={{ marginTop: 0, overflowX: 'auto' }}>
      <h3>Jejak audit</h3>
      <table className="table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Oleh</th><th>Target</th><th>Jumlah</th></tr></thead>
        <tbody>{log.map((l) => <tr key={l.id}><td>{l.created_at.slice(5, 16)}</td><td>{l.kind}</td><td>{l.actor}</td><td>{l.target}</td><td>{l.amount ? fmt(l.amount) : l.note}</td></tr>)}</tbody></table>
    </div>
  );
}
