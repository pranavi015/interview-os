"use client";

import React, { useState, useEffect } from 'react';
import { Upload, GitBranch, Building, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import { useRouter } from 'next/navigation';
import { DiagnosticResult } from '@/types';

type Step = 'RESUME' | 'GITHUB' | 'COMPANIES' | 'COMPLETE';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('RESUME');
  const { state, setResumeFile, setGithubUsername, toggleCompany, setDiagnostic } = useOnboarding();
  const [repos, setRepos] = useState<{ id: number; name: string }[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResult | null>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load persistent currentStep on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStep = localStorage.getItem('interview_os_onboarding_step') as Step;
      if (savedStep && ['RESUME', 'GITHUB', 'COMPANIES', 'COMPLETE'].includes(savedStep)) {
        setCurrentStep(savedStep);
      }
    }
  }, []);

  const changeStep = (step: Step) => {
    setCurrentStep(step);
    if (typeof window !== 'undefined') {
      localStorage.setItem('interview_os_onboarding_step', step);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setResumeFile(file);
    changeStep('GITHUB');
  };

  const fetchGithubRepos = async () => {
    if (!state.githubUsername) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`https://api.github.com/users/${state.githubUsername}/repos?sort=updated&per_page=5`);
      if (res.ok) setRepos(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleFinishSetup = async () => {
    changeStep('COMPLETE');
    setLoadingDiagnostic(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUsername: state.githubUsername,
          companies: state.selectedCompanies,
          resumeText: (state.resumeFile || state.resumeName) ? 'Frontend Developer with 3 years React experience' : '',
        }),
      });
      if (!res.ok) throw new Error('Diagnostic API failed');
      const data: DiagnosticResult = await res.json();
      setDiagnosticData(data);
      setDiagnostic(data);
    } catch (error) {
      console.error(error);
      setErrorMsg('Failed to run diagnostic. Please check your API key and try again.');
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {(['RESUME', 'GITHUB', 'COMPANIES', 'COMPLETE'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              currentStep === s ? 'bg-blue-600 text-white' :
              ['RESUME', 'GITHUB', 'COMPANIES', 'COMPLETE'].indexOf(currentStep) > i ? 'bg-green-600 text-white' :
              'bg-gray-800 text-gray-500'
            }`}>{i + 1}</div>
            {i < 3 && <div className={`w-12 h-0.5 transition-colors ${['RESUME', 'GITHUB', 'COMPANIES', 'COMPLETE'].indexOf(currentStep) > i ? 'bg-green-600' : 'bg-gray-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="max-w-xl w-full bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Set up your profile</h1>
          <p className="text-gray-400">Let&apos;s personalize your InterviewOS experience.</p>
        </div>

        {/* Step 1: Resume */}
        {currentStep === 'RESUME' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-500" />
              Upload Resume
            </h2>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10 flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
              <Upload className="w-10 h-10 text-gray-500 mb-4" />
              <p className="text-gray-400 mb-4">Drag and drop your PDF resume</p>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
                Browse Files
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
              </label>
              {(state.resumeFile || state.resumeName) && (
                <p className="mt-3 text-green-400 text-sm">✓ {state.resumeFile?.name || state.resumeName}</p>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => changeStep('GITHUB')} className="text-gray-500 hover:text-white transition-colors">
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 2: GitHub */}
        {currentStep === 'GITHUB' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-gray-300" />
              Connect GitHub
            </h2>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">We&apos;ll use your public repos for the Project Deep Dive Interviewer.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="GitHub Username"
                  value={state.githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchGithubRepos()}
                  className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={fetchGithubRepos}
                  disabled={loadingRepos}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
                >
                  {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                </button>
              </div>
              {repos.length > 0 && (
                <div className="p-4 bg-[#1a1a1a] rounded-lg border border-gray-800">
                  <h3 className="text-sm font-semibold mb-2 text-green-400">✓ {repos.length} repositories found</h3>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {repos.map((repo) => (
                      <li key={repo.id} className="truncate">• {repo.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => changeStep('RESUME')} className="text-gray-500 hover:text-white transition-colors">Back</button>
              <button onClick={() => changeStep('COMPANIES')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Target Companies */}
        {currentStep === 'COMPANIES' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-500" />
              Target Companies
            </h2>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Where do you want to work?</p>
              <div className="flex gap-2 flex-wrap">
                {['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Startups', 'Fintech'].map(company => (
                  <button
                    key={company}
                    onClick={() => toggleCompany(company)}
                    className={`border px-4 py-2 rounded-full text-sm transition-colors ${
                      state.selectedCompanies.includes(company)
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-gray-700 hover:border-purple-500'
                    }`}
                  >
                    {company}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => changeStep('GITHUB')} className="text-gray-500 hover:text-white transition-colors">Back</button>
              <button onClick={handleFinishSetup} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                Finish Setup
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete / Diagnostic Results */}
        {currentStep === 'COMPLETE' && (
          <div className="space-y-6">
            {loadingDiagnostic ? (
              <div className="text-center py-10">
                <Loader2 className="w-12 h-12 text-blue-500 mx-auto animate-spin mb-4" />
                <h2 className="text-xl font-bold">Diagnosing Profile...</h2>
                <p className="text-gray-400 mt-2">Our AI is analyzing your skills.</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center py-10">
                <p className="text-red-400">{errorMsg}</p>
                <button onClick={handleFinishSetup} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                  Retry
                </button>
              </div>
            ) : diagnosticData ? (
              <div className="space-y-6">
                <div className="text-center border-b border-gray-800 pb-6">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold">Diagnostic Complete</h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <h3 className="text-green-400 font-semibold mb-2">Strength Areas</h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {diagnosticData.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <h3 className="text-red-400 font-semibold mb-2">Weak Areas</h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {diagnosticData.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                  <h3 className="text-blue-400 font-semibold mb-3">Study Priority Score</h3>
                  <div className="space-y-3">
                    {diagnosticData.studyPriorityScores.map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.topic}</span>
                          <span className="font-mono text-gray-400">{item.score}/100</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-700" style={{ width: `${item.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => router.push('/roadmap')}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold transition-opacity"
                >
                  View My Personalized Roadmap
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
