import { confirmDialog } from '../../ConfirmDialog';

const FALLBACK_ITEMS = [
  { id: 'orders', icon: '▣', label: 'Work Order' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'history', icon: '▤', label: 'History' },
];

/** Tube Mill modules include Parameters; pass via `items` from TubeMillRunConsole. */
export const TM_NAV_FALLBACK = [
  { id: 'orders', icon: '▣', label: 'Work Order' },
  { id: 'capture', icon: '◎', label: 'Capture' },
  { id: 'parameters', icon: '▦', label: 'Parameters' },
  { id: 'history', icon: '▤', label: 'History' },
];

export default function OperatorNavRail({
  nav,
  onNavChange,
  showAdmin,
  onLogout,
  onNew,
  items: itemsProp,
}) {
  const base = itemsProp?.length ? itemsProp : FALLBACK_ITEMS;
  const items = showAdmin
    ? [...base.filter((i) => i.id !== 'admin'), { id: 'admin', icon: '⚙', label: 'Admin' }]
    : base;

  async function handleLogout() {
    if (
      await confirmDialog({
        title: 'Sign out',
        message: 'Sign out of the operator console?',
        confirmLabel: 'Sign out',
      })
    ) {
      onLogout();
    }
  }

  return (
    <nav className="nav-rail" aria-label="Primary">
      <img className="nav-rail__logo" src="/logo-nav.png" width={36} height={36} alt="Zedral" />
      <div className="nav-rail__divider" />
      <div className="nav-rail__stack">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-rail__btn ${nav === item.id ? 'active' : ''}`}
            aria-current={nav === item.id ? 'page' : undefined}
            onClick={() => onNavChange(item.id)}
          >
            <span className="nav-rail__icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
        {onNew ? (
          <button type="button" className="nav-rail__btn nav-rail__btn--new" onClick={onNew} aria-label="New">
            <span className="nav-rail__icon">+</span>
            New
          </button>
        ) : null}
      </div>
      <button type="button" className="nav-rail__btn nav-rail__btn--logout" onClick={() => void handleLogout()}>
        <span className="nav-rail__icon">↩</span>
        Logout
      </button>
    </nav>
  );
}
