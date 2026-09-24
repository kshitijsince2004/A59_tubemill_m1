import { NavLink } from 'react-router-dom';
import { confirmDialog } from '../../ConfirmDialog';

const ITEMS = [
  { to: '/machine-head-dashboard', label: 'Desk', end: true },
  { to: '/machine-head/shift-review', label: 'Review', end: false },
  { to: '/order-assignment', label: 'Orders', end: false },
  { to: '/machine-head/crew', label: 'Crew', end: false },
  { to: '/quality/specs', label: 'Quality', end: false },
  { to: '/machine-head/traceability', label: 'Trace', end: false },
  { to: '/machine-head/dpr-export', label: 'Exports', end: false },
];

export default function MachineHeadNav({ onLogout }) {
  async function handleLogout() {
    if (
      await confirmDialog({
        title: 'Sign out',
        message: 'Sign out of Machine Head desk?',
        confirmLabel: 'Sign out',
      })
    ) {
      onLogout();
    }
  }

  return (
    <nav className="mh-rail" aria-label="Machine Head">
      <div className="mh-rail__brand">
        <div className="mh-rail__logos">
          <img className="mh-rail__logo" src="/logo-nav.png" width={28} height={28} alt="Zedral" />
          <img
            className="mh-rail__logo mh-rail__logo--goodluck"
            src="/logo-goodluck.png"
            width={28}
            height={28}
            alt="Goodluck"
          />
        </div>
        <span className="mh-rail__brand-text">MH</span>
      </div>
      <div className="mh-rail__stack">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `mh-rail__link${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <button type="button" className="mh-rail__link mh-rail__logout" onClick={() => void handleLogout()}>
        Sign out
      </button>
    </nav>
  );
}
