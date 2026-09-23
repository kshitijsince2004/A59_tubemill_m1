import { Navigate, useSearchParams } from 'react-router-dom';

/** Bookmark redirect — Access lives under Users (`?tab=assignment`). */
export default function MachineAssignmentPage() {
  const [params] = useSearchParams();
  const qs = params.toString();
  const target = qs.includes('tab=')
    ? `/admin/users?${qs}`
    : '/admin/users?tab=assignment';
  return <Navigate to={target} replace />;
}
