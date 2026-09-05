import { useEffect, useState } from "react";
import { api } from "../lib/api";
import NetworkGraph, { type GraphNode } from "../components/NetworkGraph";
import {
  Search, Network, AlertTriangle, GitBranch,
  Layers, Zap, Filter, Eye, RefreshCw, ShieldCheck
} from "lucide-react";

type BottomTab = "centrality" | "communities" | "paths" | "anomalies";

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
    } else {
      setDossier(null);
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
      setChatLog((log) => [{ q, a: { answer: "Query failed. Please verify network connectivity." } }, ...log]);
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
      setPathResult({ error: "No recorded association route between selected entities." });
    } finally {
      setPathLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-void)]">
      {/* ── Top HUD Control Strip ── */}
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Network size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide text-[var(--text-primary)] uppercase">
                Criminal Network Analysis Workspace
              </h1>
              <span className="badge badge-low text-[8px]">
                ASSOCIATION GRAPH
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Multi-hop associative clustering, key influencers, and co-conspirator group detection
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-56">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter nodes..."
              className="workstation-input pl-7 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-panel-solid)]">All Types</option>
              <option value="PERSON" className="bg-[var(--bg-panel-solid)]">Persons</option>
              <option value="PHONE" className="bg-[var(--bg-panel-solid)]">Phones</option>
              <option value="VEHICLE" className="bg-[var(--bg-panel-solid)]">Vehicles</option>
              <option value="LOCATION" className="bg-[var(--bg-panel-solid)]">Locations</option>
              <option value="GANG" className="bg-[var(--bg-panel-solid)]">Syndicates</option>
              <option value="BANK_ACCOUNT" className="bg-[var(--bg-panel-solid)]">Bank Accounts</option>
              <option value="CASE" className="bg-[var(--bg-panel-solid)]">Cases</option>
            </select>
          </div>

          <button
            onClick={loadGraph}
            title="Refresh network simulation"
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>

          {graph && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)]">
              <span>{graph.nodes.length} Nodes</span>
              <span>·</span>
              <span>{graph.edges.length} Links</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Workspace: Graph Canvas + Inspection Panel ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Canvas */}
        <div className="flex-1 min-w-0 h-full relative bg-[var(--bg-void)]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--intel-blue)] border-t-transparent animate-spin" />
              <div className="text-xs font-mono text-[var(--intel-sky)] uppercase">
                Computing association matrix...
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
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Failed to load network graph. Please check backend status.
            </div>
          )}
        </div>

        {/* Right Inspection Drawer */}
        <div className="w-96 shrink-0 border-l border-[var(--border-subtle)] flex flex-col min-h-0 bg-[var(--bg-panel-solid)]">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[var(--intel-sky)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {selectedEdge ? "Relationship Record" : "Entity Dossier"}
              </span>
            </div>
            {selected && (
              <span className="badge badge-low text-[8px]">
                {selected.type}
              </span>
            )}
            {selectedEdge && (
              <span className="badge badge-low text-[8px]">
                {Math.round(selectedEdge.confidence_score * 100)}% Confidence
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedEdge ? (
              <div className="space-y-3">
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] space-y-1">
                  <div className="hud-label text-[9px] text-[var(--intel-sky)]">
                    CORROBORATED CONNECTION
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <span>{selectedEdge.source?.name}</span>
                    <span className="text-[var(--intel-sky)]">↔</span>
                    <span>{selectedEdge.target?.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--status-warning)] uppercase">
                    {selectedEdge.relationship_type?.replace("_", " ")}
                  </div>
                </div>

                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] space-y-2">
                  <div className="hud-label text-[9px] text-[var(--text-muted)]">SUPPORTING EVIDENCE SOURCE</div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Association recorded under formal case FIR records and verified CDR logs.
                  </p>
                </div>

                <button onClick={() => setSelectedEdge(null)} className="btn-ghost w-full text-xs">
                  Clear Selection
                </button>
              </div>
            ) : !selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
                <Eye size={28} className="opacity-20 mb-2" />
                <div className="text-xs font-semibold text-[var(--text-secondary)]">No Entity Selected</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[220px]">
                  Click on any node in the graph to inspect its intelligence profile and connected contacts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] space-y-1">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{selected.name}</div>
                  <div className="text-[10px] font-mono text-[var(--status-warning)]">
                    Role: {selected.role_label || "Associated Entity"}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">
                    ID: {selected.id}
                  </div>
                </div>

                {dossier && (
                  <div className="panel p-3.5 bg-[var(--bg-panel-raised)] space-y-2">
                    <div className="hud-label text-[9px] text-[var(--intel-sky)]">VERIFIED ATTRIBUTES</div>
                    <div className="space-y-1 text-xs">
                      {dossier.identity?.primary_phone && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Phone:</span>
                          <span className="font-mono">{dossier.identity.primary_phone}</span>
                        </div>
                      )}
                      {dossier.identity?.primary_vehicle && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">Vehicle:</span>
                          <span className="font-mono">{dossier.identity.primary_vehicle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Natural Language Investigation Query Input */}
          <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
            {chatLog.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs mb-1">
                {chatLog.slice(0, 2).map((entry, i) => (
                  <div key={i} className="p-2 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[11px]">
                    <div className="font-semibold text-[var(--intel-sky)]">{entry.q}</div>
                    <div className="text-[var(--text-secondary)] mt-0.5">{entry.a.answer || entry.a.text || JSON.stringify(entry.a)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5">
              <input
                value={chatQ}
                onChange={(e) => setChatQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Query network relationships..."
                className="workstation-input text-xs flex-1"
              />
              <button
                onClick={askAI}
                disabled={chatLoading || !chatQ.trim()}
                className="btn-primary py-1 px-3 text-xs"
              >
                {chatLoading ? "..." : "Query"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Analysis Workbench ── */}
      <div className="border-t border-[var(--border-subtle)] shrink-0 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[var(--border-subtle)]">
          {(
            [
              { id: "centrality", label: "Key Influencer Contacts", icon: Zap },
              { id: "communities", label: "Co-Conspirator Groups", icon: Layers },
              { id: "paths", label: "Connection Route Finder", icon: GitBranch },
              { id: "anomalies", label: "Unusual Activity Flags", icon: AlertTriangle },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setBottomTab(id as BottomTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-all ${
                bottomTab === id
                  ? "bg-zinc-800 text-zinc-100 font-semibold border-b-2 border-zinc-100 shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}

          {highlightPath && (
            <button
              onClick={() => setHighlightPath(undefined)}
              className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded border border-[rgba(239,68,68,0.4)] text-[var(--status-alert)] hover:bg-[rgba(239,68,68,0.1)] transition-all"
            >
              Clear Route ✕
            </button>
          )}
        </div>

        <div className="p-4 h-36 overflow-y-auto bg-[var(--bg-panel)]">
          {bottomTab === "centrality" && centrality && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-bold text-[11px] text-[var(--intel-sky)] uppercase mb-1.5">
                  Top by Influence (PageRank)
                </div>
                <div className="space-y-1">
                  {centrality.top_by_pagerank?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-0.5 px-1.5 rounded hover:bg-[var(--bg-panel-hover)] cursor-pointer"
                    >
                      <span className="text-[var(--text-primary)]">{r.name}</span>
                      <span className="font-mono text-[var(--intel-sky)]">{(r.pagerank * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-[11px] text-[var(--status-purple)] uppercase mb-1.5">
                  Key Bridge Contacts (Betweenness)
                </div>
                <div className="space-y-1">
                  {centrality.top_bridges?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-0.5 px-1.5 rounded hover:bg-[var(--bg-panel-hover)] cursor-pointer"
                    >
                      <span className="text-[var(--text-primary)]">{r.name}</span>
                      <span className="font-mono text-[var(--status-purple)]">{(r.betweenness_centrality * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-[11px] text-[var(--status-warning)] uppercase mb-1.5">
                  High-Connectivity Hubs (Degree)
                </div>
                <div className="space-y-1">
                  {centrality.top_by_degree?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-0.5 px-1.5 rounded hover:bg-[var(--bg-panel-hover)] cursor-pointer"
                    >
                      <span className="text-[var(--text-primary)]">{r.name}</span>
                      <span className="font-mono text-[var(--status-warning)]">{(r.degree_centrality * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bottomTab === "communities" && communities && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {communities.communities?.map((c: any) => (
                <div key={c.community_id} className="p-2.5 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                  <div className="font-bold text-[var(--text-primary)]">
                    Cluster #{c.community_id} ({c.size} Associates)
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate mt-1">
                    Primary: {c.members?.slice(0, 3).map((m: any) => m.name).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bottomTab === "paths" && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 max-w-xl">
                <select
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  className="workstation-input flex-1 text-xs"
                >
                  <option value="">Select Entity A...</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                  ))}
                </select>
                <span className="text-[var(--text-muted)]">to</span>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="workstation-input flex-1 text-xs"
                >
                  <option value="">Select Entity B...</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                  ))}
                </select>
                <button
                  onClick={findShortestPath}
                  disabled={pathLoading || !sourceNodeId || !targetNodeId}
                  className="btn-primary py-1 px-3 text-xs"
                >
                  {pathLoading ? "Tracing..." : "Trace Route"}
                </button>
              </div>

              {pathResult && (
                <div className="p-2 rounded bg-[var(--bg-panel-raised)] text-[11px] font-mono text-[var(--intel-sky)]">
                  {pathResult.error ? (
                    <span className="text-[var(--status-alert)]">{pathResult.error}</span>
                  ) : (
                    <span>Route Identified: {pathResult.path?.join(" → ")}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {bottomTab === "anomalies" && anomalies && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {anomalies.anomalies?.map((a: any, i: number) => (
                <div key={i} className="p-2 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                  <div className="font-bold text-[var(--status-warning)]">{a.title || a.type || "Unusual Activity"}</div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{a.description || a.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
