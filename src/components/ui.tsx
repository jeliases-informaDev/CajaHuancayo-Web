import React, { useId } from "react";
import { Ilustracion } from "./icons";
import { iniciales, tonoAvatar } from "../lib/format";

// Un estado = un color en toda la interfaz (definido en index.css: ok, warn, bad, neutral, blue, plum).
type Tono = "ok" | "warn" | "bad" | "neutral" | "blue" | "plum";
const TONOS: Record<string, Tono> = {
  ACTIVA: "ok", VISITADO: "ok", CONFORME: "ok", ACTIVO: "ok", AUDITOR: "ok", COMPLETADO: "ok",
  ASIGNADO: "warn", PENDIENTE: "warn", OBSERVADO: "warn", MEDIA: "warn", PROCESANDO: "warn",
  CANCELADA: "bad", NO_UBICADO: "bad", RECHAZADO: "bad", ALTA: "bad", ERROR: "bad", INTERRUMPIDA: "bad",
  CERRADO: "neutral", INACTIVO: "neutral", BAJA: "neutral",
  FINALIZADA: "blue", SUPERVISOR: "blue", ADMINISTRADOR: "plum",
};

export const etiqueta = (valor?: string | null) => {
  const t = String(valor || "-").replaceAll("_", " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function Badge({ label }: { label?: string | null }) {
  return <span className={`state ${TONOS[label || ""] || "neutral"}`}>{etiqueta(label)}</span>;
}

export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return <div className={`card${className ? " " + className : ""}`} style={style}>{children}</div>;
}

export function Button({ title, onClick, kind = "primary", disabled, type = "button" }: {
  title: string; onClick?: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button type={type} className={`btn ${kind !== "primary" ? kind : ""}`} onClick={onClick} disabled={disabled}>
      {title}
    </button>
  );
}

// La etiqueta queda asociada al control (clic en la etiqueta enfoca el campo y los lectores de pantalla la leen).
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const generado = useId();
  const hijo = React.isValidElement(children) ? (children as React.ReactElement<any>) : null;
  const id = hijo?.props?.id ?? generado;
  return <div className="field"><label htmlFor={id}>{label}</label>{hijo ? React.cloneElement(hijo, { id }) : children}</div>;
}

export function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="info-row"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export function Loading() {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 0" }}>
      <Skeleton width={220} height={34} radius={8} />
      <Skeleton width="100%" height={120} radius={16} style={{ display: "block" }} />
      <Skeleton width="100%" height={220} radius={16} style={{ display: "block" }} />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function Avatar({ nombre, size, className = "" }: { nombre?: string | null; size?: "sm" | "lg"; className?: string }) {
  return <span className={`avatar ${size || ""} ${tonoAvatar(nombre)} ${className}`.trim()} aria-hidden="true">{iniciales(nombre)}</span>;
}

export function Empty({ text, title, tipo = "vacio", action }: { text: string; title?: string; tipo?: "vacio" | "busqueda" | "visitas" | "asignar"; action?: React.ReactNode }) {
  return (
    <Card>
      <div className="empty-state">
        <Ilustracion tipo={tipo} />
        {title ? <p className="t">{title}</p> : null}
        <p>{text}</p>
        {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
      </div>
    </Card>
  );
}

export function Skeleton({ width = "100%", height = 14, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="kpi">
          <Skeleton width={64} height={27} radius={7} />
          <div style={{ height: 9 }} />
          <Skeleton width="70%" height={11} radius={5} />
        </Card>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                <Skeleton width={c === 0 ? "60%" : `${75 - c * 8}%`} height={12} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Pestañas: cada ficha se muestra por secciones. Teclado: ← → Inicio Fin cambian de pestaña.
export function Tabs({ tabs, value, onChange, name = "tabs" }: { tabs: { id: string; label: string; badge?: boolean }[]; value: string; onChange: (id: string) => void; name?: string }) {
  const mover = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    let destino = -1;
    if (e.key === "ArrowRight") destino = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") destino = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = tabs.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    onChange(tabs[destino].id);
    requestAnimationFrame(() => document.getElementById(`${name}-tab-${tabs[destino].id}`)?.focus());
  };
  return (
    <div className="tabs" role="tablist" onKeyDown={mover}>
      {tabs.map((t) => (
        <button
          key={t.id} id={`${name}-tab-${t.id}`} type="button" role="tab" aria-selected={value === t.id} aria-controls={`${name}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1} className={`tab${value === t.id ? " on" : ""}`} onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge ? <><span className="dot" aria-hidden="true" /><span className="sr-only"> (con avisos)</span></> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ name = "tabs", id, children }: { name?: string; id: string; children: React.ReactNode }) {
  return <div role="tabpanel" id={`${name}-panel-${id}`} aria-labelledby={`${name}-tab-${id}`} tabIndex={0} className="tabpanel">{children}</div>;
}

// Marca el origen de un dato: lo trajo la base de Caja Huancayo o lo registró el auditor en campo.
export function Origen({ tipo }: { tipo: "base" | "campo" }) {
  return <span className={`tag ${tipo}`}>{tipo === "base" ? "Dato de la base" : "Verificado en campo"}</span>;
}
