import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, fmt, short, ROLE_LABEL, STAFF_ROLES } from '../lib/api';
import { useApp } from '../lib/ctx';
import { Avatar, RoleChip, VipChip, flagOf } from '../components/Avatar';

export default function MePage() {
  const nav = useNavigate();
  const { me, setMe, toast, logout } = useApp();
  const [claim, setClaim] = useState<{ amount: number; streak: number } | null>(null);
  const [stats, setStats] = useState<{ following: number; fans: number } | null>(null);
  const [claimed, setClaimed] = useState<boolean | null>(null);

  useState(() => {
    if (!me) return;
    get(`/user/profile/${me.id}`).then((r) => setStats(r.stats)).catch(() => undefined);
    get('/user/claim/status').then((r) => setClaimed(r.claimed)).catch(() => undefined);
  });

  if (!me) return null;
  const isStaff = STAFF_ROLES.includes(me.role) || me.role === 'coin_seller';

  async function doClaim() {
    try {
      const r = await post('/user/claim');
      setMe(r.user);
      setClaim({ amount: r.amount, streak: r.streak });
      setClaimed(true);
    } catch (e: any) {
      toast(e.message);
    }
  }

  return (
    <>
      <div className="hero-bg" style={{ height: 240 }} />
      <div className="page">
        <div className="me-head">
          <Avatar name={me.displayName} src={me.avatar} frame={me.frame} size={78} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="me-name">
              {me.displayName} <span style={{ fontSize: 20 }}>{flagOf(me.country)}</span>
            </div>
            <div className="me-uid">
              UID:{me.uid}
              <button className="lvl" style={{ border: 0 }} onClick={() => nav('/vip')}>💎 {me.wealthLevel}</button>
              <RoleChip role={me.role} />
              <VipChip vip={me.vipLevel} svip={me.svipLevel} />
            </div>
          </div>
        </div>

        <div className="stats">
          <div><b>{stats?.following ?? 0}</b><span>Mengikuti</span></div>
          <div><b>{stats?.fans ?? 0}</b><span>Fans</span></div>
          <div><b>{short(me.charm)}</b><span>Pesona</span></div>
        </div>

        <button className="wallet" onClick={() => nav('/wallet')}>
          <span className="bag">💰</span>
          {claimed === false && <span className="tag" onClick={(e) => { e.stopPropagation(); void doClaim(); }}>Klaim harian 500K</span>}
          <small>Dompet</small>
          {fmt(me.coins)}
        </button>

        <div className="duo">
          <button className="tier vip" onClick={() => nav('/vip')}>
            <span className="big">🛡️</span>VIP
            <b>{me.svipLevel ? `SVIP ${me.svipLevel}` : me.vipLevel ? `VIP ${me.vipLevel}` : 'Belum diperoleh'}</b>
          </button>
          <button className="tier wealth" onClick={() => nav('/ranking')}>
            <span className="big">🏅</span>Level kekayaan
            <b>LV.{me.wealthLevel}</b>
          </button>
        </div>

        <div className="spin">
          <div className="amt">💎 {fmt(me.diamonds)} = {fmt(Math.floor(me.diamonds / 1000))}$</div>
          <p>Diamond didapat dari gift yang kamu terima</p>
          <span className="wheel">🎡</span>
          <button className="go" onClick={() => nav('/wallet')}>Go</button>
        </div>

        <div className="menu-grid">
          <button className="mi" onClick={() => nav('/ranking')}><span className="i">🏅</span>Lencana glory</button>
          <button className="mi" onClick={() => nav('/cp')}><span className="i">🏡</span>CP house</button>
          <button className="mi" onClick={() => nav('/shop')}><span className="i">🛍️</span>Store</button>
          <button className="mi" onClick={() => nav('/vip')}><span className="i">💚</span>VIP & SVIP</button>
          <button className="mi" onClick={() => nav('/ranking')}><span className="i">📜</span>Data host</button>
          <button className="mi" onClick={() => nav(`/user/${me.id}`)}><span className="i">🧑‍💼</span>Profil</button>
          <button className="mi" onClick={() => nav('/inventory')}><span className="i">🎒</span>Alat peraga</button>
          {isStaff && <button className="mi" onClick={() => nav('/staff')}><span className="i">🛠️</span>Pusat {ROLE_LABEL[me.role]}</button>}
        </div>

        <div className="menu-list">
          <button className="row" onClick={() => nav('/wallet')}><span className="i">🧾</span>Catatan Hadiah<span className="chev">›</span></button>
          <button className="row" onClick={() => nav('/inventory')}><span className="i">🎀</span>Alat peraga<span className="chev">›</span></button>
          <button className="row" onClick={logout}><span className="i">🚪</span>Keluar<span className="chev">›</span></button>
        </div>
      </div>

      {claim && (
        <div className="sheet-bg" onClick={() => setClaim(null)}>
          <div className="sheet light claim-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gift">🎁</div>
            <h3>Klaim harian berhasil!</h3>
            <b className="big">+{fmt(claim.amount)} koin</b>
            <p className="sub">Beruntun {claim.streak} hari. Kembali lagi besok!</p>
            <button className="btn gold block" onClick={() => setClaim(null)}>Mantap</button>
          </div>
        </div>
      )}
    </>
  );
}
