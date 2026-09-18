import { useEffect, useState } from 'react';
import { countOutbox, flushOutbox } from '../offline/outbox';

export default function SyncStatusBadge() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flushOutbox().then(() => countOutbox().then(setPending));
    };
    const onOffline = () => setOnline(false);
    const refresh = () => void countOutbox().then(setPending);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('a59-outbox-changed', refresh);
    refresh();
    const id = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('a59-outbox-changed', refresh);
      window.clearInterval(id);
    };
  }, []);

  const label = !online ? 'OFFLINE' : pending > 0 ? `SYNC ${pending}` : 'LIVE';
  const tone = !online ? 'warn' : pending > 0 ? 'pending' : 'ok';

  return (
    <span className={`z-sync z-sync--${tone}`} title="Collector / sync status">
      <span className="z-sync__dot" aria-hidden />
      {label}
    </span>
  );
}
