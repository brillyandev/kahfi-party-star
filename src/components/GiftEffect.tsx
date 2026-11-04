import SvgaView from './SvgaView';

export type GiftEvent = {
  key: number;
  from: { name: string };
  to: { name: string };
  gift: { name: string; file: string; fileKind: string; icon: string };
  qty: number;
};

export default function GiftEffect({ ev }: { ev: GiftEvent }) {
  const { gift } = ev;
  const emoji = gift.icon && !gift.icon.startsWith('/') ? gift.icon : '';
  const img = gift.icon?.startsWith('/') ? gift.icon : gift.fileKind !== 'svga' ? gift.file : '';
  return (
    <div className="fx">
      <div style={{ textAlign: 'center' }}>
        <div className="big">
          {gift.fileKind === 'svga' ? <SvgaView src={gift.file} loops={1} /> : emoji ? emoji : img ? <img src={img} alt={gift.name} /> : '🎁'}
        </div>
        <div className="cap">{ev.from.name} → {ev.to.name} · {gift.name} x{ev.qty}</div>
      </div>
    </div>
  );
}
