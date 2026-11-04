import { useNavigate } from 'react-router-dom';

export default function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}>‹</button>
      <h1>{title}</h1>
      <div style={{ minWidth: 36, textAlign: 'right' }}>{right}</div>
    </div>
  );
}
