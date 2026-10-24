// Lo que la pantalla Asignaciones sabe de los auditores y de los expedientes sin asignar, y cómo se muestra.
export type Auditor = {
  id: string; username: string; nombres: string; apellidos: string; departamento: string | null;
  zona: null | { texto: string | null; departamento: string | null; en: string }; activos?: number;
};
export type Pendiente = { id_expediente: number; codigo_expediente: string; nombres_cliente: string; numero_documento_cliente: string; tipo_credito: string; distrito: string | null };
// Los expedientes marcados, de todas las páginas y búsquedas: se guardan con lo que hace falta para mostrarlos en el resumen sin volver a pedirlos.
export type Seleccion = Map<number, { id: number; codigo: string; nombre: string }>;

// Como en el diseño: seis filas por página (caben sin desplazarse); quien quiera ver más elige 12, 25, 50 o 100.
export const TAMANOS_PLANNER = [6, 12, 25, 50, 100];
export const FILAS_PLANNER = 6;
export const AUDITORES_POR_PAGINA = 8;
// El servidor recibe hasta 500 expedientes por pedido de asignación masiva.
export const LOTE_ASIGNAR = 500;

export const nombreAuditor = (a: { nombres?: string; apellidos?: string; username: string }) => `${a.nombres || ""} ${a.apellidos || ""}`.trim() || a.username;
export const zonaAuditor = (a: Auditor) => a.zona?.texto || a.departamento || "Aún sin jornada";
export const PRIORIDADES = [["BAJA", "Baja"], ["MEDIA", "Media"], ["ALTA", "Alta"]] as const;

// «1 expediente» / «3 expedientes»
export const expedientes = (n: number) => `${n.toLocaleString("es-PE")} ${n === 1 ? "expediente" : "expedientes"}`;

// Parte una lista en grupos de a lo más `n` (los pedidos de asignación van de a 500).
export const trozos = <T,>(lista: T[], n: number) => { const salida: T[][] = []; for (let i = 0; i < lista.length; i += n) salida.push(lista.slice(i, i + n)); return salida; };
