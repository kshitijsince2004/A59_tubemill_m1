import { useEffect, useState } from 'react';

let pushToast = null;
let toastSeq = 0;

/**
 * Lightweight toast stack (audit F38).
 * Mount <ToastHost /> once (App.jsx), then call showToast(message).
 */
export function showToast(message, { ms = 3200 } = {}) {
  if (!pushToast || !message) return;
  const id = ++toastSeq;
  pushToast((prev) => [...prev, { id, message }]);
  window.setTimeout(() => {
    pushToast?.((prev) => prev.filter((t) => t.id !== id));
  }, ms);
}

export function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    pushToast = setItems;
    return () => {
      pushToast = null;
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="z-toast-host" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className="z-toast" role="status">
          {t.message}
        </div>
      ))}
    </div>
  );
}
