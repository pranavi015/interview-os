"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, Eye, EyeOff, Sparkles, Loader2, AlertCircle, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password || !confirmPassword) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to create an account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password strength calculation helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "bg-zinc-800", textClass: "text-zinc-500" };
    
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    
    if (pass.length < 6) {
      return { score: 1, label: "Too Short", color: "bg-red-500/80", textClass: "text-red-400" };
    }
    
    const totalMatched = score;
    if (totalMatched <= 2) {
      return { score: 1, label: "Weak", color: "bg-red-500/80", textClass: "text-red-400" };
    } else if (totalMatched === 3) {
      return { score: 2, label: "Fair", color: "bg-orange-500/80", textClass: "text-orange-400" };
    } else if (totalMatched === 4) {
      return { score: 3, label: "Strong", color: "bg-indigo-400/80", textClass: "text-indigo-400" };
    } else {
      return { score: 4, label: "Excellent", color: "bg-emerald-400/80", textClass: "text-emerald-400" };
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <main className="min-h-screen bg-[#070708] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse duration-[12000ms]" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800/80 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            InterviewOS Registration
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Create your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600">
              Account
            </span>
          </h1>
          <p className="text-zinc-500 text-xs">
            Start practicing and master software engineering interviews.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-zinc-950/40 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500" />

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 text-red-400 p-3.5 rounded-2xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 pl-11 pr-4 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 pl-11 pr-12 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500">Password strength:</span>
                    <span className={`font-bold uppercase tracking-wider ${strength.textClass}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          index <= strength.score ? strength.color : "bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl py-3 pl-11 pr-4 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  Creating Account...
                </>
              ) : (
                <>
                  Sign Up
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Subtext Footer */}
          <div className="mt-6 text-center text-xs text-zinc-500 border-t border-zinc-900/60 pt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
