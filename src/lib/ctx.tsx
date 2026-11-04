import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth, get, type Me } from './api';

type Ctx = {
  me: Me | null;
  loading: boolean;
  setMe: (m: Me | null) => void;
  refresh: () => Promise<void>;
  logout: () => void;
  toast: (msg: string) => void;
  unread: number;
  refreshUnread: () => void;
};

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!auth.get());
  const [msg, setMsg] = useState('');
  const [unread, setUnread] = useState(0);
  const timer = useRef<number | undefined>();

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 2600);
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.get()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const r = await get<{ user: Me }>('/auth/me');
      setMe(r.user);
    } catch {
      auth.clear();
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(() => {
    if (!auth.get()) return;
    get<{ unread: number }>('/social/messages/unread').then((r) => setUnread(r.unread)).catch(() => undefined);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    refreshUnread();
    const t = window.setInterval(refreshUnread, 20000);
    return () => window.clearInterval(t);
  }, [me?.id, refreshUnread]);

  const logout = useCallback(() => {
    auth.clear();
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, setMe, refresh, logout, toast, unread, refreshUnread }),
    [me, loading, refresh, logout, toast, unread, refreshUnread],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </AppCtx.Provider>
  );
}
