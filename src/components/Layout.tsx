import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/expedientes", label: "Expedientes" },
  { to: "/asignaciones", label: "Asignaciones" },
  { to: "/visitas", label: "Visitas" },
  { to: "/usuarios", label: "Usuarios" },
  { to: "/seguridad", label: "Seguridad" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="name">Auditoría de Visitas</div>
          <div className="company">CAJA HUANCAYO</div>
        </div>
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
            {link.label}
          </NavLink>
        ))}
        <div className="sidebar-spacer" />
        <div className="sidebar-user">
          <div className="u">{user?.nombres || user?.username}</div>
          <div className="r">{user?.rol}</div>
          <button className="sidebar-logout" onClick={doLogout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
