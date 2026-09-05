import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export type GraphNode = {
  id: string; type: string; name: string;
  role_label?: string; community?: number; risk_band?: string; risk_level?: string;
  centrality?: { degree_centrality: number; betweenness_centrality: number; pagerank: number };
  x?: number; y?: number; fx?: number | null; fy?: number | null;
  vx?: number; vy?: number;
};
export type GraphEdge = {
  id?: string;
  source_entity_id: string; target_entity_id: string;
  relationship_type: string; confidence_score: number;
};

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number; index?: number };
type SimLink = { source: SimNode; target: SimNode; relationship_type: string; confidence_score: number; id?: string };

const TYPE_COLORS: Record<string, string> = {
  PERSON: "#5b8def",
  PHONE: "#2dd4bf",
  VEHICLE: "#fbbf24",
  LOCATION: "#a855f7",
  ORGANIZATION: "#ff3b5c",
  GANG: "#ff3b5c",
  BANK_ACCOUNT: "#34d399",
  CASE: "#64748b",
};

const RISK_GLOW: Record<string, { color: string; intensity: number }> = {
  high: { color: "rgba(255,59,92,", intensity: 0.6 },
  medium: { color: "rgba(251,191,36,", intensity: 0.4 },
  low: { color: "rgba(45,212,191,", intensity: 0.2 },
  unknown: { color: "rgba(45,212,191,", intensity: 0.1 },
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function NetworkGraph({
  nodes, edges, onSelect, onSelectEdge, highlightPath,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (n: GraphNode) => void;
  onSelectEdge?: (edge: SimLink) => void;
  highlightPath?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const hoveredRef = useRef<SimNode | null>(null);
  const selectedRef = useRef<SimNode | null>(null);
  const selectedEdgeRef = useRef<SimLink | null>(null);
  const animRef = useRef(0);
  const pulseRef = useRef(0);
  const particleRef = useRef(0);
  const sizeRef = useRef({ w: 900, h: 640 });
  const dragRef = useRef<{ node: SimNode | null; active: boolean }>({ node: null, active: false });
  const highlightSet = useRef(new Set<string>());

  useEffect(() => {
    highlightSet.current = new Set(highlightPath || []);
  }, [highlightPath]);

  // Build simulation once and update on data change
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || nodes.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width || 900;
    const h = rect.height || 640;
    sizeRef.current = { w, h };

    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    // Build node/link arrays
    const nodeMap = new Map<string, SimNode>();
    nodes.forEach((n) => {
      nodeMap.set(n.id, {
        ...n,
        x: n.x ?? w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: n.y ?? h / 2 + (Math.random() - 0.5) * h * 0.6,
        vx: 0, vy: 0,
      });
    });

    const simNodes = Array.from(nodeMap.values());
    const simLinks: SimLink[] = edges
      .filter((e) => nodeMap.has(e.source_entity_id) && nodeMap.has(e.target_entity_id))
      .map((e) => ({
        source: nodeMap.get(e.source_entity_id)!,
        target: nodeMap.get(e.target_entity_id)!,
        relationship_type: e.relationship_type,
        confidence_score: e.confidence_score,
        id: e.id,
      }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // Stop previous simulation
    if (simRef.current) simRef.current.stop();

    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-150).distanceMax(400))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force("collide", d3.forceCollide<SimNode>(16).strength(0.6))
      .force("x", d3.forceX(w / 2).strength(0.02))
      .force("y", d3.forceY(h / 2).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    // Warm-up: run 200 ticks silently before rendering
    sim.stop();
    for (let i = 0; i < 200; i++) sim.tick();
    sim.alpha(0.3).restart();

    simRef.current = sim;

    sim.on("tick", () => { /* Canvas is redrawn in the animation loop */ });

    return () => {
      sim.stop();
    };
  }, [nodes, edges]);

  // Rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      const { w, h } = sizeRef.current;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Apply zoom transform
      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const simNodes = nodesRef.current;
      const simLinks = linksRef.current;
      const hl = highlightSet.current;
      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      pulseRef.current += 0.02;
      particleRef.current += 0.008;
      const pulseVal = Math.sin(pulseRef.current) * 0.5 + 0.5;

      // ── Draw edges ──
      for (const link of simLinks) {
        const s = link.source;
        const tgt = link.target;
        const isHighlighted = hl.has(s.id) && hl.has(tgt.id);
        const isHoveredEdge = hovered && (s.id === hovered.id || tgt.id === hovered.id);

        if (isHighlighted) {
          // Animated glow edge
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + pulseVal * 0.3})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "rgba(0, 255, 255, 0.5)";
          ctx.shadowBlur = 12;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -particleRef.current * 200;
          ctx.stroke();
          ctx.restore();

          // Particle traveling along edge
          const progress = (particleRef.current * 3) % 1;
          const px = s.x + (tgt.x - s.x) * progress;
          const py = s.y + (tgt.y - s.y) * progress;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 255, 255, 0.8)";
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = isHoveredEdge
            ? "rgba(45, 212, 191, 0.3)"
            : `rgba(45, 212, 191, ${Math.max(0.04, link.confidence_score * 0.12)})`;
          ctx.lineWidth = isHoveredEdge ? 1.2 : 0.6;
          ctx.stroke();
        }
      }

      // ── Draw nodes ──
      for (const node of simNodes) {
        const color = TYPE_COLORS[node.type] || "#8b96ac";
        const isSelected = selected?.id === node.id;
        const isHovered = hovered?.id === node.id;
        const isOnPath = hl.has(node.id);
        const isNeighbor = selected && simLinks.some(
          (l) => (l.source.id === selected.id && l.target.id === node.id) ||
                 (l.target.id === selected.id && l.source.id === node.id)
        );

        const baseRadius = node.type === "PERSON" ? 6 : 5;
        const r = isSelected ? baseRadius + 4 : isHovered ? baseRadius + 2 : isOnPath ? baseRadius + 2 : baseRadius;

        // Risk glow
        const risk = RISK_GLOW[node.risk_band || "unknown"] || RISK_GLOW.unknown;
        if (risk.intensity > 0.15 || isSelected || isOnPath) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
          const glowAlpha = isSelected ? 0.25 + pulseVal * 0.15 : isOnPath ? 0.2 : risk.intensity * 0.15;
          ctx.fillStyle = isOnPath
            ? `rgba(0, 255, 255, ${glowAlpha})`
            : `${risk.color}${glowAlpha})`;
          ctx.fill();
          ctx.restore();
        }

        // Selection ring (animated pulse)
        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          const ringR = r + 6 + pulseVal * 3;
          ctx.arc(node.x, node.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + pulseVal * 0.2})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isOnPath ? "#0ff" : color;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? "rgba(0, 255, 255, 0.8)"
          : isHovered ? "rgba(255,255,255,0.5)" : "rgba(6, 9, 15, 0.6)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Labels (only for selected, hovered, neighbors, and highlighted path)
        if (isSelected || isHovered || isOnPath || isNeighbor) {
          ctx.save();
          ctx.font = `${isSelected || isHovered ? "600" : "400"} ${isSelected ? 11 : 10}px 'Inter', sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          // Label background
          const text = node.name;
          const metrics = ctx.measureText(text);
          const lx = node.x + r + 6;
          const ly = node.y;
          const padding = 4;

          ctx.fillStyle = "rgba(6, 9, 15, 0.85)";
          ctx.beginPath();
          ctx.roundRect(
            lx - padding, ly - 8 - padding / 2,
            metrics.width + padding * 2, 16 + padding,
            4
          );
          ctx.fill();

          ctx.fillStyle = isSelected || isHovered
            ? "#f0f4ff"
            : isOnPath ? "#0ff" : "rgba(139, 150, 172, 0.9)";
          ctx.fillText(text, lx, ly);
          ctx.restore();
        }
      }

      ctx.restore();

      // ── Minimap ──
      drawMinimap();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Minimap drawing
  const drawMinimap = useCallback(() => {
    const minimap = minimapRef.current;
    if (!minimap) return;
    const mctx = minimap.getContext("2d");
    if (!mctx) return;

    const mw = 150;
    const mh = 100;
    mctx.clearRect(0, 0, mw, mh);

    // Background
    mctx.fillStyle = "rgba(6, 9, 15, 0.9)";
    mctx.fillRect(0, 0, mw, mh);
    mctx.strokeStyle = "rgba(45, 212, 191, 0.15)";
    mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mw, mh);

    const simNodes = nodesRef.current;
    if (simNodes.length === 0) return;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const padding = 40;
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const scale = Math.min((mw - padding) / rangeX, (mh - padding) / rangeY);
    const ox = (mw - rangeX * scale) / 2 - minX * scale;
    const oy = (mh - rangeY * scale) / 2 - minY * scale;

    // Draw dots
    for (const n of simNodes) {
      const mx = n.x * scale + ox;
      const my = n.y * scale + oy;
      const color = TYPE_COLORS[n.type] || "#8b96ac";
      mctx.beginPath();
      mctx.arc(mx, my, 1.2, 0, Math.PI * 2);
      mctx.fillStyle = highlightSet.current.has(n.id) ? "#0ff" : color;
      mctx.fill();
    }

    // Viewport rectangle
    const { w, h } = sizeRef.current;
    const t = transformRef.current;
    const vx = (-t.x / t.k) * scale + ox;
    const vy = (-t.y / t.k) * scale + oy;
    const vw = (w / t.k) * scale;
    const vh = (h / t.k) * scale;

    mctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
  }, []);

  // Zoom & Pan via D3 zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    d3.select(canvas).call(zoom);

    return () => {
      d3.select(canvas).on(".zoom", null);
    };
  }, []);

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getNodeAt = (mx: number, my: number): SimNode | null => {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      let closest: SimNode | null = null;
      let closestDist = 20;
      for (const n of nodesRef.current) {
        const d = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
        if (d < closestDist) {
          closestDist = d;
          closest = n;
        }
      }
      return closest;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragRef.current.active && dragRef.current.node) {
        const t = transformRef.current;
        dragRef.current.node.fx = (mx - t.x) / t.k;
        dragRef.current.node.fy = (my - t.y) / t.k;
        simRef.current?.alpha(0.1).restart();
        return;
      }

      const node = getNodeAt(mx, my);
      hoveredRef.current = node;
      canvas.style.cursor = node ? "pointer" : "grab";
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        dragRef.current = { node, active: true };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.1).restart();
        e.stopPropagation();
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current.active && dragRef.current.node) {
        dragRef.current.node.fx = null;
        dragRef.current.node.fy = null;
        simRef.current?.alphaTarget(0);
      }
      dragRef.current = { node: null, active: false };
    };

    const getEdgeAt = (mx: number, my: number): SimLink | null => {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      let closest: SimLink | null = null;
      let closestDist = 8;
      for (const link of linksRef.current) {
        const x1 = link.source.x, y1 = link.source.y;
        const x2 = link.target.x, y2 = link.target.y;
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) continue;
        const tt = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2));
        const px = x1 + tt * (x2 - x1);
        const py = y1 + tt * (y2 - y1);
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < closestDist) {
          closestDist = dist;
          closest = link;
        }
      }
      return closest;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        selectedRef.current = node;
        selectedEdgeRef.current = null;
        onSelect(node);
        return;
      }

      const edge = getEdgeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (edge && onSelectEdge) {
        selectedEdgeRef.current = edge;
        onSelectEdge(edge);
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        if (node.fx !== null && node.fx !== undefined) {
          node.fx = null;
          node.fy = null;
        } else {
          node.fx = node.x;
          node.fy = node.y;
        }
        simRef.current?.alpha(0.1).restart();
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("dblclick", handleDblClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("dblclick", handleDblClick);
    };
  }, [onSelect]);

  // Resize handler
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        sizeRef.current = { w: width, h: height };
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Zoom controls
  const zoomTo = (scaleDelta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = transformRef.current;
    const { w, h } = sizeRef.current;
    const newK = Math.max(0.1, Math.min(6, t.k * scaleDelta));
    transformRef.current = d3.zoomIdentity
      .translate(w / 2, h / 2)
      .scale(newK)
      .translate(-w / 2, -h / 2);
  };

  const fitToView = () => {
    const simNodes = nodesRef.current;
    if (simNodes.length === 0) return;
    const { w, h } = sizeRef.current;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const padding = 60;
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const k = Math.min((w - padding * 2) / rangeX, (h - padding * 2) / rangeY, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    transformRef.current = d3.zoomIdentity
      .translate(w / 2, h / 2)
      .scale(k)
      .translate(-cx, -cy);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: "var(--bg-void)" }}>
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {[
          { icon: ZoomIn, action: () => zoomTo(1.3), title: "Zoom in" },
          { icon: ZoomOut, action: () => zoomTo(0.7), title: "Zoom out" },
          { icon: Maximize2, action: fitToView, title: "Fit to view" },
        ].map(({ icon: Icon, action, title }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            className="glass-panel-static flex items-center justify-center transition-all"
            style={{
              width: 32, height: 32, borderRadius: 8,
              cursor: "pointer", color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--neon-teal)";
              e.currentTarget.style.borderColor = "rgba(45,212,191,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border-strong)";
            }}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-3 right-3 z-10" style={{
        borderRadius: 8, overflow: "hidden",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}>
        <canvas ref={minimapRef} width={150} height={100} />
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 glass-panel-static px-3 py-2 flex flex-wrap gap-x-3 gap-y-1"
           style={{ maxWidth: 280 }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${hexToRgba(color, 0.4)}` }} />
            <span className="hud-label" style={{ fontSize: 8 }}>{type.replace("_", " ")}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredRef.current && (
        <div className="absolute z-20 pointer-events-none glass-panel-static px-3 py-2"
             style={{ left: 12, top: 12, maxWidth: 220 }}>
          <div className="text-xs font-semibold">{hoveredRef.current.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge badge-info" style={{ fontSize: 8, padding: "1px 6px" }}>
              {hoveredRef.current.type}
            </span>
            {hoveredRef.current.risk_band && hoveredRef.current.risk_band !== "unknown" && (
              <span className={`badge badge-${hoveredRef.current.risk_band}`}
                    style={{ fontSize: 8, padding: "1px 6px" }}>
                {hoveredRef.current.risk_band}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
