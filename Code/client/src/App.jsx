import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { setDevRoleOverride } from './api/tubemillClient';
import { setDevRoleOverride as setProcessRole } from './api/http';
import { authApi } from './api/authApi';
import LoginScreen from './components/LoginScreen';
import { MachineHeadRoute, AdminRoute, PlantRoute } from './components/RoleRoute';
import TubeMillRunConsole from './pages/TubeMillRunConsole';
import FurnaceCapture from './pages/FurnaceCapture';
import StpCapture from './pages/StpCapture';
import DrawBenchCapture from './pages/DrawBenchCapture';
import SwageCapture from './pages/SwageCapture';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import MachineMasterAdmin from './pages/admin/MachineMasterAdmin';
import MachineAssignmentPage from './pages/admin/MachineAssignmentPage';
import MasterDataAdmin from './pages/admin/MasterDataAdmin';
import ValidationRulesAdmin from './pages/admin/ValidationRulesAdmin';
import IntegrationsAdmin from './pages/admin/IntegrationsAdmin';
import PlanningAdmin from './pages/admin/PlanningAdmin';
import SystemAdmin from './pages/admin/SystemAdmin';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import MachineHeadDashboard from './pages/machinehead/MachineHeadDashboard';
import MachineHeadReviewPage from './pages/machinehead/MachineHeadReviewPage';
import MhProcessLivePage from './pages/machinehead/MhProcessLivePage';
import MachineHeadCrewPage from './pages/machinehead/MachineHeadCrewPage';
import OrderAssignmentPage from './pages/machinehead/OrderAssignmentPage';
import TraceabilityPage from './pages/machinehead/TraceabilityPage';
import MachineDprExportPage from './pages/machinehead/MachineDprExportPage';
import QualitySpecsPage, { QualitySpecEditorPage } from './pages/quality/QualitySpecsPage';
import PlantHeadDashboard from './pages/planthead/PlantHeadDashboard';
import PlantLiveDashboard from './pages/planthead/PlantLiveDashboard';
import PlantProduction from './pages/planthead/PlantProduction';
import PlantOrderTracking from './pages/planthead/PlantOrderTracking';
import PlantDefects from './pages/planthead/PlantDefects';
import PlantStoppages from './pages/planthead/PlantStoppages';
import PlantAlerts from './pages/planthead/PlantAlerts';
import AuditTrailView from './pages/planthead/AuditTrailView';
import PlantDprExport from './pages/planthead/PlantDprExport';
import ExportHistory from './pages/planthead/ExportHistory';
import PlantUsersPage from './pages/planthead/PlantUsersPage';
import PlantSetupPage from './pages/planthead/PlantSetupPage';

import {
  getAccessToken,
  getStoredUser,
  primaryRole,
  setStoredUser,
  subscribeAuth,
} from './lib/authStore';
import {
  PROCESS_META,
  allowedProcesses as filterProcesses,
  firstProcessPath,
  processPath,
  roleAtLeast,
  roleHomePath,
} from './lib/roleHome';
import { initSuperTokensClient, signOutSession, syncAccessTokenFromSession } from './lib/supertokens';

