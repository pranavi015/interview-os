"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, GitBranch, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { dbService } from "@/lib/db";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function OnboardingPage() {
  const router = useRouter();
  const { state, setResumeFile, setGithubUsername, setDiagnostic } = useOnboarding();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  
  // Step Form States
  const [resumeName, setLocalResumeName] = useState("");
  const [githubUser, setLocalGithubUser] = useState("");
  const [prepGoal, setPrepGoal] = useState<string>("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [companyTypes, setCompanyTypes] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<string>("");

  // Parsing States
  const [parsedResumeText, setParsedResumeText] = useState("");
  const [parsingResume, setParsingResume] = useState(false);

  // Loading / Error States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [repos, setRepos] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Load from local storage if exists
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("interview_os_onboarding_step");
      if (saved) {
        const stepNum = parseInt(saved) as Step;
        if (stepNum >= 1 && stepNum <= 7) setCurrentStep(stepNum);
      }
      
      setLocalResumeName(state.resumeName || "");
      setLocalGithubUser(state.githubUsername || "");
    }
  }, [state]);

  const changeStep = (next: Step) => {
    setCurrentStep(next);
    localStorage.setItem("interview_os_onboarding_step", String(next));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setLocalResumeName(file.name);
      setParsingResume(true);
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/resume/parse", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Could not parse resume text.");
        const data = await res.json();
        setParsedResumeText(data.text);
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Failed to extract text from PDF. You can still proceed.");
      } finally {
        setParsingResume(false);
      }
    }
  };

  function cleanGitHubUsername(val: string): string {
    if (!val) return "";
    let clean = val.trim();
    clean = clean.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
    clean = clean.split("/")[0].split("?")[0];
    return clean;
  }

  const fetchGithubRepos = async () => {
    if (!githubUser.trim()) return;
    setLoadingRepos(true);
    const username = cleanGitHubUsername(githubUser);
    setGithubUsername(username);
    try {
      const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`);
      if (res.ok) {
        const data = await res.json();
        setRepos(data.map((r: any) => r.name));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleToggleRole = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleToggleChallenge = (challenge: string) => {
    setChallenges((prev) => {
      if (prev.includes(challenge)) {
        return prev.filter((c) => c !== challenge);
      }
      if (prev.length >= 3) return prev; // Limit to 3
      return [...prev, challenge];
    });
  };

  const handleToggleCompany = (company: string) => {
    setCompanyTypes((prev) =>
      prev.includes(company) ? prev.filter((c) => c !== company) : [...prev, company]
    );
  };

  const handleFinishSetup = async () => {
    setLoading(true);
    setErrorMsg(null);
    changeStep(7); // Show loading screen / results screen

    const username = cleanGitHubUsername(githubUser);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: username,
          companies: companyTypes,
          resumeText: parsedResumeText || (resumeName ? `Candidate with Resume: ${resumeName}` : "General Engineering Candidate"),
        }),
      });

      if (!res.ok) throw new Error("Diagnostic API failed");
      const diagnosticData = await res.json();
      setDiagnostic(diagnosticData);

      // Overwrite the weaknesses/strengths in the DB using client choices too
      const customWeaknesses = challenges.length > 0 ? challenges : diagnosticData.weaknesses;

      // Update backend profile
      await dbService.updateProfile("default-user", {
        github_username: username,
        selected_companies: companyTypes,
        strengths: diagnosticData.strengths,
        weaknesses: customWeaknesses,
        readiness_score: 60 // initial setup completed
      });

      // Clear onboarding state cache so homepage will show dashboard
      localStorage.setItem("interview_os_onboarding_completed", "true");
    } catch (error) {
      console.error(error);
      setErrorMsg("Failed to run diagnostics. Retrying with default values.");
      
      // Fallback update so the user can continue
      await dbService.updateProfile("default-user", {
        github_username: username,
        selected_companies: companyTypes,
        strengths: ["React & Frontend", "State Management", "Git & Collaboration"],
        weaknesses: challenges.length > 0 ? challenges : ["System Design", "Algorithms"],
        readiness_score: 50
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Progress Indicators */}
      {currentStep <= 6 && (
        <div className="flex items-center gap-3 mb-10 z-10">
          {([1, 2, 3, 4, 5, 6] as Step[]).map((stepNum) => (
            <React.Fragment key={stepNum}>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === stepNum
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-extrabold scale-110"
                    : currentStep > stepNum
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                }`}
              >
                {stepNum}
              </div>
              {stepNum < 6 && (
                <div
                  className={`w-6 md:w-10 h-0.5 transition-colors ${
                    currentStep > stepNum ? "bg-emerald-800" : "bg-zinc-800"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Card */}
      <div className="max-w-xl w-full bg-zinc-900/40 border border-zinc-850 rounded-3xl p-8 backdrop-blur shadow-2xl relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />

        {/* Step 1: Resume & GitHub */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 1 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">Resume & GitHub</h2>
              <p className="text-zinc-400 text-sm">Let&apos;s understand your background before we begin.</p>
            </div>

            {/* Resume File */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Upload Resume (PDF)</label>
              <div className="border border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/40 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors relative">
                <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                <p className="text-zinc-400 text-xs mb-3">Drag and drop or browse files</p>
                <label className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 px-4 py-2 rounded-xl cursor-pointer text-xs font-semibold transition-colors">
                  Browse Resume
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </label>
                {parsingResume ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>Extracting PDF text...</span>
                  </div>
                ) : resumeName && (
                  <p className="mt-3 text-emerald-400 text-xs font-medium">✓ {resumeName}</p>
                )}
              </div>
            </div>

            {/* GitHub Username */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Connect GitHub</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <GitBranch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="GitHub Username"
                    value={githubUser}
                    onChange={(e) => setLocalGithubUser(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 text-sm transition-colors text-zinc-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchGithubRepos}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs font-bold px-4 py-3 rounded-xl transition-colors"
                >
                  {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                </button>
              </div>
              {repos.length > 0 && (
                <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl text-xs text-zinc-400">
                  <span className="text-emerald-400 font-bold block mb-1">✓ {repos.length} Repositories Found</span>
                  <p className="truncate text-[10px] text-zinc-500">Connected: {repos.slice(0, 3).join(", ")}...</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(2)}
                className="bg-white text-black hover:bg-zinc-200 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Goal */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 2 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">What are you preparing for?</h2>
              <p className="text-zinc-400 text-sm">Choose your primary goal.</p>
            </div>

            <div className="space-y-2.5">
              {[
                "Campus Placements",
                "Internship Interviews",
                "Full-Time Software Roles",
                "Off-Campus Job Search",
                "Career Switch into Tech",
              ].map((goal) => (
                <button
                  key={goal}
                  onClick={() => setPrepGoal(goal)}
                  className={`w-full text-left px-5 py-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                    prepGoal === goal
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-950/40 text-zinc-400"
                  }`}
                >
                  <span>{goal}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      prepGoal === goal ? "border-emerald-400" : "border-zinc-700"
                    }`}
                  >
                    {prepGoal === goal && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(1)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => changeStep(3)}
                disabled={!prepGoal}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Target Roles */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 3 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">Which roles are you targeting?</h2>
              <p className="text-zinc-400 text-sm">Select all that apply.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                "Frontend Engineer",
                "Backend Engineer",
                "Full Stack Engineer",
                "AI / ML Engineer",
                "Data Engineer",
                "Software Development Engineer (SDE)",
                "Product Engineer",
                "Not Sure Yet",
              ].map((role) => {
                const isSelected = targetRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => handleToggleRole(role)}
                    className={`text-left p-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-3 ${
                      isSelected
                        ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-400"
                        : "bg-zinc-950/20 border-zinc-850 text-zinc-400"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? "border-emerald-400 bg-emerald-400/20" : "border-zinc-700"
                      }`}
                    >
                      {isSelected && <span className="text-[10px] text-emerald-400">✓</span>}
                    </div>
                    <span>{role}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(2)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => changeStep(4)}
                disabled={targetRoles.length === 0}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Challenges */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 4 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">What is most challenging in interviews?</h2>
              <p className="text-zinc-400 text-sm">Select up to 3 options.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                "Data Structures & Algorithms",
                "Explaining My Projects",
                "System Design",
                "JavaScript / React Concepts",
                "Core CS Subjects (DBMS, OS, OOP)",
                "Communication & Confidence",
                "Behavioral / HR Questions",
                "Last-Minute Preparation",
              ].map((challenge) => {
                const isSelected = challenges.includes(challenge);
                return (
                  <button
                    key={challenge}
                    onClick={() => handleToggleChallenge(challenge)}
                    className={`text-left p-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-3 ${
                      isSelected
                        ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-400"
                        : "bg-zinc-950/20 border-zinc-850 text-zinc-400"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? "border-emerald-400 bg-emerald-400/20" : "border-zinc-700"
                      }`}
                    >
                      {isSelected && <span className="text-[10px] text-emerald-400">✓</span>}
                    </div>
                    <span>{challenge}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(3)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => changeStep(5)}
                disabled={challenges.length === 0}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Target Companies */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 5 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">What kind of companies interest you?</h2>
              <p className="text-zinc-400 text-sm">Optional</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                "Product-Based Companies",
                "Startups",
                "AI Startups",
                "SaaS Companies",
                "Fintech Companies",
                "Service-Based Companies",
                "Open to Any Opportunity",
              ].map((company) => {
                const isSelected = companyTypes.includes(company);
                return (
                  <button
                    key={company}
                    onClick={() => handleToggleCompany(company)}
                    className={`text-left p-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-3 ${
                      isSelected
                        ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-400"
                        : "bg-zinc-950/20 border-zinc-850 text-zinc-400"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? "border-emerald-400 bg-emerald-400/20" : "border-zinc-700"
                      }`}
                    >
                      {isSelected && <span className="text-[10px] text-emerald-400">✓</span>}
                    </div>
                    <span>{company}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(4)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={() => changeStep(6)}
                className="bg-white text-black hover:bg-zinc-200 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1"
              >
                Skip / Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Timeline */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Step 6 of 6
              </span>
              <h2 className="text-2xl font-extrabold mt-3 mb-1">How soon is your next interview?</h2>
              <p className="text-zinc-400 text-sm">We&apos;ll tailor the first recommendations based on this.</p>
            </div>

            <div className="space-y-2.5">
              {[
                "Within 24 Hours",
                "This Week",
                "This Month",
                "Just Starting Preparation",
              ].map((time) => (
                <button
                  key={time}
                  onClick={() => setTimeline(time)}
                  className={`w-full text-left px-5 py-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                    timeline === time
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-950/40 text-zinc-400"
                  }`}
                >
                  <span>{time}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      timeline === time ? "border-emerald-400" : "border-zinc-700"
                    }`}
                  >
                    {timeline === time && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-850/60">
              <button
                onClick={() => changeStep(5)}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleFinishSetup}
                disabled={!timeline}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold px-8 py-3 rounded-xl text-xs transition-all flex items-center gap-1.5 hover:scale-[1.01] active:scale-95 shadow-lg shadow-emerald-500/10"
              >
                Finish Setup
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Completed Screen with Loading / Redirection CTA */}
        {currentStep === 7 && (
          <div className="text-center py-8 space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 text-emerald-500 mx-auto animate-spin" />
                <h2 className="text-xl font-bold">Diagnosing Profile...</h2>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-xs mx-auto">
                  Our LLM advisor is analyzing your background and setup parameters to customize your blitz drills.
                </p>
              </div>
            ) : errorMsg ? (
              <div className="space-y-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-xs text-red-400 max-w-sm mx-auto">{errorMsg}</p>
                <button
                  onClick={handleFinishSetup}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-6 py-2 rounded-xl text-xs transition-colors"
                >
                  Retry Setup
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold">Setup Complete!</h2>
                  <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                    Your focus profiles and custom readiness parameters are compiled.
                  </p>
                </div>

                {timeline === "Within 24 Hours" && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs max-w-xs mx-auto text-left space-y-2 leading-relaxed">
                    <span className="font-extrabold uppercase tracking-wider block text-[10px]">⚠️ Rapid Preparation Mode</span>
                    Your interview is scheduled within 24 hours. We recommend generating an Interview Crash Pack first to memorize critical concepts!
                  </div>
                )}

                <div className="pt-4 max-w-xs mx-auto space-y-2.5">
                  {timeline === "Within 24 Hours" ? (
                    <button
                      onClick={() => {
                        localStorage.removeItem("interview_os_onboarding_step");
                        router.push("/crash-pack");
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                    >
                      Go to Crash Pack
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        localStorage.removeItem("interview_os_onboarding_step");
                        router.push("/");
                      }}
                      className="w-full bg-white text-black hover:bg-zinc-200 font-extrabold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-white/5"
                    >
                      Enter Dashboard
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
