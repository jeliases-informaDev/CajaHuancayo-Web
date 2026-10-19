// Coordenadas escritas por una persona: "lat, lng", enlaces de Google Maps, "geo:" y grados con hemisferio.

export type Coordenadas = { latitud: number; longitud: number };

// Si la pareja vino al revés (lng, lat) y así sí cae en el Perú, se corrige.
function validar(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const enPeru = (a: number, b: number) => a <= 0.5 && a >= -18.5 && b <= -68 && b >= -81.5;
  if (enPeru(lat, lng)) return { latitud: lat, longitud: lng };
  if (enPeru(lng, lat)) return { latitud: lng, longitud: lat };
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { latitud: lat, longitud: lng };
  return null;
}

// Acepta "lat, lng", "lat lng", enlaces de Google Maps (@lat,lng · q=lat,lng · !3dlat!4dlng), "geo:lat,lng" y grados con hemisferio (12.06 S 75.20 W).
export function interpretarCoordenadas(texto: string): Coordenadas | null {
  const t = texto.trim();
  if (!t) return null;
  let m =
    t.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
    t.match(/[?&](?:q|query|ll|center|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i) ||
    t.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ||
    t.match(/^geo:(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (!m) {
    const h = t.match(/^(\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])[\s,]+(\d{1,3}(?:\.\d+)?)\s*°?\s*([EOW])$/i);
    if (h) return validar(Number(h[1]) * (h[2].toUpperCase() === "S" ? -1 : 1), Number(h[3]) * (h[4].toUpperCase() === "E" ? 1 : -1));
    m = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  }
  if (!m) return null;
  return validar(Number(m[1]), Number(m[2]));
}
