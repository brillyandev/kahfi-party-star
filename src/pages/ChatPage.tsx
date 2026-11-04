import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { useApp } from '../lib/ctx';
import TopBar from '../components/TopBar';

export default function ChatPage() {
  const { id } = useParams();
  const { toast, refreshUnread } = useApp();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [name, setName] = useState('Chat');
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const load = () => get(`/social/messages/${id}`).then((r) => { setMsgs(r.messages); refreshUnread(); }).catch(() => undefined);

  useEffect(() => {
    get(`/user/profile/${id}`).then((r) => setName(r.user.displayName)).catch(() => undefined);
    void load();
    const t = window.setInterval(load, 4000);
    return () => window.clearInterval(t);
  }, [id]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    try { await post(`/social/messages/${id}`, { body }); await load(); } catch (err: any) { toast(err.message); }
  }

  return (
    <>
      <TopBar title={name} />
      <div className="bubbles" style={{ paddingBottom: 90 }}>
        {msgs.map((m) => <div key={m.id} className={`bub ${m.mine ? 'mine' : ''}`}>{m.body}</div>)}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..." maxLength={500} />
        <button className="btn" type="submit">Kirim</button>
      </form>
    </>
  );
}
