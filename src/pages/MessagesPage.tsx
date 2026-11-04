import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { useApp } from '../lib/ctx';
import { Avatar } from '../components/Avatar';

export default function MessagesPage() {
  const nav = useNavigate();
  const { refreshUnread } = useApp();
  const [threads, setThreads] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => get('/social/messages').then((r) => { setThreads(r.threads); setLoaded(true); refreshUnread(); }).catch(() => undefined);
    load();
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [refreshUnread]);

  return (
    <>
      <div className="hero-bg" style={{ height: 150 }} />
      <div className="page">
        <h2 style={{ color: '#fff', margin: '4px 2px 14px' }}>Pesan</h2>
        {loaded && threads.length === 0 && <div className="empty">Belum ada percakapan.<br />Buka profil seseorang untuk mengirim pesan.</div>}
        {threads.map((t) => (
          <button key={t.user.id} className="thread" onClick={() => nav(`/chat/${t.user.id}`)}>
            <Avatar name={t.user.displayName} src={t.user.avatar} frame={t.user.frame} size={46} />
            <div className="t"><b>{t.user.displayName}</b><span>{t.last}</span></div>
            {t.unread > 0 && <span className="unread">{t.unread}</span>}
          </button>
        ))}
      </div>
    </>
  );
}
