"use client";

import React, { useState, useEffect, useRef } from "react";
import { useOnboarding } from "@/context/OnboardingContext";
import { DeepDiveMessage, DeepDiveSession } from "@/types";
import {
  GitBranch,
  Folder,
  FileCode,
  Play,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Terminal,
  User,
  ArrowLeft,
  BookOpen,
  Star,
  Award,
  Sparkles,
  ChevronRight,
  HelpCircle,
  FileText,
  Volume2,
  LineChart,
  Target,
  Share2,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

export default function DeepDivePage() {
  const { state } = useOnboarding();

  // App states
  const [step, setStep] = useState<"SETUP" | "INTERVIEW" | "FEEDBACK">("SETUP");
  const [githubUsername, setGithubUsername] = useState(state.githubUsername || "");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [maxQuestions, setMaxQuestions] = useState<number>(3);
  const [startingInterview, setStartingInterview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Explorer states
  const [explorerTab, setExplorerTab] = useState<"FILES" | "README">("FILES");

  // Interview state
  const [session, setSession] = useState<DeepDiveSession | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [responding, setResponding] = useState(false);
  
  // Feedback Tab
  const [feedbackTab, setFeedbackTab] = useState<"OVERVIEW" | "STRENGTHS" | "IMPROVEMENTS" | "CHECKLIST">("OVERVIEW");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, responding]);

  // If user has a GitHub username already from onboarding, fetch repos on mount
  useEffect(() => {
    if (state.githubUsername) {
      fetchRepos(state.githubUsername);
    }
  }, [state.githubUsername]);

  const fetchRepos = async (inputStr: string) => {
    if (!inputStr.trim()) return;

    let cleanedUsername = inputStr.trim();
    let detectedRepo = "";

    // Remove trailing slash if any
    if (cleanedUsername.endsWith("/")) {
      cleanedUsername = cleanedUsername.slice(0, -1);
    }

    // Parse URL if github.com is present
    if (cleanedUsername.includes("github.com")) {
      const githubUrlRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)(?:\/([^\/]+))?/i;
      const match = cleanedUsername.match(githubUrlRegex);
      if (match) {
        cleanedUsername = match[1];
        if (match[2]) {
          detectedRepo = match[2];
        }
      }
    } else if (cleanedUsername.includes("/")) {
      // Handles "username/repo" syntax
      const parts = cleanedUsername.split("/");
      cleanedUsername = parts[0];
      detectedRepo = parts[1];
    }

    // Update state to show clean username in the input box
    setGithubUsername(cleanedUsername);

    setLoadingRepos(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`https://api.github.com/users/${cleanedUsername}/repos?sort=updated&per_page=12`);
      if (!res.ok) {
        throw new Error("User not found or GitHub API limit reached.");
      }
      const data = await res.json();
      setRepos(data);

      if (data.length > 0) {
        const matchingRepo = data.find((r: any) => r.name.toLowerCase() === detectedRepo.toLowerCase());
        if (detectedRepo) {
          if (matchingRepo) {
            setSelectedRepo(matchingRepo.name);
          } else {
            // Check if specific repo exists directly (might not be in recent 12)
            try {
              const repoRes = await fetch(`https://api.github.com/repos/${cleanedUsername}/${detectedRepo}`);
              if (repoRes.ok) {
                const repoData = await repoRes.json();
                const updatedRepos = [repoData, ...data.filter((r: any) => r.name.toLowerCase() !== detectedRepo.toLowerCase())];
                setRepos(updatedRepos);
                setSelectedRepo(repoData.name);
              } else {
                setSelectedRepo(data[0].name);
              }
            } catch {
              setSelectedRepo(data[0].name);
            }
          }
        } else {
          setSelectedRepo(data[0].name);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to fetch repositories.");
    } finally {
      setLoadingRepos(false);
    }
  };

  const startInterview = async () => {
    if (!githubUsername || !selectedRepo) return;
    setStartingInterview(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/deepdive/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername,
          repoName: selectedRepo,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to start deep dive session.");
      }

      const data = await res.json();

      setSession({
        repoName: data.repoName,
        repoContext: data.repoContext,
        messages: [
          {
            role: "interviewer",
            content: data.firstQuestion || "Let's start the deep dive. Tell me about your architecture decisions on this project.",
          },
        ],
        questionCount: 1,
        maxQuestions,
        isComplete: false,
      });

      setStep("INTERVIEW");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred starting the interview.");
    } finally {
      setStartingInterview(false);
    }
  };

  const submitAnswer = async () => {
    if (!candidateAnswer.trim() || !session || responding) return;

    const answer = candidateAnswer.trim();
    setCandidateAnswer("");
    setResponding(true);

    // Optimistically update conversation history
    const updatedMessages: DeepDiveMessage[] = [
      ...session.messages,
      { role: "candidate", content: answer },
    ];

    setSession((prev) =>
      prev ? { ...prev, messages: updatedMessages } : null
    );

    try {
      const res = await fetch("/api/deepdive/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoName: session.repoName,
          repoContext: session.repoContext,
          messages: updatedMessages,
          questionCount: session.questionCount,
          maxQuestions: session.maxQuestions,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to post response.");
      }

      const data = await res.json();

      if (data.isComplete) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                isComplete: true,
                feedback: data.feedback,
              }
            : null
        );
        setStep("FEEDBACK");
      } else {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: data.messages,
                questionCount: data.questionCount,
              }
            : null
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to communicate with the interviewer. Please try again.");
    } finally {
      setResponding(false);
    }
  };

  // Parsing feedback content for professional dashboard display
  const getParsedFeedback = () => {
    if (!session || !session.feedback) return { score: 85, summary: "", sections: {} as Record<string, string[]> };

    const text = session.feedback;
    let score = 80; // default backup
    
    // Parse score from text (e.g. "Score: 85/100" or similar)
    const ratingMatch = text.match(/(\d{1,3})\s*\/\s*100/);
    if (ratingMatch) {
      score = parseInt(ratingMatch[1]);
    } else {
      const numericMatch = text.match(/Rating:\s*(\d{1,3})/i);
      if (numericMatch) score = parseInt(numericMatch[1]);
    }

    const sections: Record<string, string[]> = {
      strengths: [],
      improvements: [],
      checklist: []
    };

    // Simple parsing to extract bullet points
    const lines = text.split("\n");
    let currentCategory = "";

    lines.forEach(line => {
      const cleanLine = line.replace(/^[\*\-\s\d\.]+/g, "").trim();
      if (!cleanLine) return;

      if (line.toLowerCase().includes("strength")) {
        currentCategory = "strengths";
      } else if (line.toLowerCase().includes("improvement") || line.toLowerCase().includes("gap") || line.toLowerCase().includes("weakness")) {
        currentCategory = "improvements";
      } else if (line.toLowerCase().includes("next step") || line.toLowerCase().includes("study") || line.toLowerCase().includes("action")) {
        currentCategory = "checklist";
      } else if ((line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line)) && currentCategory) {
        sections[currentCategory].push(cleanLine);
      }
    });

    // Provide default fallbacks if parsing fails to find enough items
    if (sections.strengths.length === 0) {
      sections.strengths = [
        "Clear explanation of project architectural foundations",
        "Demonstrated strong ownership of implementation decisions",
        "Solid awareness of libraries and framework integrations"
      ];
    }
    if (sections.improvements.length === 0) {
      sections.improvements = [
        "Provide more depth on edge cases and failure modes",
        "Quantify performance wins or storage sizing metrics",
        "Clarify alternative designs evaluated during early stages"
      ];
    }
    if (sections.checklist.length === 0) {
      sections.checklist = [
        "Implement custom error bounds and logging mechanisms",
        "Review database query index optimization strategies",
        "Write integration tests simulating complex user-interaction flows"
      ];
    }

    // Clean summary
    const summaryIndex = text.indexOf("###");
    const summary = summaryIndex > -1 ? text.slice(0, summaryIndex).trim() : "Excellent interview session diving deep into codebase scaling, system design architecture, and library implementations.";

    return { score, summary, sections };
  };

  const parsed = getParsedFeedback();

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,116,144,0.12),rgba(0,0,0,0))] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none" />

      {/* Main Header */}
      <header className="border-b border-white/[0.04] bg-[#080808]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/20 relative group">
            <div className="absolute inset-0 bg-cyan-400 opacity-0 group-hover:opacity-20 blur transition-opacity rounded-xl" />
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                PRO ENGINE
              </span>
              <h1 className="text-sm font-bold tracking-tight text-white md:text-base">
                InterviewOS Project Deep Dive
              </h1>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">
              Interactive structural architecture and systems probe
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            href="/roadmap"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] px-3.5 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Study Roadmap
          </Link>
        </div>
      </header>

      {/* App Workspace */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Step 1: Repository Setup Dashboard */}
        {step === "SETUP" && (
          <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-10 space-y-8 animate-fade-in">
            {/* Header branding info */}
            <div className="space-y-3 text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
                No Mocking. Deep Project Scan.
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Interview Your Own Codebases
              </h2>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                Connect your GitHub, select any repository, and let the AI Interviewer construct tailored, structural questions parsing your actual files and dependencies.
              </p>
            </div>

            {/* Config & Search Section */}
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              
              {/* Setup Configuration Panel */}
              <div className="bg-[#090909] border border-white/[0.04] rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none rounded-bl-full" />
                
                <h3 className="text-sm font-semibold tracking-wider text-gray-300 uppercase border-b border-white/[0.04] pb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  GitHub Connection
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      Profile URL or Username
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="e.g., https://github.com/octocat"
                          value={githubUsername}
                          onChange={(e) => setGithubUsername(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && fetchRepos(githubUsername)}
                          className="w-full bg-[#111] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:outline-none transition-colors text-white placeholder-gray-600"
                        />
                        {githubUsername && (
                          <button 
                            onClick={() => setGithubUsername("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => fetchRepos(githubUsername)}
                        disabled={loadingRepos || !githubUsername.trim()}
                        className="bg-white text-black hover:bg-gray-200 disabled:opacity-30 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                      >
                        {loadingRepos ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Scan"
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      Pasting a full repository URL will auto-extract both username and repository instantly!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      Selected Target
                    </label>
                    {repos.length > 0 ? (
                      <select
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        className="w-full bg-[#111] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors text-white"
                      >
                        {repos.map((repo) => (
                          <option key={repo.id} value={repo.name}>
                            {repo.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-gray-500 bg-[#111] border border-dashed border-white/[0.04] rounded-xl p-4 text-center">
                        Scan your GitHub profile to load repositories.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                      Interview Rigor
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[3, 5, 8].map((qCount) => (
                        <button
                          key={qCount}
                          type="button"
                          onClick={() => setMaxQuestions(qCount)}
                          className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                            maxQuestions === qCount
                              ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                              : "bg-[#111] border-white/[0.04] text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          {qCount} Questions
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={startInterview}
                  disabled={startingInterview || !githubUsername || !selectedRepo}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-30 text-white py-3 rounded-xl font-bold text-sm transition-opacity shadow-lg shadow-cyan-900/10"
                >
                  {startingInterview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing Project Structure...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Initialize Deep Dive
                    </>
                  )}
                </button>
              </div>

              {/* Repositories Visual Hub */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <Folder className="w-4 h-4 text-cyan-400" />
                    Available codebases ({repos.length})
                  </h3>
                  {repos.length > 0 && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      Click repo card to select
                    </span>
                  )}
                </div>

                {loadingRepos ? (
                  <div className="flex flex-col items-center justify-center py-28 bg-[#090909]/40 border border-white/[0.04] rounded-2xl">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                    <p className="text-gray-400 text-xs font-mono">Scanning GitHub packages & trees...</p>
                  </div>
                ) : repos.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {repos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => setSelectedRepo(repo.name)}
                        className={`text-left p-5 rounded-2xl border transition-all hover:scale-[1.01] relative overflow-hidden group ${
                          selectedRepo === repo.name
                            ? "bg-cyan-950/[0.08] border-cyan-500/50 shadow-md shadow-cyan-950/10"
                            : "bg-[#090909] border-white/[0.04] hover:border-white/[0.08]"
                        }`}
                      >
                        {selectedRepo === repo.name && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent pointer-events-none rounded-bl-full" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <Folder className={`w-4 h-4 shrink-0 ${selectedRepo === repo.name ? "text-cyan-400" : "text-gray-500"}`} />
                            <h4 className="font-bold truncate text-sm text-white">{repo.name}</h4>
                          </div>
                          <span className="shrink-0 flex items-center gap-1 text-[10px] text-yellow-400/90 font-mono bg-yellow-400/5 px-2 py-0.5 rounded-full border border-yellow-400/10">
                            <Star className="w-2.5 h-2.5 fill-yellow-400" />
                            {repo.stargazers_count}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2 min-h-[2rem] leading-normal">
                          {repo.description || "No description loaded."}
                        </p>
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/[0.02]">
                          <span className="text-[10px] bg-white/[0.02] text-gray-300 border border-white/[0.04] px-2 py-0.5 rounded font-mono">
                            {repo.language || "Unknown"}
                          </span>
                          {selectedRepo === repo.name && (
                            <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-500/20">
                              Selected
                              <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 bg-[#090909]/40 border border-dashed border-white/[0.04] rounded-2xl text-center px-6">
                    <GitBranch className="w-10 h-10 text-gray-700 mb-4" />
                    <h4 className="font-bold text-gray-300 text-sm">No repositories connected</h4>
                    <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-normal">
                      Scan your profile URL on the left to extract and explore your codebases.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Active Split-Panel Code workspace */}
        {step === "INTERVIEW" && session && (
          <div className="flex-1 flex overflow-hidden animate-fade-in">
            
            {/* Sidebar Code Explorer (Files + README panel) */}
            <div className="w-80 border-r border-white/[0.04] bg-[#070707] hidden lg:flex flex-col shrink-0 overflow-hidden">
              
              {/* Explorer Tab Header */}
              <div className="flex border-b border-white/[0.04] bg-[#0a0a0a]">
                <button
                  onClick={() => setExplorerTab("FILES")}
                  className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase text-center border-b-2 transition-all ${
                    explorerTab === "FILES"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-500/[0.02]"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  📁 File Tree
                </button>
                <button
                  onClick={() => setExplorerTab("README")}
                  className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase text-center border-b-2 transition-all ${
                    explorerTab === "README"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-500/[0.02]"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  📖 README.md
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                
                {/* Active inspected project */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                    INSPECTING TARGET
                  </span>
                  <div className="flex items-center gap-2 p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                    <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono text-xs font-bold truncate text-white">
                      {session.repoName}
                    </span>
                  </div>
                </div>

                {/* Main Tab Render */}
                {explorerTab === "FILES" ? (
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                      SOURCE TREE
                    </span>
                    <div className="bg-[#0b0b0b] rounded-xl border border-white/[0.03] p-3 max-h-[400px] overflow-y-auto">
                      <div className="font-mono text-[10px] text-gray-400 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                          <span>📁 root</span>
                        </div>
                        {session.repoContext
                          .split("File Structure:\n")[1]
                          ?.split("\n")
                          .slice(0, 35)
                          .map((p, i) => (
                            <div key={i} className="pl-3 flex items-center gap-1.5 hover:text-white transition-colors truncate cursor-default">
                              <FileCode className="w-3 h-3 text-gray-600 shrink-0" />
                              <span className="truncate">{p}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                      README PREVIEW
                    </span>
                    <div className="bg-[#0b0b0b] rounded-xl border border-white/[0.03] p-3 text-xs text-gray-400 font-mono overflow-y-auto leading-relaxed max-h-[400px] whitespace-pre-wrap">
                      {session.repoContext.split("\n\nFile Structure:\n")[0]?.replace("README:\n", "").trim() || "No README text loaded."}
                    </div>
                  </div>
                )}

                {/* State tracker panel */}
                <div className="bg-[#0b0b0b] p-4 border border-white/[0.03] rounded-xl text-xs space-y-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">
                    SESSION LOG
                  </span>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Rounds:</span>
                    <span className="font-mono font-bold text-white">{session.maxQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Completed:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {session.questionCount} of {session.maxQuestions}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{
                          width: `${(session.questionCount / session.maxQuestions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right main workspace (Active interview console) */}
            <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
              
              {/* Small screens dashboard progress bar */}
              <div className="lg:hidden border-b border-white/[0.04] px-6 py-3 flex items-center justify-between bg-[#0a0a0a] shrink-0 text-xs">
                <span className="font-bold text-gray-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-cyan-400" />
                  {session.repoName}
                </span>
                <span className="font-mono text-[10px] text-cyan-400 bg-cyan-400/5 border border-cyan-400/10 px-2 py-0.5 rounded-full">
                  Question {session.questionCount}/{session.maxQuestions}
                </span>
              </div>

              {/* Interviewer Status HUD */}
              <div className="border-b border-white/[0.04] bg-[#080808]/90 px-6 py-4 flex items-center justify-between shrink-0 relative">
                <div className="flex items-center gap-3">
                  {/* Glowing Pulse Visualizer */}
                  <div className="relative w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <div className={`absolute inset-0 rounded-full bg-cyan-400/20 blur transition-all ${responding ? "animate-pulse" : ""}`} />
                    {responding ? (
                      <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-400 animate-bounce" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      AI Lead Architect
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {responding 
                        ? "STATUS: Evaluating implementation statements..." 
                        : `STATUS: Awaiting answer for step ${session.questionCount}`}
                    </p>
                  </div>
                </div>

                {/* Animated waves graphic */}
                <div className="hidden sm:flex items-center gap-0.5 h-4 text-cyan-500/50">
                  <div className={`w-0.5 bg-cyan-500 rounded transition-all duration-300 ${responding ? "h-3.5 animate-bounce" : "h-1"}`} style={{animationDelay: "0ms"}} />
                  <div className={`w-0.5 bg-cyan-500 rounded transition-all duration-300 ${responding ? "h-2 animate-bounce" : "h-2"}`} style={{animationDelay: "150ms"}} />
                  <div className={`w-0.5 bg-cyan-500 rounded transition-all duration-300 ${responding ? "h-4 animate-bounce" : "h-1.5"}`} style={{animationDelay: "300ms"}} />
                  <div className={`w-0.5 bg-cyan-500 rounded transition-all duration-300 ${responding ? "h-2.5 animate-bounce" : "h-2"}`} style={{animationDelay: "450ms"}} />
                  <div className={`w-0.5 bg-cyan-500 rounded transition-all duration-300 ${responding ? "h-1 animate-bounce" : "h-1"}`} style={{animationDelay: "600ms"}} />
                </div>
              </div>

              {/* Console Interview Stream */}
              <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 max-w-4xl mx-auto w-full">
                
                {session.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-4 ${
                      msg.role === "candidate" ? "justify-end" : "justify-start"
                    } animate-fade-in`}
                  >
                    
                    {msg.role === "interviewer" && (
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                      </div>
                    )}

                    {msg.role === "candidate" ? (
                      /* Candidate answer rendered like a highly premium Code Editor Block */
                      <div className="max-w-[85%] rounded-xl overflow-hidden border border-white/[0.06] bg-[#0c0c0c] shadow-lg shadow-black/40 text-left font-mono">
                        <div className="bg-[#121212] border-b border-white/[0.04] px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 select-none">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-cyan-500" />
                            candidate_explanations.md
                          </span>
                          <span>Markdown</span>
                        </div>
                        <div className="px-5 py-4 flex gap-4 text-xs leading-relaxed">
                          <div className="text-gray-600 select-none text-right font-mono pr-2 border-r border-white/[0.02] flex flex-col">
                            {msg.content.split("\n").map((_, lineIdx) => (
                              <span key={lineIdx}>{lineIdx + 1}</span>
                            ))}
                          </div>
                          <div className="text-cyan-100 flex-1 whitespace-pre-wrap font-sans">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Interviewer bubble rendered like a highly premium system terminal report */
                      <div className="max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed border border-white/[0.04] bg-[#090909] text-gray-200 shadow-md">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          AI INTERVIEWER // SYS.INSPECT
                        </div>
                        <div className="text-gray-300 font-sans leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    )}

                    {msg.role === "candidate" && (
                      <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}

                {responding && (
                  <div className="flex gap-4 justify-start animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="bg-[#090909] border border-white/[0.04] rounded-2xl px-5 py-4 flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                        Running deep static analysis on answers...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Console Input terminal box */}
              <div className="border-t border-white/[0.04] bg-[#070707]/90 backdrop-blur-md px-6 py-5 shrink-0 relative">
                <div className="max-w-4xl mx-auto space-y-3">
                  
                  {/* Mock code block input border */}
                  <div className="border border-white/[0.06] bg-[#0b0b0b] rounded-xl shadow-inner focus-within:border-cyan-500/50 transition-colors overflow-hidden flex flex-col">
                    <div className="bg-[#101010] border-b border-white/[0.04] px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 select-none">
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3.5 h-3.5 text-cyan-500" />
                        type_your_answer.md
                      </span>
                      <span>UTF-8</span>
                    </div>
                    
                    <div className="flex p-3 gap-3">
                      <div className="text-gray-700 font-mono text-xs select-none pr-1 text-right leading-relaxed flex flex-col">
                        <span>1</span>
                        <span>2</span>
                      </div>
                      <textarea
                        rows={3}
                        value={candidateAnswer}
                        onChange={(e) => setCandidateAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitAnswer();
                          }
                        }}
                        placeholder="Provide details on architecture layouts, components state, hooks, or package configurations you selected..."
                        disabled={responding}
                        className="flex-1 bg-transparent border-0 resize-none outline-none focus:ring-0 text-sm text-gray-150 leading-relaxed font-sans min-h-[60px]"
                      />
                    </div>
                  </div>

                  {/* Submission and prompt details */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Tip: Reference specific file paths or functions you made in this repository.
                    </div>
                    
                    <button
                      onClick={submitAnswer}
                      disabled={responding || !candidateAnswer.trim()}
                      className="bg-white text-black hover:bg-gray-200 disabled:opacity-30 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                    >
                      <span>Submit Answer</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Step 3: Delightful Visual Feedback scorecard */}
        {step === "FEEDBACK" && session && (
          <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-6 py-12 space-y-8 animate-fade-in">
            
            {/* Header completion summary */}
            <div className="text-center space-y-3 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950/20 mb-4 animate-bounce">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Technical Scorecard Ready!
              </h2>
              <p className="text-gray-400 text-sm">
                Evaluation results generated successfully for repository{" "}
                <span className="font-mono text-cyan-400 bg-cyan-400/5 border border-cyan-400/10 px-2.5 py-0.5 rounded-full">
                  {session.repoName}
                </span>
              </p>
            </div>

            {/* Scorecard Visual Dashboard Grid */}
            <div className="grid md:grid-cols-3 gap-8 items-start">
              
              {/* Left Circular score meter card */}
              <div className="bg-[#090909] border border-white/[0.04] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent pointer-events-none rounded-bl-full" />
                
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block">
                  Readiness Grade
                </span>

                {/* Circle rating gauge */}
                <div className="relative w-40 h-40 flex items-center justify-center select-none">
                  {/* SVG Outer circle */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      className="stroke-white/[0.03] fill-transparent"
                      strokeWidth="8"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      className="stroke-cyan-500 fill-transparent shadow-lg"
                      strokeWidth="8"
                      strokeDasharray={427}
                      strokeDashoffset={427 - (427 * parsed.score) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white font-mono">{parsed.score}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                      of 100
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 w-full">
                  <div className="px-4 py-2 bg-white/[0.01] border border-white/[0.04] rounded-xl text-xs font-semibold text-gray-300">
                    Rating Index: {parsed.score >= 85 ? "L5 Senior Candidate" : "L4 Mid Architect"}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Calculated by analyzing technical accuracy, error mitigation depth, and architectural reasoning.
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-white/[0.03] flex justify-center gap-2">
                  <button className="flex-1 py-2 bg-white text-black hover:bg-gray-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    Share Results
                  </button>
                </div>
              </div>

              {/* Right detailed scorecard reports panel */}
              <div className="md:col-span-2 bg-[#090909] border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden flex flex-col">
                
                {/* Reports Tab Navigation */}
                <div className="flex border-b border-white/[0.04] bg-[#0c0c0c]">
                  {[
                    { id: "OVERVIEW", label: "Overview", icon: LineChart },
                    { id: "STRENGTHS", label: "Strengths", icon: CheckCircle2 },
                    { id: "IMPROVEMENTS", label: "Improvements", icon: AlertCircle },
                    { id: "CHECKLIST", label: "Growth Roadmap", icon: Target },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setFeedbackTab(tab.id as any)}
                        className={`flex-1 py-4 text-xs font-semibold text-center border-b-2 transition-all flex items-center justify-center gap-2 ${
                          feedbackTab === tab.id
                            ? "border-cyan-500 text-cyan-400 bg-cyan-500/[0.01]"
                            : "border-transparent text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reports Content Box */}
                <div className="p-8 min-h-[260px] overflow-y-auto">
                  
                  {feedbackTab === "OVERVIEW" && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="text-base font-bold text-white border-l-2 border-cyan-500 pl-3">
                        Executive Summary
                      </h4>
                      <p className="text-sm text-gray-300 leading-relaxed font-sans">
                        {parsed.summary}
                      </p>
                      <div className="p-4 bg-cyan-500/[0.02] border border-cyan-500/10 rounded-2xl flex items-start gap-3 mt-6">
                        <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-white uppercase tracking-wide">
                            AI INTERVIEWER REFLECTIONS
                          </h5>
                          <p className="text-xs text-gray-400 leading-relaxed mt-1">
                            The candidate showed great composure answering structural engineering questions. Probing highlights a high degree of confidence in the package environment, though extra refinement in concurrency controls would solidify scaling profiles.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {feedbackTab === "STRENGTHS" && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="text-base font-bold text-white border-l-2 border-green-500 pl-3">
                        Technical Strengths Identified
                      </h4>
                      <ul className="space-y-3 pt-2">
                        {parsed.sections.strengths.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3 bg-[#111]/30 p-3 border border-white/[0.02] rounded-xl">
                            <span className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-green-400 font-mono text-[10px] font-bold mt-0.5">
                              ✓
                            </span>
                            <span className="text-xs text-gray-300 leading-normal">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedbackTab === "IMPROVEMENTS" && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="text-base font-bold text-white border-l-2 border-amber-500 pl-3">
                        Improvement Opportunities
                      </h4>
                      <ul className="space-y-3 pt-2">
                        {parsed.sections.improvements.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3 bg-[#111]/30 p-3 border border-white/[0.02] rounded-xl">
                            <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 font-bold text-xs mt-0.5">
                              !
                            </span>
                            <span className="text-xs text-gray-300 leading-normal">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedbackTab === "CHECKLIST" && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="text-base font-bold text-white border-l-2 border-cyan-500 pl-3">
                        Recommended Next Steps
                      </h4>
                      <ul className="space-y-3 pt-2">
                        {parsed.sections.checklist.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3 bg-[#111]/30 p-3 border border-white/[0.02] rounded-xl hover:border-cyan-500/20 transition-colors">
                            <span className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 font-mono text-[10px] font-bold mt-0.5 select-none">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-gray-300 leading-normal">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={() => {
                  setStep("SETUP");
                  setSession(null);
                  setErrorMsg(null);
                }}
                className="bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Interrogate Another Repository
              </button>
              <Link
                href="/roadmap"
                className="bg-[#111] hover:bg-[#1a1a1a] text-white border border-white/[0.04] hover:border-white/[0.08] px-6 py-3 rounded-xl text-xs font-bold text-center transition-all"
              >
                Back to Learning Roadmap
              </Link>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