function useAuthSession() {
  const [user, setUser] = useState(() => getStoredUser());
  const [authReady, setAuthReady] = useState(() => !getStoredUser());

  useEffect(() => {
    initSuperTokensClient();
    let cancelled = false;

    (async () => {
      const stored = getStoredUser();
      if (!stored) {
        if (!cancelled) setAuthReady(true);
        return;
      }
      await syncAccessTokenFromSession();
      if (!getAccessToken()) {
        const role = localStorage.getItem('a59-role');
        if (role) {
          setDevRoleOverride(role);
          setProcessRole(role);
        }
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          if (me?.user) setStoredUser(me.user);
          setUser(getStoredUser());
        }
      } catch {
        // Dead/stale SuperTokens tokens cause refresh loops; wipe session fully.
        await signOutSession();
        setDevRoleOverride(null);
        setProcessRole(null);
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
    setProcessRole(null);
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
  const isAdmin = user.roles.includes('ADMIN');

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
    showAdmin: isAdmin,
    onAdmin: () => navigate('/admin'),
    roleLabel: role,
  };

  if (processId === 'TM') return <TubeMillRunConsole {...floorProps} />;
  if (processId === 'FUR') return <FurnaceCapture {...floorProps} />;
  if (processId === 'STP') return <StpCapture {...floorProps} />;
  if (processId === 'DRW') return <DrawBenchCapture {...floorProps} />;
  if (processId === 'SWG') return <SwageCapture {...floorProps} />;
  return <Navigate to="/tm" replace />;
}

function MhProps({ user, onLogout, children }) {
  const role = primaryRole(user);
  const firstFloor = firstProcessPath(user);
  const props = {
    user,
    roleLabel: role,
    showAdmin: user.roles.includes('ADMIN'),
    showPlant: roleAtLeast(user, 'PLANT_HEAD'),
    onLogout,
    firstFloorPath: firstFloor,
  };
  return children(props);
}

function PlantProps({ user, onLogout, children }) {
  return (
    <MhProps user={user} onLogout={onLogout}>
      {children}
    </MhProps>
  );
}

function AdminProps({ user, onLogout, children }) {
  return (
    <MhProps user={user} onLogout={onLogout}>
      {children}
    </MhProps>
  );
}

function MhLiveParam(props) {
  const { processId } = useParams();
  return <MhProcessLivePage processId={processId} {...props} />;
}

function QualityEditorParam(props) {
  const { id } = useParams();
  return <QualitySpecEditorPage specId={id} {...props} />;
}

function AppRoutes() {
  const { user, setUser, authReady, handleLogout } = useAuthSession();
  const navigate = useNavigate();

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
                navigate(roleHomePath(u), { replace: true });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={roleHomePath(user)} replace />} />
      <Route path="/" element={<Navigate to={roleHomePath(user)} replace />} />

      {PROCESS_META.map((p) => (
        <Route
          key={p.id}
          path={p.path}
          element={<FloorRoute processId={p.id} user={user} onLogout={handleLogout} />}
        />
      ))}

      <Route path="/admin" element={<AdminRoute><Navigate to="/admin/integrations" replace /></AdminRoute>} />
      <Route
        path="/admin/integrations"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <IntegrationsAdmin {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <AdminUsersPage {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/machines"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <MachineMasterAdmin {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/machine-assignment"
        element={
          <AdminRoute>
            <MachineAssignmentPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/master-data"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <MasterDataAdmin {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/validation-rules"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <ValidationRulesAdmin {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/planning"
        element={
          <AdminRoute>
            <PlanningAdmin />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/system"
        element={
          <AdminRoute>
            <SystemAdmin />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <AdminRoute>
            <AdminProps user={user} onLogout={handleLogout}>
              {(p) => <AdminAuditPage {...p} />}
            </AdminProps>
          </AdminRoute>
        }
      />

      {/* Plant Command Center */}
      <Route
        path="/plant"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantHeadDashboard {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/live"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantLiveDashboard {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/production"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantProduction {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/orders"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantOrderTracking {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/defect-intelligence"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantDefects {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/downtime-intelligence"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantStoppages {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/alerts"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantAlerts {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/audit"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <AuditTrailView {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/dpr-export"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantDprExport {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/exports/history"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <ExportHistory {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/users"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantUsersPage {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route
        path="/plant/setup"
        element={
          <PlantRoute>
            <PlantProps user={user} onLogout={handleLogout}>
              {(p) => <PlantSetupPage {...p} />}
            </PlantProps>
          </PlantRoute>
        }
      />
      <Route path="/reports/plant-head" element={<Navigate to="/plant" replace />} />
      <Route path="/reports/export" element={<Navigate to="/plant/dpr-export" replace />} />
      <Route path="/reports/dpr" element={<Navigate to="/plant/dpr-export" replace />} />
      <Route path="/audit" element={<Navigate to="/plant/audit" replace />} />

      <Route
        path="/machine-head-dashboard"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <MachineHeadDashboard {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route path="/live" element={<Navigate to="/machine-head-dashboard" replace />} />
      <Route
        path="/machine-head/shift-review"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <MachineHeadReviewPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/machine-head/:processId/live"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <MhLiveParam {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/machine-head/crew"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <MachineHeadCrewPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/machine-head/traceability"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <TraceabilityPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/machine-head/dpr-export"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <MachineDprExportPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/machine-head/exports/history"
        element={<Navigate to="/machine-head/dpr-export" replace />}
      />
      <Route
        path="/order-assignment"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <OrderAssignmentPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/import/rolling"
        element={<Navigate to="/order-assignment" replace />}
      />
      <Route
        path="/quality/specs"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <QualitySpecsPage {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />
      <Route
        path="/quality/specs/:id"
        element={
          <MachineHeadRoute>
            <MhProps user={user} onLogout={handleLogout}>
              {(p) => <QualityEditorParam {...p} />}
            </MhProps>
          </MachineHeadRoute>
        }
      />

      <Route path="*" element={<Navigate to={roleHomePath(user)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
