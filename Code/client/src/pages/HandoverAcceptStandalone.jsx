import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { machineHandoverService } from '../lib/machineHandoverService';
import HandoverAcceptPage from './HandoverAcceptPage';

/**
 * Deep-link accept page: /handover/accept/:handoverId
 */
export default function HandoverAcceptStandalone() {
  const { handoverId } = useParams();
  const navigate = useNavigate();
  const [handover, setHandover] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!handoverId) return;
    let cancelled = false;
    void machineHandoverService
      .listPending()
      .then((res) => {
        if (cancelled) return;
        const list = res?.pending ?? [];
        const hit = list.find(
          (h) => (h.handover_id || h.handoverId) === handoverId
        );
        if (!hit) {
          setErr('Handover not found or no longer pending');
          return;
        }
        setHandover(hit);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed');
      });
    return () => {
      cancelled = true;
    };
  }, [handoverId]);

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#b91c1c' }}>{err}</p>
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  if (!handover) {
    return <div style={{ padding: 24 }}>Loading handover…</div>;
  }

  return (
    <HandoverAcceptPage
      handover={handover}
      onAccepted={() => {
        const machine = handover.machine_code || handover.machineCode;
        navigate(machine ? `/?` : '/', { replace: true });
        // Prefer process home via reload of role home
        window.location.href = '/';
      }}
    />
  );
}
