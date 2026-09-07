import { api } from "../lib/api";
import type {
  LocationsApiResponse,
  LocationDetailApiResponse,
  Hotspot,
} from "../types/location";

export const locationService = {
  async getLocations(params: Record<string, string> = {}): Promise<LocationsApiResponse> {
    return api.locations(params);
  },

  async getLocationDetail(id: string): Promise<LocationDetailApiResponse> {
    return api.locationDetail(id);
  },

  async getHotspots(params: Record<string, string> = {}): Promise<{ hotspots: Hotspot[]; total_hotspots: number }> {
    return api.locationHotspots(params);
  },
};
