import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type GraphNode = {
  id: string; type: string; name: string;
  role_label?: string; community?: number; risk_band?: string;
  x?: number; y?: number; fx?: number | null; fy?: number | null;
};
export type GraphEdge = { source_entity_id: string; target_entity_id: string; relationship_type: string; confidence_score: number };

const TYPE_COLOR: Record<string, string> = {
  PERSON: "#5b8def", PHONE: "#2dd4bf", VEHICLE: "#f5a524", LOCATION: "#9d7bea",
  ORGANIZATION: "#f45252", GANG: "#f45252", BANK_ACCOUNT: "#34d399", CASE: "#94a3b8",
};

export default function NetworkGraph({
  nodes, edges, onSelect, highlightPath,
}: {
  nodes: GraphNode[]; edges: GraphEdge[];
  onSelect: (n: GraphNode) => void;
  highlightPath?: string[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 900, height = 640;

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on("zoom", (event: any) => {
        g.attr("transform", event.transform);
      }) as any
    );

    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
    const links = edges
      .filter((e) => nodeMap.has(e.source_entity_id) && nodeMap.has(e.target_entity_id))
      .map((e) => ({ ...e, source: e.source_entity_id, target: e.target_entity_id }));

    const simNodes = Array.from(nodeMap.values());
    const highlightSet = new Set(highlightPath || []);

    const simulation = d3
      .forceSimulation(simNodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(70).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(18));

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => (highlightSet.has(d.source_entity_id) && highlightSet.has(d.target_entity_id) ? "#2dd4bf" : "#2e3750"))
      .attr("stroke-width", (d: any) => (highlightSet.has(d.source_entity_id) && highlightSet.has(d.target_entity_id) ? 2.5 : Math.max(0.6, d.confidence_score * 1.5)))
      .attr("opacity", (d: any) => (highlightSet.has(d.source_entity_id) && highlightSet.has(d.target_entity_id) ? 0.95 : 0.35));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d: any) => (highlightSet.has(d.id) ? 10 : 6))
      .attr("fill", (d: any) => TYPE_COLOR[d.type] || "#8b96ac")
      .attr("stroke", (d: any) => (highlightSet.has(d.id) ? "#fff" : "#0a0e14"))
      .attr("stroke-width", (d: any) => (highlightSet.has(d.id) ? 2 : 1))
      .style("cursor", "pointer")
      .on("click", (_event: any, d: any) => {
        onSelect(d);
      })
      .call(
        d3
          .drag<any, any>()
          .on("start", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event: any, d: any) => {
            d.fx = event.x; d.fy = event.y;
          })
          .on("end", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any
      );

    const label = g
      .append("g")
      .selectAll("text")
      .data(simNodes)
      .join("text")
      .text((d: any) => d.name)
      .attr("font-size", 9)
      .attr("fill", "#8b96ac")
      .attr("dx", 9)
      .attr("dy", 3)
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, highlightPath]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ background: "var(--bg-void)" }} />
  );
}
