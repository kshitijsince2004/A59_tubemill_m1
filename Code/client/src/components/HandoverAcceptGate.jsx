import { useLocation } from 'react-router-dom';
import { useHandoverPending } from '../hooks/useHandoverState';
import HandoverAcceptPage from '../pages/HandoverAcceptPage';
import { machineHandoverService } from '../lib/machineHandoverService';
import { ZButton } from '../ui';

/**
 * Blocks the process / TM floor until the incoming operator accepts a pending handover.
 * Does not block the outgoing /handover route.
 */
export function HandoverAcceptGate({ machineCode, children, onHandoverAccepted }) {
  const location = useLocation();
  const onOutgoingHandoverRoute = /\/handover\/?$/.test(location.pathname);

  const {
    data: pending,
    error,
    isLoading,
    mutate,
  } = useHandoverPending(machineCode, Boolean(machineCode) && !onOutgoingHandoverRoute);

  if (onOutgoingHandoverRoute || !machineCode) {
    return children;
  }

  const status = error?.status;
  const loadError =
    error && status !== 401
      ? error instanceof Error
        ? error.message
        : 'Failed to check handover status'
      : null;
  const isAclError = status === 403;

  const checking = pending === undefined && isLoading && !loadError;

  return (
    <>
      {children}

      {checking ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.75)',
            fontSize: 14,
          }}
        >
          Checking handover status…
        </div>
      ) : null}

      {loadError ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: '#f8fafc',
            padding: 24,
          }}
        >
          <p style={{ color: '#b91c1c', textAlign: 'center', maxWidth: 420 }}>{loadError}</p>
          {isAclError ? (
            <p className="muted" style={{ textAlign: 'center', maxWidth: 420, fontSize: 13 }}>
              You do not have write access for machine {machineCode}. Switch process or sign in with
              an account that can operate this station.
            </p>
          ) : (
            <ZButton variant="secondary" onClick={() => void mutate(undefined, { force: true })}>
              Retry
            </ZButton>
          )}
        </div>
      ) : null}

      {pending ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <HandoverAcceptPage
            handover={pending}
            onAccepted={async () => {
              await mutate(null, { revalidate: false });
              try {
                const sess = await machineHandoverService.ensureSession(machineCode);
                const sid = sess?.session
                  ? String(sess.session.sessionId ?? sess.session.session_id ?? sess.session.id ?? '')
                  : '';
                if (sid) onHandoverAccepted?.(sid);
              } catch {
                /* accept already succeeded */
              }
              void mutate(undefined, { force: true });
            }}
          />
        </div>
      ) : null}
    </>
  );
}
