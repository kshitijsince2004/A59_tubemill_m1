import { Navigate } from 'react-router-dom';
import { getStoredUser, primaryRole } from '../lib/authStore';
import { roleAtLeast } from '../lib/roleHome';

/**
 * Rank-based route guard. Optional `allow` is an exact-role OR list
 * (legacy compatibility — prefer minRole only).
 */
export function RoleRoute({ minRole = 'OPERATOR', allow, children }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;

  if (allow?.length && allow.some((r) => user.roles?.includes(r))) {
    return children;
  }

  if (!roleAtLeast(user, minRole)) {
    const role = primaryRole(user);
    if (role === 'OPERATOR') return <Navigate to="/tm" replace />;
    if (role === 'PLANT_HEAD') return <Navigate to="/plant" replace />;
    return <Navigate to="/machine-head-dashboard" replace />;
  }

  return children;
}

export function MachineHeadRoute({ children }) {
  return <RoleRoute minRole="MACHINE_HEAD">{children}</RoleRoute>;
}

/** Plant Command Center — Plant Head + Admin only (MH uses MH dashboard / order-assignment). */
export function PlantRoute({ children }) {
  return <RoleRoute minRole="PLANT_HEAD">{children}</RoleRoute>;
}

export function AdminRoute({ children }) {
  return <RoleRoute minRole="ADMIN">{children}</RoleRoute>;
}
