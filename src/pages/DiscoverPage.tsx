import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { Avatar, RoleChip, flagOf } from '../components/Avatar';

export default function DiscoverPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ users: any[]; rooms: any[] }>({ users: [], rooms: [] });
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    get('/social/ranking?kind=charm').then((r) => setTop(r.list.slice(0, 10))).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setRes({ users: [], rooms: [] }); return; }
    const t = window.setTimeout(() => get(`/user/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => undefined), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className="hero-bg" style={{ height: 160 }} />
      <div className="page">
        <h2 style={{ color: '#fff', margin: '4px 2px 12px' }}>Temukan</h2>
        <div className="field" style={{ marginBottom: 8 }}>
          <input placeholder="Cari UID, nama, atau kode room" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {q.trim().length >= 2 ? (
          <>
            {res.rooms.length > 0 && <div className="card"><h3>Room</h3>
              {res.rooms.map((r) => (
                <button key={r.id} className="thread" onClick={() => nav(`/room/${r.code}`)}>
                  <span style={{ fontSize: 30 }}>🎙️</span><div className="t"><b>{r.title}</b><span>Kode: {r.code}</span></div>
                </button>))}
            </div>}
            <div className="card"><h3>Pengguna</h3>
              {res.users.length === 0 && <div className="sub">Tidak ada hasil.</div>}
              {res.users.map((u) => (
                <button key={u.id} className="thread" onClick={() => nav(`/user/${u.id}`)}>
                  <Avatar name={u.displayName} src={u.avatar} frame={u.frame} size={42} />
                  <div className="t"><b>{u.displayName} {flagOf(u.country)} <RoleChip role={u.role} /></b><span>UID {u.uid}</span></div>
                </button>))}
            </div>
          </>
        ) : (
          <div className="card">
            <h3>🌟 Bintang pesona teratas</h3>
            {top.length === 0 && <div className="sub">Belum ada data. Jadilah yang pertama!</div>}
            {top.map((u) => (
              <button key={u.id} className="thread" onClick={() => nav(`/user/${u.id}`)}>
                <b style={{ width: 22, color: '#999' }}>{u.rank}</b>
                <Avatar name={u.displayName} src={u.avatar} frame={u.frame} size={42} />
                <div className="t"><b>{u.displayName}</b><span>Pesona {u.score.toLocaleString('id-ID')}</span></div>
              </button>))}
          </div>
        )}
      </div>
    </>
  );
}
