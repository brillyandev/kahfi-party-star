import { useEffect, useState } from 'react';
import { get, post, fmt } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';

export type ShopItem = { id: number; type: string; name: string; price: number; file: string; fileKind: string; icon: string; durationDays: number };

export function ItemPic({ item }: { item: ShopItem }) {
  if (item.icon && !item.icon.startsWith('/')) return <span>{item.icon}</span>;
  const src = item.icon || item.file;
  if (item.fileKind === 'svga' && !item.icon) return <span>🎞️</span>;
  return src ? <img src={src} alt={item.name} loading="lazy" /> : <span>🎁</span>;
}

const TABS = [['frame', 'Bingkai'], ['effect', 'Efek'], ['entrance', 'Masuk'], ['badge', 'Lencana']] as const;

export default function ShopPage() {
  const { me, setMe, toast } = useApp();
  const [type, setType] = useState<string>('frame');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState<ShopItem | null>(null);

  const load = () => {
    get(`/shop/items?type=${type}`).then((r) => setItems(r.items));
    get('/shop/inventory').then((r) => setOwned(new Set(r.items.map((i: any) => i.id))));
  };
  useEffect(() => { load(); setSel(null); }, [type]);

  async function buy() {
    if (!sel) return;
    try {
      const r = await post(`/shop/buy/${sel.id}`);
      setMe(r.user);
      toast(`Berhasil membeli ${sel.name}`);
      load();
    } catch (e: any) { toast(e.message); }
  }

  return (
    <>
      <TopBar title="Toko" right={<span className="sub">🪙 {fmt(me?.coins)}</span>} />
      <div className="page" style={{ paddingTop: 10 }}>
        <div className="seg">{TABS.map(([k, l]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
        {items.length === 0 && <div className="empty">Belum ada item di kategori ini.<br />Developer bisa menambahkan lewat Pusat Developer.</div>}
        <div className="shop-grid">
          {items.map((i) => (
            <button key={i.id} className={`item ${sel?.id === i.id ? 'sel' : ''}`} onClick={() => setSel(i)}>
              {i.fileKind === 'svga' && <span className="svga-tag">SVGA</span>}
              {owned.has(i.id) && <span className="own">Dimiliki</span>}
              <div className="pic"><ItemPic item={i} /></div>
              <div className="nm">{i.name}</div>
              <div className="pr">🪙 {fmt(i.price)}{i.durationDays ? ` / ${i.durationDays}h` : ''}</div>
            </button>
          ))}
        </div>
        {sel && (
          <div className="card" style={{ position: 'sticky', bottom: 80 }}>
            <b>{sel.name}</b>
            <div className="sub">{sel.durationDays ? `Berlaku ${sel.durationDays} hari` : 'Permanen'} · 🪙 {fmt(sel.price)}</div>
            <button className="btn gold block" style={{ marginTop: 10 }} disabled={owned.has(sel.id)} onClick={buy}>{owned.has(sel.id) ? 'Sudah dimiliki' : 'Beli sekarang'}</button>
          </div>
        )}
      </div>
    </>
  );
}
