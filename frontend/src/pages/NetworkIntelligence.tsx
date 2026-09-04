import { useEffect, useState } from "react";
import { api } from "../lib/api";
import NetworkGraph from "../components/NetworkGraph";
import type { GraphNode } from "../components/NetworkGraph";
import { Search, Sparkles } from "lucide-react";

type BottomTab = "centrality" | "communities" | "paths" | "anomalies" | "leads";

export default function NetworkIntelligence() {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: any[] } | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
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

  function loadGraph() {
    api.networkGraph(entityTypeFilter ? { entity_type: entityTypeFilter } : {}).then(setGraph);
  }

  useEffect(loadGraph, [entityTypeFilter]);
  useEffect(() => { api.centrality().then(setCentrality); api.communities().then(setCommunities); api.anomalies().then(setAnomalies); }, []);

  function selectNode(n: GraphNode) {
    setSelected(n);
    setHighlightPath(undefined);
    if (n.type === "PERSON") {
      api.dossier(n.id).then(setDossier);
      api.hiddenLinks(n.id).then(setHiddenLinks);
    } else {
      setDossier(null);
      setHiddenLinks(null);
    }
  }

  const filteredNodes = graph?.nodes.filter((n) => !search || n.name.toLowerCase().includes(search.toLowerCase())) || [];

  async function askAI() {
    if (!chatQ.trim()) return;
    setChatLoading(true);
    try {
      const res = await api.chat(chatQ);
      setChatLog((log) => [{ q: chatQ, a: res }, ...log]);
      setChatQ("");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--border-subtle)" }}>
        <h1 className="text-sm font-semibold whitespace-nowrap">Network Intelligence</h1>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2 top-2 text-[var(--text-muted)]" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entity, phone, vehicle, FIR..."
            className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none focus:border-[var(--accent-teal)]"
          />
        </div>
        <select
          value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="">All entity types</option>
          <option value="PERSON">Person</option>
          <option value="PHONE">Phone</option>
          <option value="VEHICLE">Vehicle</option>
          <option value="LOCATION">Location</option>
          <option value="GANG">Gang</option>
          <option value="ORGANIZATION">Organization</option>
          <option value="BANK_ACCOUNT">Bank account</option>
          <option value="CASE">Case</option>
        </select>
        {graph && (
          <span className="text-[11px] text-[var(--text-muted)] ml-auto">
            {graph.nodes.length} entities · {graph.edges.length} relationships
          </span>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          {graph ? (
            <NetworkGraph nodes={filteredNodes} edges={graph.edges} onSelect={selectNode} highlightPath={highlightPath} />
          ) : (
            <div className="p-6 text-sm text-[var(--text-muted)]">Loading network graph...</div>
          )}
        </div>

        <div className="w-96 shrink-0 border-l flex flex-col min-h-0" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex-1 overflow-auto p-4">
            {!selected && (
              <div className="text-xs text-[var(--text-muted)]">
                Select a node on the graph to see its evidence-backed intelligence profile.
              </div>
            )}
            {selected && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{selected.type}</div>
                  <div className="text-base font-semibold">{selected.name}</div>
                </div>

                {dossier && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="panel p-2">
                        <div className="text-sm font-bold">{(dossier.network_position.degree_centrality * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-[var(--text-muted)]">Degree</div>
                      </div>
                      <div className="panel p-2">
                        <div className="text-sm font-bold">{(dossier.network_position.betweenness_centrality * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-[var(--text-muted)]">Betweenness</div>
                      </div>
                      <div className="panel p-2">
                        <div className="text-sm font-bold">{dossier.network_position.community_size}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">Community size</div>
                      </div>
                    </div>
                    <div className="badge badge-low">{dossier.network_position.role_label}</div>

                    <div>
                      <div className="text-xs font-semibold mb-1">Intelligence Insights</div>
                      <ul className="space-y-1">
                        {dossier.intelligence_insights.map((ins: any, i: number) => (
                          <li key={i} className="text-xs text-[var(--text-secondary)]">
                            <span className="badge badge-low mr-1" style={{ fontSize: 9 }}>{ins.type}</span>
                            {ins.text}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="text-xs font-semibold mb-1">Connections ({dossier.connections.length})</div>
                      <div className="space-y-1 max-h-48 overflow-auto">
                        {dossier.connections.slice(0, 15).map((c: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-subtle)]">
                            <div>
                              <div>{c.name}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{c.relationship_type}</div>
                            </div>
                            <div className="w-14">
                              <div className="confidence-bar"><div className="confidence-fill" style={{ width: `${c.confidence * 100}%` }} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {dossier.anomalies.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold mb-1 text-[var(--accent-red)]">Anomalies</div>
                        {dossier.anomalies.map((a: any) => (
                          <div key={a.id} className="text-xs badge badge-high mb-1 block w-fit">{a.type}</div>
                        ))}
                      </div>
                    )}

                    {hiddenLinks?.findings?.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold mb-1">Hidden Connection Discovered</div>
                        <button
                          onClick={() => setHighlightPath(hiddenLinks.findings[0].path)}
                          className="panel p-2 w-full text-left"
                        >
                          <div className="text-xs">
                            Connected to <b>{hiddenLinks.findings[0].target_name}</b> through {hiddenLinks.findings[0].hop_count} hops
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-1">
                            {hiddenLinks.findings[0].path_names.join(" → ")}
                          </div>
                          <div className="text-[10px] text-[var(--accent-teal)] mt-1">
                            {hiddenLinks.findings[0].distinct_evidence_records} distinct evidence records · click to highlight
                          </div>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t p-3" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-1 text-xs font-semibold mb-2"><Sparkles size={13} color="var(--accent-teal)" /> AI Investigation Assistant</div>
            <div className="max-h-40 overflow-auto space-y-2 mb-2">
              {chatLog.map((entry, i) => (
                <div key={i} className="text-xs">
                  <div className="text-[var(--text-secondary)]">Q: {entry.q}</div>
                  <div className="text-[var(--text-primary)] mt-0.5">{entry.a.answer}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={chatQ} onChange={(e) => setChatQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="e.g. Summarize the network around Ravi"
                className="flex-1 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-xs outline-none"
              />
              <button onClick={askAI} disabled={chatLoading} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-teal)] text-[#08211d] disabled:opacity-50">
                {chatLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex gap-1 px-4 pt-2">
          {(["centrality", "communities", "paths", "anomalies", "leads"] as BottomTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setBottomTab(t)}
              className={`px-3 py-1.5 text-xs rounded-t-lg capitalize ${bottomTab === t ? "bg-[var(--bg-panel)] text-[var(--accent-teal)]" : "text-[var(--text-secondary)]"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-4 h-40 overflow-auto bg-[var(--bg-panel)]">
          {bottomTab === "centrality" && centrality && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold mb-2">Top by PageRank (influence)</div>
                {centrality.top_by_pagerank.map((r: any) => (
                  <div key={r.id} className="flex justify-between text-xs py-0.5">
                    <span>{r.name} <span className="text-[var(--text-muted)]">({r.role_label})</span></span>
                    <span className="mono">{(r.pagerank * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold mb-2">Top Bridge Entities (betweenness)</div>
                {centrality.top_bridges.map((r: any) => (
                  <div key={r.id} className="flex justify-between text-xs py-0.5">
                    <span>{r.name}</span>
                    <span className="mono">{(r.betweenness_centrality * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bottomTab === "communities" && communities && (
            <div className="grid grid-cols-4 gap-3">
              {communities.communities.slice(0, 8).map((c: any) => (
                <div key={c.community_id} className="panel p-2">
                  <div className="text-xs font-semibold mb-1">Community {c.community_id} · {c.size} members</div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {c.members.slice(0, 4).map((m: any) => m.name).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
          {bottomTab === "paths" && (
            <div className="text-xs text-[var(--text-secondary)]">
              Select two entities to trace a path — click a node, then ask the AI assistant e.g. "How is Ravi connected to Suresh?" to trace the shortest evidence-backed path.
            </div>
          )}
          {bottomTab === "anomalies" && anomalies && (
            <div className="space-y-2">
              {anomalies.anomalies.map((a: any) => (
                <div key={a.id} className="flex items-start justify-between text-xs">
                  <div>
                    <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                    <span className="ml-2">{a.entity_name}: {a.reason}</span>
                  </div>
                </div>
              ))}
              {anomalies.anomalies.length === 0 && <div className="text-xs text-[var(--text-muted)]">No anomalies detected.</div>}
            </div>
          )}
          {bottomTab === "leads" && (
            <div className="text-xs text-[var(--text-secondary)]">
              Actionable leads surface from hidden-link discovery and anomalies — select a PERSON node and check its
              "Hidden Connection Discovered" panel on the right for cross-source leads worth investigating.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
