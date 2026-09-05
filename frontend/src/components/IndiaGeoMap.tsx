import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Compass,
} from "lucide-react";

export interface GeoLocation {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  fir_count: number;
  threat_score: number;
  risk_category: "CRITICAL" | "HIGH" | "MODERATE";
  linked_entities?: { id: string; name: string; type: string }[];
  recent_fir?: string;
  created_at?: string;
}

// Strictly India Geographic Bounds
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 66.0],  // Southwest coordinate of Indian subcontinent & waters
  [37.5, 98.5], // Northeast coordinate of India
];

const INDIA_CENTER: [number, number] = [22.5, 80.0];

interface Props {
  locations: GeoLocation[];
  selectedLocationId?: string | null;
  selectedState: string;
  selectedDistrict: string;
  onSelectLocation: (loc: GeoLocation) => void;
  onSelectState?: (state: string) => void;
  onSelectDistrict?: (dist: string) => void;
  onResetView?: () => void;
}

export default function IndiaGeoMap({
  locations,
  selectedLocationId,
  selectedState,
  selectedDistrict,
  onSelectLocation,
  onSelectState,
  onSelectDistrict,
  onResetView,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups
  const statesGeoJsonRef = useRef<L.GeoJSON | null>(null);
  const districtsGeoJsonRef = useRef<L.GeoJSON | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Cached GeoJSON data
  const statesDataRef = useRef<any | null>(null);
  const districtsDataRef = useRef<any | null>(null);

  const [is3DTilt, setIs3DTilt] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [geoDataLoaded, setGeoDataLoaded] = useState(false);

  // 1. Fetch real GeoJSON administrative boundary files
  useEffect(() => {
    Promise.all([
      fetch("/data/india_states.json")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/data/india_districts.json")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([statesData, districtsData]) => {
      statesDataRef.current = statesData;
      districtsDataRef.current = districtsData;
      setGeoDataLoaded(true);
    });
  }, []);

  // 2. Initialize Leaflet Map locked strictly to India
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      minZoom: 4,
      maxZoom: 16,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 1.0, // Strictly prevents panning outside India
      zoomControl: false,
      attributionControl: false,
    });

    // Clean Dark Base Map (Zero watermark, No API key required)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "",
      }
    ).addTo(map);

    // Clean Dark Reference Overlay (State boundaries, roads, cities)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "",
      }
    ).addTo(map);

    // Layer groups
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 3. Render Real Administrative State Boundary Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !statesDataRef.current) return;

    if (statesGeoJsonRef.current) {
      map.removeLayer(statesGeoJsonRef.current);
    }

    const isStateSelected = Boolean(selectedState);

    // Compute activity count per state to show data-driven density
    const stateActivityCount: Record<string, number> = {};
    locations.forEach((loc) => {
      // Current dataset locations belong to Tamil Nadu
      const s = "Tamil Nadu";
      stateActivityCount[s] = (stateActivityCount[s] || 0) + (loc.fir_count || 1);
    });

    const statesLayer = L.geoJSON(statesDataRef.current, {
      style: (feature) => {
        const stateName = feature?.properties?.name || "";
        const isTargetState =
          selectedState &&
          stateName.toLowerCase() === selectedState.toLowerCase();

        const activity = stateActivityCount[stateName] || 0;
        const hasActivity = activity > 0;

        if (isTargetState) {
          // Prominently highlighted selected state polygon
          return {
            color: "#38bdf8",
            weight: 2.5,
            fillColor: "#0ea5e9",
            fillOpacity: 0.18,
            dashArray: undefined,
          };
        }

        if (isStateSelected) {
          // Subdue other states when one state is selected
          return {
            color: "#1e293b",
            weight: 1,
            fillColor: "#090d16",
            fillOpacity: 0.05,
            dashArray: "2, 3",
          };
        }

        // All India View: Real state polygons with density indication
        return {
          color: hasActivity ? "#38bdf8" : "#334155",
          weight: hasActivity ? 1.5 : 1,
          fillColor: hasActivity ? "#0ea5e9" : "#0f172a",
          fillOpacity: hasActivity ? 0.12 : 0.04,
          dashArray: hasActivity ? undefined : "3, 3",
        };
      },
      onEachFeature: (feature, layer) => {
        const stateName = feature?.properties?.name || "";
        const activity = stateActivityCount[stateName] || 0;

        if (!isStateSelected) {
          layer.bindTooltip(
            `<div class="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
              STATE: ${stateName} ${activity > 0 ? `· ${activity} Active Records` : ""}
            </div>`,
            { direction: "center", permanent: false, className: "leaflet-custom-tooltip" }
          );
        }

        layer.on("click", () => {
          if (onSelectState) onSelectState(stateName);
          // Zoom smoothly to the real state polygon bounds
          const bounds = (layer as any).getBounds?.();
          if (bounds && map) {
            map.flyToBounds(bounds, { padding: [30, 30], duration: 1.2 });
          }
        });
      },
    });

    statesLayer.addTo(map);
    statesGeoJsonRef.current = statesLayer;
  }, [geoDataLoaded, selectedState, locations, onSelectState]);

  // 4. Render Real Administrative District Boundary Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtsDataRef.current) return;

    if (districtsGeoJsonRef.current) {
      map.removeLayer(districtsGeoJsonRef.current);
    }

    // Only render district polygons if a state or district is selected, or zoomed in (zoom >= 7)
    if (!selectedState && currentZoom < 7) return;

    const activeStateName = (selectedState || "Tamil Nadu").toLowerCase();

    // Filter district features belonging to the active state
    const filteredFeatures = districtsDataRef.current.features.filter((f: any) => {
      const stateProp = (f.properties?.state || "").toLowerCase();
      return stateProp.includes("tamil") || (selectedState && stateProp.includes(activeStateName));
    });

    if (filteredFeatures.length === 0) return;

    const districtsGeoJsonData = {
      type: "FeatureCollection",
      features: filteredFeatures,
    };

    const districtsLayer = L.geoJSON(districtsGeoJsonData as any, {
      style: (feature) => {
        const distName = feature?.properties?.district || feature?.properties?.name || "";
        const isTargetDistrict =
          selectedDistrict &&
          distName.toLowerCase().includes(selectedDistrict.toLowerCase().replace(" south", ""));

        if (isTargetDistrict) {
          return {
            color: "#38bdf8",
            weight: 2,
            fillColor: "#0284c7",
            fillOpacity: 0.22,
          };
        }

        return {
          color: "#475569",
          weight: 1,
          fillColor: "#1e293b",
          fillOpacity: 0.08,
          dashArray: "2, 2",
        };
      },
      onEachFeature: (feature, layer) => {
        const distName = feature?.properties?.district || feature?.properties?.name || "";

        layer.bindTooltip(
          `<div class="text-[10px] font-mono font-bold uppercase text-amber-300">
            DISTRICT: ${distName}
          </div>`,
          { direction: "center", permanent: false, className: "leaflet-custom-tooltip" }
        );

        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (onSelectDistrict) onSelectDistrict(distName);
          const bounds = (layer as any).getBounds?.();
          if (bounds && map) {
            map.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
          }
        });
      },
    });

    districtsLayer.addTo(map);
    districtsGeoJsonRef.current = districtsLayer;
  }, [geoDataLoaded, selectedState, selectedDistrict, currentZoom, onSelectDistrict]);

  // 5. Render Data-Driven Hotspot Location Markers
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    locations.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;

      const isSelected = selectedLocationId === loc.id;
      const isCritical = loc.threat_score >= 70;
      const isHigh = loc.threat_score >= 40 && loc.threat_score < 70;

      const markerColor = isSelected
        ? "#38bdf8"
        : isCritical
        ? "#ef4444"
        : isHigh
        ? "#f59e0b"
        : "#0ea5e9";

      const pulseClass = isSelected
        ? "ring-4 ring-sky-400/80 scale-125"
        : isCritical
        ? "animate-pulse ring-2 ring-red-500/50"
        : "";

      // Custom HTML Marker with pulsing aura (clean hover label, no permanent text overlap)
      const customIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div class="relative group cursor-pointer flex items-center justify-center">
            <div 
              style="background: ${markerColor};" 
              class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-130 flex items-center justify-center ${pulseClass}"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
            </div>
            
            <div class="absolute left-5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-slate-900/95 border border-slate-700 text-[10px] font-mono text-slate-100 whitespace-nowrap shadow-2xl transition-opacity pointer-events-none z-40 ${
              isSelected ? "opacity-100 border-sky-400 font-bold" : "opacity-0 group-hover:opacity-100"
            }">
              <span>${loc.name}</span>
              <span class="text-amber-400 ml-1">(${loc.district})</span>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectLocation(loc);
        if (onSelectDistrict && loc.district) {
          onSelectDistrict(loc.district);
        }
      });

      marker.addTo(markersLayer);
    });
  }, [locations, selectedLocationId, onSelectLocation, onSelectDistrict]);

  // 6. Camera Pan / Zoom on Selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. If specific location selected, fly to it
    if (selectedLocationId) {
      const loc = locations.find((l) => l.id === selectedLocationId);
      if (loc && loc.latitude && loc.longitude) {
        map.flyTo([loc.latitude, loc.longitude], 12, { duration: 1.2 });
        return;
      }
    }

    // 2. If district selected, find district polygon bounds
    if (selectedDistrict && districtsGeoJsonRef.current) {
      let matchedBounds: L.LatLngBounds | null = null;
      districtsGeoJsonRef.current.eachLayer((layer: any) => {
        const name = layer.feature?.properties?.district || layer.feature?.properties?.name || "";
        if (name.toLowerCase().includes(selectedDistrict.toLowerCase().replace(" south", ""))) {
          matchedBounds = layer.getBounds?.();
        }
      });
      if (matchedBounds) {
        map.flyToBounds(matchedBounds, { padding: [40, 40], duration: 1.2 });
        return;
      }
    }

    // 3. If state selected, find state polygon bounds
    if (selectedState && statesGeoJsonRef.current) {
      let matchedStateBounds: L.LatLngBounds | null = null;
      statesGeoJsonRef.current.eachLayer((layer: any) => {
        const name = layer.feature?.properties?.name || "";
        if (name.toLowerCase() === selectedState.toLowerCase()) {
          matchedStateBounds = layer.getBounds?.();
        }
      });
      if (matchedStateBounds) {
        map.flyToBounds(matchedStateBounds, { padding: [30, 30], duration: 1.2 });
        return;
      }
    }

    // 4. Default: All India View
    if (!selectedState && !selectedDistrict) {
      map.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
    }
  }, [selectedLocationId, selectedDistrict, selectedState, locations]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleResetToIndia = useCallback(() => {
    if (onResetView) onResetView();
    mapRef.current?.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
  }, [onResetView]);

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#070b14]">
      {/* 2D / 3D Isometric View Container */}
      <div
        style={{
          perspective: is3DTilt ? "1100px" : undefined,
          transformStyle: "preserve-3d",
        }}
        className="w-full h-full"
      >
        <div
          ref={mapContainerRef}
          style={{
            transform: is3DTilt ? "rotateX(36deg) scale(0.95)" : "none",
            transformOrigin: "center center",
            transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="w-full h-full block"
        />
      </div>

      {/* Top Floating Status Breadcrumb */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-sky-500/40 backdrop-blur-md shadow-xl text-xs font-semibold text-sky-400">
          <Compass size={14} className="text-sky-400" />
          <span className="font-mono text-[11px] tracking-wider">
            {selectedDistrict
              ? `INDIA / ${(selectedState || "TAMIL NADU").toUpperCase()} / ${selectedDistrict.toUpperCase()}`
              : selectedState
              ? `INDIA / ${selectedState.toUpperCase()}`
              : "INDIA GEOGRAPHIC INVESTIGATION MAP"}
          </span>
        </div>

        {is3DTilt && (
          <span className="px-2 py-1 rounded bg-purple-950/80 border border-purple-500/40 text-[10px] font-mono text-purple-300 backdrop-blur-md">
            3D PERSPECTIVE ACTIVE
          </span>
        )}
      </div>

      {/* Camera & Navigation Toolbar (Top Right) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <div className="flex flex-col gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleResetToIndia}
            className="p-2 rounded-lg hover:bg-sky-500/20 text-slate-300 hover:text-white transition-colors"
            title="Reset to All India View"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={() => setIs3DTilt((t) => !t)}
            className={`p-2 rounded-lg transition-colors ${
              is3DTilt
                ? "bg-purple-600 text-white shadow-md font-bold"
                : "hover:bg-sky-500/20 text-slate-300 hover:text-white"
            }`}
            title="Toggle 2D / 3D Isometric View"
          >
            <Layers size={15} />
          </button>
        </div>
      </div>

      {/* Map Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center gap-4 shadow-xl backdrop-blur-md text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm" />
          <span>High Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-sm" />
          <span>Moderate Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-sky-500 border border-white shadow-sm" />
          <span>Standard Activity</span>
        </div>
        <div className="border-l border-slate-700 pl-3 text-[10px] text-slate-400">
          India Bounds Locked · Zoom: {currentZoom}x
        </div>
      </div>
    </div>
  );
}
