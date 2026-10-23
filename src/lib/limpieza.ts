import { useEffect, useState } from "react";
import { getEmpresaElegida, request } from "../api";

// Modo pruebas: mientras está encendido el administrador puede borrar empleados por completo y limpiar los datos de prueba. Lo enciende cada
// empresa desde Seguridad. El estado se pide una vez y se comparte: el aviso de la barra superior y las opciones de Usuarios y Seguridad lo leen.
let activo = false;
let cargado = false;
let deEmpresa = ""; // empresa de la que es el valor: un administrador universal que cambia de empresa no debe ver el de la anterior
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const empresaActual = () => getEmpresaElegida() || "";

async function leer() {
  const empresa = empresaActual();
  try {
    const r = await request<{ data: { modo_pruebas: boolean } }>("/api/limpieza/estado");
    activo = Boolean(r.data.modo_pruebas);
  } catch { activo = false; }
  cargado = true; deEmpresa = empresa;
  avisar();
}

export async function cambiarModoPruebas(nuevo: boolean) {
  const r = await request<{ data: { modo_pruebas: boolean } }>("/api/limpieza/modo-pruebas", { method: "PUT", body: JSON.stringify({ activo: nuevo }) });
  activo = Boolean(r.data.modo_pruebas); cargado = true; deEmpresa = empresaActual();
  avisar();
}

export const olvidarModoPruebas = () => { activo = false; cargado = false; deEmpresa = ""; avisar(); };

// `habilitado`: solo el administrador (o el universal dentro de una empresa) puede preguntar; los demás roles no hacen la petición.
export function useModoPruebas(habilitado: boolean) {
  const [, forzar] = useState(0);
  useEffect(() => {
    if (!habilitado) return;
    const f = () => forzar((n) => n + 1);
    oyentes.add(f);
    if (!cargado || deEmpresa !== empresaActual()) void leer();
    return () => { oyentes.delete(f); };
  }, [habilitado]);
  const vigente = habilitado && cargado && deEmpresa === empresaActual();
  return { activo: vigente && activo, cargado: vigente };
}

// Visitas de ejemplo (solo con el modo pruebas encendido): cuántas hay, cargarlas y quitarlas. Lo que se carga lleva una marca y quitar no toca nada real.
export type EstadoDemo = { visitas: number; expedientes: number; auditores: number; previstas: number };
export type CargaDemo = { creadas: number; omitidas: number; fotos: number; previstas: number; asesores: number };
export type QuitaDemo = { visitas: number; fotos: number; asignaciones: number; expedientes: number; archivos_sin_borrar: number };
export const leerEstadoDemo = () => request<{ data: EstadoDemo }>("/api/limpieza/demo").then((r) => r.data);
export const cargarVisitasDemo = () => request<{ data: CargaDemo }>("/api/limpieza/demo/visitas", { method: "POST" }).then((r) => r.data);
export const quitarVisitasDemo = () => request<{ data: QuitaDemo }>("/api/limpieza/demo/visitas", { method: "DELETE" }).then((r) => r.data);

export type Totales = Record<string, number>;
type RespuestaBorrado = { terminado: boolean; borrado: Totales; archivos_sin_borrar: number };

// El servidor borra en lotes con un tiempo máximo por llamada: si queda trabajo contesta `terminado: false` y se vuelve a llamar. Se suman los
// totales de cada llamada para ir mostrando el avance.
export async function correrHastaTerminar(ruta: string, cuerpo: unknown, alProgreso: (total: Totales) => void) {
  const total: Totales = {};
  let sinBorrar = 0;
  for (let llamada = 0; llamada < 1000; llamada += 1) {
    const r = await request<{ data: RespuestaBorrado }>(ruta, { method: "POST", body: JSON.stringify(cuerpo) });
    for (const [k, v] of Object.entries(r.data.borrado)) total[k] = (total[k] || 0) + v;
    sinBorrar += r.data.archivos_sin_borrar || 0;
    alProgreso({ ...total });
    if (r.data.terminado) return { total, sinBorrar };
  }
  throw new Error("El borrado sigue sin terminar después de muchos intentos. Revisa la lista y vuelve a intentarlo.");
}
