// Señales de verificación de una visita, sacadas de lo que ya guarda el sistema. Es el mismo criterio que
// usa la mesa de revisión; aquí va la versión corta que cabe en una fila de tabla.
export type Tono = "ok" | "warn" | "bad" | "na";
export type Senal = { tone: Tono; label: string };

export function senalesDeLista(v: any, radio = 100): Senal[] {
  const dist = v.distancia_domicilio_m != null ? Number(v.distancia_domicilio_m) : null;
  const fotos = v.evidencias?.length || 0;
  return [
    { tone: v.mock_location ? "bad" : "ok", label: v.mock_location ? "GPS simulado" : "GPS real" },
    { tone: v.device_integrity_ok ? "ok" : "bad", label: v.device_integrity_ok ? "Dispositivo íntegro" : "Dispositivo con observaciones" },
    { tone: fotos ? "ok" : "bad", label: fotos ? `${fotos} ${fotos === 1 ? "fotografía" : "fotografías"}` : "Sin fotografías" },
    dist == null ? { tone: "na", label: "Sin distancia calculada" } : dist <= radio ? { tone: "ok", label: `A ${Math.round(dist)} m del domicilio` } : { tone: "bad", label: `A ${Math.round(dist)} m: fuera del radio` },
  ];
}

export const resumenSenales = (s: Senal[]) => {
  const aplican = s.filter((x) => x.tone !== "na");
  const bien = aplican.filter((x) => x.tone === "ok").length;
  return { bien, total: aplican.length, mal: aplican.filter((x) => x.tone === "bad").length };
};
