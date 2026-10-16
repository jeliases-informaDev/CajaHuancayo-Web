import React from "react";

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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="info-row"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export function Loading() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
      <span
        style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          border: "2.5px solid var(--border)", borderTopColor: "var(--primary)",
          animation: "ch-spin 0.7s linear infinite",
        }}
      />
      Cargando…
      <style>{"@keyframes ch-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

export function Empty({ text, title }: { text: string; title?: string }) {
  return (
    <Card>
      <div className="empty-state">
        <span className="icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 13V7a1 1 0 0 1 1-1h3.5l1.5 2h5l1.5-2H20a1 1 0 0 1 1 1v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 13l1.4 5.6A1 1 0 0 0 6.36 19h11.28a1 1 0 0 0 .97-.76L20 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 13h5l1 2h4l1-2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {title ? <p style={{ margin: 0, fontWeight: 800, color: "var(--text)", fontSize: 13.5 }}>{title}</p> : null}
        <p style={{ margin: 0 }}>{text}</p>
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

// Pestañas simples: cada formulario/ficha se muestra por secciones, no en una sola página larga.
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; badge?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab${value === t.id ? " on" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? <span className="dot" aria-label="con avisos" /> : null}
        </button>
      ))}
    </div>
  );
}

// Marca el origen de un dato: lo trajo la base de Caja Huancayo o lo registró el auditor en campo.
export function Origen({ tipo }: { tipo: "base" | "campo" }) {
  return <span className={`tag ${tipo}`}>{tipo === "base" ? "Dato de la base" : "Verificado en campo"}</span>;
}
