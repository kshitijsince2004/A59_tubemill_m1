import { useEffect, useState } from 'react';
import { ZButton, ZInput, ZSelect } from '../ui';
import { setDevRoleOverride, tubemillApi } from '../api/tubemillClient';

const ROLES = ['OPERATOR', 'SUPERVISOR', 'ADMIN', 'PLANT_HEAD'];

interface Props {
  onUnlocked: (role: string) => void;
}

export default function LoginScreen({ onUnlocked }: Props) {
  const [badge, setBadge] = useState('OP-A59');
  const [pin, setPin] = useState('1234');
  const [role, setRole] = useState('OPERATOR');
  const [authMode, setAuthMode] = useState<'dev' | 'static'>('dev');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void tubemillApi.getSession().then((s) => {
      setAuthMode(s.authMode);
      setRole(s.role);
    }).catch(() => undefined);
  }, []);

  async function unlock() {
    setError(null);
    if (!badge.trim() || pin.length < 4) {
      setError('Enter badge and 4+ digit PIN');
      return;
    }
    if (authMode === 'dev') {
      setDevRoleOverride(role);
      localStorage.setItem('a59-role', role);
      localStorage.setItem('a59-badge', badge);
      onUnlocked(role);
      return;
    }
    // static mode: server role only
    localStorage.setItem('a59-badge', badge);
    localStorage.setItem('a59-unlocked', '1');
    onUnlocked(role);
  }

  return (
    <div className="login-screen">
      <header className="login-screen__bar">
        <span className="login-screen__brand">Zedral</span>
        <span>Operator Console · A-59</span>
        <span className="mono">{new Date().toLocaleTimeString()}</span>
      </header>
      <div className="login-screen__card">
        <h1>Terminal unlock</h1>
        <p className="muted">Badge / PIN {authMode === 'dev' ? '(dev role select)' : '(static role from server)'}</p>
        {error && <div className="error-strip">{error}</div>}
        <label className="eyebrow">Badge</label>
        <ZInput value={badge} onChange={(e) => setBadge(e.target.value)} />
        <label className="eyebrow">PIN</label>
        <ZInput type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
        {authMode === 'dev' && (
          <>
            <label className="eyebrow">Role</label>
            <ZSelect value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </ZSelect>
          </>
        )}
        <ZButton variant="primary" onClick={() => void unlock()} style={{ width: '100%', marginTop: 16 }}>
          Sign in
        </ZButton>
      </div>
    </div>
  );
}
