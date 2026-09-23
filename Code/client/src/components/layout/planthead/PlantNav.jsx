import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/plant', label: 'Overview', end: true },
  { to: '/plant/live', label: 'Live', end: false },
  { to: '/plant/production', label: 'Production', end: false },
  { to: '/plant/orders', label: 'Orders', end: false },
  { to: '/plant/defect-intelligence', label: 'Defects', end: false },
  { to: '/plant/downtime-intelligence', label: 'Downtime', end: false },
  { to: '/plant/alerts', label: 'Alerts', end: false },
  { to: '/plant/dpr-export', label: 'Exports', end: false },
  { to: '/plant/users', label: 'Users', end: false },
  { to: '/plant/setup', label: 'Lines', end: false },
  { to: '/plant/audit', label: 'Audit', end: false },
];

export default function PlantNav({ onLogout }) {
  function handleLogout() {
    if (window.confirm('Sign out of Plant Command Center?')) onLogout();
  }

  return (
    <nav className="ph-rail" aria-label="Plant Head">
      <div className="ph-rail__brand">
        <div className="ph-rail__logos">
          <img className="ph-rail__logo" src="/logo-nav.png" width={28} height={28} alt="Zedral" />
          <img
            className="ph-rail__logo ph-rail__logo--goodluck"
            src="/logo-goodluck.png"
            width={28}
            height={28}
            alt="Goodluck"
          />
        </div>
        <span className="ph-rail__brand-text">Plant</span>
      </div>
      <div className="ph-rail__stack">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `ph-rail__link${isActive ? ' is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <button type="button" className="ph-rail__link ph-rail__logout" onClick={handleLogout}>
        Sign out
      </button>
    </nav>
  );
}
