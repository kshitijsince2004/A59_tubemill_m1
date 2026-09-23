import { useEffect, useState } from 'react';import { jsx as _jsx } from "react/jsx-runtime";

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (/*#__PURE__*/
    _jsx("div", { className: "offline-banner", role: "status", children: "Offline \u2014 writes queue locally and sync when back online" }

    ));

}