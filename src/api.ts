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
    headers: { "x-client-platform": "web", ...(token ? { Authorization: "Bearer " + token } : {}) },
  });
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  return response.blob();
}

export async function fetchEvidenceBlobUrl(idEvidencia: string) {
  const blob = await authenticatedBlob(`/api/visitas/evidencias/${idEvidencia}/archivo`);
  return URL.createObjectURL(blob);
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
