import { useEffect, useState } from 'react';
import { get, post, fmt } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';

export default function VipPage() {
  const { me, setMe, toast } = useApp();
  const [tiers, setTiers] = useState<any[]>([]);
  useEffect(() => { get('/shop/vip').then((r) => setTiers(r.tiers)); }, []);

  async function buy(t: any) {
    try {
      const r = await post('/shop/vip/buy', { kind: t.kind, level: t.level });
      setMe(r.user);
      toast(`${t.name} aktif!`);
    } catch (e: any) { toast(e.message); }
  }

  const until = me?.vipUntil ? new Date(me.vipUntil + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <>
      <TopBar title="VIP & SVIP" />
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="card" style={{ marginTop: 0 }}>
          <b>Status kamu: {me?.svipLevel ? `SVIP ${me.svipLevel}` : me?.vipLevel ? `VIP ${me.vipLevel}` : 'Belum berlangganan'}</b>
          <div className="sub">{until && (me?.vipLevel || me?.svipLevel) ? `Aktif sampai ${until}` : 'Dapatkan bonus klaim harian lebih besar dan lencana eksklusif.'}</div>
        </div>
        {['svip', 'vip'].map((kind) => (
          <div key={kind} style={{ marginTop: 14 }}>
            <h3 style={{ margin: '0 0 8px' }}>{kind === 'svip' ? '👑 SVIP' : '🛡️ VIP'}</h3>
            {tiers.filter((t) => t.kind === kind).map((t) => (
              <div key={t.name} className={`vip-card ${kind}`}>
                <h4>{t.name}</h4>
                <ul>{t.perks.map((p: string) => <li key={p}>{p}</li>)}</ul>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="pr">🪙 {fmt(t.price)} / {t.days} hari</span>
                  <button className="btn gold small" onClick={() => buy(t)}>Beli</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
