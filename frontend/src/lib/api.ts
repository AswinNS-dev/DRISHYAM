import { useAuth } from "../store/auth";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("drishyam_token");
}

async function request(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof URLSearchParams) && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    useAuth.getState().logout("Your session has expired. Please sign in again.");
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("401 Unauthorized: Session expired");
  }
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
  dashboardIntelligence: (params: Record<string, string> = {}) =>
    request(`/api/v2/dashboard/intelligence?${new URLSearchParams(params)}`),

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
  globalSearch: (q: string) =>
    request(`/api/v2/entities/global-search?${new URLSearchParams({ q })}`),
  dossier: (id: string) => request(`/api/v2/entities/${id}`),

  cases: () => request("/api/v2/cases"),
  caseDetail: (id: string) => request(`/api/v2/cases/${id}`),
  caseNetwork: (id: string) => request(`/api/v2/cases/${id}/network`),

  // FIRs
  firs: (q = "", caseId = "") => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (caseId) params.case_id = caseId;
    return request(`/api/v2/firs?${new URLSearchParams(params)}`);
  },
  firDetail: (id: string) => request(`/api/v2/firs/${id}`),
  createFir: (payload: { fir_number: string; narrative_text: string; case_id?: string; location_name?: string; district?: string }) =>
    request("/api/v2/firs", { method: "POST", body: JSON.stringify(payload) }),

  // Intelligence
  intelligenceLeads: () => request("/api/v2/intelligence/leads"),
  intelligenceReports: () => request("/api/v2/intelligence/reports"),
  intelligenceReportDetail: (id: string) => request(`/api/v2/intelligence/reports/${id}`),
  intelligenceHiddenLinks: () => request("/api/v2/intelligence/hidden-links"),

  // Timeline
  timeline: (params: {
    entity_id?: string;
    case_id?: string;
    event_type?: string;
    from_date?: string;
    to_date?: string;
    anchor_date?: string;
    window_days?: number;
    limit?: number;
  } = {}) => {
    const q: Record<string, string> = {};
    if (params.entity_id) q.entity_id = params.entity_id;
    if (params.case_id) q.case_id = params.case_id;
    if (params.event_type) q.event_type = params.event_type;
    if (params.from_date) q.from_date = params.from_date;
    if (params.to_date) q.to_date = params.to_date;
    if (params.anchor_date) q.anchor_date = params.anchor_date;
    if (params.window_days !== undefined && params.window_days !== null) q.window_days = params.window_days.toString();
    if (params.limit) q.limit = params.limit.toString();
    return request(`/api/v2/timeline?${new URLSearchParams(q)}`);
  },

  // Locations / Map
  locations: () => request("/api/v2/locations"),
  locationDetail: (id: string) => request(`/api/v2/locations/${id}`),

  // Admin
  adminUsers: () => request("/api/v2/admin/users"),
  createAdminUser: (payload: any) => request("/api/v2/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminRole: (userId: string, role: string) =>
    request(`/api/v2/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  adminTelemetry: () => request("/api/v2/admin/system"),
  adminAudit: () => request("/api/v2/admin/audit"),

  // Settings
  settings: () => request("/api/v2/settings"),
  updateSettings: (payload: any) => request("/api/v2/settings", { method: "POST", body: JSON.stringify(payload) }),

  alerts: () => request("/api/v2/alerts"),

  importFir: (text: string, caseId?: string) =>
    request("/api/v2/import/fir", { method: "POST", body: JSON.stringify({ text, case_id: caseId }) }),

  chat: (question: string) =>
    request("/api/v2/ai/chat", { method: "POST", body: JSON.stringify({ question }) }),

  generateReport: (entityId: string | undefined, reportType: string) =>
    request("/api/v2/reports/generate", { method: "POST", body: JSON.stringify({ entity_id: entityId, report_type: reportType }) }),

  // Evidence & Tamper-Evident Ledger
  evidence: (paramsOrCaseId?: string | { case_id?: string; q?: string; evidence_type?: string; status?: string; page?: number; page_size?: number }) => {
    if (typeof paramsOrCaseId === "string") {
      return request(paramsOrCaseId ? `/api/v2/evidence?case_id=${encodeURIComponent(paramsOrCaseId)}` : "/api/v2/evidence");
    }
    const p: Record<string, string> = {};
    if (paramsOrCaseId?.case_id) p.case_id = paramsOrCaseId.case_id;
    if (paramsOrCaseId?.q) p.q = paramsOrCaseId.q;
    if (paramsOrCaseId?.evidence_type && paramsOrCaseId.evidence_type !== "ALL") p.evidence_type = paramsOrCaseId.evidence_type;
    if (paramsOrCaseId?.status && paramsOrCaseId.status !== "ALL") p.status = paramsOrCaseId.status;
    if (paramsOrCaseId?.page) p.page = paramsOrCaseId.page.toString();
    if (paramsOrCaseId?.page_size) p.page_size = paramsOrCaseId.page_size.toString();
    const qs = new URLSearchParams(p).toString();
    return request(qs ? `/api/v2/evidence?${qs}` : "/api/v2/evidence");
  },
  verifyEvidence: (evidenceId: string, simulateTamper = false) =>
    request(`/api/v2/evidence/${evidenceId}/verify${simulateTamper ? "?simulate_tamper=true" : ""}`, { method: "POST" }),
  registerEvidence: (payload: any) =>
    request("/api/v2/evidence", { method: "POST", body: JSON.stringify(payload) }),
  uploadEvidenceFile: (formData: FormData) =>
    request("/api/v2/evidence/upload", { method: "POST", body: formData }),
  evidenceLedger: () =>
    request("/api/v2/evidence/ledger"),
  tamperTestEvidence: (evidenceId: string, enableTamper = true) =>
    request(`/api/v2/evidence/${evidenceId}/tamper-test?enable_tamper=${enableTamper}`, { method: "POST" }),

  // Analysis: Communications & Transactions
  communications: (params: {
    entity_id?: string;
    case_id?: string;
    q?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  } = {}) => {
    const q: Record<string, string> = {};
    if (params.entity_id) q.entity_id = params.entity_id;
    if (params.case_id) q.case_id = params.case_id;
    if (params.q) q.q = params.q;
    if (params.from_date) q.from_date = params.from_date;
    if (params.to_date) q.to_date = params.to_date;
    if (params.limit) q.limit = params.limit.toString();
    return request(`/api/v2/analysis/communications?${new URLSearchParams(q)}`);
  },
  transactions: (params: {
    entity_id?: string;
    case_id?: string;
    q?: string;
    from_date?: string;
    to_date?: string;
    min_amount?: number;
    limit?: number;
  } = {}) => {
    const q: Record<string, string> = {};
    if (params.entity_id) q.entity_id = params.entity_id;
    if (params.case_id) q.case_id = params.case_id;
    if (params.q) q.q = params.q;
    if (params.from_date) q.from_date = params.from_date;
    if (params.to_date) q.to_date = params.to_date;
    if (params.min_amount) q.min_amount = params.min_amount.toString();
    if (params.limit) q.limit = params.limit.toString();
    return request(`/api/v2/analysis/transactions?${new URLSearchParams(q)}`);
  },

  auditLog: () => request("/api/v2/audit"),
};
