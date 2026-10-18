// Color de la marca de la empresa aplicado al panel: de un #RRGGBB se derivan las variantes que usa la paleta (hover, suave, tinta y
// anillo de foco) y se escriben como variables CSS en <html>. Sin color (o sin empresa) se vuelve a la paleta de la plantilla.
const VARIABLES = ["--brand", "--brand-hover", "--brand-soft", "--brand-ink", "--ring"];
const rgbDe = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mezclar = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export function aplicarColorMarca(color?: string | null) {
  const root = document.documentElement;
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) { VARIABLES.forEach((v) => root.style.removeProperty(v)); return; }
  const base = rgbDe(color);
  const oscuro = root.dataset.theme === "dark";
  root.style.setProperty("--brand", color);
  root.style.setProperty("--brand-hover", css(mezclar(base, oscuro ? [255, 255, 255] : [0, 0, 0], 0.18)));
  root.style.setProperty("--brand-soft", oscuro ? `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.18)` : css(mezclar(base, [255, 255, 255], 0.88)));
  root.style.setProperty("--brand-ink", css(mezclar(base, oscuro ? [255, 255, 255] : [0, 0, 0], oscuro ? 0.55 : 0.4)));
  root.style.setProperty("--ring", `0 0 0 3px rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.28)`);
}
