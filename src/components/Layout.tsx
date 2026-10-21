import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useMenuKeys } from "./kit";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import Palette from "./Palette";
import { useRail, useTheme, type Tema } from "../lib/theme";
import { olvidarResumen, useResumen } from "../lib/resumen";

type Enlace = { universalOnly?: boolean; to: string; label: string; icon: string; end?: boolean; adminOnly?: boolean };
// Las secciones van en una sola lista, sin títulos de grupo (diseño de Figma). El orden es el de los íconos de la barra compacta.
const ENLACES: Enlace[] = [
  { to: "/", label: "Dashboard", icon: "resumen", end: true },
  { to: "/seguimiento", label: "Seguimiento en vivo", icon: "seguimiento" },
  { to: "/visitas", label: "Visitas", icon: "visitas" },
  { to: "/expedientes", label: "Expedientes", icon: "expedientes" },
  { to: "/asignaciones", label: "Asignaciones", icon: "asignaciones" },
  { to: "/usuarios", label: "Usuarios", icon: "usuarios", adminOnly: true },
  { to: "/empresas", label: "Empresas", icon: "usuarios", universalOnly: true },
  { to: "/seguridad", label: "Seguridad", icon: "seguridad" },
];

// Migas de la barra superior: «sección > pantalla» como en el diseño. La nota de la derecha explica la pantalla; solo las pantallas ya
// rediseñadas la tienen (las demás todavía traen su propio encabezado).
const RUTAS: Record<string, { seccion: string; pantalla: string; nota?: string }> = {
  "": { seccion: "Dashboard", pantalla: "Overview" },
  seguimiento: { seccion: "Seguimiento en Vivo", pantalla: "Mapa" },
  visitas: { seccion: "Operación", pantalla: "Visita" },
  expedientes: { seccion: "Cartera", pantalla: "Expediente" },
  asignaciones: { seccion: "Operación", pantalla: "Asignaciones" },
  usuarios: { seccion: "Administración", pantalla: "Usuarios" },
  empresas: { seccion: "Administración", pantalla: "Empresas" },
  seguridad: { seccion: "Administración", pantalla: "Seguridad" },
  privacidad: { seccion: "Cuenta", pantalla: "Privacidad" },
};
const ROL: Record<string, string> = { ADMINISTRADOR: "Administrador", SUPERVISOR: "Supervisor", UNIVERSAL: "Administrador universal" };
const TEMAS: { id: Tema; label: string; icon: string }[] = [{ id: "light", label: "Claro", icon: "sol" }, { id: "dark", label: "Oscuro", icon: "luna" }, { id: "auto", label: "Sistema", icon: "auto" }];

// «Caja Huancayo» o «CajaHuancayo» → «CH»; un nombre de una sola palabra → sus dos primeras letras.
const siglas = (nombre: string) => {
  const mayusculas = nombre.match(/[A-ZÁÉÍÓÚÑ]/g);
  return (mayusculas && mayusculas.length >= 2 ? mayusculas.slice(0, 2).join("") : nombre.replace(/\s+/g, "").slice(0, 2)).toUpperCase();
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, empresa, empresaElegida, logout } = useAuth();
  const esUniversal = user?.rol === "UNIVERSAL";
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
  const esAdmin = user?.rol === "ADMINISTRADOR" || (esUniversal && Boolean(empresaElegida));
  // Marca que ve el usuario: la de su empresa (o la elegida por el universal); sin empresa, la de la plantilla.
  const marcaNombre = empresa?.marca?.nombre || empresa?.nombre_corto || (esUniversal ? "Sulotec" : "");
  const marcaProducto = empresa?.marca?.producto || "Auditoría de Visitas";
  const nombre = [user?.nombres, user?.apellidos].filter(Boolean).join(" ") || user?.username || "";
  const porRevisar = resumen?.cola_revision.length || 0;
  const visibles = ENLACES.filter((e) => (e.universalOnly ? esUniversal : (esUniversal && !empresaElegida ? false : !e.adminOnly || esAdmin)));

  const partes = location.pathname.split("/").filter(Boolean);
  const ruta = RUTAS[partes[0] || ""] || { seccion: "Panel", pantalla: "Panel" };
  const migas = (
    <nav className="crumbs" aria-label="Ruta de navegación">
      <span>{ruta.seccion}</span><span className="sep" aria-hidden="true">&gt;</span>
      {partes.length > 1 ? <><Link to={`/${partes[0]}`}>{ruta.pantalla}</Link><span className="sep" aria-hidden="true">&gt;</span><b>Detalle</b></> : <b>{ruta.pantalla}</b>}
    </nav>
  );

  return (
    <div className="app" data-open={abierto}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <aside className="sidebar" aria-label="Navegación principal">
        <Link to={esUniversal && !empresaElegida ? "/empresas" : "/"} className="ws" aria-label={`${marcaProducto}, ${marcaNombre || "Sulotec"}. Ir al inicio`} translate="no">
          <span className="ws-badge" aria-hidden="true">{siglas(marcaNombre || "Sulotec")}</span>
          <span className="ws-mark" aria-hidden="true" />
          <div className="ws-texto"><b>{marcaNombre || "Sulotec"}</b><span>Panel de operaciones</span></div>
        </Link>
        {esUniversal ? <Link to="/empresas" className="empresa-actual" aria-label="Cambiar de empresa">{empresaElegida && empresa ? `Dentro de ${empresa.nombre}` : "Elige una empresa"}</Link> : null}
        <nav className="side-nav" aria-label="Secciones">
          {visibles.map((e) => (
            <NavLink key={e.to} to={e.to} end={e.end} data-tip={e.label} className={({ isActive }) => `navitem${isActive ? " active" : ""}`}>
              <Icon name={e.icon} size={20} />
              <span className="lbl-t">{e.label}</span>
              {e.to === "/visitas" && porRevisar > 0 ? <span className="nav-count" aria-label={`${porRevisar} por revisar`}>{porRevisar}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot" ref={userRef}>
          <button className="railbtn collapse" onClick={alternarRail} aria-pressed={rail} data-tip={rail ? "Expandir la barra" : "Contraer la barra"}>
            <Icon name={rail ? "derecha" : "izquierda"} size={18} /><span className="lbl-t">{rail ? "Expandir barra" : "Contraer barra"}</span>
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
          <button ref={userBtn} className="userbtn" onClick={() => setMenuUsuario((v) => !v)} aria-haspopup="menu" aria-expanded={menuUsuario} data-tip={nombre} title={nombre}>
            <Avatar nombre={nombre} />
            <span className="who"><b>{ROL[user?.rol || ""] || user?.rol}</b><span>{marcaNombre || nombre}</span></span>
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
          {ruta.nota ? <p className="top-nota">{ruta.nota}</p> : null}
        </header>
        <main className="page" id="contenido" tabIndex={-1}>{children}</main>
      </div>
      <Palette abierta={paleta} onClose={() => setPaleta(false)} esAdmin={esAdmin} />
    </div>
  );
}
