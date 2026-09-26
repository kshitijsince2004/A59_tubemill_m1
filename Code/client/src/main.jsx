import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';
import './ui/ui.css';
import { flushOutbox, startOutboxPeriodicFlush } from './offline/outbox';
import { jsx as _jsx } from "react/jsx-runtime";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Never register a SW during Vite/local dev — cache-first SW freezes /src modules.
    const isViteDev = import.meta.env.DEV || location.port === '5173';
    if (isViteDev) {
      void navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((r) => r.unregister())),
      );
      if (typeof caches !== 'undefined') {
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
      return;
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

window.addEventListener('online', () => {
  void flushOutbox();
});

startOutboxPeriodicFlush();

createRoot(document.getElementById('root')).render(/*#__PURE__*/
  _jsx(StrictMode, { children: /*#__PURE__*/
    _jsx(ErrorBoundary, { children: /*#__PURE__*/
      _jsx(QueryClientProvider, { client: queryClient, children: /*#__PURE__*/
        _jsx(App, {}) }
      )
    } )
  })
);
