const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("ks_token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (payload: any) =>
    request<any>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<any>("/farmers/me"),
  advisory: (id: string) => request<any>(`/advisory/${id}`),
  weather: (district: string) => request<any>(`/weather/${encodeURIComponent(district)}`),
  market: (crop: string) => request<any>(`/market/${encodeURIComponent(crop)}`),
  risk: (id: string) => request<any>(`/risk/${id}`),
  alerts: () => request<any>("/officer/alerts"),
  farmer: (id: string) => request<any>(`/farmers/${id}`),
  intervention: (payload: any) =>
    request<any>("/officer/interventions", { method: "POST", body: JSON.stringify(payload) }),
  chat: (payload: any) =>
    request<any>("/chat", { method: "POST", body: JSON.stringify(payload) }),
  interventions: (id: string) => request<any>(`/officer/interventions/${id}`)
};
