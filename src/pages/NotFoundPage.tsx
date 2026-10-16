import { Link } from "react-router-dom";
import { Marca } from "../components/icons";

export default function NotFoundPage() {
  return (
    <main className="notfound" id="contenido">
      <div>
        <Marca size={44} />
        <div className="big" aria-hidden="true" style={{ marginTop: 18 }}>404</div>
        <h1>Esta página no existe</h1>
        <p>El enlace puede estar incompleto o la pantalla ya no está disponible. Vuelve al resumen o busca lo que necesitas con Ctrl&nbsp;K.</p>
        <Link to="/" className="btn">Ir al resumen</Link>
      </div>
    </main>
  );
}
