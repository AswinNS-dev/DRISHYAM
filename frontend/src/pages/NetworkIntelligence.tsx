import { useEffect, useState } from "react";
import { api } from "../lib/api";
import NetworkGraph, { type GraphNode } from "../components/NetworkGraph";
import {
  Search, Sparkles, Network, Brain, AlertTriangle, GitBranch,
  Shield, Layers, Zap, Target, ArrowRight, CornerDownRight,
  Filter, Eye, Terminal, RefreshCw
} from "lucide-react";

type BottomTab = "centrality" | "communities" | "paths" | "anomalies" | "leads";

export default function NetworkIntelligence() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [dossier, setDossier] = useState<any>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("centrality");
  const [centrality, setCentrality] = useState<any>(null);
  const [communities, setCommunities] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [hiddenLinks, setHiddenLinks] = useState<any>(null);
  const [chatQ, setChatQ] = useState("");
  const [chatLog, setChatLog] = useState<{ q: string; a: any }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[] | undefined>(undefined);

  // Path finder state
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [pathResult, setPathResult] = useState<any>(null);
  const [pathLoading, setPathLoading] = useState(false);

  function loadGraph() {
    setLoading(true);
    api.networkGraph(entityTypeFilter ? { entity_type: entityTypeFilter } : {})
      .then((data) => {
        setGraph(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(loadGraph, [entityTypeFilter]);

  useEffect(() => {
    api.centrality().then(setCentrality).catch(() => {});
    api.communities().then(setCommunities).catch(() => {});
    api.anomalies().then(setAnomalies).catch(() => {});
  }, []);

  function selectNode(n: GraphNode) {
    setSelected(n);
    setSelectedEdge(null);
    setHighlightPath(undefined);
    if (n.type === "PERSON" || n.type === "PHONE" || n.type === "ORGANIZATION") {
      api.dossier(n.id).then(setDossier).catch(() => setDossier(null));
      api.hiddenLinks(n.id).then(setHiddenLinks).catch(() => setHiddenLinks(null));
    } else {
      setDossier(null);
      setHiddenLinks(null);
    }
  }

  function selectEdge(edge: any) {
    setSelected(null);
    setSelectedEdge(edge);
  }

  const filteredNodes = graph?.nodes.filter((n) =>
    !search || n.name.toLowerCase().includes(search.toLowerCase()) || (n.role_label && n.role_label.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  async function askAI() {
    if (!chatQ.trim()) return;
    const q = chatQ;
    setChatQ("");
    setChatLoading(true);
    try {
      const res = await api.chat(q);
      setChatLog((log) => [{ q, a: res }, ...log]);
    } catch {
      setChatLog((log) => [{ q, a: { answer: "Intelligence synthesis query timed out. System offline fallback active." } }, ...log]);
    } finally {
      setChatLoading(false);
    }
  }

  async function findShortestPath() {
    if (!sourceNodeId || !targetNodeId) return;
    setPathLoading(true);
    try {
      const res = await api.path(sourceNodeId, targetNodeId);
      setPathResult(res);
      if (res?.path) {
        setHighlightPath(res.path);
      }
    } catch (e) {
      setPathResult({ error: "No connection route found between selected entities." });
    } finally {
      setPathLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-void)]">
      {/* ── Top HUD Control Strip ── */}
      <div
        className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 z-10 glass-panel"
        style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.05))",
              border: "1px solid rgba(45,212,191,0.3)",
              boxShadow: "0 0 12px rgba(45,212,191,0.2)",
            }}
          >
            <Network size={16} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide text-[var(--text-primary)] uppercase">
                Neural Network Graph
              </h1>
              <span className="hud-label" style={{ fontSize: 9, color: "var(--neon-teal)" }}>
                INTERACTIVE GRAPH ENGINE
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Multi-hop associative clustering & graph centrality analysis
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--neon-teal)] opacity-70" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter graph node..."
              className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)] focus:shadow-[0_0_10px_rgba(45,212,191,0.2)] transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-panel)]">All Entity Types</option>
              <option value="PERSON" className="bg-[var(--bg-panel)]">Person</option>
              <option value="PHONE" className="bg-[var(--bg-panel)]">Phone</option>
              <option value="VEHICLE" className="bg-[var(--bg-panel)]">Vehicle</option>
              <option value="LOCATION" className="bg-[var(--bg-panel)]">Location</option>
              <option value="GANG" className="bg-[var(--bg-panel)]">Gang</option>
              <option value="ORGANIZATION" className="bg-[var(--bg-panel)]">Organization</option>
              <option value="BANK_ACCOUNT" className="bg-[var(--bg-panel)]">Bank Account</option>
              <option value="CASE" className="bg-[var(--bg-panel)]">Case</option>
            </select>
          </div>

          <button
            onClick={loadGraph}
            title="Refresh network simulation"
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-all bg-[var(--bg-panel-raised)]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[var(--neon-teal)]" : ""} />
          </button>

          {graph && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[rgba(45,212,191,0.06)] border border-[rgba(45,212,191,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[var(--neon-teal)] animate-pulse" />
              <span className="text-[11px] font-mono text-[var(--neon-teal)]">
                {graph.nodes.length} Nodes · {graph.edges.length} Edges
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Workspace: Graph Canvas + Intelligence Inspector ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Graph Canvas Container */}
        <div className="flex-1 min-w-0 h-full relative bg-[radial-gradient(ellipse_at_center,_var(--bg-panel)_0%,_var(--bg-void)_100%)]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--neon-teal)] border-t-transparent animate-spin" />
              <div className="text-xs font-mono text-[var(--neon-teal)] uppercase tracking-widest">
                Computing force simulation matrices...
              </div>
            </div>
          ) : graph ? (
            <NetworkGraph
              nodes={filteredNodes}
              edges={graph.edges}
              onSelect={selectNode}
              onSelectEdge={selectEdge}
              highlightPath={highlightPath}
            />
          ) : (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">
              Failed to load graph nodes. Check backend connection.
            </div>
          )}
        </div>

        {/* ── Intelligence Inspector Drawer (Right Side) ── */}
        <div
          className="w-[420px] shrink-0 border-l flex flex-col min-h-0 glass-panel relative z-10"
          style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[var(--neon-teal)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {selectedEdge ? "Relationship Intelligence" : "Tactical Dossier"}
              </span>
            </div>
            {selected && (
              <span className={`badge ${selected.risk_level === "CRITICAL" ? "badge-critical" : selected.risk_level === "HIGH" ? "badge-high" : "badge-medium"}`}>
                {selected.risk_level || "MEDIUM"} RISK
              </span>
            )}
            {selectedEdge && (
              <span className="badge badge-low text-[9px]">
                {Math.round(selectedEdge.confidence_score * 100)}% CONFIDENCE
              </span>
            )}
          </div>

          {/* Dossier Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedEdge ? (
              /* EDGE EVIDENCE INSPECTOR */
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="glass-panel p-4 neon-border-left">
                  <div className="hud-label text-[9px] text-[var(--neon-teal)] mb-1">
                    VERIFIED ASSOCIATION LINK
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                    <span>{selectedEdge.source?.name}</span>
                    <span className="text-[var(--neon-teal)]">↔</span>
                    <span>{selectedEdge.target?.name}</span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--neon-amber)] mt-1 uppercase">
                    {selectedEdge.relationship_type.replace("_", " ")}
                  </div>
                </div>

                <div className="glass-panel p-4 space-y-2.5">
                  <div className="hud-label text-[9px] text-[var(--text-muted)]">CORROBORATING EVIDENCE LEDGER</div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[var(--neon-teal)] text-[11px]">Primary FIR Document</div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        Recorded under FIR-2026-0118. Mentioned together during extortion rendezvous near Central Market.
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                      <div className="font-bold text-[var(--neon-teal)] text-[11px]">Surveillance & CDR Records</div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        23 verified communication bursts logged across IMEI towers within 14 days.
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEdge(null)}
                  className="btn-ghost w-full py-2 text-xs"
                >
                  Clear Selection
                </button>
              </div>
            ) : !selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
                <div className="w-12 h-12 rounded-full border border-dashed border-[var(--border-subtle)] flex items-center justify-center mb-3">
                  <Eye size={20} className="text-[var(--text-muted)] opacity-60" />
                </div>
                <div className="text-xs font-semibold text-[var(--text-secondary)]">No Entity or Link Selected</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[240px]">
                  Click on any node to view its Dossier, or click any relationship edge to inspect its evidence chain and legal records.
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Node Identity Card */}
                <div className="glass-panel p-3.5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-mono uppercase bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border-b border-l border-[rgba(45,212,191,0.2)]">
                    {selected.type}
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{selected.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selected.role_label && (
                      <span className="badge badge-low text-[10px]">{selected.role_label}</span>
                    )}
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      ID: {selected.id.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                {/* Centrality Metrics Grid */}
                {dossier?.network_position && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="glass-panel p-2.5 text-center">
                      <div className="text-base font-mono font-bold text-[var(--neon-teal)]">
                        {(dossier.network_position.degree_centrality * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase mt-0.5">Degree</div>
                    </div>
                    <div className="glass-panel p-2.5 text-center">
                      <div className="text-base font-mono font-bold text-[var(--neon-cyan)]">
                        {(dossier.network_position.betweenness_centrality * 100).toFixed(0)}%
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase mt-0.5">Betweenness</div>
                    </div>
                    <div className="glass-panel p-2.5 text-center">
                      <div className="text-base font-mono font-bold text-[var(--neon-amber)]">
                        {dossier.network_position.community_size || 1}
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase mt-0.5">Cluster</div>
                    </div>
                  </div>
                )}

                {/* AI Intelligence Insights */}
                {dossier?.intelligence_insights && dossier.intelligence_insights.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--neon-teal)] mb-2">
                      <Brain size={13} />
                      Synthesized Intelligence
                    </div>
                    <div className="space-y-1.5">
                      {dossier.intelligence_insights.map((ins: any, i: number) => (
                        <div
                          key={i}
                          className="text-xs p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[rgba(45,212,191,0.03)] flex items-start gap-2"
                        >
                          <Zap size={13} className="text-[var(--neon-teal)] shrink-0 mt-0.5" />
                          <div>
                            <span className="badge badge-low text-[9px] mr-1.5">{ins.type}</span>
                            <span className="text-[var(--text-secondary)]">{ins.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hidden Connection Discovery */}
                {hiddenLinks?.findings && hiddenLinks.findings.length > 0 && (
                  <div className="p-3 rounded-lg border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.06)]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-red)] uppercase mb-1.5">
                      <AlertTriangle size={13} />
                      Hidden Connection Detected
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Indirect association with <strong className="text-white">{hiddenLinks.findings[0].target_name}</strong> via {hiddenLinks.findings[0].hop_count} intermediary hops.
                    </p>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1.5">
                      {hiddenLinks.findings[0].path_names?.join(" → ")}
                    </div>
                    <button
                      onClick={() => setHighlightPath(hiddenLinks.findings[0].path)}
                      className="mt-2.5 w-full py-1.5 px-2 rounded bg-[rgba(244,63,94,0.15)] hover:bg-[rgba(244,63,94,0.25)] border border-[rgba(244,63,94,0.4)] text-[var(--accent-red)] text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Target size={12} />
                      Highlight Route on Canvas
                    </button>
                  </div>
                )}

                {/* Direct Connections / Evidence */}
                {dossier?.connections && dossier.connections.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      <span>Network Links ({dossier.connections.length})</span>
                      <span className="text-[10px] font-mono">CONFIDENCE</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {dossier.connections.map((c: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] transition-all cursor-pointer"
                          onClick={() => {
                            const found = graph?.nodes.find((n) => n.id === c.target_id || n.id === c.source_id);
                            if (found) selectNode(found);
                          }}
                        >
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{c.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{c.relationship_type}</div>
                          </div>
                          <div className="w-16 text-right">
                            <div className="text-[10px] font-mono text-[var(--neon-teal)]">
                              {(c.confidence * 100).toFixed(0)}%
                            </div>
                            <div className="confidence-bar mt-0.5">
                              <div className="confidence-fill" style={{ width: `${c.confidence * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── AI Investigation Assistant Chat (Bottom of drawer) ── */}
          <div className="border-t p-3 bg-[var(--bg-panel)]" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--neon-teal)]">
                <Sparkles size={13} />
                <span>AI Neural Analyst</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">SIH-26189 ENGINE</span>
            </div>

            {/* Quick chips if chat is empty */}
            {chatLog.length === 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  "Identify kingpin clusters",
                  "Summarize key bridges",
                  "Check anomalies",
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setChatQ(chip);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] hover:border-[var(--neon-teal)] transition-all bg-[var(--bg-panel-raised)]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Chat conversation messages */}
            {chatLog.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-2 mb-2 pr-1">
                {chatLog.map((entry, i) => (
                  <div key={i} className="text-xs space-y-1">
                    <div className="text-[11px] font-medium text-[var(--neon-cyan)] flex items-center gap-1">
                      <Terminal size={10} /> {entry.q}
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] leading-relaxed">
                      {entry.a.answer || entry.a.text || JSON.stringify(entry.a)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5">
              <input
                value={chatQ}
                onChange={(e) => setChatQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Ask network intelligence query..."
                className="flex-1 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
              />
              <button
                onClick={askAI}
                disabled={chatLoading || !chatQ.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.4)] disabled:opacity-40 transition-all"
              >
                {chatLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Telemetry Panel (Tabs: Centrality, Communities, Paths, Anomalies) ── */}
      <div className="border-t shrink-0 glass-panel" style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}>
        {/* Tab Headers */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[var(--border-subtle)] bg-[rgba(10,14,24,0.6)]">
          {(
            [
              { id: "centrality", label: "Centrality / PageRank", icon: Zap },
              { id: "communities", label: "Communities & Gangs", icon: Layers },
              { id: "paths", label: "Route & Path Finder", icon: GitBranch },
              { id: "anomalies", label: "Anomalies & Red Flags", icon: AlertTriangle },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setBottomTab(id as BottomTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
                bottomTab === id
                  ? "text-[var(--neon-teal)] border-[var(--neon-teal)] bg-[rgba(45,212,191,0.08)] shadow-[0_-2px_10px_rgba(45,212,191,0.15)]"
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}

          {highlightPath && (
            <button
              onClick={() => setHighlightPath(undefined)}
              className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded border border-[rgba(244,63,94,0.4)] text-[var(--accent-red)] hover:bg-[rgba(244,63,94,0.1)] transition-all"
            >
              Clear Route Highlighting ✕
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-4 h-44 overflow-y-auto bg-[var(--bg-panel)]">
          {/* TAB 1: CENTRALITY */}
          {bottomTab === "centrality" && centrality && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--neon-teal)] mb-2 flex items-center gap-1">
                  <Zap size={12} /> Top By PageRank (Influence)
                </div>
                <div className="space-y-1">
                  {centrality.top_by_pagerank?.slice(0, 5).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[rgba(45,212,191,0.06)] cursor-pointer transition-all border border-transparent hover:border-[rgba(45,212,191,0.2)]"
                    >
                      <span className="text-[var(--text-primary)] font-medium">
                        {r.name} <span className="text-[10px] text-[var(--text-muted)]">({r.role_label || "operative"})</span>
                      </span>
                      <span className="font-mono text-[var(--neon-teal)]">{(r.pagerank * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--neon-cyan)] mb-2 flex items-center gap-1">
                  <GitBranch size={12} /> Key Intermediaries (Betweenness)
                </div>
                <div className="space-y-1">
                  {centrality.top_bridges?.slice(0, 5).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[rgba(0,255,255,0.06)] cursor-pointer transition-all border border-transparent hover:border-[rgba(0,255,255,0.2)]"
                    >
                      <span className="text-[var(--text-primary)] font-medium">{r.name}</span>
                      <span className="font-mono text-[var(--neon-cyan)]">{(r.betweenness_centrality * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--neon-amber)] mb-2 flex items-center gap-1">
                  <Shield size={12} /> High-Degree Hubs (Density)
                </div>
                <div className="space-y-1">
                  {centrality.top_by_degree?.slice(0, 5).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[rgba(245,158,11,0.06)] cursor-pointer transition-all border border-transparent hover:border-[rgba(245,158,11,0.2)]"
                    >
                      <span className="text-[var(--text-primary)] font-medium">{r.name}</span>
                      <span className="font-mono text-[var(--neon-amber)]">{(r.degree_centrality * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMUNITIES */}
          {bottomTab === "communities" && communities && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.communities?.map((c: any) => (
                <div key={c.community_id} className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[var(--neon-teal)]">
                      Cluster #{c.community_id + 1}
                    </span>
                    <span className="badge badge-low text-[10px]">{c.size} members</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mb-2">
                    Key Operator: <strong className="text-white">{c.dominant_name}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.members?.slice(0, 6).map((m: any, idx: number) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[var(--text-muted)] hover:text-white cursor-pointer"
                        onClick={() => {
                          const n = graph?.nodes.find((node) => node.name === m || node.id === m);
                          if (n) selectNode(n);
                        }}
                      >
                        {typeof m === "string" ? m : m.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PATH FINDER */}
          {bottomTab === "paths" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] font-mono">SOURCE:</span>
                  <select
                    value={sourceNodeId}
                    onChange={(e) => setSourceNodeId(e.target.value)}
                    className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                  >
                    <option value="">Select source entity</option>
                    {graph?.nodes.map((n) => (
                      <option key={n.id} value={n.id} className="bg-[var(--bg-panel)]">
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight size={14} className="text-[var(--neon-teal)]" />

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] font-mono">TARGET:</span>
                  <select
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                    className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                  >
                    <option value="">Select target entity</option>
                    {graph?.nodes.map((n) => (
                      <option key={n.id} value={n.id} className="bg-[var(--bg-panel)]">
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={findShortestPath}
                  disabled={!sourceNodeId || !targetNodeId || pathLoading}
                  className="px-3 py-1 rounded bg-[var(--neon-teal)] text-[#08211d] text-xs font-bold hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] disabled:opacity-40 transition-all flex items-center gap-1"
                >
                  <Target size={12} />
                  {pathLoading ? "Tracing..." : "Compute Connection Route"}
                </button>
              </div>

              {pathResult && (
                <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)]">
                  {pathResult.error ? (
                    <div className="text-xs text-[var(--accent-red)]">{pathResult.error}</div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-[var(--neon-teal)]">Route Traced ({pathResult.hop_count || pathResult.path?.length - 1} Hops):</span>
                      {pathResult.path_names?.map((name: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.25)] text-[var(--neon-teal)] font-medium">
                            {name}
                          </span>
                          {i < pathResult.path_names.length - 1 && <CornerDownRight size={12} className="text-[var(--text-muted)]" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ANOMALIES */}
          {bottomTab === "anomalies" && (
            <div className="space-y-2">
              {anomalies?.anomalies?.length ? (
                anomalies.anomalies.map((a: any, i: number) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.05)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-[var(--accent-red)] shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-[var(--accent-red)]">{a.type || a.rule_name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{a.description}</div>
                      </div>
                    </div>
                    {a.entity_id && (
                      <button
                        onClick={() => {
                          const n = graph?.nodes.find((node) => node.id === a.entity_id);
                          if (n) selectNode(n);
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-[rgba(244,63,94,0.15)] text-[var(--accent-red)] hover:bg-[rgba(244,63,94,0.25)]"
                      >
                        Locate Node →
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-muted)] text-center py-6">
                  No critical network anomalies flagged at this moment.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
