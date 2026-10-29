import { useEffect, useState } from "react";
import { request } from "../api";
import { useAuth } from "../AuthContext";
import { Badge, Empty, Field, Skeleton } from "../components/ui";

// Catálogo de empresas (clientes de Sulotec). Solo lo ve el administrador universal; desde aquí «entra» a cada empresa.
type Empresa = { id: string; nombre: string; nombre_corto: string; slug: string; estado: string; prefijo?: string | null; marca: { nombre?: string; color?: string; logo_url?: string }; reglas: { geocerca_radio_m: number; precision_maxima_m: number; zona_radio_m?: number } };
const vacia = { nombre: "", nombre_corto: "", prefijo: "", geocerca_radio_m: "", precision_maxima_m: "", zona_radio_m: "", color: "" };
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

export default function EmpresasPage() {
  const { empresaElegida, elegirEmpresa } = useAuth();
  const [lista, setLista] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState(vacia);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try { const r: any = await request("/api/empresas"); setLista(r.data); setError(""); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const abrirEdicion = (e: Empresa) => { setEditando(e); setForm({ nombre: e.nombre, nombre_corto: e.nombre_corto, prefijo: e.prefijo || "", geocerca_radio_m: String(e.reglas.geocerca_radio_m), precision_maxima_m: String(e.reglas.precision_maxima_m), zona_radio_m: e.reglas.zona_radio_m ? String(e.reglas.zona_radio_m) : "", color: e.marca.color || "" }); };
  const cerrar = () => { setEditando(null); setForm(vacia); };
  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setGuardando(true); setError(""); setAviso("");
    const cuerpo: any = { nombre: form.nombre.trim(), nombre_corto: form.nombre_corto.trim() || undefined, configuracion: {}, marca: {} };
    if (form.geocerca_radio_m) cuerpo.configuracion.geocerca_radio_m = Number(form.geocerca_radio_m);
    if (form.precision_maxima_m) cuerpo.configuracion.precision_maxima_m = Number(form.precision_maxima_m);
    if (form.zona_radio_m) cuerpo.configuracion.zona_radio_m = Number(form.zona_radio_m);
    if (form.color) cuerpo.marca.color = form.color;
    // Al crear, sin abreviatura el servidor la sugiere desde el nombre; al editar, vacío quita la abreviatura.
    if (editando || form.prefijo.trim()) cuerpo.prefijo = form.prefijo.trim().toLowerCase();
    try {
      if (editando) { await request(`/api/empresas/${editando.id}`, { method: "PUT", body: JSON.stringify(cuerpo) }); setAviso("Empresa actualizada."); }
      else { await request("/api/empresas", { method: "POST", body: JSON.stringify(cuerpo) }); setAviso("Empresa creada. Ya puedes entrar a ella y crear sus usuarios."); }
      cerrar(); await cargar();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };
  const cambiarEstado = async (e: Empresa) => {
    const suspender = e.estado === "ACTIVA";
    if (!window.confirm(suspender ? `¿Suspender a ${e.nombre}? Sus usuarios no podrán entrar hasta reactivarla.` : `¿Reactivar a ${e.nombre}?`)) return;
    try { await request(`/api/empresas/${e.id}`, { method: "PUT", body: JSON.stringify({ estado: suspender ? "SUSPENDIDA" : "ACTIVA" }) }); await cargar(); } catch (x: any) { setError(x.message); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Empresas</h1>
          <p>Cada empresa es un cliente de Sulotec con sus propios usuarios, expedientes, reglas y marca. Elige una para entrar a su panel.</p>
        </div>
        <div className="actions"><button className="btn" onClick={() => { cerrar(); setEditando(null); setForm(vacia); (document.getElementById("f-nombre") as HTMLInputElement | null)?.focus(); }}>Nueva empresa</button></div>
      </div>
      {error ? <div role="alert" className="error-box">{error}</div> : null}
      {aviso ? <div role="status" className="callout ok">{aviso}</div> : null}

      <div className="planner">
        <div>
          <div className="section-head"><h2>{editando ? `Editar ${editando.nombre}` : "Nueva empresa"}</h2></div>
          <form onSubmit={guardar} className="form-grid">
            <Field label="Nombre"><input id="f-nombre" name="nombre" className="input" required maxLength={150} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Caja Municipal de…" /></Field>
            <Field label="Nombre corto (se muestra en la app)"><input name="nombre_corto" className="input" maxLength={60} value={form.nombre_corto} onChange={(e) => setForm({ ...form, nombre_corto: e.target.value })} placeholder="Caja…" /></Field>
            <Field label="Abreviatura (prefijo fijo de sus usuarios)"><input name="prefijo" className="input" required={Boolean(editando)} maxLength={8} value={form.prefijo} onChange={(e) => setForm({ ...form, prefijo: e.target.value })} placeholder="arq" pattern="[A-Za-z0-9]{2,8}" title="De 2 a 8 letras o números" autoCapitalize="none" spellCheck={false} /><span className="help">Sus usuarios se crean como <code translate="no">{(form.prefijo.trim() || "arq").toLowerCase()}.jorge</code>; es obligatoria (vacía al crear = se sugiere desde el nombre); las cuentas ya creadas no cambian.</span></Field>
            <Field label="Geocerca (m)"><input name="geocerca_radio_m" className="input" type="number" min={10} max={50000} value={form.geocerca_radio_m} onChange={(e) => setForm({ ...form, geocerca_radio_m: e.target.value })} placeholder="100" /></Field>
            <Field label="Precisión máxima del GPS (m)"><input name="precision_maxima_m" className="input" type="number" min={5} max={5000} value={form.precision_maxima_m} onChange={(e) => setForm({ ...form, precision_maxima_m: e.target.value })} placeholder="100" /></Field>
            <Field label="Radio de zona para la primera visita (m)"><input name="zona_radio_m" className="input" type="number" min={100} max={20000} value={form.zona_radio_m} onChange={(e) => setForm({ ...form, zona_radio_m: e.target.value })} placeholder="1000" title="Sin referencia todavía, cuánto puede alejarse la primera visita de la zona conocida (sugerencia del mapa o visitas vecinas)" /></Field>
            <Field label="Color de la marca (tiñe el panel de esa empresa)">
              <div className="color-marca">
                <input type="color" aria-label="Elegir color" value={COLOR_HEX.test(form.color) ? form.color : "#2d41c4"} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                <input name="color" className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#2d41c4" pattern="#[0-9a-fA-F]{6}" spellCheck={false} />
              </div>
            </Field>
            <div className="stickybar">
              {editando ? <button type="button" className="btn quiet" onClick={cerrar}>Cancelar</button> : null}
              <button className="btn" disabled={guardando}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear empresa"}</button>
            </div>
          </form>
        </div>
        <div>
          <div className="section-head"><h2>Catálogo</h2><span className="meta">{lista.length}</span></div>
          {loading ? <Skeleton height={200} radius={16} style={{ display: "block" }} /> : !lista.length ? <Empty tipo="asignar" title="Sin empresas" text="Crea la primera empresa para empezar." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Empresa</th><th scope="col">Reglas</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
                <tbody>
                  {lista.map((e) => (
                    <tr key={e.id} className={empresaElegida === e.id ? "selected" : ""}>
                      <td><b>{e.marca.color ? <span className="swatch" style={{ background: e.marca.color }} aria-hidden="true" /> : null}{e.nombre}</b><span className="sub" translate="no">{e.slug}{e.prefijo ? " · usuarios " + e.prefijo + ".…" : " · sin abreviatura"}</span></td>
                      <td>Geocerca {e.reglas.geocerca_radio_m} m · GPS ±{e.reglas.precision_maxima_m} m</td>
                      <td><Badge label={e.estado} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button type="button" className="btn small" disabled={e.estado !== "ACTIVA"} onClick={() => elegirEmpresa(e.id)}>{empresaElegida === e.id ? "Dentro" : "Entrar"}</button>{" "}
                        <button type="button" className="btn small quiet" onClick={() => abrirEdicion(e)}>Editar</button>{" "}
                        <button type="button" className="btn small quiet" onClick={() => cambiarEstado(e)}>{e.estado === "ACTIVA" ? "Suspender" : "Reactivar"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
