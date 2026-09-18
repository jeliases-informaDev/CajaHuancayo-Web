import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Gestionar usuarios es exclusivo del Administrador; el Supervisor ve todo lo demás
  // (mapa en vivo, banco de clientes, evidencias, fichas) pero no crea/suspende cuentas.
  const links = LINKS.filter((link) => !link.adminOnly || user?.rol === "ADMINISTRADOR");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="name">Auditoría de Visitas</div>
          <div className="company">CAJA HUANCAYO</div>
        </div>
        {links.map((link) => (
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
