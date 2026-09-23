import { Navigate } from 'react-router-dom';

/** Bookmark redirect — Planning merged into Integrations. */
export default function PlanningAdmin() {
  return <Navigate to="/admin/integrations?tab=orders" replace />;
}
