import { useEffect, useState } from 'react';
import { countDeadLetter, countOutbox, flushOutbox } from '../offline/outbox';
import { getSyncStatus, subscribeSyncStatus, syncNow } from '../offline/syncEngine';

export default function SyncStatusBadge() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [deadLetter, setDeadLetter] = useState(0);
  const [parked, setParked] = useState(0);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flushOutbox().then(() => refresh());
      void syncNow('badge-online');
    };
    const onOffline = () => setOnline(false);
    const refresh = () =>
      void Promise.all([countOutbox(), countDeadLetter()]).then(([n, d]) => {
        setPending(n);
        setDeadLetter(d);
      });
    const unsub = subscribeSyncStatus((s) => {
      setParked(s.parked || 0);
      if (typeof s.pending === 'number') setPending((p) => Math.max(p, s.pending));
    });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('a59-outbox-changed', refresh);
    refresh();
    const snap = getSyncStatus();
    setParked(snap.parked || 0);
    const id = window.setInterval(refresh, 5000);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('a59-outbox-changed', refresh);
      window.clearInterval(id);
    };
  }, []);

  let label = 'LIVE';
  let tone = 'ok';
  if (!online) {
    label = 'OFFLINE';
    tone = 'warn';
  } else if (parked > 0 || deadLetter > 0) {
    label = `ATTN ${parked || deadLetter}`;
    tone = 'danger';
  } else if (pending > 0) {
    label = `SYNC ${pending}`;
    tone = 'pending';
  }

  const title =
    parked > 0
      ? `${parked} parked write(s) need supervisor resolve`
      : deadLetter > 0
        ? `${deadLetter} item(s) need attention after max retries`
        : 'Collector / sync status';

  return (
    <span className={`z-sync z-sync--${tone}`} title={title}>
      <span className="z-sync__dot" aria-hidden />
      {label}
    </span>
  );
}
