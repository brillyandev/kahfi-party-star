export type Role = 'user' | 'admin' | 'super_admin' | 'coin_seller' | 'developer';

export type Frame = { id: number; name?: string; file: string; file_kind: string } | null;

export type Me = {
  id: number;
  uid: string;
  username: string;
  displayName: string;
  role: Role;
  avatar: string;
  country: string;
  bio: string;
  coins: number;
  diamonds: number;
  charm: number;
  wealth: number;
  activity: number;
  wealthLevel: number;
  vipLevel: number;
  svipLevel: number;
  vipUntil: string | null;
  frame: Frame;
  claimStreak: number;
};

const TOKEN_KEY = 'kps:token';

/**
 * Alamat server API. Kosong berarti satu domain dengan website (disarankan).
 * Bisa diatur dua cara:
 *   - saat build : VITE_API_BASE=https://api.contoh.com npm run build
 *   - saat jalan : ubah public/config.js tanpa build ulang
 */
const savedBase = typeof window !== 'undefined' ? (localStorage.getItem('kps:apiBase') || '') : '';
const runtimeBase = typeof window !== 'undefined' ? ((window as any).__KPS_API__ || '') : '';
export const API_BASE = String(savedBase || import.meta.env.VITE_API_BASE || runtimeBase || '').replace(/\/$/, '');

/** Simpan alamat server lalu muat ulang agar dipakai seluruh aplikasi. */
export function setApiBase(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) localStorage.setItem('kps:apiBase', clean);
  else localStorage.removeItem('kps:apiBase');
  location.reload();
}

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY) || '',
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(auth.get() ? { Authorization: `Bearer ${auth.get()}` } : {}),
    },
    body: body == null ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* kosong */
  }
  if (!res.ok) throw new ApiError(data.error || 'Terjadi kesalahan.', res.status);
  return data as T;
}

export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>('PATCH', p, b ?? {});
export const del = <T = any>(p: string) => api<T>('DELETE', p);

export const STAFF_ROLES: Role[] = ['admin', 'super_admin', 'developer'];

export const ROLE_LABEL: Record<Role, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
  coin_seller: 'Coin Seller',
  developer: 'Developer',
};

export function fmt(n: number | undefined | null): string {
  const v = Number(n || 0);
  return v.toLocaleString('id-ID');
}

export function short(n: number | undefined | null): string {
  const v = Number(n || 0);
  if (v >= 1e12) return `${(v / 1e12).toFixed(1).replace(/\.0$/, '')}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}Jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
}
