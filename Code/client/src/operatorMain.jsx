import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OperatorApp from './OperatorApp';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';
import './ui/ui.css';
import { flushOutbox, startOutboxPeriodicFlush } from './offline/outbox';
import { bootstrapNative } from './native/bootstrap';
import { hydrateAuthFromSecureStorage } from './lib/authStore';
import { startSyncEngine } from './offline/syncEngine';
import './native/kioskBridgeStub';
import { startKioskIfDeviceOwner } from './native/kiosk';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Capacitor owns the shell — never register a PWA service worker in the operator APK.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations().then((regs) =>
      Promise.all(regs.map((r) => r.unregister()))
    );
  });
}

window.addEventListener('online', () => {
  void flushOutbox();
});

startOutboxPeriodicFlush();

void (async () => {
  await hydrateAuthFromSecureStorage();
  await bootstrapNative();
  startSyncEngine();
  void startKioskIfDeviceOwner();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <OperatorApp />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
})();
