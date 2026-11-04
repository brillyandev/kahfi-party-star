import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post, del, fmt } from '../lib/api';
import { useApp } from '../lib/ctx';
import { useVoice, type Peer } from '../lib/useVoice';
import { Avatar, RoleChip, VipChip } from '../components/Avatar';
import GiftEffect from '../components/GiftEffect';
import { ItemPic, type ShopItem } from './ShopPage';

const SEATS = 8;
const STAFF = ['admin', 'super_admin', 'developer'];

export default function RoomPage() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const { me, setMe, toast } = useApp();
  const v = useVoice();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Peer | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [gifts, setGifts] = useState<ShopItem[]>([]);
  const [giftSel, setGiftSel] = useState<ShopItem | null>(null);
  const [qty, setQty] = useState(1);
  const [target, setTarget] = useState<Peer | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => { void v.join(code); return () => v.leave(); /* eslint-disable-next-line */ }, [code]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [v.chat.length]);
  useEffect(() => { if (v.kicked) { toast(v.kicked); nav('/'); } }, [v.kicked]);

  const everyone: Peer[] = v.self ? [v.self, ...v.peers] : v.peers;
  const bySeat = (i: number) => everyone.find((p) => p.seat === i);
  const listeners = everyone.filter((p) => p.seat == null);
  const speakingOf = (p: Peer) => !!v.speaking[p.id === v.self?.id ? 'self' : p.id];
  const iAmHost = !!v.self?.isOwner;
  const canModerate = iAmHost || STAFF.includes(me?.role || '');

  async function openGift(to?: Peer) {
    const list = await get('/shop/items?type=gift');
    setGifts(list.items); setGiftSel(list.items[0] ?? null); setTarget(to ?? null); setGiftOpen(true);
  }
  async function sendGift() {
    if (!giftSel || !target) return toast('Pilih penerima dulu');
    try {
      const r = await post(`/rooms/${code}/gift`, { itemId: giftSel.id, toUserId: target.userId, qty });
      setMe(r.user); setGiftOpen(false);
    } catch (e: any) { toast(e.message); }
  }
  async function seat(i: number) {
    const cur = bySeat(i);
    if (cur) { setPicked(cur); return; }
    const err = await v.takeSeat(i);
    if (err) toast(err);
  }
  async function closeRoom() {
    if (!confirm('Tutup room ini untuk semua orang?')) return;
    try { await del(`/rooms/${code}`); nav('/'); } catch (e: any) { toast(e.message); }
  }
  function submit(e: React.FormEvent) { e.preventDefault(); const t = text.trim(); if (!t) return; v.sendChat(t); setText(''); }

  if (v.status === 'error') {
    return (
      <div className="vroom"><div className="empty" style={{ margin: 'auto', color: '#fff' }}>
        <div style={{ fontSize: 54 }}>😕</div>{v.error}<br /><br />
        <button className="btn gold" onClick={() => nav('/')}>Kembali</button>
      </div></div>
    );
  }

  return (
    <div className="vroom">
      <div className="vr-top">
        <button className="ib" onClick={() => nav('/')}>‹</button>
        <div className="tt"><h2>{v.room?.title || 'Menghubungkan...'}</h2><small>Kode {code} · {everyone.length} orang</small></div>
        {canModerate && <button className="ib" title="Tutup room" onClick={closeRoom}>⏻</button>}
      </div>

      <div className="seats">
        {Array.from({ length: SEATS }, (_, i) => {
          const p = bySeat(i);
          return (
            <button key={i} className={`seat ${p && speakingOf(p) && !p.muted ? 'speaking' : ''}`} onClick={() => seat(i)}>
              <div className="sv">
                {p ? (<><Avatar name={p.name} src={p.avatar} frame={p.frame} size={62} /><span className="mic">{p.muted ? '🔇' : '🎙️'}</span></>) : <div className="empty-seat">＋</div>}
              </div>
              <span className="nm">{p ? p.name : `Kursi ${i + 1}`}</span>
            </button>
          );
        })}
      </div>

      {listeners.length > 0 && (
        <div style={{ padding: '0 14px 6px', fontSize: 12, opacity: .75 }}>
          Pendengar: {listeners.map((p) => p.name).join(', ')}
        </div>
      )}

      <div className="chatlog" ref={log}>
        {v.chat.map((l) => <div key={l.key} className={`msg ${l.sys ? 'sys' : ''}`}>{l.name && <b>{l.name}</b>}{l.text}</div>)}
      </div>

      <form className="vr-bar" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ketik pesan..." maxLength={200} />
        {v.self?.seat != null ? (
          <>
            <button type="button" className={`rb ${v.muted ? 'off' : 'on'}`} onClick={v.toggleMute}>{v.muted ? '🔇' : '🎙️'}</button>
            <button type="button" className="rb" title="Turun kursi" onClick={v.leaveSeat}>⬇️</button>
          </>
        ) : null}
        <button type="button" className="rb gold" title="Kirim gift" onClick={() => openGift()}>🎁</button>
      </form>

      {v.gift && <GiftEffect ev={v.gift} />}

      {picked && (
        <div className="sheet-bg" onClick={() => setPicked(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Avatar name={picked.name} src={picked.avatar} frame={picked.frame} size={54} />
              <div><b style={{ fontSize: 17 }}>{picked.name}</b><div style={{ display: 'flex', gap: 6, marginTop: 4 }}><RoleChip role={picked.role} /><VipChip vip={picked.vip} svip={picked.svip} /></div></div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {picked.id !== v.self?.id && <button className="btn gold" onClick={() => { const p = picked; setPicked(null); void openGift(p); }}>🎁 Kirim gift</button>}
              <button className="btn ghost" onClick={() => nav(`/user/${picked.userId}`)}>Lihat profil</button>
              {canModerate && picked.id !== v.self?.id && !picked.isOwner && picked.role !== 'developer' && picked.svip === 0 && (
                <button className="btn red" onClick={() => { v.kick(picked.id); setPicked(null); }}>Keluarkan dari room</button>
              )}
            </div>
          </div>
        </div>
      )}

      {giftOpen && (
        <div className="sheet-bg" onClick={() => setGiftOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Kirim gift <span style={{ float: 'right', fontSize: 14, color: '#ffd761' }}>🪙 {fmt(me?.coins)}</span></h3>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
              {everyone.filter((p) => p.id !== v.self?.id).map((p) => (
                <button key={p.id} onClick={() => setTarget(p)} style={{ background: 'none', border: 0, color: '#fff', opacity: target?.id === p.id ? 1 : .55, textAlign: 'center', fontSize: 11 }}>
                  <Avatar name={p.name} src={p.avatar} size={44} /><div style={{ marginTop: 3, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  {target?.id === p.id && <div>✓</div>}
                </button>
              ))}
              {everyone.length <= 1 && <span className="sub">Belum ada orang lain di room.</span>}
            </div>
            <div className="shop-grid">
              {gifts.map((g) => (
                <button key={g.id} className={`item ${giftSel?.id === g.id ? 'sel' : ''}`} style={{ border: giftSel?.id === g.id ? '2px solid #ffd761' : '2px solid transparent' }} onClick={() => setGiftSel(g)}>
                  <div className="pic"><ItemPic item={g} /></div><div className="nm">{g.name}</div><div className="pr">🪙 {fmt(g.price)}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              {[1, 10, 99].map((n) => <button key={n} className={`btn small ${qty === n ? 'gold' : 'ghost'}`} onClick={() => setQty(n)}>x{n}</button>)}
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#ffd761' }}>Total 🪙 {fmt((giftSel?.price || 0) * qty)}</span>
            </div>
            <button className="btn gold block" style={{ marginTop: 12 }} disabled={!giftSel || !target} onClick={sendGift}>{target ? `Kirim ke ${target.name}` : 'Pilih penerima'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
