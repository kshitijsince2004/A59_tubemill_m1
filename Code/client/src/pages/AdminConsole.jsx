import { Navigate } from 'react-router-dom';

/** @deprecated Prefer /admin/users — kept so old links resolve. */
export default function AdminConsole() {
  return <Navigate to="/admin/users" replace />;
}
