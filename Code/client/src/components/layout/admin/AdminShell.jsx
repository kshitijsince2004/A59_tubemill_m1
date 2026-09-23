import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from './AdminNav';

/**
 * System-administration shell. Break-glass consoles stay in the header — not the primary rail.
 */
export default function AdminShell({
  title,
  subtitle,
  roleLabel = 'ADMIN',
  onLogout,
  firstFloorPath = '/tm',
  children,
  actions,
}) {
  const [consolesOpen, setConsolesOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!consolesOpen) return undefined;
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setConsolesOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [consolesOpen]);

  return (
    <div className="admin-root">
      <AdminNav onLogout={onLogout} />
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header__titles">
            <p className="admin-header__eyebrow">System administration</p>
            <h1 className="admin-header__title">{title}</h1>
            {subtitle ? <p className="admin-header__sub">{subtitle}</p> : null}
          </div>
          <div className="admin-header__right">
            {actions}
            <div className="admin-consoles" ref={menuRef}>
              <button
                type="button"
                className="admin-consoles__btn"
                aria-expanded={consolesOpen}
                aria-haspopup="menu"
                onClick={() => setConsolesOpen((o) => !o)}
              >
                Open console
              </button>
              {consolesOpen ? (
                <div className="admin-consoles__menu" role="menu">
                  <Link
                    role="menuitem"
                    to={firstFloorPath || '/tm'}
                    className="admin-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Floor capture
                  </Link>
                  <Link
                    role="menuitem"
                    to="/plant"
                    className="admin-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Plant command
                  </Link>
                  <Link
                    role="menuitem"
                    to="/machine-head-dashboard"
                    className="admin-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Machine head
                  </Link>
                </div>
              ) : null}
            </div>
            <span className="admin-header__role">{roleLabel}</span>
          </div>
        </header>
        <div className="admin-body">{children}</div>
      </div>
    </div>
  );
}
