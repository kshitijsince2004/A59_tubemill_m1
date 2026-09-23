import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PlantNav from './PlantNav';

/**
 * Plant Command Center shell. Break-glass consoles stay in the header — not the primary rail.
 */
export default function PlantShell({
  title,
  subtitle,
  roleLabel = 'PLANT_HEAD',
  showAdmin,
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
    <div className="ph-root">
      <PlantNav onLogout={onLogout} />
      <div className="ph-main">
        <header className="ph-header">
          <div className="ph-header__titles">
            <p className="ph-header__eyebrow">Plant Command Center</p>
            <h1 className="ph-header__title">{title}</h1>
            {subtitle ? <p className="ph-header__sub">{subtitle}</p> : null}
          </div>
          <div className="ph-header__right">
            {actions}
            <div className="ph-consoles" ref={menuRef}>
              <button
                type="button"
                className="ph-consoles__btn"
                aria-expanded={consolesOpen}
                aria-haspopup="menu"
                onClick={() => setConsolesOpen((o) => !o)}
              >
                Open console
              </button>
              {consolesOpen ? (
                <div className="ph-consoles__menu" role="menu">
                  <Link
                    role="menuitem"
                    to={firstFloorPath || '/tm'}
                    className="ph-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Floor capture
                  </Link>
                  <Link
                    role="menuitem"
                    to="/machine-head-dashboard"
                    className="ph-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Machine head
                  </Link>
                  {showAdmin ? (
                    <Link
                      role="menuitem"
                      to="/admin"
                      className="ph-consoles__item"
                      onClick={() => setConsolesOpen(false)}
                    >
                      Admin
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="ph-header__role">{roleLabel}</span>
          </div>
        </header>
        <div className="ph-body">{children}</div>
      </div>
    </div>
  );
}
