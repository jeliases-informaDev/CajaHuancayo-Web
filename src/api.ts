const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4100").replace(/\/$/, "");
const TOKEN_KEY = "ch_web_token";

export class ApiError extends Error {
  status: number; data: any;
  constructor(status: number, data: any) {
    super(data?.error || "No se pudo completar la solicitud");
    this.status = status; this.data = data;
  }
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
// Empresa elegida por el administrador universal de Sulotec (los usuarios de empresa no la necesitan: el servidor la toma de su cuenta).
const EMPRESA_KEY = "ch_empresa";
export function getEmpresaElegida() { try { return localStorage.getItem(EMPRESA_KEY); } catch { return null; } }
export function setEmpresaElegida(id: string | null) { try { if (id) localStorage.setItem(EMPRESA_KEY, id); else localStorage.removeItem(EMPRESA_KEY); } catch { /* sin almacenamiento */ } }
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-client-platform": "web",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(getEmpresaElegida() ? { "x-empresa-id": getEmpresaElegida() as string } : {}),
      ...(options.headers || {}),
    },
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

// Las fotos y el Word export requieren el token Bearer, que un <img src> o un
// <a href> normal no puede enviar. Se piden con fetch autenticado y se sirven
// como blob URL en el navegador.
async function authenticatedBlob(path: string): Promise<Blob> {
  const token = getToken();
  const response = await fetch(API_URL + path, {
    headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}), ...(getEmpresaElegida() ? { "x-empresa-id": getEmpresaElegida() as string } : {}) },
  });
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  return response.blob();
}

export async function fetchEvidenceBlobUrl(idEvidencia: string) {
  const blob = await authenticatedBlob(`/api/visitas/evidencias/${idEvidencia}/archivo`);
  return URL.createObjectURL(blob);
}

// Descarga autenticada de un archivo cualquiera de la API (plantillas de Excel, etc.).
export async function descargarArchivo(path: string, filename: string) {
  const blob = await authenticatedBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadWordExport(idVisita: number, filename: string) {
  const blob = await authenticatedBlob(`/api/reportes/visita/${idVisita}/word`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

export { API_URL };
