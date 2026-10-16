import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

// Iconos de línea (24×24) del menú lateral.
const ICONOS: Record<string, React.ReactNode> = {
  "/": <><rect x="3" y="3" width="7" height="9" rx="1.8" /><rect x="14" y="3" width="7" height="5" rx="1.8" /><rect x="14" y="12" width="7" height="9" rx="1.8" /><rect x="3" y="16" width="7" height="5" rx="1.8" /></>,
  "/seguimiento": <><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  "/expedientes": <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  "/asignaciones": <><rect x="5" y="4" width="14" height="17" rx="2.2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></>,
  "/visitas": <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>,
  "/usuarios": <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 5a3.2 3.2 0 0 1 0 6.2M18.5 14.8c1.6.8 2.7 2.4 3 5.2" /></>,
  "/seguridad": <><path d="M12 3l8 3v6c0 4.6-3.2 8.2-8 9-4.8-.8-8-4.4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>,
};

const LINKS = [
  { to: "/", label: "Dashboard", end: true, grupo: "Operación" },
  { to: "/seguimiento", label: "Seguimiento en vivo", grupo: "Operación" },
  { to: "/expedientes", label: "Expedientes", grupo: "Operación" },
  { to: "/asignaciones", label: "Asignaciones", grupo: "Operación" },
  { to: "/visitas", label: "Visitas", grupo: "Operación" },
  { to: "/usuarios", label: "Usuarios", adminOnly: true, grupo: "Control" },
  { to: "/seguridad", label: "Seguridad", grupo: "Control" },
];

const initialsOf = (name: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Gestionar usuarios es exclusivo del Administrador; el Supervisor ve todo lo demás
  // (mapa en vivo, banco de clientes, evidencias, fichas) pero no crea/suspende cuentas.
  const links = LINKS.filter((link) => !link.adminOnly || user?.rol === "ADMINISTRADOR");
  const currentLabel = links.find((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)))?.label || "Auditoría de Visitas";

  return (
    <div className="app-shell">
      <div className={`sidebar-scrim${menuOpen ? " show" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="mark">CH</div>
          <div style={{ flex: 1 }}>
            <div className="name">Auditoría de Visitas</div>
            <div className="company">CAJA HUANCAYO</div>
          </div>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <nav className="sidebar-nav">
          {links.map((link, i) => (
            <React.Fragment key={link.to}>
              {i === 0 || links[i - 1].grupo !== link.grupo ? <div className="sidebar-section">{link.grupo}</div> : null}
              <NavLink to={link.to} end={link.end} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[link.to]}</svg>
                {link.label}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <div className="avatar">{initialsOf(user?.nombres || user?.username || "")}</div>
          <div className="who">
            <div className="u">{user?.nombres || user?.username}</div>
            <div className="r">{user?.rol}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={doLogout}>Cerrar sesión</button>
      </aside>
      <div className="content-scroll">
        <div className="topbar">
          <button className="topbar-burger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
          <div className="topbar-title">
            {currentLabel}
            <span>CAJA HUANCAYO</span>
          </div>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
