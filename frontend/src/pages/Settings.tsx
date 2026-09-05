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
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <SettingsIcon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Engine Calibration & Threshold Settings
              </h1>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              AI model provider orchestration, identity resolution matching thresholds, and export rules
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] text-xs text-[var(--status-verified)]">
            <CheckCircle2 size={13} />
            <span>Parameters saved successfully</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => <div key={n} className="skeleton h-28 rounded" />)}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Section 1: AI Provider Selection */}
            <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <Cpu size={14} className="text-[var(--text-primary)]" />
                <span>AI Language Model Provider</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Select the primary LLM engine for FIR narrative summarization, cross-case associative reasoning, and tactical investigation chat.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {[
                  { id: "GEMINI", name: "Google Gemini 2.0 Flash", desc: "Multimodal reasoning with law enforcement context" },
                  { id: "GROQ", name: "Groq LLaMA 3.3 70B", desc: "Sub-second inference speed for instant response" },
                  { id: "OPENAI", name: "OpenAI GPT-4o", desc: "High-precision entity resolution & pattern parsing" },
                  { id: "HEURISTIC_EXPLAINABLE", name: "Explainable Rule Engine", desc: "Zero-dependency offline legal parser with regex gazetteer" },
                ].map((prov) => (
                  <div
                    key={prov.id}
                    onClick={() => setAiProvider(prov.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      aiProvider === prov.id
                        ? "border-zinc-500 bg-[var(--bg-panel-raised)] text-zinc-100"
                        : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{prov.name}</span>
                      {aiProvider === prov.id && <span className="w-1.5 h-1.5 rounded-full bg-zinc-100" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{prov.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Algorithmic Thresholds */}
            <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <Sliders size={14} className="text-[var(--text-primary)]" />
                <span>Identity Resolution & Deduplication Thresholds</span>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-[var(--text-primary)]">Minimum Extraction Confidence</span>
                    <span className="font-mono text-zinc-300 font-bold">{Math.round(minConfidence * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-zinc-400"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Entities extracted from FIRs with confidence below this threshold are flagged for manual officer verification.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-[var(--text-primary)]">Fuzzy Matching Threshold</span>
                    <span className="font-mono text-zinc-300 font-bold">{Math.round(fuzzyThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="0.98"
                    step="0.02"
                    value={fuzzyThreshold}
                    onChange={(e) => setFuzzyThreshold(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-zinc-400"
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Jaro-Winkler string similarity threshold for matching person aliases and vehicle registrations across districts.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Judicial Privacy & Export Controls */}
            <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <Shield size={14} className="text-[var(--text-primary)]" />
                <span>Judicial Compliance & Export Rules</span>
              </div>

              <label className="flex items-center gap-3 p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymizePii}
                  onChange={(e) => setAnonymizePii(e.target.checked)}
                  className="rounded accent-zinc-400"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Redact Personally Identifiable Information (PII) in Exported Dossiers
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Mask phone numbers and witness addresses when exporting public or court briefing records.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>{saving ? "Calibrating..." : "Save Configuration"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
