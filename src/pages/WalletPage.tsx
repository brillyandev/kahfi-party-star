import { useEffect, useState } from 'react';
import { get, fmt } from '../lib/api';
import TopBar from '../components/TopBar';

const LABEL: Record<string, string> = {
  welcome_bonus: 'Bonus pendaftaran', daily_claim: 'Klaim harian', purchase: 'Pembelian', gift_sent: 'Gift dikirim',
  gift_received: 'Gift diterima (diamond)', vip_purchase: 'Beli VIP/SVIP', cp_fee: 'Biaya CP', dev_grant: 'Tambah koin',
  dev_deduct: 'Pengurangan koin', seller_in: 'Beli dari coin seller', seller_out: 'Jual koin',
};

export default function WalletPage() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { get('/user/wallet').then(setD); }, []);
  return (
    <>
      <TopBar title="Dompet & catatan" />
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="kpi">
          <div><b>🪙 {fmt(d?.coins)}</b><span>Koin</span></div>
          <div><b>💎 {fmt(d?.diamonds)}</b><span>Diamond</span></div>
        </div>
        <div className="card">
          <h3>Catatan terbaru</h3>
          {d?.log?.length === 0 && <div className="sub">Belum ada transaksi.</div>}
          {d?.log?.map((l: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
              <div><b style={{ fontSize: 14 }}>{LABEL[l.kind] || l.kind}</b><div className="sub">{l.note}</div></div>
              <b style={{ color: l.amount >= 0 ? '#14a04a' : '#e0384a' }}>{l.amount >= 0 ? '+' : ''}{fmt(l.amount)}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
