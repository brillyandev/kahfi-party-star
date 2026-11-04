import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';
import { ItemPic } from './ShopPage';

export default function InventoryPage() {
  const { me, setMe, toast } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const load = () => get('/shop/inventory').then((r) => setItems(r.items));
  useEffect(() => { void load(); }, [me?.frame?.id]);

  async function equip(id: number) {
    try { const r = await post(`/shop/equip/${id}`); setMe(r.user); toast(id ? 'Bingkai dipasang' : 'Bingkai dilepas'); await load(); } catch (e: any) { toast(e.message); }
  }

  return (
    <>
      <TopBar title="Alat peraga" right={me?.frame ? <button className="btn ghost small" onClick={() => equip(0)}>Lepas</button> : null} />
      <div className="page" style={{ paddingTop: 12 }}>
        {items.length === 0 && <div className="empty">Belum ada item.<br />Beli bingkai dan efek di Toko.</div>}
        <div className="shop-grid">
          {items.map((i) => (
            <div key={i.invId} className={`item ${i.id === me?.frame?.id ? 'sel' : ''}`}>
              <div className="pic"><ItemPic item={i} /></div>
              <div className="nm">{i.name}</div>
              <div className="pr">{i.expiresAt ? `s/d ${new Date(i.expiresAt + 'Z').toLocaleDateString('id-ID')}` : 'Permanen'}</div>
              {i.type === 'frame' && <button className="btn small block" style={{ marginTop: 6 }} onClick={() => equip(i.id)}>{i.id === me?.frame?.id ? 'Terpasang' : 'Pasang'}</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
