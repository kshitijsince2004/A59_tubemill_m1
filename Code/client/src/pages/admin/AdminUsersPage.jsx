import { AdminShell } from '../../components/layout/admin';
import UsersAdmin from './UsersAdmin';

export default function AdminUsersPage({ roleLabel, onLogout, firstFloorPath }) {
  return (
    <AdminShell
      title="Users"
      subtitle="People, roles, and process/machine access. Plant Head cannot assign ADMIN. Access tab = ACL grants."
      roleLabel={roleLabel}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <UsersAdmin allowAdminRole />
    </AdminShell>
  );
}
