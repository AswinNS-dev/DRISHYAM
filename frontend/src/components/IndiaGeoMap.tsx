import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Compass,
  Flame,
  Radio,
} from "lucide-react";
import type { LocationRecord, Hotspot } from "../types/location";

export type GeoLocation = LocationRecord;

// Strictly India Geographic Bounds
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 66.0],  // Southwest coordinate of Indian subcontinent & waters
  [37.5, 98.5], // Northeast coordinate of India
];

const INDIA_CENTER: [number, number] = [22.5, 80.0];

interface Props {
  locations: LocationRecord[];
  hotspots?: Hotspot[];
  selectedLocationId?: string | null;
  selectedHotspotId?: string | null;
  selectedState: string;
  selectedDistrict: string;
  onSelectLocation: (loc: LocationRecord) => void;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  onSelectState?: (state: string) => void;
  onSelectDistrict?: (dist: string) => void;
  onResetView?: () => void;
}

export default function IndiaGeoMap({
  locations,
  hotspots = [],
  selectedLocationId,
  selectedHotspotId,
  selectedState,
  selectedDistrict,
  onSelectLocation,
  onSelectHotspot,
  onSelectState,
  onSelectDistrict,
  onResetView,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups
  const statesGeoJsonRef = useRef<L.GeoJSON | null>(null);
  const districtsGeoJsonRef = useRef<L.GeoJSON | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Cached GeoJSON administrative data
  const statesDataRef = useRef<any | null>(null);
  const districtsDataRef = useRef<any | null>(null);

  const [is3DTilt, setIs3DTilt] = useState(false);
  const [showHotspotsLayer, setShowHotspotsLayer] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [geoDataLoaded, setGeoDataLoaded] = useState(false);

  // Filter out records with invalid or missing geographic coordinates
  const validLocations = useMemo(() => {
    return locations.filter(
      (loc) =>
        loc.latitude != null &&
        loc.longitude != null &&
        !isNaN(loc.latitude) &&
        !isNaN(loc.longitude)
    );
  }, [locations]);

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

  // 2. Initialize Leaflet Map strictly bounded to India
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

    // Clean Dark Base Map
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "",
      }
    ).addTo(map);

    // Dark Reference Overlay (State boundaries, roads, labels)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "",
      }
    ).addTo(map);

    // Layer groups for hotspots and markers
    const hotspotsLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = hotspotsLayer;
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

    // Compute activity count per state from actual filtered locations
    const stateActivityCount: Record<string, number> = {};
    validLocations.forEach((loc) => {
      const s = loc.state || "Tamil Nadu";
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
          return {
            color: "#38bdf8",
            weight: 2.5,
            fillColor: "#0ea5e9",
            fillOpacity: 0.18,
            dashArray: undefined,
          };
        }

        if (isStateSelected) {
          return {
            color: "#1e293b",
            weight: 1,
            fillColor: "#090d16",
            fillOpacity: 0.05,
            dashArray: "2, 3",
          };
        }

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
          const bounds = (layer as any).getBounds?.();
          if (bounds && map) {
            map.flyToBounds(bounds, { padding: [30, 30], duration: 1.2 });
          }
        });
      },
    });

    statesLayer.addTo(map);
    statesGeoJsonRef.current = statesLayer;
  }, [geoDataLoaded, selectedState, validLocations, onSelectState]);

  // 4. Render Real Administrative District Boundary Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtsDataRef.current) return;

    if (districtsGeoJsonRef.current) {
      map.removeLayer(districtsGeoJsonRef.current);
    }

    if (!selectedState && currentZoom < 7) return;

    const activeStateName = (selectedState || "Tamil Nadu").toLowerCase();

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

  // 5. Render Hotspot Clusters (Density Aura Rings)
  useEffect(() => {
    const map = mapRef.current;
    const hotspotsLayer = hotspotsLayerRef.current;
    if (!map || !hotspotsLayer) return;

    hotspotsLayer.clearLayers();
    if (!showHotspotsLayer) return;

    hotspots.forEach((spot) => {
      if (spot.latitude == null || spot.longitude == null) return;

      const isSelected = selectedHotspotId === spot.id;
      const isCritical = spot.severity === "CRITICAL";
      const isHigh = spot.severity === "HIGH";

      const color = isCritical
        ? "#ef4444"
        : isHigh
        ? "#f59e0b"
        : spot.severity === "MODERATE"
        ? "#0ea5e9"
        : "#10b981";

      const radiusMeters = Math.max(16000, Math.min(32000, spot.event_count * 2000 + spot.location_count * 1500));

      const circle = L.circle([spot.latitude, spot.longitude], {
        radius: radiusMeters,
        color: isSelected ? "#38bdf8" : color,
        weight: isSelected ? 2.5 : 1.5,
        fillColor: color,
        fillOpacity: isSelected ? 0.28 : isCritical ? 0.20 : 0.12,
        dashArray: isSelected ? undefined : "4, 4",
      });

      circle.bindTooltip(
        `<div class="text-[10px] font-mono space-y-0.5">
          <div class="font-bold text-sky-300 uppercase">HOTSPOT #${spot.rank}: ${spot.region}</div>
          <div class="text-slate-300">${spot.event_count} Events · ${spot.location_count} Nodes · ${spot.severity}</div>
        </div>`,
        { direction: "top", permanent: false, className: "leaflet-custom-tooltip" }
      );

      circle.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectHotspot) onSelectHotspot(spot);
        map.flyTo([spot.latitude, spot.longitude], 11, { duration: 1.2 });
      });

      circle.addTo(hotspotsLayer);
    });
  }, [hotspots, selectedHotspotId, showHotspotsLayer, onSelectHotspot]);

  // 6. Render Location Incident Markers
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    validLocations.forEach((loc) => {
      if (loc.latitude == null || loc.longitude == null) return;

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
        ? "ring-4 ring-sky-400/90 scale-130 shadow-lg shadow-sky-500/50"
        : isCritical
        ? "animate-pulse ring-2 ring-red-500/60 shadow-md shadow-red-500/30"
        : "";

      const customIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div class="relative group cursor-pointer flex items-center justify-center">
            <div 
              style="background: ${markerColor};" 
              class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-xl transition-all hover:scale-140 flex items-center justify-center ${pulseClass}"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
            </div>
            
            <div class="absolute left-5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-950/95 border border-slate-700 text-[10px] font-mono text-slate-100 whitespace-nowrap shadow-2xl transition-opacity pointer-events-none z-40 ${
              isSelected ? "opacity-100 border-sky-400 font-bold" : "opacity-0 group-hover:opacity-100"
            }">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-white">${loc.name}</span>
                <span class="text-amber-400 font-semibold">(${loc.district})</span>
              </div>
              <div class="text-[9px] text-slate-400 font-mono">
                ${loc.fir_count} Verified Incidents · Threat: ${loc.threat_score}%
              </div>
            </div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
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
  }, [validLocations, selectedLocationId, onSelectLocation, onSelectDistrict]);

  // 7. Camera Pan / Zoom on Selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. If specific location selected, fly to it
    if (selectedLocationId) {
      const loc = validLocations.find((l) => l.id === selectedLocationId);
      if (loc && loc.latitude != null && loc.longitude != null) {
        map.flyTo([loc.latitude, loc.longitude], 12, { duration: 1.2 });
        return;
      }
    }

    // 2. If hotspot selected, fly to it
    if (selectedHotspotId) {
      const spot = hotspots.find((h) => h.id === selectedHotspotId);
      if (spot && spot.latitude != null && spot.longitude != null) {
        map.flyTo([spot.latitude, spot.longitude], 11, { duration: 1.2 });
        return;
      }
    }

    // 3. If district selected, find district polygon bounds
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

    // 4. If state selected, find state polygon bounds
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

    // 5. Default: All India View
    if (!selectedState && !selectedDistrict && !selectedLocationId && !selectedHotspotId) {
      map.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
    }
  }, [selectedLocationId, selectedHotspotId, selectedDistrict, selectedState, validLocations, hotspots]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleResetToIndia = useCallback(() => {
    if (onResetView) onResetView();
    mapRef.current?.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
  }, [onResetView]);

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#070b14]">
      {/* 2D / 3D Isometric Container */}
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

        {showHotspotsLayer && hotspots.length > 0 && (
          <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-500/40 text-[10px] font-mono text-red-300 backdrop-blur-md flex items-center gap-1">
            <Flame size={12} className="text-red-400" />
            {hotspots.length} HOTSPOTS ACTIVE
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
            onClick={() => setShowHotspotsLayer((prev) => !prev)}
            className={`p-2 rounded-lg transition-colors ${
              showHotspotsLayer
                ? "bg-red-950/80 text-red-300 border border-red-700/60"
                : "hover:bg-sky-500/20 text-slate-400 hover:text-white"
            }`}
            title="Toggle Hotspot Density Rings"
          >
            <Flame size={15} />
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
      <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 flex items-center gap-3.5 shadow-xl backdrop-blur-md text-[11px] font-mono text-slate-300 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm" />
          <span>Critical Hotspot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-sm" />
          <span>High Density</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-sky-500 border border-white shadow-sm" />
          <span>Standard Location</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio size={13} className="text-red-400" />
          <span>Density Aura</span>
        </div>
        <div className="border-l border-slate-700 pl-2.5 text-[10px] text-slate-400">
          India Bounds Locked · {validLocations.length} Nodes
        </div>
      </div>
    </div>
  );
}

