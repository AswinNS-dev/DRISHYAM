export interface DatasetSummary {
  total_datasets: number;
  total_records: number;
  processing: number;
  requires_review: number;
}

export interface DatasetItem {
  id: string;
  name: string;
  filename: string | null;
  job_type: string;
  record_count: number;
  status: string;
  validation_status: string;
  entities_extracted: number;
  relationships_created: number;
  created_at: string | null;
  case_id: string | null;
  case_number: string | null;
  case_title: string | null;
  fir_id: string | null;
}

export interface ValidationReport {
  total_records: number;
  valid_records: number;
  duplicate_records: number;
  invalid_records: number;
  missing_fields: number;
  status: "VALIDATED" | "WARNINGS" | "FAILED" | "VALIDATING";
}

export interface PipelineStep {
  step: "IMPORT" | "VALIDATE" | "EXTRACT_ENTITIES" | "RESOLVE_ENTITIES" | "READY_FOR_ANALYSIS";
  name: string;
  status: "completed" | "processing" | "review_required" | "pending" | "ready" | "failed";
  timestamp?: string | null;
  count?: number;
}

export interface ExtractedEntity {
  id?: string;
  text: string;
  type: string;
  confidence: number;
  rule?: string;
  model?: string;
  span?: [number, number];
}

export interface EntityMatchCandidate {
  id?: string;
  candidate_id: string;
  candidate_name: string;
  score: number;
  status: "CONFIRMED" | "PROBABLE" | "POSSIBLE" | "UNRESOLVED" | "REJECTED";
  method?: string;
  supporting_evidence: string[];
  review_required: boolean;
  reviewed_by?: string | null;
}

export interface DatasetDetail {
  dataset: DatasetItem & {
    case?: {
      id: string;
      case_number: string;
      title: string;
      district?: string;
      status?: string;
    } | null;
  };
  validation: ValidationReport;
  pipeline: PipelineStep[];
  entity_groups: Record<string, number>;
  extracted_entities: ExtractedEntity[];
  potential_matches: EntityMatchCandidate[];
}

export interface PreviewData {
  columns: string[];
  rows: Record<string, any>[];
  total_records: number;
  page: number;
  page_size: number;
  narrative?: string;
}

export interface CaseOption {
  id: string;
  case_number: string;
  title: string;
  status: string;
  district?: string;
}
