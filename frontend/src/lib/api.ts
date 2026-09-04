const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("drishyam_token");
}

async function request(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof URLSearchParams)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    return request("/api/v2/auth/login", { method: "POST", body: form });
  },
  demoAccounts: () => request("/api/v2/auth/demo-accounts"),

  dashboardSummary: () => request("/api/v2/dashboard/summary"),

  networkGraph: (params: Record<string, string> = {}) =>
    request(`/api/v2/network/graph?${new URLSearchParams(params)}`),
  centrality: () => request("/api/v2/network/centrality"),
  communities: () => request("/api/v2/network/communities"),
  path: (source: string, target: string) =>
    request(`/api/v2/network/path?${new URLSearchParams({ source, target })}`),
  hiddenLinks: (source: string) =>
    request(`/api/v2/network/hidden-links?${new URLSearchParams({ source, max_hops: "6", min_hops: "3" })}`),
  anomalies: () => request("/api/v2/network/anomalies"),
  insights: () => request("/api/v2/network/insights"),

  entities: (entityType = "PERSON", q = "") =>
    request(`/api/v2/entities?${new URLSearchParams({ entity_type: entityType, q })}`),
  dossier: (id: string) => request(`/api/v2/entities/${id}`),

  cases: () => request("/api/v2/cases"),
  caseDetail: (id: string) => request(`/api/v2/cases/${id}`),
  caseNetwork: (id: string) => request(`/api/v2/cases/${id}/network`),

  alerts: () => request("/api/v2/alerts"),

  importFir: (text: string, caseId?: string) =>
    request("/api/v2/import/fir", { method: "POST", body: JSON.stringify({ text, case_id: caseId }) }),

  chat: (question: string) =>
    request("/api/v2/ai/chat", { method: "POST", body: JSON.stringify({ question }) }),

  generateReport: (entityId: string | undefined, reportType: string) =>
    request("/api/v2/reports/generate", { method: "POST", body: JSON.stringify({ entity_id: entityId, report_type: reportType }) }),

  auditLog: () => request("/api/v2/audit"),
};
