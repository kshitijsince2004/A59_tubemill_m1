import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MachineHeadNav from './MachineHeadNav';

/**
 * Machine Head desk shell. Break-glass consoles stay in the header — not the primary rail.
 */
export default function MachineHeadShell({
  title,
  subtitle,
  roleLabel = 'MACHINE_HEAD',
  showAdmin,
  showPlant,
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
    <div className="mh-root">
      <MachineHeadNav onLogout={onLogout} />
      <div className="mh-main">
        <header className="mh-header">
          <div className="mh-header__titles">
            <p className="mh-header__eyebrow">Machine Head desk</p>
            <h1 className="mh-header__title">{title}</h1>
            {subtitle ? <p className="mh-header__sub">{subtitle}</p> : null}
          </div>
          <div className="mh-header__right">
            {actions}
            <div className="mh-consoles" ref={menuRef}>
              <button
                type="button"
                className="mh-consoles__btn"
                aria-expanded={consolesOpen}
                aria-haspopup="menu"
                onClick={() => setConsolesOpen((o) => !o)}
              >
                Open console
              </button>
              {consolesOpen ? (
                <div className="mh-consoles__menu" role="menu">
                  <Link
                    role="menuitem"
                    to={firstFloorPath || '/tm'}
                    className="mh-consoles__item"
                    onClick={() => setConsolesOpen(false)}
                  >
                    Floor capture
                  </Link>
                  {showPlant ? (
                    <Link
                      role="menuitem"
                      to="/plant"
                      className="mh-consoles__item"
                      onClick={() => setConsolesOpen(false)}
                    >
                      Plant command
                    </Link>
                  ) : null}
                  {showAdmin ? (
                    <Link
                      role="menuitem"
                      to="/admin"
                      className="mh-consoles__item"
                      onClick={() => setConsolesOpen(false)}
                    >
                      Admin
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="mh-header__role">{roleLabel}</span>
          </div>
        </header>
        <div className="mh-body">{children}</div>
      </div>
    </div>
  );
}
