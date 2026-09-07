import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import NetworkGraph, { type GraphNode } from "../components/NetworkGraph";
import { getEntityColor, getPoliceRelationLabel } from "../components/Network3DGraph";
import {
  Search,
  Network,
  AlertTriangle,
  GitBranch,
  Layers,
  Zap,
  Filter,
  RefreshCw,
  ShieldCheck,
  Compass,
  Clock,
  ChevronRight,
  Sparkles,
  Share2,
  FolderOpen,
  Radio,
  CreditCard,
  X,
} from "lucide-react";

type BottomTab = "centrality" | "communities" | "paths" | "anomalies";

export default function NetworkIntelligence() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramEntityId = searchParams.get("entity_id") || "";
  const paramCaseId = searchParams.get("case_id") || "";

  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(paramCaseId);
  const [scopeEntityId, setScopeEntityId] = useState<string>(paramEntityId);
  const [caseList, setCaseList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null);
  const [dossier, setDossier] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // 3D Neural View vs 2D Fallback & Subgraph Depth
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [focusDegree, setFocusDegree] = useState<1 | 2 | 3>(1);

  // Bottom Workbench state
  const [bottomTab, setBottomTab] = useState<BottomTab>("centrality");
  const [centrality, setCentrality] = useState<any>(null);
  const [communities, setCommunities] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);

  // AI Assistant chat state
  const [chatQ, setChatQ] = useState("");
  const [chatLog, setChatLog] = useState<{ q: string; a: any }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Shortest Path finder state
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [pathResult, setPathResult] = useState<any>(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    api.cases().then((res) => setCaseList(res.cases || [])).catch(() => {});
  }, []);

  function loadGraph() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (entityTypeFilter) params.entity_type = entityTypeFilter;
    if (selectedCaseId) params.case_id = selectedCaseId;
    if (scopeEntityId) {
      params.entity_id = scopeEntityId;
      params.depth = focusDegree.toString();
    }

    api.networkGraph(params)
      .then((data) => {
        setGraph(data);
        setLoading(false);
        // If scoped to entity, auto-select that node
        if (scopeEntityId && data?.nodes) {
          const matched = data.nodes.find((n: any) => n.id === scopeEntityId);
          if (matched) {
            selectNode(matched);
          }
        }
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadGraph();
  }, [entityTypeFilter, selectedCaseId, scopeEntityId, focusDegree]);

  useEffect(() => {
    api.centrality().then(setCentrality).catch(() => {});
    api.communities().then(setCommunities).catch(() => {});
    api.anomalies().then(setAnomalies).catch(() => {});
  }, []);

  function selectNode(n: GraphNode) {
    setSelected(n);
    setSelectedEdge(null);
    setHighlightPath(undefined);

    // Fetch full 360 intelligence dossier
    api.dossier(n.id)
      .then((data) => setDossier(data))
      .catch(() => setDossier(null));

    // Fetch live chronological activity from timeline feed
    setTimelineLoading(true);
    api.timeline({ entity_id: n.id, limit: 5 })
      .then((res) => {
        setTimelineEvents(res.timeline || []);
        setTimelineLoading(false);
      })
      .catch(() => {
        setTimelineEvents([]);
        setTimelineLoading(false);
      });
  }

  function selectEdge(edge: any) {
    setSelected(null);
    setSelectedEdge(edge);
    setDossier(null);
    setTimelineEvents([]);
  }

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    if (!search.trim()) return graph.nodes;
    const s = search.toLowerCase();
    return graph.nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(s) ||
        (n.role_label && n.role_label.toLowerCase().includes(s)) ||
        n.type.toLowerCase().includes(s)
    );
  }, [graph, search]);

  async function askAI() {
    if (!chatQ.trim()) return;
    const q = chatQ;
    setChatQ("");
    setChatLoading(true);
    try {
      const res = await api.chat(q);
      setChatLog((log) => [{ q, a: res }, ...log]);
    } catch {
      setChatLog((log) => [
        { q, a: { answer: "Query failed. Please verify network connectivity." } },
        ...log,
      ]);
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
    } catch {
      setPathResult({ error: "No recorded association route between selected entities." });
    } finally {
      setPathLoading(false);
    }
  }

  // Connection Summary statistics for selected entity
  const connectionStats = useMemo(() => {
    if (!selected) return null;
    const directCount = dossier?.connections?.length || 0;
    const relatedCases = dossier?.related_cases?.length || 0;
    const locationsCount =
      dossier?.connections?.filter((c: any) => c.type === "LOCATION").length || 0;
    const communityId =
      dossier?.network_position?.community_id ?? selected.community ?? "N/A";

    return { directCount, relatedCases, locationsCount, communityId };
  }, [selected, dossier]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#020617]">
      {/* ── Top HUD Control Strip ── */}
      <div className="px-5 py-3.5 border-b border-slate-800/90 flex flex-col gap-3 bg-slate-900/95 backdrop-blur-md shadow-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[11px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30">
              STATE NETWORK INTELLIGENCE & SYNDICATE TOPOLOGY
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          {graph && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
              <span className="font-bold text-sky-300">{graph.nodes.length} Nodes</span>
              <span>·</span>
              <span className="text-slate-300">{graph.edges.length} Corroborated Links</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md shrink-0">
              <Network size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Entity Network Analysis Workspace
                </h1>
                <span className="badge badge-low text-xs bg-sky-950/80 text-sky-300 border border-sky-800/60 font-mono">
                  {viewMode === "3d" ? "3D NEURAL GRAPH" : "2D PLANAR GRAPH"}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-normal leading-relaxed mt-0.5">
                Multi-hop associative clustering, key connectors, and neural relationship maps
              </p>
            </div>
          </div>

          {/* View Mode Toggle & Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 3D vs 2D Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs shadow-inner">
              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-mono text-xs ${
                  viewMode === "3d"
                    ? "bg-slate-800 text-sky-300 border border-sky-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles size={13} />
                <span>3D Neural</span>
              </button>
              <button
                onClick={() => setViewMode("2d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-mono text-xs ${
                  viewMode === "2d"
                    ? "bg-slate-800 text-sky-300 border border-sky-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={13} />
                <span>2D Planar</span>
              </button>
            </div>

            {/* Search Node */}
            <div className="relative w-64 flex items-center">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredNodes.length > 0) {
                    selectNode(filteredNodes[0]);
                  }
                }}
                placeholder="Filter or find entity..."
                style={{ paddingLeft: "2.4rem" }}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 text-slate-100 placeholder-slate-500 rounded-xl py-2 text-xs md:text-sm font-mono outline-none"
              />
            </div>

            {/* Case Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <FolderOpen size={14} className="text-slate-400" />
              <select
                value={selectedCaseId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCaseId(val);
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    if (val) next.set("case_id", val);
                    else next.delete("case_id");
                    return next;
                  });
                }}
                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer max-w-[160px] truncate font-mono"
              >
                <option value="" className="bg-slate-900">All Cases (Global)</option>
                {caseList.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.case_number}: {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Filter size={14} className="text-slate-400" />
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer font-mono"
              >
                <option value="" className="bg-slate-900">All Entity Types</option>
                <option value="PERSON" className="bg-slate-900">Persons</option>
                <option value="PHONE" className="bg-slate-900">Phones</option>
                <option value="VEHICLE" className="bg-slate-900">Vehicles</option>
                <option value="LOCATION" className="bg-slate-900">Locations</option>
                <option value="GANG" className="bg-slate-900">Syndicates</option>
                <option value="BANK_ACCOUNT" className="bg-slate-900">Bank Accounts</option>
                <option value="CASE" className="bg-slate-900">Cases</option>
              </select>
            </div>

            {/* Refresh Simulation */}
            <button
              onClick={loadGraph}
              title="Refresh network simulation"
              className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white bg-slate-950 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Active Scope Sub-Strip */}
      {(selectedCaseId || scopeEntityId) && (
        <div className="px-5 py-2 bg-sky-950/40 border-b border-sky-800/40 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase text-sky-400 font-bold">Scoped Context:</span>
            {selectedCaseId && (
              <span className="badge badge-low text-xs bg-sky-900/60 text-sky-200 border border-sky-700/60 font-mono">
                Case: {caseList.find((c) => c.id === selectedCaseId)?.case_number || selectedCaseId.slice(0, 8)}
              </span>
            )}
            {scopeEntityId && (
              <span className="badge badge-low text-xs bg-sky-900/60 text-sky-200 border border-sky-700/60 font-mono">
                Subject: {graph?.nodes.find((n) => n.id === scopeEntityId)?.name || scopeEntityId.slice(0, 8)} ({focusDegree}° depth)
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCaseId("");
              setScopeEntityId("");
              setSearchParams({});
            }}
            className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 font-medium cursor-pointer"
          >
            <X size={13} />
            <span>Reset Scoped View</span>
          </button>
        </div>
      )}

      {/* ── Main Workspace: 3D/2D Graph Canvas + Entity Dossier ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Canvas Workspace */}
        <div className="flex-1 min-w-0 h-full relative bg-[var(--bg-void)]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-[var(--intel-sky)] border-t-transparent animate-spin" />
              <div className="text-xs md:text-sm font-mono text-[var(--intel-sky)] uppercase tracking-wider font-semibold">
                Computing 3D association matrix...
              </div>
            </div>
          ) : graph ? (
            <NetworkGraph
              nodes={filteredNodes}
              edges={graph.edges}
              selectedNodeId={selected?.id}
              onSelect={selectNode}
              onSelectEdge={selectEdge}
              highlightPath={highlightPath}
              viewMode={viewMode}
              focusDegree={focusDegree}
              onDegreeChange={setFocusDegree}
              onResetFocus={() => {
                setSelected(null);
                setSelectedEdge(null);
                setDossier(null);
                setTimelineEvents([]);
              }}
            />
          ) : (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Failed to load network graph. Please verify backend status.
            </div>
          )}
        </div>

        {/* ── Right Inspection Drawer (The Redesigned Entity Dossier) ── */}
        <div className="w-[420px] shrink-0 border-l border-slate-800/90 flex flex-col min-h-0 bg-slate-900/95 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {selectedEdge ? "Relationship Record" : "Entity Dossier"}
              </span>
            </div>

            {selected && (
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded uppercase font-mono tracking-wider"
                style={{
                  background: `${getEntityColor(selected.type)}22`,
                  color: getEntityColor(selected.type),
                  border: `1px solid ${getEntityColor(selected.type)}55`,
                }}
              >
                {selected.type}
              </span>
            )}

            {selectedEdge && (
              <span className="badge badge-low text-xs font-mono font-bold">
                {Math.round((selectedEdge.confidence_score || 0.8) * 100)}% Corroborated
              </span>
            )}
          </div>

          {/* Dossier Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Edge Selection View */}
            {selectedEdge ? (
              <div className="space-y-3.5">
                <div className="p-4 rounded-xl bg-slate-950/70 space-y-2 border border-slate-800 shadow-md">
                  <div className="text-xs font-mono text-sky-400 uppercase tracking-wider font-bold">
                    CORROBORATED CONNECTION RECORD
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="truncate">{selectedEdge.source?.name}</span>
                    <span className="text-sky-400">↔</span>
                    <span className="truncate">{selectedEdge.target?.name}</span>
                  </div>
                  <div className="text-xs font-mono text-amber-300 font-semibold uppercase">
                    {getPoliceRelationLabel(selectedEdge.relationship_type)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 space-y-2 border border-slate-800 shadow-md">
                  <div className="text-xs font-mono text-slate-400 uppercase font-bold">SUPPORTING EVIDENCE SOURCE</div>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Association verified under primary case records and validated intelligence logs.
                  </p>
                  {selectedEdge.evidence_id && (
                    <div className="text-xs font-mono text-slate-400">
                      Evidence Ref: <span className="text-sky-300">{selectedEdge.evidence_id}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedEdge(null)}
                  className="btn-ghost w-full text-xs md:text-sm py-2 border border-slate-800 text-slate-300 hover:text-white"
                >
                  Clear Selection
                </button>
              </div>
            ) : !selected ? (
              /* Empty State when No Entity is Selected */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <div className="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                  <Compass size={28} className="opacity-50 text-sky-400" />
                </div>
                <div className="text-sm font-bold text-slate-200 uppercase tracking-wider">No Entity Selected</div>
                <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed font-mono mt-1">
                  Click any node in the 3D neural map or search above to isolate its direct relationships,
                  examine case ties, and review timeline records.
                </p>
              </div>
            ) : (
              /* Selected Entity Dossier */
              <div className="space-y-4">
                {/* Entity Identity Card */}
                <div className="panel p-4 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-2.5 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-[var(--text-primary)] leading-tight">
                        {selected.name}
                      </div>
                      <div className="text-xs font-mono text-amber-400 font-semibold mt-1">
                        {selected.role_label || dossier?.identity?.role || "Recorded Associate"}
                      </div>
                    </div>
                    {dossier?.identity?.risk_band && (
                      <span className="badge badge-low text-xs font-mono font-bold uppercase">
                        {dossier.identity.risk_band} RISK
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-[var(--text-muted)] truncate">
                    ENTITY ID: {selected.id}
                  </div>

                  {/* Aliases if present */}
                  {dossier?.identity?.aliases?.length > 0 && (
                    <div className="text-xs text-slate-300 pt-1.5 border-t border-slate-800">
                      <span className="text-slate-400">Known Aliases: </span>
                      {dossier.identity.aliases.join(", ")}
                    </div>
                  )}
                </div>

                {/* Connection Summary Stats */}
                {connectionStats && (
                  <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-panel-raised)] border border-slate-800/80 shadow-sm">
                      <div className="text-xl font-bold font-mono text-[var(--intel-sky)]">
                        {connectionStats.directCount}
                      </div>
                      <div className="text-[11px] uppercase font-mono text-[var(--text-muted)] font-semibold mt-0.5">
                        Direct Links
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-panel-raised)] border border-slate-800/80 shadow-sm">
                      <div className="text-xl font-bold font-mono text-rose-400">
                        {connectionStats.relatedCases}
                      </div>
                      <div className="text-[11px] uppercase font-mono text-[var(--text-muted)] font-semibold mt-0.5">
                        Linked Cases
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-panel-raised)] border border-slate-800/80 shadow-sm">
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {connectionStats.locationsCount}
                      </div>
                      <div className="text-[11px] uppercase font-mono text-[var(--text-muted)] font-semibold mt-0.5">
                        Locations
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-panel-raised)] border border-slate-800/80 shadow-sm">
                      <div className="text-xl font-bold font-mono text-purple-400">
                        #{connectionStats.communityId}
                      </div>
                      <div className="text-[11px] uppercase font-mono text-[var(--text-muted)] font-semibold mt-0.5">
                        Cluster
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Toolbar */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const nextDeg = (focusDegree === 1 ? 2 : 1) as 1 | 2;
                        setFocusDegree(nextDeg);
                        if (selected) {
                          setScopeEntityId(selected.id);
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-950/60 border border-sky-800/60 text-sky-300 text-xs md:text-sm hover:bg-sky-900/60 transition-all font-semibold cursor-pointer"
                      title="Expand or collapse network hops around this subject"
                    >
                      <Share2 size={13} />
                      <span>{focusDegree === 1 ? "Expand 2° Hops" : "Collapse to 1°"}</span>
                    </button>

                    <button
                      onClick={() => navigate(`/timeline?entity_id=${selected.id}${selectedCaseId ? `&case_id=${selectedCaseId}` : ""}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs md:text-sm hover:bg-slate-700 transition-all font-semibold cursor-pointer"
                      title="View chronological timeline for this entity"
                    >
                      <Clock size={13} />
                      <span>Timeline</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => navigate(`/communications?entity_id=${selected.id}${selectedCaseId ? `&case_id=${selectedCaseId}` : ""}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs md:text-sm hover:bg-slate-700 transition-all font-semibold cursor-pointer"
                      title="Inspect telephony and CDR traces for this entity"
                    >
                      <Radio size={13} />
                      <span>Communications</span>
                    </button>

                    <button
                      onClick={() => navigate(`/transactions?entity_id=${selected.id}${selectedCaseId ? `&case_id=${selectedCaseId}` : ""}`)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs md:text-sm hover:bg-slate-700 transition-all font-semibold cursor-pointer"
                      title="Inspect financial transactions for this entity"
                    >
                      <CreditCard size={13} />
                      <span>Transactions</span>
                    </button>
                  </div>
                </div>

                {/* Corroborated Relationships List */}
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-2 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="hud-label text-xs font-mono font-bold uppercase text-[var(--intel-sky)] tracking-wider">
                      CORROBORATED RELATIONSHIPS ({dossier?.connections?.length || 0})
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Click to Pivot</span>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {dossier?.connections && dossier.connections.length > 0 ? (
                      dossier.connections.map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            const targetNode = graph?.nodes.find((n) => n.id === c.id);
                            if (targetNode) {
                              selectNode(targetNode);
                            }
                          }}
                          className="p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800/80 cursor-pointer transition-all flex items-center justify-between gap-2 group shadow-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: getEntityColor(c.type) }}
                              />
                              <span className="text-xs md:text-sm font-bold text-slate-200 truncate group-hover:text-sky-300">
                                {c.name}
                              </span>
                            </div>
                            <div className="text-xs text-amber-400/90 font-mono mt-0.5 truncate font-medium">
                              {getPoliceRelationLabel(c.relationship_type)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono text-slate-400 font-semibold">
                              {Math.round((c.confidence || 0.8) * 100)}%
                            </span>
                            <ChevronRight size={13} className="text-slate-500 group-hover:text-white inline ml-1" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[var(--text-muted)] py-2 text-center">
                        No direct relationships recorded.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Chronological Activity */}
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-2 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="hud-label text-xs font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                      RECENT INTELLIGENCE ACTIVITY
                    </div>
                    {timelineLoading && <RefreshCw size={12} className="animate-spin text-sky-400" />}
                  </div>

                  <div className="space-y-2">
                    {timelineEvents.length > 0 ? (
                      timelineEvents.slice(0, 3).map((evt: any, idx: number) => (
                        <div
                          key={evt.id || idx}
                          className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-200 truncate text-xs">{evt.title}</span>
                            <span className="text-xs font-mono text-slate-400 shrink-0">
                              {evt.timestamp ? new Date(evt.timestamp).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[var(--text-muted)] py-2 text-center">
                        {timelineLoading ? "Retrieving activity feed..." : "No recent activity records found."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Natural Language Investigation Query Input */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-950 space-y-2">
            {chatLog.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1.5 text-xs mb-1">
                {chatLog.slice(0, 2).map((entry, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="font-semibold text-sky-300">{entry.q}</div>
                    <div className="text-slate-300 mt-1 leading-relaxed">
                      {entry.a.answer || entry.a.text || JSON.stringify(entry.a)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={chatQ}
                onChange={(e) => setChatQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Ask investigative assistant..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 outline-none flex-1 font-mono"
              />
              <button
                onClick={askAI}
                disabled={chatLoading || !chatQ.trim()}
                className="btn-primary py-2 px-4 text-xs md:text-sm font-semibold cursor-pointer shrink-0"
              >
                {chatLoading ? "..." : "Query"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Analysis Workbench ── */}
      <div className="border-t border-slate-800 shrink-0 bg-slate-950 shadow-xl">
        <div className="flex items-center gap-1.5 px-5 pt-2.5 border-b border-slate-800/80">
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
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-lg transition-all cursor-pointer ${
                bottomTab === id
                  ? "bg-slate-800 text-sky-300 border-b-2 border-sky-400 shadow-sm font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}

          {highlightPath && (
            <button
              onClick={() => setHighlightPath(undefined)}
              className="ml-auto text-xs font-mono px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-950/40 transition-all cursor-pointer font-semibold"
            >
              Clear Route ✕
            </button>
          )}
        </div>

        <div className="p-4 h-40 overflow-y-auto bg-slate-900/90">
          {bottomTab === "centrality" && centrality && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div>
                <div className="font-bold text-xs font-mono text-sky-400 uppercase tracking-wider mb-2">
                  Top by Influence (PageRank)
                </div>
                <div className="space-y-1.5">
                  {centrality.top_by_pagerank?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-1 px-2 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-200 font-semibold truncate max-w-[170px] text-xs md:text-sm">{r.name}</span>
                      <span className="font-mono text-sky-300 font-bold text-xs md:text-sm">{(r.pagerank * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-xs font-mono text-purple-400 uppercase tracking-wider mb-2">
                  Key Bridge Contacts (Betweenness)
                </div>
                <div className="space-y-1.5">
                  {centrality.top_bridges?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-1 px-2 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-200 font-semibold truncate max-w-[170px] text-xs md:text-sm">{r.name}</span>
                      <span className="font-mono text-purple-300 font-bold text-xs md:text-sm">
                        {(r.betweenness_centrality * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-xs font-mono text-amber-400 uppercase tracking-wider mb-2">
                  High-Connectivity Hubs (Degree)
                </div>
                <div className="space-y-1.5">
                  {centrality.top_by_degree?.slice(0, 4).map((r: any) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const n = graph?.nodes.find((node) => node.id === r.id);
                        if (n) selectNode(n);
                      }}
                      className="flex justify-between py-1 px-2 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-200 font-semibold truncate max-w-[170px] text-xs md:text-sm">{r.name}</span>
                      <span className="font-mono text-amber-300 font-bold text-xs md:text-sm">
                        {(r.degree_centrality * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bottomTab === "communities" && communities && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              {communities.communities?.map((c: any) => (
                <div
                  key={c.community_id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 shadow-sm"
                >
                  <div className="font-bold text-white text-xs md:text-sm">
                    Cluster #{c.community_id} ({c.size} Associates)
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-1">
                    Primary: {c.members?.slice(0, 3).map((m: any) => m.name).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bottomTab === "paths" && (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 max-w-2xl">
                <select
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs md:text-sm text-slate-200 outline-none flex-1 font-mono cursor-pointer"
                >
                  <option value="">Select Entity A...</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
                <span className="text-slate-400 font-mono text-sm">↔</span>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs md:text-sm text-slate-200 outline-none flex-1 font-mono cursor-pointer"
                >
                  <option value="">Select Entity B...</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
                <button
                  onClick={findShortestPath}
                  disabled={pathLoading || !sourceNodeId || !targetNodeId}
                  className="btn-primary py-2 px-4 text-xs md:text-sm font-semibold shrink-0 cursor-pointer"
                >
                  {pathLoading ? "Tracing..." : "Trace 3D Route"}
                </button>
              </div>

              {pathResult && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs md:text-sm font-mono text-sky-300">
                  {pathResult.error ? (
                    <span className="text-rose-400">{pathResult.error}</span>
                  ) : (
                    <span>
                      Identified Route ({pathResult.path?.length} hops): {pathResult.path_names?.join(" → ") || pathResult.path?.join(" → ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {bottomTab === "anomalies" && anomalies && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {anomalies.anomalies?.map((a: any, i: number) => (
                <div
                  key={i}
                  onClick={() => {
                    if (a.entity_id) {
                      const n = graph?.nodes.find((node) => node.id === a.entity_id);
                      if (n) selectNode(n);
                    }
                  }}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-all shadow-sm"
                >
                  <div className="font-bold text-amber-300 text-xs md:text-sm">
                    {a.title || a.anomaly_type || "Unusual Activity"}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 leading-relaxed">{a.reason}</div>
                  {a.entity_name && (
                    <div className="text-xs text-slate-400 font-mono mt-1.5">Entity: {a.entity_name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
