import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './lib/ctx';
import AuthPage from './pages/AuthPage';
import PartyPage from './pages/PartyPage';
import DiscoverPage from './pages/DiscoverPage';
import MessagesPage from './pages/MessagesPage';
import MePage from './pages/MePage';
import ChatPage from './pages/ChatPage';
import RoomPage from './pages/RoomPage';
import ShopPage from './pages/ShopPage';
import VipPage from './pages/VipPage';
import RankingPage from './pages/RankingPage';
import CpPage from './pages/CpPage';
import InventoryPage from './pages/InventoryPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import StaffPage from './pages/StaffPage';

const TABS = [
  { path: '/', icon: '🏠', label: 'Party' },
  { path: '/discover', icon: '🎈', label: 'Temukan' },
  { path: '/messages', icon: '🔔', label: 'Pesan' },
  { path: '/me', icon: '👑', label: 'Saya' },
];

function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { unread } = useApp();
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = t.path === '/' ? pathname === '/' : pathname.startsWith(t.path);
        return (
          <button key={t.path} className={`tab ${on ? 'on' : ''}`} onClick={() => nav(t.path)}>
            <span className="ico">{t.icon}</span>
            <span className="t">{t.label}</span>
            {t.path === '/messages' && unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const { me, loading } = useApp();
  const { pathname } = useLocation();

  if (loading) return <div className="empty" style={{ paddingTop: 120 }}>Memuat...</div>;
  if (!me) return <AuthPage />;

  const hideTabs = pathname.startsWith('/room/') || pathname.startsWith('/chat/');

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<PartyPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/me" element={<MePage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/cp" element={<CpPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/user/:id" element={<ProfilePage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </div>
  );
}
