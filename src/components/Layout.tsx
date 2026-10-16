import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useMenuKeys } from "./kit";

const LINKS = [
  { to: "/", label: "Resumen", end: true },
  { to: "/seguimiento", label: "Seguimiento" },
  { to: "/expedientes", label: "Expedientes" },
  { to: "/asignaciones", label: "Asignaciones" },
  { to: "/visitas", label: "Visitas" },
  { to: "/usuarios", label: "Usuarios", adminOnly: true, grupo: 2 },
  { to: "/seguridad", label: "Seguridad", grupo: 2 },
];

const initialsOf = (name: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const userRef = useRef<HTMLDivElement>(null);
  const userBtn = useRef<HTMLButtonElement>(null);
  const userMenuEl = useRef<HTMLDivElement>(null);
  useMenuKeys(userMenu, userMenuEl, userBtn, () => setUserMenu(false));

  useEffect(() => { setMenuOpen(false); setUserMenu(false); }, [location.pathname]);
  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenu(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Gestionar usuarios es exclusivo del Administrador; el Supervisor ve todo lo demás
  // (seguimiento, expedientes, evidencias, fichas) pero no crea ni suspende cuentas.
  const links = LINKS.filter((link) => !link.adminOnly || user?.rol === "ADMINISTRADOR");
  const nombre = user?.nombres || user?.username || "";

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busqueda.trim();
    if (q) navigate(`/expedientes?q=${encodeURIComponent(q)}`);
    setBusqueda("");
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="topnav">
        <Link to="/" className="brand" aria-label="Ir al resumen" translate="no">
          <div className="mark">CH</div>
          <div><b>Auditoría de Visitas</b><span>Caja Huancayo</span></div>
        </Link>
        <nav className={`navlinks${menuOpen ? " open" : ""}`} aria-label="Secciones">
          {links.map((link, i) => (
            <React.Fragment key={link.to}>
              {i > 0 && links[i - 1].grupo !== link.grupo ? <span className="navsep" aria-hidden="true" /> : null}
              <NavLink to={link.to} end={link.end} className={({ isActive }) => `navlink${isActive ? " active" : ""}`}>{link.label}</NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="topspacer" />
        <form className="topsearch" onSubmit={buscar} role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" name="buscar" autoComplete="off" spellCheck={false} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente, documento o crédito…" aria-label="Buscar expedientes" />
        </form>
        <div className="usermenu" ref={userRef}>
          <button ref={userBtn} className="userbtn" onClick={() => setUserMenu((v) => !v)} aria-haspopup="menu" aria-expanded={userMenu}>
            <span className="avatar">{initialsOf(nombre)}</span>
            <span className="u">{nombre}</span>
          </button>
          {userMenu ? (
            <div className="menu" role="menu" ref={userMenuEl} style={{ color: "var(--ink)" }}>
              <div className="head"><b>{nombre}</b><span>{user?.rol === "ADMINISTRADOR" ? "Administrador" : user?.rol === "SUPERVISOR" ? "Supervisor" : user?.rol} · @{user?.username}</span></div>
              <button role="menuitem" tabIndex={-1} onClick={doLogout}>Cerrar sesión</button>
            </div>
          ) : null}
        </div>
        <button className="burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" aria-expanded={menuOpen}>
          <svg width="16" height="12" viewBox="0 0 18 14" fill="none"><path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" /></svg>
        </button>
      </header>
      <main className="page" id="contenido" tabIndex={-1}>{children}</main>
    </div>
  );
}
