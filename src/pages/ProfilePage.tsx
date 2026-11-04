import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post, short } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';
import { Avatar, RoleChip, VipChip, flagOf } from '../components/Avatar';

export default function ProfilePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, toast } = useApp();
  const [d, setD] = useState<any>(null);
  const load = () => get(`/user/profile/${id}`).then(setD).catch((e) => toast(e.message));
  useEffect(() => { void load(); }, [id]);
  if (!d) return <TopBar title="Profil" />;
  const u = d.user;
  const mine = u.id === me?.id;

  async function follow() { const r = await post(`/user/follow/${u.id}`); setD({ ...d, following: r.following, stats: { ...d.stats, fans: d.stats.fans + (r.following ? 1 : -1) } }); }

  return (
    <>
      <TopBar title="Profil" />
      <div className="page" style={{ paddingTop: 18 }}>
        <div className="card" style={{ marginTop: 0, textAlign: 'center' }}>
          <Avatar name={u.displayName} src={u.avatar} frame={u.frame} size={92} />
          <h2 style={{ margin: '14px 0 4px' }}>{u.displayName} {flagOf(u.country)}</h2>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="sub">UID {u.uid}</span><RoleChip role={u.role} /><VipChip vip={u.vipLevel} svip={u.svipLevel} />
            <span className="lvl">💎 {u.wealthLevel}</span>
          </div>
          {u.bio && <p className="sub">{u.bio}</p>}
          <div className="stats" style={{ margin: '14px 0' }}>
            <div><b>{d.stats.following}</b><span>Mengikuti</span></div>
            <div><b>{d.stats.fans}</b><span>Fans</span></div>
            <div><b>{short(u.charm)}</b><span>Pesona</span></div>
          </div>
          {d.cp && <div className="okmsg">💞 CP dengan {d.cp.partner} · keintiman {d.cp.intimacy.toLocaleString('id-ID')}</div>}
          {!mine && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn block ${d.following ? 'ghost' : ''}`} onClick={follow}>{d.following ? 'Mengikuti' : 'Ikuti'}</button>
              <button className="btn gold block" onClick={() => nav(`/chat/${u.id}`)}>Kirim pesan</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
