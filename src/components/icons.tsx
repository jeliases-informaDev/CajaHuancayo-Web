import React from "react";

// Juego de íconos propio: trazo de 1.7 en una rejilla de 24, extremos redondeados. Todos usan currentColor.
const PATHS: Record<string, React.ReactNode> = {
  resumen: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  seguimiento: <><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>,
  visitas: <><rect x="5" y="4.5" width="14" height="16.5" rx="2.6" /><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" /><path d="M8.8 13.2l2.3 2.3 4.1-4.7" /></>,
  expedientes: <path d="M3.5 7.5a2 2 0 0 1 2-2H9l2 2.2h7.5a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  asignaciones: <><circle cx="6" cy="5.5" r="2.2" /><circle cx="18" cy="19.5" r="2.2" /><path d="M8.2 5.5h7a3.5 3.5 0 0 1 0 7H9a3.5 3.5 0 0 0 0 7h6.8" /></>,
  usuarios: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3 3 0 0 1 0 5.8" /><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" /></>,
  seguridad: <><rect x="5" y="10.5" width="14" height="10" rx="2.6" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.5" r="1.3" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.6" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  filtro: <><path d="M4 7h8M17.5 7H20M4 17h2.5M12 17h8" /><circle cx="15" cy="7" r="2.5" /><circle cx="9.2" cy="17" r="2.5" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  auto: <><rect x="3" y="4.5" width="18" height="12" rx="2.4" /><path d="M8.5 20h7M12 16.5V20" /></>,
  izquierda: <path d="M14.5 6l-6 6 6 6" />,
  derecha: <path d="M9.5 6l6 6-6 6" />,
  abajo: <path d="M6 9.5l6 6 6-6" />,
  arriba: <path d="M6 14.5l6-6 6 6" />,
  volver: <path d="M19 12H5M11 6l-6 6 6 6" />,
  siguiente: <path d="M5 12h14M13 6l6 6-6 6" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alerta: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4.5M12 17.2v.1" /></>,
  descargar: <path d="M12 4v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  subir: <path d="M12 15.5V5M7.5 9L12 4.5 16.5 9M5 19.5h14" />,
  mas: <path d="M12 5v14M5 12h14" />,
  panel: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.6" /><path d="M9.5 4.5v15" /></>,
  imagen: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.6" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" /></>,
  archivo: <><path d="M7 3.5h6.5l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" /><path d="M13.5 3.5v5h5M8.5 13h7M8.5 16.5h5" /></>,
  externo: <path d="M13.5 4.5h6v6M19.5 4.5L11 13M17.5 14v4a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h4" />,
  salir: <path d="M9.5 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2.5M14 8l4 4-4 4M18 12H9.5" />,
  pulso: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  objetivo: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  mapa: <path d="M9 5.5L3.5 7.5v11l5.5-2 6 2 5.5-2v-11l-5.5 2zM9 5.5v11M15 7.5v11" />,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  huella: <><path d="M6.5 11a5.5 5.5 0 0 1 11 0c0 3-.5 5.5-1.5 8" /><path d="M9.5 19c.9-1.9 1.2-4 1.2-6.2a1.3 1.3 0 0 1 2.6 0c0 2.2-.3 4.3-1.1 6.2" /><path d="M3.8 9.2A8.7 8.7 0 0 1 12 3a8.7 8.7 0 0 1 8.2 6.2" /></>,
  firma: <><path d="M4 18c2.2 0 3.1-5.5 4.6-8.5.8-1.5 2-.6 1.6 1-.5 2.4-.9 5.2.8 4.9 2.3-.4 3.1-4 4.7-4 .9 0 .6 1.7.4 2.6-.2.9.3 1.5 1.2 1.5H20" /><path d="M3.5 20.5h17" /></>,
  ficha: <><rect x="4.5" y="3.5" width="15" height="17" rx="2.6" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></>,
  alertaCirculo: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.1" /></>,
  cambiar: <><path d="M4.5 9.5A8 8 0 0 1 18.2 6.8L19.5 8.2" /><path d="M19.5 4v4.2h-4.2" /><path d="M19.5 14.5A8 8 0 0 1 5.8 17.2L4.5 15.8" /><path d="M4.5 20v-4.2h4.2" /></>,
  planilla: <><path d="M7 3.5h6.5l5 5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" /><path d="M13.5 3.5v5h5" /><path d="M8.5 13h2M13 13h2.5M8.5 16.5h2M13 16.5h2.5" /></>,
  llave: <><circle cx="8" cy="15.5" r="3.6" /><path d="M10.6 12.9L19.5 4M16.2 7.3l2.4 2.4M13.6 9.9l1.9 1.9" /></>,
  escudoOk: <><path d="M12 3.5l7 2.5v5.6c0 4.1-2.9 7.5-7 8.9-4.1-1.4-7-4.8-7-8.9V6z" /><path d="M9 12l2.2 2.2L15.3 10" /></>,
  usuarioX: <><circle cx="9.5" cy="8.5" r="3.3" /><path d="M3.5 19.5a6 6 0 0 1 12 0" /><path d="M16.6 8.6l4 4M20.6 8.6l-4 4" /></>,
  usuarioMas: <><circle cx="9.5" cy="8.5" r="3.3" /><path d="M3.5 19.5a6 6 0 0 1 12 0" /><path d="M18.5 7.5v6M15.5 10.5h6" /></>,
  usuarioOk: <><circle cx="9.5" cy="8.5" r="3.3" /><path d="M3.5 19.5a6 6 0 0 1 12 0" /><path d="M16.2 11l2 2 3.4-4" /></>,
  ojo: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  ojoCerrado: <><path d="M4 4l16 16" /><path d="M10.7 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.1 3.9M6.4 7.6A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  portapapeles: <><rect x="5" y="4.5" width="14" height="16.5" rx="2.6" /><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" /></>,
  celular: <><rect x="7" y="3" width="10" height="18" rx="2.4" /><path d="M11 17.8h2" /></>,
  papelera: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.3h6.2a1.6 1.6 0 0 0 1.6-1.3L17.5 7M10 11v6M14 11v6" />,
  tuerca: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6" /></>,
};

