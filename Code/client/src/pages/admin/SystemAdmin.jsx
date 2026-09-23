import { Navigate } from 'react-router-dom';

/** Bookmark redirect — System merged into Integrations. */
export default function SystemAdmin() {
  return <Navigate to="/admin/integrations?tab=connector" replace />;
}
