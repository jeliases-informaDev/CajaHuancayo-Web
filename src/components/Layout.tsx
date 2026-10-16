import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useMenuKeys } from "./kit";
import { Icon, Marca } from "./icons";
import { Avatar } from "./ui";
import Palette from "./Palette";
import { useRail, useTheme, type Tema } from "../lib/theme";
import { olvidarResumen, useResumen } from "../lib/resumen";

type Enlace = { to: string; label: string; icon: string; end?: boolean; adminOnly?: boolean };
const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  { titulo: "Operación", enlaces: [
    { to: "/", label: "Resumen", icon: "resumen", end: true },
    { to: "/seguimiento", label: "Seguimiento", icon: "seguimiento" },
    { to: "/visitas", label: "Visitas", icon: "visitas" },
  ] },
  { titulo: "Cartera", enlaces: [
    { to: "/expedientes", label: "Expedientes", icon: "expedientes" },
    { to: "/asignaciones", label: "Asignaciones", icon: "asignaciones" },
  ] },
  { titulo: "Administración", enlaces: [
    { to: "/usuarios", label: "Usuarios", icon: "usuarios", adminOnly: true },
    { to: "/seguridad", label: "Seguridad", icon: "seguridad" },
  ] },
];

const NOMBRES: Record<string, string> = {
  "": "Resumen", seguimiento: "Seguimiento", visitas: "Visitas", expedientes: "Expedientes", asignaciones: "Asignaciones", usuarios: "Usuarios", seguridad: "Seguridad", privacidad: "Privacidad",
};
const ROL: Record<string, string> = { ADMINISTRADOR: "Administrador", SUPERVISOR: "Supervisor" };
const TEMAS: { id: Tema; label: string; icon: string }[] = [{ id: "light", label: "Claro", icon: "sol" }, { id: "dark", label: "Oscuro", icon: "luna" }, { id: "auto", label: "Sistema", icon: "auto" }];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { resumen } = useResumen();
  const [rail, alternarRail] = useRail();
  const [tema, fijarTema] = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const userBtn = useRef<HTMLButtonElement>(null);
  const userMenu = useRef<HTMLDivElement>(null);
  useMenuKeys(menuUsuario, userMenu, userBtn, () => setMenuUsuario(false));

  useEffect(() => { setAbierto(false); setMenuUsuario(false); }, [location.pathname]);
  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (userRef.current && !userRef.current.contains(e.target as Node)) setMenuUsuario(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);
  // Ctrl/Cmd + K abre la paleta desde cualquier parte; "/" también, salvo que se esté escribiendo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaleta((v) => !v); return; }
      const t = e.target as HTMLElement | null;
      const escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !escribiendo && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setPaleta(true); }
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const salir = async () => { await logout(); olvidarResumen(); navigate("/login"); };
  const esAdmin = user?.rol === "ADMINISTRADOR";
  const nombre = [user?.nombres, user?.apellidos].filter(Boolean).join(" ") || user?.username || "";
  const porRevisar = resumen?.cola_revision.length || 0;

  const partes = location.pathname.split("/").filter(Boolean);
  const raiz = NOMBRES[partes[0] || ""] || "Panel";
  const migas = (
    <nav className="crumbs" aria-label="Ruta de navegación">
      {partes.length > 1 ? <><Link to={`/${partes[0]}`}>{raiz}</Link><span className="sep" aria-hidden="true">/</span><b>Detalle</b></> : <b>{raiz}</b>}
    </nav>
  );

  return (
    <div className="app" data-open={abierto}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <aside className="sidebar" aria-label="Navegación principal">
        <Link to="/" className="ws" aria-label="Auditoría de Visitas, Caja Huancayo. Ir al resumen" translate="no">
          <Marca size={38} className="ws-mark" />
          <div><b>Auditoría de Visitas</b><span>Caja Huancayo</span></div>
        </Link>
        <button className="side-search" onClick={() => setPaleta(true)} data-tip="Buscar o ir a…" aria-label="Buscar o ir a… (Ctrl K)">
          <Icon name="buscar" size={18} /><span>Buscar o ir a…</span><kbd>Ctrl K</kbd>
        </button>
        <nav className="side-nav" aria-label="Secciones">
          {GRUPOS.map((g) => {
            const visibles = g.enlaces.filter((e) => !e.adminOnly || esAdmin);
            if (!visibles.length) return null;
            return (
              <React.Fragment key={g.titulo}>
                <div className="side-group" aria-hidden="true">{g.titulo}</div>
                {visibles.map((e) => (
                  <NavLink key={e.to} to={e.to} end={e.end} data-tip={e.label} className={({ isActive }) => `navitem${isActive ? " active" : ""}`}>
                    <Icon name={e.icon} size={20} />
                    <span className="lbl-t">{e.label}</span>
                    {e.to === "/visitas" && porRevisar > 0 ? <span className="nav-count" aria-label={`${porRevisar} por revisar`}>{porRevisar}</span> : null}
                  </NavLink>
                ))}
              </React.Fragment>
            );
          })}
        </nav>
        <div className="side-foot" ref={userRef}>
          <button className="railbtn collapse" onClick={alternarRail} aria-pressed={rail} data-tip={rail ? "Expandir la barra" : "Contraer la barra"}>
            <Icon name="panel" size={18} /><span className="lbl-t">{rail ? "Expandir barra" : "Contraer barra"}</span>
          </button>
          {menuUsuario ? (
            <div className="usermenu">
              <div className="menu" role="menu" ref={userMenu} aria-label="Cuenta">
                <div className="head"><b>{nombre}</b><span>{ROL[user?.rol || ""] || user?.rol} · @{user?.username}</span></div>
                <div className="mlabel" id="lbl-tema">Apariencia</div>
                <div className="themes" role="group" aria-labelledby="lbl-tema">
                  {TEMAS.map((t) => (
                    <button key={t.id} role="menuitemradio" aria-checked={tema === t.id} tabIndex={-1} onClick={() => fijarTema(t.id)}><Icon name={t.icon} size={17} />{t.label}</button>
                  ))}
                </div>
                <hr />
                <button role="menuitem" tabIndex={-1} onClick={() => { setMenuUsuario(false); navigate("/privacidad"); }}><Icon name="archivo" size={17} />Política de privacidad</button>
                <button role="menuitem" tabIndex={-1} className="bad" onClick={salir}><Icon name="salir" size={17} />Cerrar sesión</button>
              </div>
            </div>
          ) : null}
          <button ref={userBtn} className="userbtn" onClick={() => setMenuUsuario((v) => !v)} aria-haspopup="menu" aria-expanded={menuUsuario} data-tip={nombre}>
            <Avatar nombre={nombre} />
            <span className="who"><b>{nombre}</b><span>{ROL[user?.rol || ""] || user?.rol}</span></span>
            <Icon name="arriba" size={16} className="chev" />
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setAbierto(false)} aria-hidden="true" />
      <div className="main-col">
        <header className="topbar">
          <button className="burger" onClick={() => setAbierto((v) => !v)} aria-label="Abrir el menú" aria-expanded={abierto}><Icon name="menu" size={19} /></button>
          {migas}
          <div className="top-spacer" />
          <button className="pill-search" onClick={() => setPaleta(true)} aria-label="Buscar o ir a… (Ctrl K)">
            <Icon name="buscar" size={16} /><span>Buscar cliente o crédito…</span><kbd>Ctrl K</kbd>
          </button>
        </header>
        <main className="page" id="contenido" tabIndex={-1}>{children}</main>
      </div>
      <Palette abierta={paleta} onClose={() => setPaleta(false)} esAdmin={esAdmin} />
    </div>
  );
}
