import { useEffect, useState } from 'react';

type Prompt = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

/** Mengajak pengguna memasang aplikasi ke layar utama (Android/Chrome, dan petunjuk untuk iOS). */
export default function InstallBanner() {
  const [evt, setEvt] = useState<Prompt | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('kps:install-off') === '1') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as Prompt);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS tidak punya event pemasangan, jadi tampilkan petunjuk manual.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setShow(true);
    }

    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  const close = () => {
    localStorage.setItem('kps:install-off', '1');
    setShow(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice?.outcome === 'accepted') setShow(false);
    else close();
  };

  return (
    <div className="installbar">
      <img src="/icon-192.png" alt="" />
      <div className="txt">
        <b>Pasang Kahfi Party Star</b>
        <span>{ios ? 'Ketuk Bagikan, lalu Tambah ke Layar Utama' : 'Buka lebih cepat dari layar utama'}</span>
      </div>
      {!ios && <button className="go" onClick={install}>Pasang</button>}
      <button className="x" onClick={close} aria-label="Tutup">×</button>
    </div>
  );
}
