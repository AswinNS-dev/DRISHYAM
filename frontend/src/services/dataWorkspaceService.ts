import { useAuth } from "../store/auth";
import type {
  DatasetSummary,
  DatasetItem,
  DatasetDetail,
  PreviewData,
  CaseOption
} from "../types/dataWorkspace";

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("drishyam_token");
}

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !(opts.body instanceof URLSearchParams)) {
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
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.detail) msg = parsed.detail;
    } catch {
      // keep raw text
    }
    throw new Error(msg);
  }
  return res.json();
}

export const dataWorkspaceService = {
  async getDatasets(params: {
    q?: string;
    status?: string;
    job_type?: string;
    case_id?: string;
  } = {}): Promise<{ summary: DatasetSummary; datasets: DatasetItem[] }> {
    const qParams = new URLSearchParams();
    if (params.q) qParams.set("q", params.q);
    if (params.status && params.status !== "ALL") qParams.set("status", params.status);
    if (params.job_type && params.job_type !== "ALL") qParams.set("job_type", params.job_type);
    if (params.case_id && params.case_id !== "ALL") qParams.set("case_id", params.case_id);

    const qs = qParams.toString();
    return request(`/api/v2/import/datasets${qs ? `?${qs}` : ""}`);
  },

  async getDatasetDetail(id: string): Promise<DatasetDetail> {
    return request(`/api/v2/import/datasets/${encodeURIComponent(id)}`);
  },

  async getDatasetPreview(
    id: string,
    page: number = 1,
    pageSize: number = 15
  ): Promise<PreviewData> {
    return request(
      `/api/v2/import/datasets/${encodeURIComponent(id)}/preview?page=${page}&page_size=${pageSize}`
    );
  },

  async uploadDataset(payload: {
    dataset_name?: string;
    job_type: string;
    case_id?: string;
    content: string;
    file_name?: string;
    file_size_bytes?: number;
  }): Promise<any> {
    return request("/api/v2/import/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async importFirText(text: string, caseId?: string): Promise<any> {
    return request("/api/v2/import/fir", {
      method: "POST",
      body: JSON.stringify({ text, case_id: caseId }),
    });
  },

  async getCases(): Promise<CaseOption[]> {
    const res = await request<{ cases: CaseOption[] }>("/api/v2/cases");
    return res.cases || [];
  },
};
