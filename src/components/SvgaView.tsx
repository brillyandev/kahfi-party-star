import { useEffect, useRef } from 'react';

/** Memutar animasi .svga memakai svgaplayerweb (dimuat malas agar bundle awal tetap kecil). */
export default function SvgaView({ src, loops = 0, style }: { src: string; loops?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let player: any;
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import('svgaplayerweb');
        const SVGA = mod.default || mod;
        if (cancelled || !ref.current) return;
        player = new SVGA.Player(ref.current);
        const parser = new SVGA.Parser();
        parser.load(
          src,
          (video: any) => {
            if (cancelled) return;
            player.loops = loops;
            player.clearsAfterStop = true;
            player.setVideoItem(video);
            player.startAnimation();
          },
          () => undefined,
        );
      } catch {
        /* animasi gagal dimuat: abaikan, tampilan tetap aman */
      }
    })();
    return () => {
      cancelled = true;
      try { player?.stopAnimation(); player?.clear(); } catch { /* noop */ }
    };
  }, [src, loops]);

  return <div ref={ref} style={{ width: 280, height: 280, ...style }} />;
}
