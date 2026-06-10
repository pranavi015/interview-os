"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Flame,
  Shield,
  BookOpen,
  Sparkles,
  Award,
  PlayCircle,
  BarChart,
  TrendingUp,
  Target,
  Zap,
} from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { dbService } from "@/lib/db";

// ─── Mini Chart Components ────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  color,
  max = 100,
}: {
  label: string;
  value: number;
  color: string;
  max?: number;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-semibold text-zinc-400">{label}</span>
        <span className={`text-[11px] font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color.replace("text-", "bg-")}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SparkLine({ scores }: { scores: number[] }) {
  if (scores.length === 0)
    return <div className="h-10 flex items-center justify-center text-zinc-700 text-xs">No data</div>;

  const max = Math.max(...scores, 1);
  const min = Math.min(...scores);
  const range = max - min || 1;
  const H = 40;
  const W = 120;
  const pts = scores
    .map((s, i) => {
      const x = (i / Math.max(scores.length - 1, 1)) * W;
      const y = H - ((s - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  const latest = scores[scores.length - 1];
  const isUp = scores.length > 1 && latest >= scores[scores.length - 2];

  return (
    <div className="flex items-center gap-3">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
      >
        <polyline
          points={pts}
          fill="none"
          stroke={isUp ? "#34d399" : "#f87171"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {scores.map((s, i) => {
          const x = (i / Math.max(scores.length - 1, 1)) * W;
          const y = H - ((s - min) / range) * H;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={isUp ? "#34d399" : "#f87171"}
              opacity={i === scores.length - 1 ? 1 : 0.4}
            />
          );
        })}
      </svg>
      <div className="text-right">
        <div className={`text-lg font-extrabold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {latest}
        </div>
        <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Latest</div>
      </div>
    </div>
  );
}

