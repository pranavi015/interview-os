"use client";

import React, { useState, useEffect, useRef } from "react";
import { GitBranch, Shield, RefreshCw, Send, AlertTriangle, CheckCircle, Code, Star, ArrowRight, User } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import Link from "next/link";
import { dbService } from "@/lib/db";

export default function DefensePage() {
  const { state } = useOnboarding();
  const [repos, setRepos] = useState<{ id: number; name: string }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [sessionState, setSessionState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.githubUsername) {
      fetchRepos();
    }
  }, [state.githubUsername]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionState?.messages, loading]);

  function cleanGitHubUsername(val: string): string {
    if (!val) return "";
    let clean = val.trim();
    clean = clean.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
    clean = clean.split("/")[0].split("?")[0];
    return clean;
  }

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const username = cleanGitHubUsername(state.githubUsername);
      const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
        if (data.length > 0) setSelectedRepo(data[0].name);
      } else {
        console.error("Failed to fetch repos:", res.statusText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleStartDefense = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);
    try {
      const username = cleanGitHubUsername(state.githubUsername || "pranavimathur");
      const res = await fetch("/api/defense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          repoName: selectedRepo,
          githubUsername: username,
        }),
      });

      if (!res.ok) throw new Error("Failed to start Project Defense");
      const data = await res.json();
      setSessionState(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong starting the defense.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading || !sessionState) return;

    const currentInput = inputValue;
    setInputValue("");
    setLoading(true);
    setError(null);

    // Optimistically update candidate message in UI
    const optimisticState = {
      ...sessionState,
      messages: [...sessionState.messages, { role: "candidate", content: currentInput }]
    };
    setSessionState(optimisticState);

    try {
      const res = await fetch("/api/defense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          state: sessionState,
          candidateResponse: currentInput,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit response");
      const data = await res.json();
      setSessionState(data);
    } catch (err: any) {
      setError(err.message || "Failed to get reply from the interviewer.");
      // Rollback UI to previous state on failure
      setSessionState(sessionState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-gray-900 bg-[#0c0c0e]/85 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-500">
          ◀ INTERVIEWOS <span className="text-white text-xs px-2 py-0.5 bg-zinc-800 rounded">DEFENSE</span>
        </Link>
        {sessionState && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              Q: {sessionState.currentQuestionCount} / {sessionState.maxQuestions}
            </span>
            {sessionState.lastScore > 0 && (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                Last Answer Score: {sessionState.lastScore}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
        {!sessionState ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-8">
            <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 p-4 rounded-3xl shadow-xl shadow-violet-500/25">
              <Shield className="w-12 h-12 text-white" />
            </div>
            
            <div className="max-w-xl space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight">Project Defense</h1>
              <p className="text-zinc-400 text-lg">
                Connect your GitHub repo, and defend your code implementation decisions against a simulated senior architect interview.
              </p>
            </div>

            <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Select Repository</label>
                {loadingRepos ? (
                  <div className="flex items-center justify-center py-3 bg-zinc-950 rounded-xl border border-zinc-900">
                    <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                  </div>
                ) : repos.length > 0 ? (
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-white text-sm"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-zinc-500 text-sm p-4 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-xl text-center">
                    No repos found. Please ensure you entered your GitHub username in onboarding.
                  </div>
                )}
              </div>

              <button
                onClick={handleStartDefense}
                disabled={loading || !selectedRepo}
                className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 font-extrabold py-4 rounded-xl text-sm transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Begin Project Defense"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-[500px]">
            {/* Chat Box */}
            <div className="flex-1 bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-6 space-y-4 overflow-y-auto mb-6 flex flex-col justify-between">
              <div className="space-y-6">
                {sessionState.messages.map((m: any, i: number) => (
                  <div key={i} className={`flex gap-4 items-start ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                    {m.role !== "candidate" && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed ${
                      m.role === "candidate" 
                        ? "bg-indigo-600 text-white rounded-br-none" 
                        : "bg-zinc-900/80 border border-zinc-800 text-zinc-100 rounded-bl-none"
                    }`}>
                      {m.content}
                    </div>

                    {m.role === "candidate" && (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-4 items-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-zinc-900/80 border border-zinc-800 px-4 py-3 rounded-2xl flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                      <span className="text-xs text-zinc-400 font-medium">Interviewer is thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Error view */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs mb-4">
                {error}
              </div>
            )}

            {/* Final feedback overlay */}
            {sessionState.isComplete && sessionState.finalEvaluation ? (
              <div className="bg-gradient-to-br from-zinc-900/60 to-zinc-950 border border-zinc-800/80 rounded-3xl p-8 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
                  <CheckCircle className="text-emerald-500 w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-extrabold">Final Architectural Review</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Project Defense: {sessionState.repoName}</p>
                  </div>
                </div>

                <div className="prose prose-invert text-zinc-300 text-sm leading-relaxed max-w-none whitespace-pre-line bg-zinc-950/45 p-6 rounded-2xl border border-zinc-900">
                  {sessionState.finalEvaluation}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setSessionState(null)}
                    className="bg-white text-black hover:bg-zinc-200 font-bold px-8 py-3 rounded-full text-sm transition-colors"
                  >
                    Start New Defense
                  </button>
                </div>
              </div>
            ) : (
              /* Chat Input */
              <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Defend your architectural choice..."
                  disabled={loading}
                  className="flex-1 bg-zinc-900/50 border border-zinc-800 focus:border-indigo-500 transition-colors rounded-2xl px-6 py-4 focus:outline-none text-sm pr-12"
                />
                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
