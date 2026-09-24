import { NavLink } from 'react-router-dom';
import { confirmDialog } from '../../ConfirmDialog';

const ITEMS = [
  { to: '/admin/integrations', label: 'Integrations', end: false },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/machines', label: 'Machines', end: false },
  { to: '/admin/master-data', label: 'Masters', end: false },
  { to: '/admin/validation-rules', label: 'Rules', end: false },
  { to: '/admin/audit', label: 'Audit', end: false },
];

export default function AdminNav({ onLogout }) {
  async function handleLogout() {
    if (await confirmDialog({ title: 'Sign out', message: 'Sign out of Admin?', confirmLabel: 'Sign out' })) {
      onLogout();
    }
  }

  return (
    <nav className="admin-rail" aria-label="Admin">
      <div className="admin-rail__brand">
        <div className="admin-rail__logos">
          <img className="admin-rail__logo" src="/logo-nav.png" width={28} height={28} alt="Zedral" />
          <img
            className="admin-rail__logo admin-rail__logo--goodluck"
            src="/logo-goodluck.png"
            width={28}
            height={28}
            alt="Goodluck"
          />
        </div>
        <span className="admin-rail__brand-text">Admin</span>
      </div>
      <div className="admin-rail__stack">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `admin-rail__link${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <button type="button" className="admin-rail__link admin-rail__logout" onClick={() => void handleLogout()}>
        Sign out
      </button>
    </nav>
  );
}
