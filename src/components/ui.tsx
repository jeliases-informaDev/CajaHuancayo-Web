import React from "react";

const statusColors: Record<string, string> = {
  ACTIVA: "#0ead7a", ASIGNADO: "#f59e0b", PENDIENTE: "#f59e0b", VISITADO: "#0ead7a",
  CERRADO: "#6d788a", CANCELADA: "#ef4444", FINALIZADA: "#2c70e8",
  CONFORME: "#0ead7a", OBSERVADO: "#f59e0b", NO_UBICADO: "#ef4444", RECHAZADO: "#ef4444",
  ACTIVO: "#0ead7a", INACTIVO: "#94a3b8", ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#6d788a",
  ADMINISTRADOR: "#7c3aed", SUPERVISOR: "#2c70e8", AUDITOR: "#0ead7a",
};

export function Badge({ label }: { label?: string | null }) {
  const color = statusColors[label || ""] || "#6d788a";
  return (
    <span className="badge" style={{ background: `${color}20`, color }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: color, display: "inline-block" }} />
      {String(label || "-").replaceAll("_", " ")}
    </span>
  );
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
  return <p className="muted">Cargando…</p>;
}

export function Empty({ text }: { text: string }) {
  return <Card><p className="muted" style={{ margin: 0 }}>{text}</p></Card>;
}
