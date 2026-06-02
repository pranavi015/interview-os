"use client";

import React, { useEffect, useState } from 'react';
import { useOnboarding } from '@/context/OnboardingContext';
import { Roadmap, WeekPlan } from '@/types';
import { Loader2, BookOpen, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function RoadmapPage() {
  const { state, setRoadmap } = useOnboarding();
  const [roadmapData, setRoadmapData] = useState<Roadmap | null>(state.roadmap);
  const [loading, setLoading] = useState(!state.roadmap);
  const [error, setError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number>(1);

  useEffect(() => {
    if (state.roadmap) {
      setRoadmapData(state.roadmap);
      setLoading(false);
      return;
    }
    if (!state.diagnostic) {
      setLoading(false);
      return;
    }
    const generate = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/roadmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strengths: state.diagnostic?.strengths,
            weaknesses: state.diagnostic?.weaknesses,
            studyPriorityScores: state.diagnostic?.studyPriorityScores,
            companies: state.selectedCompanies,
          }),
        });
        if (!res.ok) throw new Error('Roadmap API failed');
        const data: Roadmap = await res.json();
        setRoadmapData(data);
        setRoadmap(data);
      } catch (err) {
        console.error(err);
        setError('Failed to generate your roadmap. Please go back and retry.');
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, []);

  const weekColors = [
    { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    { border: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
    { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Personalized Roadmap</h1>
          <p className="text-gray-400 text-sm mt-0.5">AI-generated 4-week interview preparation plan</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/deepdive" className="text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white px-4 py-2 rounded-lg transition-opacity">
            Project Deep Dive →
          </Link>
          <Link href="/knowledge" className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-4 py-2 rounded-lg transition-opacity">
            Knowledge Base →
          </Link>
          <Link href="/onboarding" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Re-run Diagnostic
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-14 h-14 text-blue-500 mx-auto animate-spin mb-6" />
            <h2 className="text-2xl font-bold mb-2">Building Your Roadmap...</h2>
            <p className="text-gray-400">Groq AI is crafting your personalized week-by-week study plan.</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/onboarding" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
              Go Back
            </Link>
          </div>
        ) : !state.diagnostic ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">No diagnostic data found. Please complete onboarding first.</p>
            <Link href="/onboarding" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
              Start Onboarding
            </Link>
          </div>
        ) : roadmapData ? (
          <div className="space-y-4">
            {roadmapData.weeks.map((week: WeekPlan) => {
              const color = weekColors[(week.week - 1) % weekColors.length];
              const isExpanded = expandedWeek === week.week;
              return (
                <div
                  key={week.week}
                  className={`border ${color.border} ${color.bg} rounded-2xl overflow-hidden transition-all`}
                >
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? 0 : week.week)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-xs font-bold ${color.text} uppercase tracking-widest`}>
                        Week {week.week}
                      </div>
                      <h2 className="text-lg font-semibold">{week.title}</h2>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        {week.dailyGoalMinutes} min/day
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-white/10 pt-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <BookOpen className="w-4 h-4" />
                        Topics this week
                      </div>
                      <ul className="space-y-2">
                        {week.topics.map((topic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${color.text.replace('text', 'bg')}`} />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
