// Por qué terminó una asignación a la que se le quitó el caso (lo guarda el servidor en `motivo_fin`).
export const MOTIVOS: Record<string, string> = {
  ENFERMEDAD: "Enfermedad", RETIRO: "Se retiró de la empresa", REASIGNACION: "Reasignación de carga", OTRO: "Otro motivo",
  DESACTIVADO: "Cuenta desactivada", CANCELADA: "Cancelado desde el panel",
};
// Los que puede elegir quien quita los casos (los otros los pone el sistema).
export const MOTIVOS_ELEGIBLES = ["ENFERMEDAD", "RETIRO", "REASIGNACION", "OTRO"];
export const motivoTexto = (m?: string | null) => (m ? MOTIVOS[m] || m : "");
