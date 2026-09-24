import { useEffect, useState } from 'react';
import FormModal from './FormModal';
import { ZButton } from '../ui';

let resolvePending = null;
let pushState = null;

/**
 * Promise-based confirm (audit F37). Resolves true/false.
 * Requires <ConfirmHost /> mounted (App.jsx).
 */
export function confirmDialog({
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    if (!pushState) {
      resolve(false);
      return;
    }
    if (resolvePending) resolvePending(false);
    resolvePending = resolve;
    pushState({
      open: true,
      title,
      message: message ?? title,
      confirmLabel,
      cancelLabel,
      danger,
    });
  });
}

export default function ConfirmHost() {
  const [state, setState] = useState({
    open: false,
    title: 'Confirm',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false,
  });

  useEffect(() => {
    pushState = setState;
    return () => {
      pushState = null;
    };
  }, []);

  function finish(ok) {
    const r = resolvePending;
    resolvePending = null;
    setState((s) => ({ ...s, open: false }));
    if (r) r(ok);
  }

  return (
    <FormModal
      open={state.open}
      title={state.title}
      eyebrow="Confirm"
      description={state.message}
      onClose={() => finish(false)}
      wide={false}
      footer={
        <>
          <ZButton variant="ghost" onClick={() => finish(false)}>
            {state.cancelLabel}
          </ZButton>
          <ZButton
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => finish(true)}
          >
            {state.confirmLabel}
          </ZButton>
        </>
      }
    />
  );
}
