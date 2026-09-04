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
  const [accentColor, setAccentColor] = useState("teal");

  function loadSettings() {
    setLoading(true);
    api.settings()
      .then((res) => {
        const s = res.settings || {};
        setAiProvider(s.ai_provider || "GEMINI");
        setMinConfidence(s.min_confidence_threshold || 0.70);
        setFuzzyThreshold(s.fuzzy_match_threshold || 0.82);
        setAnonymizePii(!!s.anonymize_pii_in_exports);
        setAccentColor(s.dark_mode_accent || "teal");
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
      {/* ── Top HUD Header ── */}
      <div
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 glass-panel"
        style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.05))",
              border: "1px solid rgba(45,212,191,0.3)",
              boxShadow: "0 0 12px rgba(45,212,191,0.2)",
            }}
          >
            <SettingsIcon size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                System Calibration & Engine Settings
              </h1>
              <span className="hud-label text-[9px] text-[var(--neon-teal)]">PREFERENCES</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              AI provider orchestration, algorithmic threshold limits, and cryptographic export rules
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.3)] text-xs text-[var(--neon-teal)] animate-in fade-in">
            <CheckCircle2 size={14} />
            <span>Parameters saved successfully</span>
          </div>
        )}
      </div>

      {/* ── Settings Form Body ── */}
      <div className="flex-1 p-6 overflow-y-auto max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-panel p-6 h-36 rounded-xl animate-pulse border border-[var(--border-subtle)]" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: AI Provider Selection */}
            <div className="glass-panel p-5 rounded-xl border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--neon-teal)]">
                <Cpu size={15} />
                <span>Neural Engine AI Model Provider</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Select the primary LLM engine for FIR narrative summarization, cross-case associative reasoning, and tactical investigation chat.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { id: "GEMINI", name: "Google Gemini 2.0 Flash", desc: "Ultra-fast multimodal reasoning with law enforcement context" },
                  { id: "GROQ", name: "Groq LLaMA 3.3 70B", desc: "Sub-second inference speed for instant tactical response" },
                  { id: "OPENAI", name: "OpenAI GPT-4o", desc: "High-precision entity resolution and complex pattern parsing" },
                  { id: "HEURISTIC_EXPLAINABLE", name: "Explainable Rule Engine", desc: "Zero-dependency offline legal parser with regex gazetteer" },
                ].map((prov) => (
                  <div
                    key={prov.id}
                    onClick={() => setAiProvider(prov.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      aiProvider === prov.id
                        ? "border-[var(--neon-teal)] bg-[rgba(45,212,191,0.08)] shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:border-[rgba(45,212,191,0.3)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{prov.name}</span>
                      {aiProvider === prov.id && <span className="w-2 h-2 rounded-full bg-[var(--neon-teal)] shadow-[0_0_8px_var(--neon-teal)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{prov.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Algorithmic Thresholds */}
            <div className="glass-panel p-5 rounded-xl border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--neon-cyan)]">
                <Sliders size={15} />
                <span>Detection & Resolution Sensitivity</span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[var(--text-primary)] font-medium">Minimum Evidence Confidence Score</span>
                    <span className="font-mono text-[var(--neon-teal)]">{(minConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    className="w-full accent-[var(--neon-teal)] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mt-1">
                    <span>50% (Permissive)</span>
                    <span>95% (High Certainty Only)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[var(--text-primary)] font-medium">Fuzzy Alias & Phonetic Match Cutoff</span>
                    <span className="font-mono text-[var(--neon-cyan)]">{(fuzzyThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.65}
                    max={0.95}
                    step={0.01}
                    value={fuzzyThreshold}
                    onChange={(e) => setFuzzyThreshold(parseFloat(e.target.value))}
                    className="w-full accent-[var(--neon-cyan)] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mt-1">
                    <span>65% (Loose Aliases)</span>
                    <span>95% (Strict Levenshtein)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Legal & Privacy Controls */}
            <div className="glass-panel p-5 rounded-xl border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--neon-amber)]">
                <Shield size={15} />
                <span>Compliance & Legal Privacy Safeguards</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Mask Personally Identifiable Information (PII)</div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Automatically redact phone digits, bank accounts, and civilian witness names in exported PDF reports.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={anonymizePii}
                  onChange={(e) => setAnonymizePii(e.target.checked)}
                  className="w-4 h-4 accent-[var(--neon-teal)] cursor-pointer"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_15px_rgba(45,212,191,0.4)] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <Save size={14} />
                <span>{saving ? "Calibrating System..." : "Save System Calibration"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
