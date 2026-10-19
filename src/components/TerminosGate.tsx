import { useEffect, useState } from "react";
import { request } from "../api";
import TerminosModal from "./TerminosModal";

// Al entrar al panel se consulta una vez por usuario si ya aceptó la versión vigente de los términos; si no, se muestra la ventana
// y no se puede usar el panel hasta aceptar (o rechazar y salir). El administrador universal de Sulotec está exento.
const consultado = new Map<string, boolean>();
const estadoDe = (userId: string) => ({ userId, pendiente: consultado.get(userId) === false });

export default function TerminosGate({ userId, rol }: { userId: string; rol: string }) {
  const [estado, setEstado] = useState(() => estadoDe(userId));
  // Si cambia el usuario de la sesión, el estado se recalcula en el mismo render (sin efecto).
  if (estado.userId !== userId) setEstado(estadoDe(userId));

  useEffect(() => {
    if (rol === "UNIVERSAL" || consultado.has(userId)) return;
    let vigente = true;
    request<any>("/api/terminos")
      .then((r) => { const ok = Boolean(r.data?.aceptado); consultado.set(userId, ok); if (vigente) setEstado({ userId, pendiente: !ok }); })
      .catch(() => { /* sin respuesta no se bloquea el panel; se vuelve a consultar en la próxima carga */ });
    return () => { vigente = false; };
  }, [userId, rol]);

  if (!estado.pendiente || estado.userId !== userId) return null;
  return <TerminosModal onAceptado={() => { consultado.set(userId, true); setEstado({ userId, pendiente: false }); }} />;
}
