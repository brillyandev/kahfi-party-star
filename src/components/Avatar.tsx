import type { Frame } from '../lib/api';

export function initials(name: string) {
  const p = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** Bingkai: PNG/WEBP/SVG tampil sebagai gambar. SVGA tampil sebagai lencana ikon (pemutar penuh opsional). */
export function Avatar({
  name,
  src,
  size = 48,
  frame,
}: {
  name: string;
  src?: string;
  size?: number;
  frame?: Frame | { file: string; file_kind?: string; fileKind?: string } | null;
}) {
  const kind = frame ? (frame as any).file_kind || (frame as any).fileKind : '';
  const showFrameImg = frame && kind && kind !== 'svga';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      <span className="face">{src ? <img src={src} alt="" /> : initials(name)}</span>
      {showFrameImg && <img className="frame" src={frame!.file} alt="" />}
      {frame && kind === 'svga' && (
        <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '3px solid #ffd761', boxShadow: '0 0 12px #ffb300' }} />
      )}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  if (role === 'user') return null;
  const label = { developer: 'DEV', super_admin: 'SUPER ADMIN', admin: 'ADMIN', coin_seller: 'COIN SELLER' }[role] || role;
  return <span className={`role-chip ${role}`}>{label}</span>;
}

export function VipChip({ vip, svip }: { vip?: number; svip?: number }) {
  if (svip) return <span className="vip-chip svip">SVIP{svip}</span>;
  if (vip) return <span className="vip-chip">VIP{vip}</span>;
  return null;
}

export function flagOf(cc?: string) {
  const c = (cc || 'ID').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🏳️';
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}
