"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Calendar, ChevronDown, ChevronUp, Copy, Download, FileText, Sparkles, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function CrashPackPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [packs, setPacks] = useState<any[]>([]);
  const [currentPack, setCurrentPack] = useState<any>(null);
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const res = await fetch("/api/crash-pack");
      if (res.ok) {
        const data = await res.json();
        setPacks(data);
        if (data.length > 0) {
          setCurrentPack(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch packs", err);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crash-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      if (!res.ok) throw new Error("Failed to generate Crash Pack");
      const data = await res.json();
      
      setCurrentPack(data);
      // Prepend to history
      setPacks((prev) => [data, ...prev]);
      setJobDescription("");
    } catch (err: any) {
      setError(err.message || "Failed to generate your crash pack. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "HIGH":
        return "bg-red-500/10 text-red-400 border-red-500/25";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/25";
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-gray-900 bg-[#0c0c0e]/85 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">
          ◀ INTERVIEWOS <span className="text-white text-xs px-2 py-0.5 bg-zinc-800 rounded">CRASH PACK</span>
        </Link>
      </header>

      {/* Main Grid Layout */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & History (5 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Generator Form */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur shadow-xl">
            <h2 className="text-xl font-extrabold flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Generate Crash Pack
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Paste Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the target role description, key skills and responsibilities here..."
                  className="w-full h-44 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 transition-colors text-xs text-zinc-300 leading-relaxed resize-none"
                  disabled={loading}
                />
              </div>

              {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 p-3 rounded-xl">{error}</div>}

              <button
                type="submit"
                disabled={loading || !jobDescription.trim()}
                className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 font-extrabold py-3.5 rounded-xl text-xs transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Build Personal Briefing"}
              </button>
            </form>
          </div>

          {/* History Sidebar */}
          <div className="bg-zinc-900/20 border border-zinc-800/40 rounded-3xl p-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Saved Briefings</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {packs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setCurrentPack(p)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    currentPack?.id === p.id
                      ? "bg-zinc-800/40 border-zinc-700 text-white"
                      : "bg-zinc-900/10 border-zinc-900 text-zinc-400 hover:bg-zinc-900/40"
                  }`}
                >
                  <FileText className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500/80" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold truncate leading-tight">
                      {p.job_description.substring(0, 45)}...
                    </p>
                    <span className="text-[10px] text-zinc-500 block mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
              {packs.length === 0 && (
                <div className="text-xs text-zinc-600 text-center py-6">No saved briefings found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Display View (8 Cols) */}
        <div className="lg:col-span-8">
          {currentPack ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold flex items-center gap-2">
                    <BookOpen className="text-emerald-400" />
                    Personalized Crash Pack
                  </h1>
                  <p className="text-xs text-zinc-500 mt-1">Generated: {new Date(currentPack.created_at).toLocaleString()}</p>
                </div>
                
                <button 
                  onClick={() => window.print()}
                  className="self-start md:self-auto border border-zinc-800 hover:bg-zinc-800/40 text-zinc-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
              </div>

              {/* Must Know Topics (Urgency Analyst) */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Urgency Gap Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentPack.generated_pack.mustKnowTopics.map((item: any, i: number) => (
                    <div key={i} className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-bold text-sm text-zinc-200">{item.topic}</h4>
                          <span className={`text-[9px] font-extrabold border px-2 py-0.5 rounded-full ${getUrgencyColor(item.urgency)}`}>
                            {item.urgency}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revision Notes */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-2">High-Density Revision Cheatsheet</h3>
                <div className="space-y-4">
                  {currentPack.generated_pack.revisionNotes.map((section: any, i: number) => (
                    <div key={i} className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-3">
                      <h4 className="font-extrabold text-base text-emerald-400 flex items-center gap-2 border-b border-zinc-800/60 pb-2">
                        <CheckCircle className="w-4 h-4" />
                        {section.title}
                      </h4>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none">
                        {section.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected Scenarios */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Target Interview Scenarios</h3>
                <div className="space-y-3">
                  {currentPack.generated_pack.targetScenarios.map((scen: any, i: number) => {
                    const isOpen = expandedScenario === i;
                    return (
                      <div key={i} className="bg-zinc-950/30 border border-zinc-900 rounded-2xl overflow-hidden transition-all">
                        <button
                          onClick={() => setExpandedScenario(isOpen ? null : i)}
                          className="w-full text-left p-4 flex items-center justify-between gap-4 hover:bg-zinc-900/25 transition-colors"
                        >
                          <span className="font-bold text-xs text-zinc-200">{scen.scenario}</span>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-zinc-900 text-xs text-zinc-400 leading-relaxed bg-zinc-900/10">
                            <h5 className="font-bold text-[10px] text-emerald-500 uppercase tracking-wider mb-2">Defense Strategy</h5>
                            {scen.answerStrategy}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 border border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <BookOpen className="w-10 h-10 mb-3 text-zinc-600" />
              <p className="text-sm">Paste a job description on the left to build your Interview Crash Pack.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
