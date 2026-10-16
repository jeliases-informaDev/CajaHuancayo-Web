import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api";
import { Icon } from "./icons";
import { useTheme } from "../lib/theme";

// Paleta de comandos (Ctrl/Cmd + K, o "/"): saltar a cualquier pantalla, aplicar un filtro frecuente o
// encontrar un expediente por crédito, nombre o documento sin salir de donde se está.
type Opcion = { id: string; grupo: string; titulo: string; detalle?: string; icono: string; ejecutar: () => void };

export default function Palette({ abierta, onClose, esAdmin }: { abierta: boolean; onClose: () => void; esAdmin: boolean }) {
  const navigate = useNavigate();
  const [tema, fijarTema] = useTheme();
  const [q, setQ] = useState("");
  const [activa, setActiva] = useState(0);
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const idBase = "pal";

  useEffect(() => { if (abierta) { setQ(""); setActiva(0); setExpedientes([]); requestAnimationFrame(() => entrada.current?.focus()); } }, [abierta]);

  // Búsqueda en vivo de expedientes (con una pequeña espera para no pedir en cada letra).
  useEffect(() => {
    const texto = q.trim();
    if (!abierta || texto.length < 2) { setExpedientes([]); setBuscando(false); return; }
    setBuscando(true);
    const t = window.setTimeout(() => {
      request<any>(`/api/expedientes?limit=6&search=${encodeURIComponent(texto)}`)
        .then((r) => setExpedientes(r.data || []))
        .catch(() => setExpedientes([]))
        .finally(() => setBuscando(false));
    }, 220);
    return () => window.clearTimeout(t);
  }, [q, abierta]);

  const ir = (ruta: string) => () => { onClose(); navigate(ruta); };
  const base: Opcion[] = useMemo(() => [
    { id: "n-resumen", grupo: "Ir a", titulo: "Resumen", detalle: "Estado de la muestra y visitas por revisar", icono: "resumen", ejecutar: ir("/") },
    { id: "n-seg", grupo: "Ir a", titulo: "Seguimiento", detalle: "Mapa en vivo de auditores y clientes", icono: "seguimiento", ejecutar: ir("/seguimiento") },
    { id: "n-vis", grupo: "Ir a", titulo: "Visitas", detalle: "Fichas, evidencia y señales de verificación", icono: "visitas", ejecutar: ir("/visitas") },
    { id: "n-exp", grupo: "Ir a", titulo: "Expedientes", detalle: "Cartera cargada desde la base", icono: "expedientes", ejecutar: ir("/expedientes") },
    { id: "n-asi", grupo: "Ir a", titulo: "Asignaciones", detalle: "Armar la muestra de cada auditor", icono: "asignaciones", ejecutar: ir("/asignaciones") },
    ...(esAdmin ? [{ id: "n-usr", grupo: "Ir a", titulo: "Usuarios", detalle: "Cuentas, zonas y dispositivos", icono: "usuarios", ejecutar: ir("/usuarios") }] : []),
    { id: "n-seg2", grupo: "Ir a", titulo: "Seguridad", detalle: "Registro de accesos y operaciones", icono: "seguridad", ejecutar: ir("/seguridad") },
    { id: "a-obs", grupo: "Atajos", titulo: "Visitas observadas", detalle: "Las que el auditor marcó con observaciones", icono: "alerta", ejecutar: ir("/visitas?resultado=OBSERVADO") },
    { id: "a-alert", grupo: "Atajos", titulo: "Visitas con alertas de seguridad", detalle: "GPS simulado, dispositivo o sin fotos", icono: "huella", ejecutar: ir("/visitas?alertas=1") },
    { id: "a-sin", grupo: "Atajos", titulo: "Expedientes sin coordenadas", detalle: "No se puede medir la distancia al domicilio", icono: "objetivo", ejecutar: ir("/expedientes?sin_coordenadas=1") },
    { id: "a-pend", grupo: "Atajos", titulo: "Expedientes sin asignar", icono: "asignaciones", ejecutar: ir("/expedientes?estado=PENDIENTE") },
    { id: "t-claro", grupo: "Apariencia", titulo: "Tema claro", icono: "sol", ejecutar: () => { fijarTema("light"); onClose(); } },
    { id: "t-oscuro", grupo: "Apariencia", titulo: "Tema oscuro", icono: "luna", ejecutar: () => { fijarTema("dark"); onClose(); } },
    { id: "t-auto", grupo: "Apariencia", titulo: "Tema del sistema", detalle: tema === "auto" ? "Activo" : undefined, icono: "auto", ejecutar: () => { fijarTema("auto"); onClose(); } },
  ], [esAdmin, tema]); // eslint-disable-line react-hooks/exhaustive-deps

  const opciones: Opcion[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtradas = t ? base.filter((o) => `${o.titulo} ${o.detalle || ""}`.toLowerCase().includes(t)) : base;
    const deExp: Opcion[] = expedientes.map((e) => ({
      id: `e-${e.id_expediente}`, grupo: "Expedientes", titulo: e.nombres_cliente,
      detalle: `${e.codigo_expediente} · ${e.numero_documento_cliente || "sin documento"} · ${e.tipo_credito === "OTROS" ? "MYPE" : "Consumo"}`,
      icono: "expedientes", ejecutar: ir(`/expedientes/${e.id_expediente}`),
    }));
    return [...deExp, ...filtradas];
  }, [q, base, expedientes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActiva(0); }, [q, expedientes.length]);
  useEffect(() => { lista.current?.querySelector<HTMLElement>(`#${idBase}-${activa}`)?.scrollIntoView({ block: "nearest" }); }, [activa]);

  if (!abierta) return null;

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiva((i) => Math.min(opciones.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiva((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); opciones[activa]?.ejecutar(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab") { e.preventDefault(); }
  };

  let grupoPrevio = "";
  return (
    <div className="pal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Buscar o ir a" onKeyDown={teclas}>
        <div className="pal-input">
          <Icon name="buscar" size={20} />
          <input
            ref={entrada} type="text" role="combobox" aria-expanded="true" aria-controls={`${idBase}-lista`} aria-activedescendant={opciones[activa] ? `${idBase}-${activa}` : undefined}
            aria-autocomplete="list" autoComplete="off" spellCheck={false} name="comando" placeholder="Busca un cliente, un crédito o una pantalla…" value={q} onChange={(e) => setQ(e.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="pal-list" id={`${idBase}-lista`} role="listbox" aria-label="Resultados" ref={lista}>
          {!opciones.length ? <div className="pal-empty">{buscando ? "Buscando…" : "Nada coincide con lo que escribiste."}</div> : null}
          {opciones.map((o, i) => {
            const cabecera = o.grupo !== grupoPrevio;
            grupoPrevio = o.grupo;
            return (
              <React.Fragment key={o.id}>
                {cabecera ? <div className="pal-group" role="presentation">{o.grupo}</div> : null}
                <div id={`${idBase}-${i}`} role="option" aria-selected={i === activa} className="pal-opt" onMouseMove={() => setActiva(i)} onClick={o.ejecutar}>
                  <span className="pi"><Icon name={o.icono} size={17} /></span>
                  <span className="pt">{o.titulo}{o.detalle ? <small>{o.detalle}</small> : null}</span>
                  {i === activa ? <Icon name="siguiente" size={16} /> : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div className="pal-foot" aria-hidden="true">
          <span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
