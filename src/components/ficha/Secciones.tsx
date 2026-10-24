import React from "react";
import { Card, InfoRow, Origen } from "../ui";
import { dash, entero, fecha, n2, variacion } from "../../lib/format";

// Secciones de lectura de la ficha, compartidas por el detalle del expediente (datos
// vivos de la base) y el de la visita (datos congelados al momento de auditar).

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="fieldgrid">{children}</div>;
}

export function ClienteSeccion({ e }: { e: any }) {
  const c = e.datos_cliente || {};
  const telefonos = [c.telefono_fijo, c.telefono_celular].filter(Boolean).join(" · ") || e.telefono_cliente;
  return (
    <Card>
      <p className="section-title">Cliente <Origen tipo="base" /></p>
      <Grid>
        <div>
          <InfoRow k="Nombres y apellidos" v={dash(e.nombres_cliente)} />
          <InfoRow k="Documento" v={`${dash(e.tipo_documento_cliente)} ${dash(e.numero_documento_cliente)}`} />
          <InfoRow k="Fecha de nacimiento / edad" v={`${fecha(c.fecha_nacimiento)} · ${dash(c.edad)} años`} />
          <InfoRow k="Estado civil / sexo" v={dash([c.estado_civil, c.sexo].filter(Boolean).join(" · "))} />
          <InfoRow k="Teléfono" v={dash(telefonos)} />
          <InfoRow k="Tipo de cliente" v={dash(c.tipo_cliente)} />
          <InfoRow k="Código de cliente / expediente (core)" v={dash([c.codigo_cliente, c.codigo_expediente_core].filter(Boolean).join(" / "))} />
        </div>
        <div>
          <InfoRow k="Dirección del domicilio" v={dash(e.direccion_domicilio)} />
          <InfoRow k="Distrito / provincia / dpto." v={`${dash(e.distrito)} / ${dash(e.provincia)} / ${dash(e.departamento)}`} />
          <InfoRow k="Referencia" v={dash(c.referencia_domicilio)} />
          <InfoRow k="Tipo de vivienda" v={dash(c.tipo_vivienda)} />
          <InfoRow k="N.º de suministro" v={dash(c.numero_suministro)} />
          <InfoRow k="Zona" v={dash(c.zona)} />
          <InfoRow k="Fuente" v={dash(c.fuente)} />
          <InfoRow k="Oficina / agencia" v={dash(e.oficina)} />
        </div>
      </Grid>
    </Card>
  );
}

export function NegocioSeccion({ e }: { e: any }) {
  const n = e.datos_negocio || {};
  const negocios: any[] = n.negocios || [];
  return (
    <>
      <Card>
        <p className="section-title">Negocio <Origen tipo="base" /></p>
        <Grid>
          <div>
            <InfoRow k="Actividad" v={dash(n.actividad)} />
            <InfoRow k="Sector económico" v={dash(n.sector_economico)} />
          </div>
          <div>
            <InfoRow k="Antigüedad" v={n.antiguedad_meses != null ? `${n.antiguedad_meses} meses` : dash(n.antiguedad_texto)} />
          </div>
        </Grid>
      </Card>
      {negocios.length ? negocios.map((x, i) => (
        <Card key={i}>
          <p className="section-title">Local del negocio {negocios.length > 1 ? i + 1 : ""}</p>
          <Grid>
            <div>
              <InfoRow k="Dirección" v={dash(x.direccion)} />
              <InfoRow k="Distrito / dpto." v={`${dash(x.distrito)} / ${dash(x.departamento)}`} />
            </div>
            <div>
              <InfoRow k="Referencia" v={dash(x.referencia)} />
              <InfoRow k="Teléfono" v={dash(x.telefono)} />
              <InfoRow k="Contacto" v={dash(x.contacto)} />
            </div>
          </Grid>
        </Card>
      )) : <Card><p className="subtle">La base no trae direcciones del negocio.</p></Card>}
    </>
  );
}

