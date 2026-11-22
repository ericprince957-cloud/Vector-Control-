'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA is an enhancement; the app works without it. */
    });
  }, []);
  return null;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Install button — shown only when the browser says the app is installable. */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed) return <p className="text-sm text-muted">Vector Control is installed on this device.</p>;
  if (!evt) return <p className="text-sm text-muted">To install: use your browser menu → “Install app” or “Add to Home screen”.</p>;
  return (
    <Button onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>Install app</Button>
  );
}
