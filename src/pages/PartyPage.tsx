import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, fmt } from '../lib/api';
import { useApp } from '../lib/ctx';
import { flagOf } from '../components/Avatar';

type RoomCard = {
  id: number; code: string; title: string; cover: string; country: string; isHot: boolean; online: number;
  owner: { id: number; displayName: string; avatar: string };
};
type Banner = { id: number; title: string; image: string };

export default function PartyPage() {
  const nav = useNavigate();
  const { toast } = useApp();
  const [tab, setTab] = useState<'hot' | 'new'>('hot');
  const [top, setTop] = useState<'saya' | 'party' | 'acara' | 'negara'>('party');
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [mine, setMine] = useState<RoomCard[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [pool, setPool] = useState(11_099_539);
  const [bi, setBi] = useState(0);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    get('/social/home').then((r) => { setBanners(r.banners); setPool(r.prizePool); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const load = () => {
      if (top === 'saya') get('/rooms/mine').then((r) => setMine(r.rooms)).catch(() => undefined);
      else get(`/rooms?tab=${tab}${top === 'negara' ? '&country=ID' : ''}`).then((r) => setRooms(r.rooms)).catch(() => undefined);
    };
    load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [tab, top]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = window.setInterval(() => setBi((i) => (i + 1) % banners.length), 4500);
    return () => window.clearInterval(t);
  }, [banners.length]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await post('/rooms', { title });
      setCreating(false);
      setTitle('');
      nav(`/room/${r.room.code}`);
    } catch (err: any) {
      toast(err.message);
    }
  }

  const list = top === 'saya' ? mine : rooms;
  const banner = banners[bi];

  return (
    <>
      <div className="hero-bg" />
      <div className="page">
        <div className="toptabs">
          {([['saya', 'Saya'], ['party', 'Party'], ['acara', 'Acara'], ['negara', 'Negara']] as const).map(([k, l]) => (
            <button key={k} className={top === k ? 'on' : ''} onClick={() => setTop(k)}>{l}</button>
          ))}
          <span className="grow" />
          <button className="iconbtn" onClick={() => setCreating(true)} title="Buat room">🏠</button>
          <button className="iconbtn" onClick={() => nav('/discover')} title="Cari">🔍</button>
        </div>

        <div className="banner">
          {banner?.image ? <img src={banner.image} alt={banner.title} /> : <h2>{banner?.title || 'Kahfi Party Star'}<br />Voice Room</h2>}
        </div>

        <div className="shortcuts">
          <button className="sc gift" onClick={() => nav('/ranking')}>Kirim Hadiah<small>🏆🎤👑</small></button>
          <button className="sc cp" onClick={() => nav('/cp')}>Daftar CP<small>💞</small></button>
          <button className="sc family" onClick={() => nav('/shop')}>Toko<small>🛍️✨</small></button>
        </div>

        <button className="prize" onClick={() => nav('/ranking')}>
          <span className="coin">🪙</span>
          <b>{fmt(pool)}</b>
          <span className="r">Pembagian kolam hadiah undian ›</span>
        </button>

        {top !== 'saya' && (
          <div className="pills">
            <button className={`pill ${tab === 'hot' ? 'on' : ''}`} onClick={() => setTab('hot')}>🔥 Hot</button>
            <button className={`pill ${tab === 'new' ? 'on' : ''}`} onClick={() => setTab('new')}>🎉 New</button>
          </div>
        )}

        {top === 'acara' ? (
          <div className="empty">Belum ada acara terjadwal.<br />Pantau terus, event seru segera hadir.</div>
        ) : list.length === 0 ? (
          <div className="empty">
            {top === 'saya' ? 'Kamu belum punya room.' : 'Belum ada room yang aktif.'}<br />
            Ketuk tombol 🏠 di atas untuk membuat room pertamamu.
          </div>
        ) : (
          <div className="rooms">
            {list.map((r) => (
              <button key={r.id} className="room-card" onClick={() => nav(`/room/${r.code}`)}>
                <div className="room-cover">
                  {r.cover ? <img src={r.cover} alt="" /> : <span>{['🪽', '🌙', '🔥', '🌊', '💎', '🦋'][r.id % 6]}</span>}
                  <div className="room-meta">
                    <span className="av">{r.owner.displayName.slice(0, 1).toUpperCase()}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.owner.displayName}</span>
                    <span className="on">▮▮ {r.online}</span>
                  </div>
                </div>
                <div className="room-title"><span className="flag">{flagOf(r.country)}</span><span>{r.title}</span></div>
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <div className="sheet-bg" onClick={() => setCreating(false)}>
          <form className="sheet light" onClick={(e) => e.stopPropagation()} onSubmit={createRoom}>
            <h3>Buat room baru</h3>
            <div className="field"><label>Judul room</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Contoh: Ngobrol santai malam ini" autoFocus required /></div>
            <button className="btn gold block" type="submit">Buat & masuk</button>
          </form>
        </div>
      )}
    </>
  );
}
