// El producto se llama siempre GeoMatrix. Lo que cambia de un cliente a otro es el nombre de la EMPRESA que lo contrata, y las pantallas lo muestran
// así: «GeoMatrix – <empresa>». La marca de una empresa personaliza su nombre, color y logo, nunca el nombre del producto.
export const PRODUCTO = "GeoMatrix";

export const tituloDe = (empresa?: string | null) => (empresa ? `${PRODUCTO} – ${empresa}` : PRODUCTO);
