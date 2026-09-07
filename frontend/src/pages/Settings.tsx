import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Settings as SettingsIcon, Cpu, Sliders, Shield,
  Save, CheckCircle2
} from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [aiProvider, setAiProvider] = useState("GEMINI");
  const [minConfidence, setMinConfidence] = useState(0.70);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.82);
  const [anonymizePii, setAnonymizePii] = useState(false);
  const [accentColor, setAccentColor] = useState("zinc");

  function loadSettings() {
    setLoading(true);
    api.settings()
      .then((res) => {
        const s = res.settings || {};
        setAiProvider(s.ai_provider || "GEMINI");
        setMinConfidence(s.min_confidence_threshold || 0.70);
        setFuzzyThreshold(s.fuzzy_match_threshold || 0.82);
        setAnonymizePii(!!s.anonymize_pii_in_exports);
        setAccentColor(s.dark_mode_accent || "zinc");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        ai_provider: aiProvider,
        min_confidence_threshold: Number(minConfidence),
        fuzzy_match_threshold: Number(fuzzyThreshold),
        anonymize_pii_in_exports: anonymizePii,
        dark_mode_accent: accentColor,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-100 overflow-hidden">
      {/* Tactical Module Header */}
      <div className="flex-none px-6 py-4 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <SettingsIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono tracking-widest text-sky-400 uppercase font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                  STATE ENGINE CALIBRATION & PARAMETER GOVERNANCE
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE CONFIGURATION
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  ACTIVE PROVIDER: {aiProvider}
                </span>
              </div>
              <h1 className="text-sm font-black tracking-wide text-white uppercase text-glow-white">
                SYSTEM CALIBRATION & THRESHOLD CONTROLS
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI model provider orchestration, identity resolution matching thresholds, and judicial privacy export rules
              </p>
            </div>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs font-semibold text-emerald-300 animate-in fade-in duration-200">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>Engine Parameters Calibrated & Saved Successfully</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: AI Provider Selection */}
            <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800/80">
                <Cpu size={16} className="text-sky-400" />
                <span>Primary AI Inference Engine Orchestration</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select the primary LLM engine for FIR narrative summarization, cross-case associative reasoning, and tactical investigation chat.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {[
                  { id: "GEMINI", name: "Google Gemini 2.0 Flash", desc: "Multimodal reasoning with high-fidelity law enforcement context", badge: "RECOMMENDED" },
                  { id: "GROQ", name: "Groq LLaMA 3.3 70B", desc: "Sub-second inference speed for instantaneous tactical response", badge: "HIGH SPEED" },
                  { id: "OPENAI", name: "OpenAI GPT-4o", desc: "High-precision complex entity resolution & multi-hop pattern parsing", badge: "MAX REASONING" },
                  { id: "HEURISTIC_EXPLAINABLE", name: "Explainable Rule Engine", desc: "Zero-dependency offline legal parser with regex gazetteer for air-gapped deployments", badge: "OFFLINE AIR-GAP" },
                ].map((prov) => {
                  const isSelected = aiProvider === prov.id;
                  return (
                    <div
                      key={prov.id}
                      onClick={() => setAiProvider(prov.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-sky-500/70 bg-sky-950/40 text-white ring-1 ring-sky-500/50"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950/90 text-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isSelected ? "text-sky-300 text-glow-sky" : "text-slate-200"}`}>
                              {prov.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{prov.desc}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {isSelected ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full border border-slate-700" />
                          )}
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                            isSelected ? "bg-sky-900/60 text-sky-200 border border-sky-700/60" : "bg-slate-900 text-slate-500 border border-slate-800"
                          }`}>
                            {prov.badge}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Algorithmic Thresholds */}
            <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800/80">
                <Sliders size={16} className="text-sky-400" />
                <span>Identity Resolution & Deduplication Calibration</span>
              </div>

              <div className="space-y-6 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200 block">Minimum Extraction Confidence</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Entities extracted with confidence below this score are automatically flagged for officer verification.
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-md">
                      {Math.round(minConfidence * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>50% (Permissive / High Recall)</span>
                    <span>70% (Balanced)</span>
                    <span>95% (Conservative / High Precision)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200 block">Cross-District Fuzzy Matching Threshold</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Jaro-Winkler similarity index required to cluster aliases, phonetic spellings, and vehicle plates.
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-md">
                      {Math.round(fuzzyThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="0.98"
                    step="0.02"
                    value={fuzzyThreshold}
                    onChange={(e) => setFuzzyThreshold(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>60% (Loose Matching)</span>
                    <span>82% (Standard Law Enforcement)</span>
                    <span>98% (Strict Exact Match)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Judicial Privacy & Export Controls */}
            <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800/80">
                <Shield size={16} className="text-sky-400" />
                <span>Judicial Compliance & Automated Redaction</span>
              </div>

              <label className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymizePii}
                  onChange={(e) => setAnonymizePii(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">
                    Enforce Mandatory PII Redaction in Exported Briefings
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Automatically mask civilian mobile numbers, Aadhaar indices, and confidential witness residential addresses when generating court-ready or multi-agency dossiers.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-500 font-mono">
                Changes apply instantly across all active investigation pipelines.
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-lg shadow-sky-950/50 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Save size={15} />
                <span>{saving ? "Calibrating..." : "Save System Configuration"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
