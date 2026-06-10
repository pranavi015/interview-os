"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.push("/login");
    }
  }, [user, loading, isPublicPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />

        <div className="z-10 flex flex-col items-center gap-4">
          {/* Glowing Spinner Container */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md animate-pulse" />
            <Loader2 className="w-10 h-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 animate-spin relative z-10" style={{ stroke: 'url(#blue-indigo-gradient)' }} />
            
            {/* SVG Gradient definition for Lucide icon coloring */}
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id="blue-indigo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">
              Verifying Session
            </h2>
            <p className="text-xs text-zinc-500">Connecting to InterviewOS...</p>
          </div>
        </div>
      </div>
    );
  }

  // If there's no user and we are not on a public page, render nothing while redirecting
  if (!user && !isPublicPage) {
    return null;
  }

  return <>{children}</>;
}
