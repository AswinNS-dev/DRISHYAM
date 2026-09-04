import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Search } from "lucide-react";

const TYPES = ["PERSON", "PHONE", "VEHICLE", "LOCATION", "GANG", "ORGANIZATION", "BANK_ACCOUNT"];

export default function Entities() {
  const [entityType, setEntityType] = useState("PERSON");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.entities(entityType, q).then((r) => setRows(r.entities)).finally(() => setLoading(false));
  }, [entityType, q]);

  async function openDossier(id: string) {
    const d = await api.dossier(id);
    setSelected(d);
  }

  return (
    <div className="p-6 flex gap-6 h-full min-h-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-lg font-semibold">Entities</h1>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search size={14} className="absolute left-2 top-2.5 text-[var(--text-muted)]" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name..."
              className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-7 pr-3 py-2 text-xs outline-none focus:border-[var(--accent-teal)]"
            />
          </div>
          <select
            value={entityType} onChange={(e) => setEntityType(e.target.value)}
            className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2 py-2 text-xs"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
          </select>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="px-4 py-2 font-medium">Name</th>
                {entityType === "PERSON" && <th className="px-4 py-2 font-medium">Role</th>}
                {entityType === "PERSON" && <th className="px-4 py-2 font-medium">Risk band</th>}
                {entityType === "PERSON" && <th className="px-4 py-2 font-medium">Aliases</th>}
                <th className="px-4 py-2 font-medium">Data source</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-panel-raised)]">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  {entityType === "PERSON" && <td className="px-4 py-2 capitalize">{r.role}</td>}
                  {entityType === "PERSON" && <td className="px-4 py-2"><span className={`badge badge-${r.risk_band === "unknown" ? "low" : r.risk_band}`}>{r.risk_band}</span></td>}
                  {entityType === "PERSON" && <td className="px-4 py-2 text-[var(--text-secondary)]">{r.aliases?.join(", ") || "-"}</td>}
                  <td className="px-4 py-2"><span className="badge badge-demo">{r.data_source}</span></td>
                  <td className="px-4 py-2 text-right">
                    {entityType === "PERSON" ? (
                      <button onClick={() => openDossier(r.id)} className="text-[var(--accent-teal)]">Dossier</button>
                    ) : (
                      <button onClick={() => navigate("/network")} className="text-[var(--accent-teal)]">View in network</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <div className="p-6 text-center text-xs text-[var(--text-muted)]">No entities found.</div>}
          {loading && <div className="p-6 text-center text-xs text-[var(--text-muted)]">Loading...</div>}
        </div>
      </div>

      {selected && (
        <div className="w-96 shrink-0 panel p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-semibold">{selected.identity.name}</div>
            <button onClick={() => setSelected(null)} className="text-xs text-[var(--text-muted)]">Close</button>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mb-1">Aliases: {selected.identity.aliases.join(", ") || "None"}</div>
          <div className="badge badge-low mb-3">{selected.network_position.role_label}</div>
          <div className="text-xs font-semibold mb-1">Intelligence Insights</div>
          <ul className="space-y-1 mb-3">
            {selected.intelligence_insights.map((ins: any, i: number) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">{ins.text}</li>
            ))}
          </ul>
          <button onClick={() => navigate("/network")} className="w-full py-2 rounded-lg text-xs font-semibold bg-[var(--accent-teal)] text-[#08211d]">
            Open in Network Intelligence
          </button>
        </div>
      )}
    </div>
  );
}
