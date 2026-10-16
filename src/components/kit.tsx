import React, { useEffect, useRef, useState } from "react";

// Piezas de interfaz del panel. Se usan en varias pantallas y siguen el sistema de index.css.

export function Drawer({ title, subtitle, onClose, children, footer }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="subtle" style={{ marginTop: 4 }}>{subtitle}</p> : null}
          </div>
          <button className="btn quiet small" onClick={onClose} aria-label="Cerrar">Cerrar</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}

export function Modal({ title, steps, step, onClose, children, footer }: {
  title: string; steps?: string[]; step?: number; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          {steps ? (
            <div className="stepper" aria-label="Pasos">
              {steps.map((s, i) => <div key={s} className={i === step ? "on" : i < (step ?? 0) ? "done" : ""}>{s}</div>)}
            </div>
          ) : null}
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </>
  );
}

export type MenuItem = { label: string; onClick: () => void; tone?: "bad"; hidden?: boolean; separatorBefore?: boolean };

// Menú de acciones de una fila ("⋯"): evita llenar las tablas de botones.
export function ActionMenu({ header, items, label = "Acciones" }: { header?: { title: string; sub?: string }; items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", cerrar); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="kebab" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open ? (
        <div className="menu" role="menu">
          {header ? <div className="head"><b>{header.title}</b>{header.sub ? <span>{header.sub}</span> : null}</div> : null}
          {items.filter((i) => !i.hidden).map((item) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore ? <hr /> : null}
              <button role="menuitem" className={item.tone} onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}>{item.label}</button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? "on" : ""} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// Barra segmentada con leyenda: reemplaza a las "tarjetas de número" para mostrar proporciones.
export function SegBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <div className="segbar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {segments.filter((s) => s.value > 0).map((s) => <i key={s.label} style={{ width: `${(s.value / (total || 1)) * 100}%`, background: s.color }} />)}
      </div>
      <div className="legend">
        {segments.map((s) => <span key={s.label} style={{ ["--c" as any]: s.color }}>{s.label} <b>{s.value.toLocaleString("es-PE")}</b></span>)}
      </div>
    </>
  );
}

export function Bars({ data }: { data: { dia: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <>
      <div className="bars" role="img" aria-label={`Visitas por día, últimos ${data.length} días`}>
        {data.map((d, i) => <div key={d.dia} className={i === data.length - 1 ? "today" : ""} style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }} title={`${new Date(d.dia + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" })}: ${d.total}`} />)}
      </div>
      <div className="bars-axis"><span>{new Date(data[0]?.dia + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" })}</span><span>hoy</span></div>
    </>
  );
}

export function Check({ tone, title, detail }: { tone: "ok" | "warn" | "bad" | "na"; title: string; detail?: string }) {
  return (
    <div className={`check ${tone}`}>
      <span className="ico" aria-hidden="true">{tone === "ok" ? "✓" : tone === "bad" ? "×" : tone === "warn" ? "!" : "–"}</span>
      <div><b>{title}</b>{detail ? <span>{detail}</span> : null}</div>
    </div>
  );
}
