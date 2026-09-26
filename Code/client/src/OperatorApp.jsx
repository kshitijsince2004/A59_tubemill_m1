import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import { setDevRoleOverride } from './api/http';
import { authApi } from './api/authApi';
import LoginScreen from './components/LoginScreen';
import ConfirmHost from './components/ConfirmDialog';
import DeviceSetupPanel from './components/DeviceSetupPanel';
import { ToastHost } from './ui/toast';
import {
  getAccessToken,
  getStoredUser,
  primaryRole,
  setStoredUser,
  subscribeAuth,
  clearAuth,
} from './lib/authStore';
import {
  PROCESS_META,
  allowedProcesses as filterProcesses,
  firstProcessPath,
  processPath,
} from './lib/roleHome';
import { initSuperTokensClient, signOutSession, syncAccessTokenFromSession } from './lib/supertokens';

const TubeMillRunConsole = lazy(() => import('./pages/TubeMillRunConsole'));
const FurnaceCapture = lazy(() => import('./pages/FurnaceCapture'));
const StpCapture = lazy(() => import('./pages/StpCapture'));
const DrawBenchCapture = lazy(() => import('./pages/DrawBenchCapture'));
const SwageCapture = lazy(() => import('./pages/SwageCapture'));
const ScopeHandoverRoute = lazy(() => import('./components/ScopeHandoverRoute'));

function LazyFallback() {
  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <p className="muted">Loading…</p>
      </div>
    </div>
  );
}

function isOperatorUser(user) {
  if (!user) return false;
  const role = primaryRole(user);
  const elevated = (user.roles ?? []).some(
    (r) => r === 'MACHINE_HEAD' || r === 'PLANT_HEAD' || r === 'ADMIN'
  );
  return role === 'OPERATOR' && !elevated;
}

function useAuthSession() {
  const [user, setUser] = useState(() => getStoredUser());
  const [authReady, setAuthReady] = useState(() => !getStoredUser());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = getAccessToken();
      const demoSession = typeof token === 'string' && token.startsWith('a59.1.');
      if (!demoSession) {
        try {
          initSuperTokensClient();
          await syncAccessTokenFromSession();
        } catch {
          /* ST optional */
        }
      }

      const stored = getStoredUser();
      if (!stored) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      if (!isOperatorUser(stored)) {
        await signOutSession();
        clearAuth();
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      }

      if (stored.offline) {
        if (!cancelled) {
          setUser(stored);
          setAuthReady(true);
        }
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) {
          if (me?.user) {
            if (!isOperatorUser(me.user)) {
              await signOutSession();
              clearAuth();
              setUser(null);
            } else {
              setStoredUser(me.user);
              setUser(me.user);
            }
          } else {
            setUser(getStoredUser());
          }
        }
      } catch {
        await signOutSession();
        setDevRoleOverride(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    return subscribeAuth(() => {
      if (!cancelled) setUser(getStoredUser());
    });
  }, []);

  function handleLogout() {
    void signOutSession();
    setDevRoleOverride(null);
    setUser(null);
  }

  return { user, setUser, authReady, handleLogout };
}

function FloorRoute({ processId, user, onLogout }) {
  const navigate = useNavigate();
  const allowed = useMemo(() => filterProcesses(user), [user]);
  const processOptions = useMemo(
    () => allowed.map((p) => ({ id: p.id, label: p.label, machineCode: p.machineCode })),
    [allowed]
  );
  const role = primaryRole(user);

  useEffect(() => {
    localStorage.setItem('a59-process', processId);
  }, [processId]);

  useEffect(() => {
    if (allowed.length && !allowed.some((p) => p.id === processId)) {
      navigate(allowed[0].path, { replace: true });
    }
  }, [allowed, processId, navigate]);

  const floorProps = {
    processes: processOptions,
    processId,
    onProcessChange: (id) => navigate(processPath(id)),
    onLogout,
    showAdmin: false,
    onAdmin: undefined,
    roleLabel: role,
  };

  if (processId === 'TM') return <TubeMillRunConsole {...floorProps} />;
  if (processId === 'FUR') return <FurnaceCapture {...floorProps} />;
  if (processId === 'STP') return <StpCapture {...floorProps} />;
  if (processId === 'DRW') return <DrawBenchCapture {...floorProps} />;
  if (processId === 'SWG') return <SwageCapture {...floorProps} />;
  return <Navigate to={firstProcessPath(user)} replace />;
}

function OperatorRoutes() {
  const { user, setUser, authReady, handleLogout } = useAuthSession();
  const navigate = useNavigate();
  const home = user ? firstProcessPath(user) : '/login';

  if (!authReady) {
    return (
      <div className="login-screen">
        <div className="login-screen__card">
          <p className="muted">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <LoginScreen
              onUnlocked={(u) => {
                setStoredUser(u);
                setUser(u);
                navigate(firstProcessPath(u), { replace: true });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route
          path="/setup"
          element={
            <div className="login-screen">
              <DeviceSetupPanel
                onBound={() => navigate(home, { replace: true })}
                onExitKiosk={() => undefined}
              />
            </div>
          }
        />
        {PROCESS_META.map((p) => (
          <Route
            key={p.id}
            path={p.path}
            element={<FloorRoute processId={p.id} user={user} onLogout={handleLogout} />}
          />
        ))}
        <Route path="/handover" element={<ScopeHandoverRoute />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Suspense>
  );
}

export default function OperatorApp() {
  return (
    <BrowserRouter>
      <ToastHost />
      <ConfirmHost />
      <OperatorRoutes />
    </BrowserRouter>
  );
}
