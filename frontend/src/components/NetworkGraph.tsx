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
  PERSON: "#3b82f6",
  PHONE: "#0ea5e9",
  VEHICLE: "#f59e0b",
  LOCATION: "#8b5cf6",
  ORGANIZATION: "#ef4444",
  GANG: "#ef4444",
  BANK_ACCOUNT: "#10b981",
  CASE: "#64748b",
};

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
  const sizeRef = useRef({ w: 900, h: 640 });
  const dragRef = useRef<{ node: SimNode | null; active: boolean }>({ node: null, active: false });
  const highlightSet = useRef(new Set<string>());

  useEffect(() => {
    highlightSet.current = new Set(highlightPath || []);
  }, [highlightPath]);

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

    if (simRef.current) simRef.current.stop();

    const sim = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(85).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-160).distanceMax(420))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force("collide", d3.forceCollide<SimNode>(18).strength(0.6))
      .force("x", d3.forceX(w / 2).strength(0.02))
      .force("y", d3.forceY(h / 2).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    sim.stop();
    for (let i = 0; i < 200; i++) sim.tick();
    sim.alpha(0.3).restart();

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [nodes, edges]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const { w, h } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, w * dpr, h * dpr);

      ctx.save();
      ctx.scale(dpr, dpr);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Draw Subtle Background Grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
      ctx.lineWidth = 1 / t.k;
      const gridSize = 40;
      const startX = -t.x / t.k - 100;
      const startY = -t.y / t.k - 100;
      const endX = (w - t.x) / t.k + 100;
      const endY = (h - t.y) / t.k + 100;

      ctx.beginPath();
      for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      // Draw Links
      const simLinks = linksRef.current;
      for (const link of simLinks) {
        const isSelected = selectedEdgeRef.current === link;
        const isPathLink = highlightSet.current.has(link.source.id) && highlightSet.current.has(link.target.id);

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);

        if (isPathLink) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3 / t.k;
        } else if (isSelected) {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2.5 / t.k;
        } else {
          ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
          ctx.lineWidth = 1.2 / t.k;
        }
        ctx.stroke();
      }

      // Draw Nodes
      const simNodes = nodesRef.current;
      for (const n of simNodes) {
        const isHovered = hoveredRef.current?.id === n.id;
        const isSelected = selectedRef.current?.id === n.id;
        const isPath = highlightSet.current.has(n.id);
        const baseColor = TYPE_COLORS[n.type] || "#94a3b8";

        let radius = 7;
        if (n.type === "PERSON") radius = 9;
        if (n.type === "CASE" || n.type === "GANG") radius = 10;
        if (isHovered || isSelected || isPath) radius += 2.5;

        // Base node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();

        // High contrast border
        ctx.strokeStyle = isSelected || isPath ? "#ffffff" : "rgba(24, 24, 27, 0.85)";
        ctx.lineWidth = isSelected || isPath ? 2.5 / t.k : 1.5 / t.k;
        ctx.stroke();

        // Node Label
        if (t.k > 0.6 || isHovered || isSelected || isPath) {
          ctx.font = `${11 / t.k}px Inter, sans-serif`;
          ctx.fillStyle = isSelected || isPath ? "#ffffff" : "#cbd5e1";
          ctx.textAlign = "center";
          ctx.fillText(n.name, n.x, n.y + radius + 11 / t.k);
        }
      }

      ctx.restore();

      drawMinimap();
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Minimap
  const drawMinimap = useCallback(() => {
    const minimap = minimapRef.current;
    if (!minimap) return;
    const mctx = minimap.getContext("2d");
    if (!mctx) return;

    const mw = 140;
    const mh = 90;
    mctx.clearRect(0, 0, mw, mh);

    mctx.fillStyle = "#0c1322";
    mctx.fillRect(0, 0, mw, mh);
    mctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mw, mh);

    const simNodes = nodesRef.current;
    if (simNodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const padding = 30;
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const scale = Math.min((mw - padding) / rangeX, (mh - padding) / rangeY);
    const ox = (mw - rangeX * scale) / 2 - minX * scale;
    const oy = (mh - rangeY * scale) / 2 - minY * scale;

    for (const n of simNodes) {
      const mx = n.x * scale + ox;
      const my = n.y * scale + oy;
      const color = TYPE_COLORS[n.type] || "#94a3b8";
      mctx.beginPath();
      mctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      mctx.fillStyle = highlightSet.current.has(n.id) ? "#38bdf8" : color;
      mctx.fill();
    }

    const { w, h } = sizeRef.current;
    const t = transformRef.current;
    const vx = (-t.x / t.k) * scale + ox;
    const vy = (-t.y / t.k) * scale + oy;
    const vw = (w / t.k) * scale;
    const vh = (h / t.k) * scale;

    mctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
  }, []);

  // Zoom & Pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 5])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });

    d3.select(canvas).call(zoom);
    return () => {
      d3.select(canvas).on(".zoom", null);
    };
  }, []);

  // Mouse selection & dragging
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getNodeAt = (mx: number, my: number): SimNode | null => {
      const t = transformRef.current;
      const x = (mx - t.x) / t.k;
      const y = (my - t.y) / t.k;
      let closest: SimNode | null = null;
      let closestDist = 22;
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

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = getNodeAt(mx, my);
      if (node) {
        selectedRef.current = node;
        selectedEdgeRef.current = null;
        onSelect(node);
        return;
      }

      // Check if clicked close to an edge
      if (onSelectEdge) {
        const t = transformRef.current;
        const x = (mx - t.x) / t.k;
        const y = (my - t.y) / t.k;
        for (const link of linksRef.current) {
          const x1 = link.source.x, y1 = link.source.y;
          const x2 = link.target.x, y2 = link.target.y;
          const len = Math.hypot(x2 - x1, y2 - y1);
          if (len === 0) continue;
          const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len;
          if (dist < 6 / t.k) {
            selectedRef.current = null;
            selectedEdgeRef.current = link;
            onSelectEdge(link);
            return;
          }
        }
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
    };
  }, [onSelect]);

  const handleZoomIn = () => {
    if (!canvasRef.current) return;
    d3.select(canvasRef.current).transition().call(
      d3.zoom<HTMLCanvasElement, unknown>().scaleBy as any, 1.3
    );
  };

  const handleZoomOut = () => {
    if (!canvasRef.current) return;
    d3.select(canvasRef.current).transition().call(
      d3.zoom<HTMLCanvasElement, unknown>().scaleBy as any, 0.75
    );
  };

  const handleResetZoom = () => {
    if (!canvasRef.current) return;
    d3.select(canvasRef.current).transition().call(
      d3.zoom<HTMLCanvasElement, unknown>().transform as any, d3.zoomIdentity
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none bg-[var(--bg-void)]">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Zoom Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-[var(--bg-panel-solid)] p-1 rounded border border-[var(--border-subtle)]">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-[var(--bg-panel-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-[var(--bg-panel-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded hover:bg-[var(--bg-panel-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Reset View"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Minimap */}
      <div className="absolute bottom-3 right-3 z-10 rounded overflow-hidden border border-[var(--border-subtle)] shadow-md">
        <canvas ref={minimapRef} width={140} height={90} />
      </div>

      {/* Clean Investigation Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-[var(--bg-panel-solid)] border border-[var(--border-subtle)] rounded p-2.5 flex flex-wrap gap-x-3 gap-y-1.5 max-w-xs shadow-md">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
