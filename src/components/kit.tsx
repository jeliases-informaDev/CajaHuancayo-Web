import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { resumenSenales, type Senal } from "../lib/senales";

// Piezas de interfaz del panel. Se usan en varias pantallas y siguen el sistema de index.css.

const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Al abrir un diálogo: el foco entra en él, Tab no se escapa y, al cerrarlo, el foco vuelve a donde estaba.
function useDialogFocus(ref: React.RefObject<HTMLElement | null>, primero?: string) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const inicial = (primero && el?.querySelector<HTMLElement>(primero)) || el?.querySelector<HTMLElement>(`${FOCUSABLES}`) || el;
    inicial?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLES)].filter((i) => i.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previo?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function Drawer({ title, subtitle, onClose, children, footer }: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, ".drawer-body input, .drawer-body select, .drawer-body textarea, .drawer-body a[href], .drawer-body button");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="subtle" style={{ marginTop: 4 }}>{subtitle}</p> : null}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Cerrar"><Icon name="cerrar" size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </aside>
    </>,
    document.body,
  );
}

export function Modal({ title, steps, step, onClose, children, footer }: {
  title: string; steps?: string[]; step?: number; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          {steps ? (
            <div className="stepper" role="list" aria-label="Pasos">
              {steps.map((s, i) => <div key={s} role="listitem" aria-current={i === step ? "step" : undefined} className={i === step ? "on" : i < (step ?? 0) ? "done" : ""}>{s}</div>)}
            </div>
          ) : null}
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}

// Teclado de un menú: abre con el foco en el primer elemento, ↑ ↓ Inicio Fin se mueven, Esc cierra y devuelve el foco al botón.
export function useMenuKeys(abierto: boolean, menu: React.RefObject<HTMLElement | null>, disparador: React.RefObject<HTMLElement | null>, cerrar: () => void) {
  useEffect(() => {
    if (!abierto) return;
    const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const lista = items();
      const i = lista.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") { e.preventDefault(); cerrar(); disparador.current?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); lista[(i + 1) % lista.length]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); lista[(i - 1 + lista.length) % lista.length]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); lista[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); lista[lista.length - 1]?.focus(); }
      else if (e.key === "Tab") cerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type MenuItem = { label: string; onClick: () => void; tone?: "bad"; hidden?: boolean; separatorBefore?: boolean };

// Menú de acciones de una fila ("⋯"): evita llenar las tablas de botones.
export function ActionMenu({ header, items, label = "Acciones" }: { header?: { title: string; sub?: string }; items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [open]);
  useMenuKeys(open, menu, boton, () => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref}>
      <button ref={boton} className="kebab" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open ? (
        <div className="menu" role="menu" ref={menu}>
          {header ? <div className="head"><b>{header.title}</b>{header.sub ? <span>{header.sub}</span> : null}</div> : null}
          {items.filter((i) => !i.hidden).map((item) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore ? <hr /> : null}
              <button role="menuitem" tabIndex={-1} className={item.tone} onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); boton.current?.focus(); }}>{item.label}</button>
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? "on" : ""} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}{o.n != null ? <span className="n">{o.n.toLocaleString("es-PE")}</span> : null}</button>
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
  const etiqueta = (dia: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(`${dia}T12:00:00`));
  return (
    <>
      <div className="bars" role="img" aria-label={`Visitas por día, últimos ${data.length} días: ${data.map((d) => `${etiqueta(d.dia)} ${d.total}`).join(", ")}`}>
        {data.map((d, i) => <div key={d.dia} className={i === data.length - 1 ? "today" : ""} style={{ height: `${Math.max(5, (d.total / max) * 100)}%` }} title={`${etiqueta(d.dia)}: ${d.total}`} />)}
      </div>
      <div className="bars-axis" aria-hidden="true"><span>{data[0] ? etiqueta(data[0].dia) : ""}</span><span>hoy</span></div>
    </>
  );
}

// Anillo de avance con degradado: muestra qué parte del total ya está hecha.
export function Ring({ value, total, small, light, caption }: { value: number; total: number; small?: boolean; light?: boolean; caption?: string }) {
  const id = useId().replace(/:/g, "");
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const [dibujado, setDibujado] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setDibujado(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  return (
    <div className={`ring${small ? " sm" : ""}${light ? " light" : ""}`} role="img" aria-label={`${value} de ${total}${caption ? ` ${caption}` : ""}, ${Math.round(pct * 100)} %`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c11f8c" /><stop offset=".55" stopColor="#7a2c9e" /><stop offset="1" stopColor="#2d41c4" /></linearGradient></defs>
        <circle className="track" cx="60" cy="60" r={R} fill="none" strokeWidth="11" />
        <circle className="val" cx="60" cy="60" r={R} fill="none" strokeWidth="11" strokeLinecap="round" stroke={`url(#${id})`} strokeDasharray={C} strokeDashoffset={C * (1 - dibujado)} />
      </svg>
      <div className="center"><b>{Math.round(pct * 100)}%</b>{caption ? <span>{caption}</span> : null}</div>
    </div>
  );
}

// Una barrita por señal de verificación: verde cumple, roja falla, gris no aplica.
export function Pips({ senales }: { senales: Senal[] }) {
  const r = resumenSenales(senales);
  const detalle = senales.map((x) => `${x.label}${x.tone === "na" ? " (no aplica)" : x.tone === "ok" ? "" : " (alerta)"}`).join("; ");
  return (
    <span title={detalle}>
      <span className="pips" role="img" aria-label={`${r.bien} de ${r.total} señales en regla. ${detalle}`}>
        {senales.map((x, i) => <i key={i} className={x.tone === "na" ? "" : x.tone} />)}
      </span>
      <span className="pips-t" aria-hidden="true">{r.bien}/{r.total}</span>
    </span>
  );
}

// Visor de fotografías a pantalla completa: ← → cambian de foto, Esc cierra.
export function Lightbox({ items, index, onIndex, onClose }: { items: { url: string; titulo: string }[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);
  const actual = items[index];
  if (!actual) return null;
  return createPortal(
    <div className="lightbox" ref={ref} role="dialog" aria-modal="true" aria-label="Visor de fotografías" tabIndex={-1}>
      <div className="lb-bar">
        <span>{actual.titulo} · {index + 1} de {items.length}</span>
        <button className="lb-close" onClick={onClose} aria-label="Cerrar el visor"><Icon name="cerrar" size={18} /></button>
      </div>
      <div className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <button className="lb-nav lb-prev" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Foto anterior"><Icon name="izquierda" /></button>
        <img src={actual.url} alt={actual.titulo} />
        <button className="lb-nav lb-next" onClick={() => onIndex(index + 1)} disabled={index >= items.length - 1} aria-label="Foto siguiente"><Icon name="derecha" /></button>
      </div>
    </div>,
    document.body,
  );
}

export function Check({ tone, title, detail }: { tone: "ok" | "warn" | "bad" | "na"; title: string; detail?: string }) {
  const estado = tone === "ok" ? "Cumple" : tone === "bad" ? "No cumple" : tone === "warn" ? "Por revisar" : "No aplica";
  return (
    <div className={`check ${tone}`}>
      <span className="ico" aria-hidden="true">{tone === "ok" ? "✓" : tone === "bad" ? "×" : tone === "warn" ? "!" : "–"}</span>
      <div><b><span className="sr-only">{estado}: </span>{title}</b>{detail ? <span>{detail}</span> : null}</div>
    </div>
  );
}