export function Icon({ name, size = 20, className, strokeWidth = 1.7 }: { name: keyof typeof PATHS | string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} focusable="false">
      {PATHS[name] ?? null}
    </svg>
  );
}

// Sello de la marca: el mismo que el favicon. El degradado lleva un id por instancia para que varias marcas en la misma página no choquen.
export function Marca({ size = 38, className }: { size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c11f8c" /><stop offset=".55" stopColor="#7a2c9e" /><stop offset="1" stopColor="#2d41c4" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M16 6.5c-3.9 0-7 3-7 6.9 0 4.9 5.6 9.6 6.4 10.2a1 1 0 0 0 1.2 0C17.4 23 23 18.3 23 13.4c0-3.9-3.1-6.9-7-6.9z" fill="#fff" />
      <path d="M12.9 13.2l2.2 2.3 4-4.4" stroke="#6a2a97" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ilustraciones de los estados vacíos: líneas y formas planas con los colores de la marca.
export function Ilustracion({ tipo = "vacio" }: { tipo?: "vacio" | "busqueda" | "visitas" | "asignar" }) {
  const brand = "var(--brand)";
  const soft = "var(--brand-soft)";
  const mag = "var(--magenta)";
  return (
    <svg className="illus" viewBox="0 0 168 120" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="84" cy="106" rx="56" ry="7" fill="var(--sunken)" />
      {tipo === "busqueda" ? (
        <>
          <rect x="30" y="22" width="86" height="64" rx="10" fill={soft} stroke="var(--line-2)" />
          <path d="M42 40h44M42 52h62M42 64h34" stroke="var(--line-2)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="112" cy="70" r="20" fill="var(--surface)" stroke={brand} strokeWidth="3" />
          <path d="M127 85l14 14" stroke={brand} strokeWidth="5" strokeLinecap="round" />
          <path d="M104 70h16" stroke={mag} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : tipo === "visitas" ? (
        <>
          <path d="M20 90c20-26 38-4 56-22s26-36 52-36" stroke="var(--line-2)" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
          <circle cx="24" cy="88" r="6" fill="var(--surface)" stroke={brand} strokeWidth="2.5" />
          <g transform="translate(112 18)">
            <path d="M18 0C8.6 0 1 7.2 1 16.2 1 28 14.4 39.4 16 40.6a3 3 0 0 0 4 0C21.6 39.4 35 28 35 16.2 35 7.2 27.4 0 18 0z" fill={brand} />
            <circle cx="18" cy="16" r="9" fill="var(--surface)" />
            <path d="M13.5 16.2l3.2 3.2 6-6.4" stroke={mag} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </>
      ) : tipo === "asignar" ? (
        <>
          <rect x="26" y="30" width="116" height="22" rx="8" fill={soft} stroke="var(--line-2)" />
          <rect x="26" y="58" width="116" height="22" rx="8" fill="var(--surface)" stroke="var(--line-2)" />
          <circle cx="40" cy="41" r="6" fill={brand} /><circle cx="40" cy="69" r="6" fill={mag} />
          <path d="M54 41h50M54 69h38" stroke="var(--line-2)" strokeWidth="3" strokeLinecap="round" />
          <path d="M118 41h14" stroke={brand} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M26 44a8 8 0 0 1 8-8h22l10 10h58a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" fill={soft} stroke="var(--line-2)" />
          <path d="M26 56h116" stroke="var(--line-2)" />
          <circle cx="84" cy="74" r="11" fill="var(--surface)" stroke={brand} strokeWidth="2.5" />
          <path d="M84 69v5.5M84 78.5v.1" stroke={mag} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
