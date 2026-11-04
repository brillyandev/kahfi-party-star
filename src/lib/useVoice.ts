import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { auth } from './api';

export type Peer = {
  id: string; userId: number; name: string; avatar?: string; role: string; vip: number; svip: number;
  frame: { file: string; file_kind: string } | null; muted: boolean; seat: number | null; isOwner: boolean;
};
export type ChatLine = { key: number; sys?: boolean; name?: string; text: string };
export type Status = 'idle' | 'connecting' | 'joined' | 'error';

const FALLBACK: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const ON = 0.018, OFF = 0.009;

export function useVoice() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [self, setSelf] = useState<Peer | null>(null);
  const [room, setRoom] = useState<{ code: string; title: string; ownerId: number } | null>(null);
  const [muted, setMuted] = useState(true);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [gift, setGift] = useState<any>(null);
  const [kicked, setKicked] = useState('');

  const sock = useRef<Socket | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const analysers = useRef(new Map<string, { a: AnalyserNode; d: Uint8Array; s: MediaStreamAudioSourceNode }>());
  const speakState = useRef(new Map<string, boolean>());
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const ice = useRef<RTCIceServer[]>(FALLBACK);
  const lineKey = useRef(0);
  const micOkRef = useRef(false);

  const selfId = useRef('');

  const audioCtx = () => {
    if (!ctx.current) { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx.current = new C(); }
    if (ctx.current.state === 'suspended') void ctx.current.resume().catch(() => undefined);
    return ctx.current;
  };

  const watch = (id: string, s: MediaStream) => {
    const c = audioCtx(); if (!c) return;
    try {
      analysers.current.get(id)?.s.disconnect();
      const src = c.createMediaStreamSource(s); const a = c.createAnalyser();
      a.fftSize = 512; a.smoothingTimeConstant = 0.55; src.connect(a);
      analysers.current.set(id, { a, d: new Uint8Array(a.frequencyBinCount), s: src });
    } catch { /* tanpa audio */ }
  };

  const loop = () => {
    const tick = () => {
      if (ctx.current?.state === 'suspended') void ctx.current.resume().catch(() => undefined);
      const next: Record<string, boolean> = {};
      analysers.current.forEach((e, id) => {
        e.a.getByteTimeDomainData(e.d as any);
        let sum = 0; for (let i = 0; i < e.d.length; i++) { const v = (e.d[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / e.d.length); const was = speakState.current.get(id) ?? false;
        const on = was ? rms > OFF : rms > ON; speakState.current.set(id, on); next[id] = on;
      });
      setSpeaking((p) => { for (const k of new Set([...Object.keys(p), ...Object.keys(next)])) if (!!p[k] !== !!next[k]) return next; return p; });
    };
    if (raf.current == null) raf.current = window.setInterval(tick, 120);
  };

  const drop = useCallback((id: string) => {
    const pc = pcs.current.get(id);
    if (pc) { pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null; try { pc.close(); } catch { /* noop */ } pcs.current.delete(id); }
    pendingIce.current.delete(id);
    const au = audios.current.get(id); if (au) { au.srcObject = null; au.remove(); audios.current.delete(id); }
    try { analysers.current.get(id)?.s.disconnect(); } catch { /* noop */ }
    analysers.current.delete(id); speakState.current.delete(id);
    setPeers((p) => p.filter((x) => x.id !== id));
  }, []);

  const mkPeer = useCallback((id: string) => {
    const old = pcs.current.get(id); if (old) return old;
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    pcs.current.set(id, pc);
    stream.current?.getTracks().forEach((t) => pc.addTrack(t, stream.current!));
    pc.onicecandidate = (e) => { if (e.candidate) sock.current?.emit('signal', { to: id, data: { type: 'candidate', candidate: e.candidate.toJSON() } }); };
    pc.ontrack = (e) => {
      const [rs] = e.streams; if (!rs) return;
      let au = audios.current.get(id);
      if (!au) { au = document.createElement('audio'); au.autoplay = true; au.setAttribute('playsinline', 'true'); au.style.display = 'none'; document.body.appendChild(au); audios.current.set(id, au); }
      au.srcObject = rs; void au.play().catch(() => undefined); watch(id, rs);
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { pc.close(); pcs.current.delete(id); } };
    return pc;
  }, []);

  const teardown = useCallback(() => {
    if (raf.current != null) { window.clearInterval(raf.current as unknown as number); raf.current = null; }
    pcs.current.forEach((pc) => { try { pc.close(); } catch { /* noop */ } }); pcs.current.clear(); pendingIce.current.clear();
    audios.current.forEach((a) => { a.srcObject = null; a.remove(); }); audios.current.clear();
    analysers.current.forEach((e) => { try { e.s.disconnect(); } catch { /* noop */ } }); analysers.current.clear(); speakState.current.clear();
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    if (sock.current) { sock.current.emit('leave'); sock.current.removeAllListeners(); sock.current.disconnect(); sock.current = null; }
    setPeers([]); setSpeaking({}); setSelf(null); setStatus('idle');
  }, []);

  const join = useCallback(async (code: string) => {
    setError(''); setStatus('connecting'); setChat([]); setKicked('');
    try {
      try { const r = await fetch('/api/ice'); const j = await r.json(); if (j.iceServers?.length) ice.current = j.iceServers; } catch { /* pakai STUN bawaan */ }

      // Mikrofon bersifat opsional: tanpa izin, pengguna tetap bisa mendengar dan chat.
      let micOk = false;
      // Coba dengan pemrosesan suara dulu, lalu audio polos. Sebagian perangkat
      // menolak constraint echoCancellation dengan OverconstrainedError.
      for (const constraints of [
        { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false },
        { audio: true, video: false },
      ]) {
        try {
          stream.current = await navigator.mediaDevices.getUserMedia(constraints);
          micOk = true;
          break;
        } catch { /* coba constraint berikutnya */ }
      }
      micOkRef.current = micOk;
      if (micOk && stream.current) {
        stream.current.getAudioTracks().forEach((t) => (t.enabled = false));
      } else {
        const ac = audioCtx();
        if (ac) { const dest = ac.createMediaStreamDestination(); stream.current = dest.stream; }
      }
      if (stream.current) watch('self', stream.current);
      loop();

      const s = io({ auth: { token: auth.get() }, transports: ['websocket', 'polling'] });
      sock.current = s;
      s.on('connect_error', () => { setError('Tidak bisa terhubung ke server.'); setStatus('error'); });

      s.on('peer-joined', (p: Peer) => { setPeers((x) => (x.some((y) => y.id === p.id) ? x : [...x, p])); setChat((c) => [...c, { key: ++lineKey.current, sys: true, text: `${p.name} masuk room` }]); });
      s.on('peer-left', ({ id }: { id: string }) => drop(id));
      s.on('peer-muted', ({ id, muted: m }: { id: string; muted: boolean }) => setPeers((x) => x.map((p) => (p.id === id ? { ...p, muted: m } : p))));
      s.on('seat-changed', ({ id, seat, muted: m }: any) => {
        if (id === selfId.current) {
          setSelf((p) => (p ? { ...p, seat, muted: m } : p)); setMuted(m);
          stream.current?.getAudioTracks().forEach((t) => (t.enabled = !m && micOkRef.current));
        } else setPeers((x) => x.map((p) => (p.id === id ? { ...p, seat, muted: m } : p)));
      });
      s.on('chat', (m: any) => setChat((c) => [...c.slice(-80), { key: ++lineKey.current, name: m.from.name, text: m.text }]));
      s.on('gift', (g: any) => { setGift({ ...g, key: Date.now() }); setChat((c) => [...c, { key: ++lineKey.current, sys: true, text: `🎁 ${g.from.name} mengirim ${g.gift.name} x${g.qty} ke ${g.to.name}` }]); window.setTimeout(() => setGift(null), 2600); });
      s.on('kicked', ({ reason }: { reason: string }) => { setKicked(reason); teardown(); });
      s.on('room-closed', () => { setKicked('Room telah ditutup.'); teardown(); });
      s.on('banned', () => { setKicked('Akun kamu diblokir.'); teardown(); });

      s.on('signal', async ({ from, data }: { from: string; data: any }) => {
        try {
          if (data.type === 'offer') {
            const pc = mkPeer(from); await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            for (const c of pendingIce.current.get(from) ?? []) await pc.addIceCandidate(c).catch(() => undefined); pendingIce.current.delete(from);
            const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); s.emit('signal', { to: from, data: { type: 'answer', sdp: ans } });
          } else if (data.type === 'answer') {
            const pc = pcs.current.get(from); if (!pc) return; await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            for (const c of pendingIce.current.get(from) ?? []) await pc.addIceCandidate(c).catch(() => undefined); pendingIce.current.delete(from);
          } else if (data.type === 'candidate') {
            const pc = pcs.current.get(from);
            if (!pc || !pc.remoteDescription) { const q = pendingIce.current.get(from) ?? []; q.push(data.candidate); pendingIce.current.set(from, q); }
            else await pc.addIceCandidate(data.candidate).catch(() => undefined);
          }
        } catch (e) { console.error(e); }
      });

      s.emit('join', { code }, async (ack: any) => {
        if (!ack || ack.error) { setError(ack?.error || 'Gagal masuk room.'); setStatus('error'); teardown(); return; }
        selfId.current = ack.selfId;
        setSelf({ id: ack.selfId, ...ack.self }); setPeers(ack.peers); setRoom(ack.room); setMuted(ack.self.muted); setStatus('joined');
        if (!micOk) setChat((c) => [...c, { key: ++lineKey.current, sys: true, text: '🎙️ Izin mikrofon tidak aktif. Kamu tetap bisa mendengar dan chat.' }]);
        for (const p of ack.peers as Peer[]) { const pc = mkPeer(p.id); const off = await pc.createOffer(); await pc.setLocalDescription(off); s.emit('signal', { to: p.id, data: { type: 'offer', sdp: off } }); }
      });
    } catch (e: any) { setError(e?.message || 'Gagal memulai room.'); setStatus('error'); teardown(); }
  }, [drop, mkPeer, teardown]);

  const toggleMute = useCallback(() => {
    if (self?.seat == null) return;
    const next = !muted; setMuted(next);
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !next && micOkRef.current));
    sock.current?.emit('mute', { muted: next });
  }, [muted, self?.seat]);

  const takeSeat = useCallback(
    (seat: number) =>
      new Promise<string | null>((res) =>
        sock.current?.emit('take-seat', { seat }, (a: any) => {
          const err = a?.error ?? null;
          // Aktifkan mikrofon tepat setelah kursi didapat. Ini jalur pasti, tidak
          // bergantung pada urutan event socket.
          if (!err && micOkRef.current) stream.current?.getAudioTracks().forEach((t) => (t.enabled = true));
          res(err);
        }),
      ),
    [],
  );
  const leaveSeat = useCallback(() => sock.current?.emit('leave-seat'), []);
  const sendChat = useCallback((text: string) => sock.current?.emit('chat', { text }), []);
  const kick = useCallback((id: string) => sock.current?.emit('kick', { id }), []);

  // Browser menahan AudioContext sampai ada interaksi. Buka pada sentuhan pertama
  // supaya deteksi bicara dan pemutaran suara langsung hidup.
  useEffect(() => {
    const unlock = () => {
      audioCtx();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);


  useEffect(() => () => teardown(), [teardown]);

  return { status, error, peers, self, room, muted, speaking, chat, gift, kicked, join, leave: teardown, toggleMute, takeSeat, leaveSeat, sendChat, kick };
}
