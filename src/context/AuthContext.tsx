"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, dbService } from "@/lib/db";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email?: string;
  isMock?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (supabase) {
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      // Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      // Fallback: Check localStorage mock user session
      const savedUser = localStorage.getItem("interview_os_mock_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Mock SignIn
        const mockSession = { id: "default-user", email, isMock: true };
        setUser(mockSession);
        localStorage.setItem("interview_os_mock_user", JSON.stringify(mockSession));
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        // Mock SignUp
        const mockSession = { id: "default-user", email, isMock: true };
        setUser(mockSession);
        localStorage.setItem("interview_os_mock_user", JSON.stringify(mockSession));
      }
      router.push("/onboarding");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      } else {
        localStorage.removeItem("interview_os_mock_user");
      }
      setUser(null);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
