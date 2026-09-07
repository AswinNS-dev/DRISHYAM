export interface LocationEvent {
  id: string;
  fir_number: string;
  case_id?: string | null;
  case_number?: string | null;
  case_title?: string | null;
  crime_type?: string | null;
  title: string;
  description: string;
  timestamp: string | null;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  entities?: { id: string; name: string; type: string }[];
}

export interface LinkedEntity {
  id: string;
  name: string;
  type: string;
  relationship?: string;
  confidence?: number;
}

export interface LocationRecord {
  id: string;
  name: string;
  district: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  fir_count: number;
  threat_score: number;
  risk_category: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  events: LocationEvent[];
  linked_entities: LinkedEntity[];
  recent_fir?: string | null;
  created_at?: string | null;
}

export interface HotspotLocationSummary {
  id: string;
  name: string;
  district?: string;
  fir_count: number;
  threat_score: number;
}

export interface Hotspot {
  id: string;
  rank: number;
  region: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  event_count: number;
  location_count: number;
  density_score: number;
  threat_score: number;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  location_ids: string[];
  locations?: HotspotLocationSummary[];
}

export interface LocationFilter {
  timeRange: "ALL" | "7D" | "30D" | "6M" | "1Y";
  state: string;
  district: string;
  eventType: string;
  severity: string;
  search: string;
}

export interface LocationSummary {
  totalEvents: number;
  activeLocations: number;
  hotspots: number;
  statesAffected: number;
  highestActivityRegion: string;
}

export interface RelatedCase {
  id: string;
  case_number: string;
  title: string;
  crime_type?: string | null;
  district?: string | null;
  status: string;
  opened_at?: string | null;
}

export interface LocationDossier {
  id: string;
  name: string;
  district: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  event_count: number;
  threat_score: number;
  risk_category: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  firs: LocationEvent[];
  event_timeline: LocationEvent[];
  related_cases: RelatedCase[];
  event_types: Record<string, number>;
  linked_entities: LinkedEntity[];
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
}

export interface LocationsApiResponse {
  locations: LocationRecord[];
  total_locations: number;
  hotspots: Hotspot[];
  filters_applied?: Record<string, string | null>;
}

export interface LocationDetailApiResponse {
  location: LocationDossier;
}
