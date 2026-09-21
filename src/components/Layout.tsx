import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/seguimiento", label: "Seguimiento en vivo" },
  { to: "/expedientes", label: "Expedientes" },
  { to: "/asignaciones", label: "Asignaciones" },
  { to: "/visitas", label: "Visitas" },
  { to: "/usuarios", label: "Usuarios", adminOnly: true },
  { to: "/seguridad", label: "Seguridad" },
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
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <span className="dot" />
              {link.label}
            </NavLink>
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
