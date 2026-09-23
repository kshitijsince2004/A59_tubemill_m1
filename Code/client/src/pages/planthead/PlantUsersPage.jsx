import { PlantShell } from '../../components/layout/planthead';
import UsersAdmin from './UsersAdmin';

export default function PlantUsersPage({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  return (
    <PlantShell
      title="Users"
      subtitle="People, roles, and process/machine access. Cannot assign ADMIN unless you are Admin."
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        <UsersAdmin allowAdminRole={!!showAdmin} />
      </div>
    </PlantShell>
  );
}
