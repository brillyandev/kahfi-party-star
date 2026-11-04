import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, short } from '../lib/api';
import TopBar from '../components/TopBar';
import { Avatar } from '../components/Avatar';

const KINDS = [
  ['gift_received', '🎁 Top Gift'],
  ['gift_sent', '💸 Top Pengirim'],
  ['charm', '✨ Pesona'],
  ['wealth', '💰 Kekayaan'],
  ['activity', '🔥 Keaktifan'],
] as const;
const PERIODS = [['day', 'Harian'], ['week', 'Mingguan'], ['month', 'Bulanan']] as const;

export default function RankingPage() {
  const nav = useNavigate();
  const [kind, setKind] = useState<string>('gift_received');
  const [period, setPeriod] = useState<string>('week');
  const [list, setList] = useState<any[]>([]);
  const timed = kind === 'gift_received' || kind === 'gift_sent';

  useEffect(() => { get(`/social/ranking?kind=${kind}&period=${period}`).then((r) => setList(r.list)).catch(() => setList([])); }, [kind, period]);

  const [a, b, c] = list;
  const pod = (u: any, cls: string, medal: string) => u ? (
    <button className={`pod ${cls}`} style={{ border: 0 }} onClick={() => nav(`/user/${u.id}`)}>
      <div className="n">{medal}</div>
      <Avatar name={u.displayName} src={u.avatar} frame={u.frame} size={cls === 'p1' ? 64 : 52} />
      <div className="nm">{u.displayName}</div>
      <div className="sc2">{short(u.score)}</div>
    </button>
  ) : <div />;

  return (
    <>
      <TopBar title="Peringkat" />
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="seg" style={{ overflowX: 'auto' }}>
          {KINDS.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} style={{ whiteSpace: 'nowrap', padding: '8px 10px' }} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        {timed && <div className="seg">{PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>}

        {list.length === 0 ? <div className="empty">Belum ada data peringkat.<br />Kirim gift di room untuk masuk papan peringkat!</div> : (
          <>
            <div className="podium">{pod(b, 'p2', '🥈')}{pod(a, 'p1', '🥇')}{pod(c, 'p3', '🥉')}</div>
            {list.slice(3).map((u) => (
              <button key={u.id} className="rk-row" style={{ border: 0, width: '100%', textAlign: 'left' }} onClick={() => nav(`/user/${u.id}`)}>
                <span className="no">{u.rank}</span>
                <Avatar name={u.displayName} src={u.avatar} frame={u.frame} size={40} />
                <span className="nm">{u.displayName}</span>
                <span className="pt">{short(u.score)}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}