function RadialGauge({ value, label }: { value: number; label: string }) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const dash = (value / 100) * circ;
  const color =
    value >= 75 ? "#34d399" : value >= 50 ? "#60a5fa" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
        <text
          x="55"
          y="51"
          textAnchor="middle"
          fill={color}
          fontSize="20"
          fontWeight="800"
          fontFamily="inherit"
        >
          {value}
        </text>
        <text x="55" y="67" textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="600">
          {label}
        </text>
      </svg>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Home() {
  const { state } = useOnboarding();
  const [profile, setProfile] = useState<any>(null);
  const [recentBlitz, setRecentBlitz] = useState<any[]>([]);
  const [recentDefense, setRecentDefense] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const p = await dbService.getProfile("default-user");
      setProfile(p);

      const blitz = await dbService.getBlitzSessions();
      setRecentBlitz(blitz.slice(0, 10));

      const defense = await dbService.getProjectDefenseSessions();
      setRecentDefense(defense.slice(0, 5));
    };

    loadData();

    if (typeof window !== "undefined") {
      const savedStreak = localStorage.getItem("blitz_streak");
      if (savedStreak) setStreak(parseInt(savedStreak));
    }
  }, [state]);

  const hasOnboarded = !!(state.githubUsername || state.resumeName);

  // Derived analytics
  // getBlitzSessions() always returns newest-first (both Supabase and mock DB)
  // sparkline needs oldest→newest, so we reverse a chronological slice
  const blitzScores = [...recentBlitz].reverse().map((b) => b.evaluation?.score ?? 50);
  const topicCounts: Record<string, number> = {};
  recentBlitz.forEach((b) => {
    if (b.topic) topicCounts[b.topic] = (topicCounts[b.topic] || 0) + 1;
  });

  const avgScore =
    blitzScores.length > 0
      ? Math.round(blitzScores.reduce((a, b) => a + b, 0) / blitzScores.length)
      : 0;

  const topicColors: Record<string, string> = {
    react: "text-cyan-400",
    javascript: "text-amber-400",
    "system-design": "text-purple-400",
    dsa: "text-emerald-400",
  };

  if (!hasOnboarded) {
    return (
      <main className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />

        <div className="text-center max-w-3xl space-y-6 z-10">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800/80 px-4 py-2 rounded-full text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            <Sparkles className="w-4 h-4 text-blue-400" />
            INTRODUCING INTERVIEWOS V1
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none text-zinc-100">
            The Operating System for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600">
              Software Interviews
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Train under pressure with rapid voice practice, defend your codebase choices, and generate study packs.
          </p>

          <div className="pt-8">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-extrabold text-lg hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
            >
              Start Onboarding Setup
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-gray-900 bg-[#0c0c0e]/85 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <span className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
          INTERVIEWOS
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/25">
            <Flame className="w-4 h-4 fill-orange-400" />
            <span>{streak} Day Streak</span>
          </div>
          <Link
            href="/onboarding"
            className="text-xs text-zinc-400 hover:text-white transition-colors border border-zinc-800 bg-zinc-900 px-3 py-1.5 rounded-full"
          >
            Onboarding Setup
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">

          {/* Radial Readiness Gauge */}
          <div className="bg-gradient-to-br from-zinc-900/40 to-zinc-950/80 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> Readiness Score
            </h3>
            <div className="flex flex-col items-center gap-2">
              <RadialGauge value={profile?.readiness_score || 50} label="Readiness" />
              <p className="text-xs text-zinc-500 text-center leading-relaxed">
                Score updates dynamically as you complete Blitz sessions scoring above 70%.
              </p>
            </div>
          </div>

          {/* Blitz Score Trend */}
          <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Score Trend
            </h3>
            <SparkLine scores={blitzScores} />
            {blitzScores.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{avgScore}</div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Avg Score</div>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400">{recentBlitz.length}</div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Sessions</div>
                </div>
              </div>
            )}
          </div>

          {/* Topic Breakdown */}
          {Object.keys(topicCounts).length > 0 && (
            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Topics Drilled
              </h3>
              <div className="space-y-3">
                {Object.entries(topicCounts).map(([topic, count]) => (
                  <ScoreBar
                    key={topic}
                    label={topic.replace("-", " ")}
                    value={count}
                    max={Math.max(...Object.values(topicCounts))}
                    color={topicColors[topic] || "text-zinc-400"}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Profile Focus */}
          <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-6 space-y-5">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Focus Profile</h3>

            {state.selectedCompanies && state.selectedCompanies.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Target Companies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {state.selectedCompanies.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full text-zinc-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Identified Strengths
              </span>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {profile?.strengths?.map((str: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {str}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Priority Growth Gaps
              </span>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {profile?.weaknesses?.map((weak: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    {weak}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-2xl font-extrabold tracking-tight">Practice Suite</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/blitz"
              className="group relative bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-98 shadow-lg hover:bg-zinc-900/60"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base mb-1">Interview Blitz</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Voice-first rapid-fire practice with speech analytics and instant scores.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 mt-6 inline-flex items-center gap-1">
                Enter Blitz <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>

            <Link
              href="/defense"
              className="group relative bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-98 shadow-lg hover:bg-zinc-900/60"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base mb-1">Project Defense</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Stateful LangGraph chat that tests and evaluates your architecture decisions.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-violet-400 group-hover:text-violet-300 mt-6 inline-flex items-center gap-1">
                Defend Project <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>

            <Link
              href="/crash-pack"
              className="group relative bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-98 shadow-lg hover:bg-zinc-900/60"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base mb-1">Crash Pack</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Input job descriptions to generate custom revision sheets.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 mt-6 inline-flex items-center gap-1">
                Open Briefings <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </div>

          {/* Historical Score Charts */}
          <div className="bg-zinc-900/20 border border-zinc-800/45 rounded-3xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart className="w-4 h-4 text-zinc-500" />
              Performance Analytics
            </h3>

            {/* Per-session score bars */}
            {blitzScores.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Blitz Score History (most recent first)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {recentBlitz.slice(0, 7).map((b, i) => {
                    const score = b.evaluation?.score ?? 0;
                    const color =
                      score >= 80
                        ? "bg-emerald-500"
                        : score >= 60
                        ? "bg-blue-500"
                        : "bg-red-500";
                    const dateStr = b.completed_at
                      ? new Date(b.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "";
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-zinc-600 w-5 shrink-0 text-right">{i + 1}</span>
                        <div className="flex-1 bg-zinc-900 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-700`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span
                          className={`font-bold w-8 text-right ${
                            score >= 80
                              ? "text-emerald-400"
                              : score >= 60
                              ? "text-blue-400"
                              : "text-red-400"
                          }`}
                        >
                          {score}
                        </span>
                        <span className="text-zinc-600 truncate max-w-[80px] hidden sm:block">
                          {b.topic}
                        </span>
                        {dateStr && (
                          <span className="text-zinc-700 text-[10px] hidden md:block">{dateStr}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 italic">
                Complete your first Blitz session to see performance analytics.
              </p>
            )}

            {/* Defense sessions */}
            {recentDefense.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-900">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Project Defense Logs
                </span>
                {recentDefense.map((d, i) => (
                  <div
                    key={i}
                    className="bg-zinc-950/40 border border-zinc-900 p-3 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="overflow-hidden pr-2">
                      <p className="font-bold text-zinc-300 truncate">Repo: {d.repo_name}</p>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      {d.final_evaluation?.score || "Done"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