// Códigos internos del core (moneda, tipo, producto, pagaré, oficina…): la base los trae y aquí se ven todos, compactos.
const CODIGOS: [string, string][] = [["moneda", "Moneda"], ["tipo_credito", "Tipo"], ["producto", "Producto"], ["subproducto", "Subproducto"], ["pagare", "Pagaré"], ["normal_refinanciado", "Normal/refin."], ["estado_contable", "Estado contable"], ["modalidad", "Modalidad"], ["plazo", "Plazo"], ["oficina", "Oficina"]];
function CodigosCore({ cr, cliente }: { cr: any; cliente: any }) {
  const codigos = cr.codigos || {};
  const items = CODIGOS.filter(([k]) => codigos[k]).map(([k, etiqueta]) => `${etiqueta} ${codigos[k]}`);
  const cc = cliente.codigos || {};
  if (cc.sexo) items.push(`Sexo ${cc.sexo}`);
  if (cc.estado_civil) items.push(`Est. civil ${cc.estado_civil}`);
  if (!items.length) return null;
  return <p className="subtle" style={{ marginTop: 8 }} translate="no"><b style={{ fontWeight: 600 }}>Códigos del core:</b> {items.join(" · ")}</p>;
}

export function CreditoSeccion({ e }: { e: any }) {
  const cr = e.datos_credito || {};
  const apr = cr.nivel_aprobador || {};
  const historial: any[] = cr.historial || [];
  return (
    <>
      <Card>
        <p className="section-title">Crédito y participantes <Origen tipo="base" /></p>
        <Grid>
          <div>
            <InfoRow k="N.º de crédito" v={dash(cr.numero_credito || e.codigo_expediente)} />
            <InfoRow k="Producto / subproducto" v={dash([cr.producto, cr.subproducto].filter(Boolean).join(" / "))} />
            <InfoRow k="Tipo / modalidad / línea" v={dash([cr.tipo_credito_desc, cr.modalidad, cr.linea_credito].filter(Boolean).join(" · "))} />
            <InfoRow k="Monto desembolsado" v={`${e.moneda === "USD" ? "US$" : "S/"} ${n2(e.monto_desembolso)}` + (e.moneda === "USD" && cr.monto_desembolsado_soles != null ? ` (S/ ${n2(cr.monto_desembolsado_soles)}, T.C. ${n2(cr.tipo_cambio)})` : "")} />
            <InfoRow k="Saldo de capital" v={n2(cr.saldo_capital) + (e.moneda === "USD" && cr.saldo_capital_soles != null ? ` (S/ ${n2(cr.saldo_capital_soles)})` : "")} />
            <InfoRow k="Solicitud / días de gracia" v={`${dash(cr.solicitud)} / ${dash(cr.dias_gracia)}`} />
            <InfoRow k="Cuota" v={`${n2(cr.monto_cuota)} · ${dash(cr.plazo_cuotas)} cuotas`} />
            <InfoRow k="Destino" v={dash(cr.destino)} />
            <InfoRow k="Estado / condición contable" v={`${dash(cr.estado)} / ${dash(cr.condicion_contable)}`} />
          </div>
          <div>
            <InfoRow k="Asesor responsable" v={dash([cr.asesor_actual || e.asesor_responsable, cr.usuario_asesor_actual].filter(Boolean).join(" · "))} />
            <InfoRow k="Asesor de la solicitud" v={dash([cr.asesor_solicitud, cr.usuario_asesor_solicitud].filter(Boolean).join(" · "))} />
            <InfoRow k="Nivel aprobador" v={dash([apr.nombre, apr.cargo, apr.usuario].filter(Boolean).join(" - "))} />
            <InfoRow k="Cónyuge / aval / rep. legal" v={`${dash(cr.conyuge)}${cr.marca_conyuge && cr.marca_conyuge !== "NOCONYU" ? ` (${cr.marca_conyuge})` : ""} / ${dash(cr.aval)} / ${dash(cr.rep_legal)}`} />
            <InfoRow k="Vencimiento / último pago" v={`${fecha(cr.fecha_vencimiento)} / ${fecha(cr.fecha_ultimo_pago)}`} />
            <InfoRow k="Calificación SBS / entidades" v={`${dash(cr.calificacion_sbs)} / ${dash(cr.numero_entidades)}`} />
            <InfoRow k="Días de atraso / cuota más atrasada" v={`${dash(cr.dias_atraso)} / ${dash(cr.cuota_mas_atrasada)}`} />
          </div>
        </Grid>
        <CodigosCore cr={cr} cliente={e.datos_cliente || {}} />
      </Card>
      <Card>
        <p className="section-title">Historial crediticio <Origen tipo="base" /></p>
        {historial.length ? (
          <table className="compact">
            <thead>
              <tr>
                <th scope="col">Línea</th><th scope="col">Tipo</th><th scope="col">Desembolso</th><th scope="col" className="num">Monto</th><th scope="col">Solicitud</th><th scope="col">N.º de crédito</th>
                <th scope="col" className="num">Plazo</th><th scope="col" className="num">Cuota</th><th scope="col">Condición</th><th scope="col" className="num">Saldo</th><th scope="col">Asesor</th><th scope="col">Cuota más atrasada</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h, i) => (
                <tr key={i}>
                  <td>{dash(h.linea)}</td><td>{dash(h.tipo)}</td><td>{fecha(h.fecha_desembolso)}</td><td className="num">{n2(h.monto)}</td>
                  <td>{dash(h.solicitud)}</td><td>{dash(h.numero_credito)}</td><td className="num">{dash(h.plazo_cuotas)}</td><td className="num">{n2(h.cuota)}</td>
                  <td>{dash(h.condicion)}</td><td className="num">{n2(h.saldo)}</td><td>{dash(h.asesor)}</td><td>{dash(h.cuota_mas_atrasada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="subtle">La base no trae historial de créditos.</p>}
      </Card>
    </>
  );
}

const BALANCE: [string, string, boolean?][] = [
  ["Activo corriente", "activo_corriente", true], ["   Disponibles", "disponibles"], ["   Cuentas por cobrar", "cuentas_por_cobrar"], ["   Otras cuentas por cobrar", "otras_cuentas_por_cobrar"],
  ["   Adelanto a proveedores", "adelanto_proveedores"], ["   Existencias", "existencias"], ["Activo no corriente (activo fijo)", "activo_no_corriente", true], ["TOTAL ACTIVO", "total_activo", true],
  ["Pasivo corriente", "pasivo_corriente", true], ["   Proveedores", "proveedores"], ["   Otras cuentas por pagar", "otras_cuentas_por_pagar"], ["   Préstamos corto plazo", "prestamos_corto_plazo"],
  ["Pasivo no corriente", "pasivo_no_corriente", true], ["   Préstamos largo plazo", "prestamos_largo_plazo"], ["TOTAL PASIVO", "total_pasivo", true], ["PATRIMONIO", "patrimonio", true], ["TOTAL PASIVO + PATRIMONIO", "total_pasivo_patrimonio", true],
];
const RESULTADOS: [string, string, boolean?][] = [
  ["VENTAS NETAS", "ventas_netas", true], ["Costo de mercaderías / producción", "costo_ventas"], ["UTILIDAD BRUTA", "utilidad_bruta", true], ["Gastos operativos del negocio", "gastos_operativos"],
  ["UTILIDAD OPERATIVA", "utilidad_operativa", true], ["Obligaciones del negocio (cuotas)", "obligaciones_negocio"], ["UTILIDAD NETA DEL NEGOCIO", "utilidad_neta", true],
  ["Otros ingresos unidad económica familiar", "otros_ingresos_uef"], ["Obligaciones de la unidad familiar (cuotas)", "obligaciones_uef"], ["Gastos familiares", "gastos_familiares"],
  ["RESULTADO UNIDAD ECON. FAMILIAR", "resultado_uef", true], ["CAPACIDAD DE PAGO", "capacidad_pago", true], ["% del resultado U.E.F. aplicado", "porcentaje_capacidad"],
];

function Comparativo({ titulo, filas, bloque, reeval, anterior }: { titulo: string; filas: [string, string, boolean?][]; bloque: "balance" | "resultados"; reeval: any; anterior: any }) {
  return (
    <Card>
      <p className="section-title">{titulo} <Origen tipo="base" /></p>
      <table className="compact">
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            <th scope="col" className="num">Reevaluación<br /><span className="subtle">{reeval ? `${dash(reeval.numero_evaluacion)} · ${fecha(reeval.fecha)}` : "sin evaluación"}</span></th>
            <th scope="col" className="num">Anterior<br /><span className="subtle">{anterior ? `${dash(anterior.numero_evaluacion)} · ${fecha(anterior.fecha)}` : "sin evaluación"}</span></th>
            <th scope="col" className="num">Variación</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([etiqueta, clave, fuerte]) => (
            <tr key={clave} className={fuerte ? "strong" : undefined}>
              <td style={{ whiteSpace: "pre" }}>{etiqueta}</td>
              <td className="num">{n2(reeval?.[bloque]?.[clave])}</td>
              <td className="num">{n2(anterior?.[bloque]?.[clave])}</td>
              <td className="num subtle">{clave === "porcentaje_capacidad" ? "" : variacion(reeval?.[bloque]?.[clave], anterior?.[bloque]?.[clave])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Conformidad({ conformidad }: { conformidad: any }) {
  if (!conformidad) return null;
  const items: [string, string][] = [["ingresos", "Ingresos del negocio"], ["balance", "Balance general"], ["resultados", "Estado de resultados"]];
  return (
    <Card>
      <p className="section-title">Análisis y conformidad del auditor <Origen tipo="campo" /></p>
      {items.map(([clave, etiqueta]) => {
        const b = conformidad[clave];
        if (!b) return null;
        return <InfoRow key={clave} k={etiqueta} v={b.conforme ? <span className="tag campo">CONFORME</span> : <span><span className="tag aviso">OBSERVADO</span> {dash(b.comentario)}</span>} />;
      })}
    </Card>
  );
}

export function EvaluacionMype({ e, conformidad }: { e: any; conformidad?: any }) {
  const ev = e.evaluacion_financiera || {};
  const ingresos: any[] = ev.ingresos || [];
  const hay = ev.reevaluacion || ev.anterior;
  return (
    <>
      {!hay ? <div className="callout aviso">La base no trae evaluación financiera para este crédito.</div> : null}
      <Card>
        <p className="section-title">Ingresos del negocio <Origen tipo="base" /></p>
        {ingresos.length ? (
          <table className="compact">
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>Descripción</th><th scope="col" rowSpan={2} className="num">Frec./mes</th>
                <th scope="col" colSpan={2} className="num">Días buenos</th><th scope="col" colSpan={2} className="num">Días malos</th><th scope="col" colSpan={2} className="num">Días estándar</th>
                <th scope="col" rowSpan={2} className="num">P. compra</th><th scope="col" rowSpan={2} className="num">P. venta</th><th scope="col" rowSpan={2} className="num">Total mercad.</th>
                <th scope="col" rowSpan={2} className="num">Total compras</th><th scope="col" rowSpan={2} className="num">Total ventas</th><th scope="col" rowSpan={2} className="num">Cant. fin</th>
              </tr>
              <tr><th scope="col" className="num">Cant</th><th scope="col" className="num">Días</th><th scope="col" className="num">Cant</th><th scope="col" className="num">Días</th><th scope="col" className="num">Cant</th><th scope="col" className="num">Días</th></tr>
            </thead>
            <tbody>
              {ingresos.map((l, i) => (
                <tr key={i}>
                  <td>{dash(l.descripcion)}</td><td className="num">{n2(l.frecuencia)}</td>
                  <td className="num">{n2(l.dias_buenos?.cantidad)}</td><td className="num">{entero(l.dias_buenos?.dias)}</td>
                  <td className="num">{n2(l.dias_malos?.cantidad)}</td><td className="num">{entero(l.dias_malos?.dias)}</td>
                  <td className="num">{n2(l.dias_estandar?.cantidad)}</td><td className="num">{entero(l.dias_estandar?.dias)}</td>
                  <td className="num">{n2(l.precio_compra)}</td><td className="num">{n2(l.precio_venta)}</td>
                  <td className="num">{n2(l.total_mercaderias)}</td><td className="num">{n2(l.total_compras)}</td><td className="num">{n2(l.total_ventas)}</td><td className="num">{n2(l.cantidad_estandar_fin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="subtle">Sin ingresos registrados en la evaluación.</p>}
      </Card>
      {hay ? (
        <>
          <Comparativo titulo="Balance general (soles)" filas={BALANCE} bloque="balance" reeval={ev.reevaluacion} anterior={ev.anterior} />
          <Comparativo titulo="Estado de resultados (soles)" filas={RESULTADOS} bloque="resultados" reeval={ev.reevaluacion} anterior={ev.anterior} />
        </>
      ) : null}
      <Conformidad conformidad={conformidad} />
    </>
  );
}

export function IngresosConsumo({ e }: { e: any }) {
  const ingresos: any[] = e.evaluacion_financiera?.ingresos_consumo || [];
  // Si la base de Consumo trajo la evaluación tipo MYPE (ventas con días buenos y malos) y no las líneas de consumo, se muestra esa para no perder los datos (igual que la ficha Word).
  if (!ingresos.length && (e.evaluacion_financiera?.ingresos || []).length) return <EvaluacionMype e={e} />;
  return (
    <Card>
      <p className="section-title">Ingresos registrados en la evaluación <Origen tipo="base" /></p>
      {ingresos.length ? (
        <table className="compact">
          <thead><tr><th scope="col">Descripción</th><th scope="col">Relación</th><th scope="col">Moneda</th><th scope="col" className="num">Monto</th><th scope="col">Tipo de ingreso</th></tr></thead>
          <tbody>{ingresos.map((x, i) => <tr key={i}><td>{dash(x.descripcion)}</td><td>{dash(x.relacion)}</td><td>{dash(x.moneda)}</td><td className="num">{n2(x.monto)}</td><td>{dash(x.tipo_ingreso)}</td></tr>)}</tbody>
        </table>
      ) : <p className="subtle">Sin ingresos registrados.</p>}
    </Card>
  );
}

export function EndeudamientoSeccion({ e }: { e: any }) {
  const d = e.endeudamiento || {};
  const tabla = (lista: any[]) => (
    <table className="compact">
      <thead><tr><th scope="col">Entidad</th><th scope="col" className="num">Saldo S/</th><th scope="col">Calificación</th><th scope="col">Tipo de crédito</th></tr></thead>
      <tbody>{lista.map((x, i) => <tr key={i}><td>{dash(x.entidad)}</td><td className="num">{n2(x.saldo)}</td><td>{dash(x.calificacion)}</td><td>{dash(x.tipo_credito)}</td></tr>)}</tbody>
    </table>
  );
  const entidades: any[] = d.entidades || [];
  const conyuge: any[] = d.entidades_conyuge || [];
  return (
    <>
      <Card>
        <p className="section-title">Endeudamiento del cliente <Origen tipo="base" /></p>
        {d.fecha_corte ? <p className="subtle" style={{ marginBottom: 8 }}>Situación al {fecha(d.fecha_corte)}</p> : null}
        {entidades.length ? tabla(entidades) : <p className="subtle">La base no trae deudas en otras entidades.</p>}
      </Card>
      {conyuge.length ? <Card><p className="section-title">Endeudamiento del cónyuge <Origen tipo="base" /></p>{tabla(conyuge)}</Card> : null}
    </>
  );
}
