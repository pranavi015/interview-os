import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Initialize real Supabase if keys are provided
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("Supabase keys are missing. Using client-side LocalStorage/In-Memory fallback database.");
}

// In-Memory fallback store for server-side usage, synchronized with client-side localStorage when running in browser
class MockDatabase {
  private getStorage(): any {
    if (typeof window === "undefined") {
      // Server-side simple global cache
      if (!(global as any)._mock_db) {
        (global as any)._mock_db = {
          profiles: {},
          resumes: {},
          github_projects: {},
          documents: [],
          blitz_sessions: [],
          project_defense_sessions: [],
          crash_packs: []
        };
      }
      return (global as any)._mock_db;
    }

    // Client-side localStorage
    const key = "interview_os_mock_db";
    let data = localStorage.getItem(key);
    if (!data) {
      const initial = {
        profiles: {},
        resumes: {},
        github_projects: {},
        documents: [],
        blitz_sessions: [],
        project_defense_sessions: [],
        crash_packs: []
      };
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  }

  private saveStorage(data: any) {
    if (typeof window !== "undefined") {
      localStorage.setItem("interview_os_mock_db", JSON.stringify(data));
    } else {
      (global as any)._mock_db = data;
    }
  }

  getProfile(profileId = "default-user") {
    const db = this.getStorage();
    if (!db.profiles[profileId]) {
      db.profiles[profileId] = {
        id: profileId,
        github_username: "",
        selected_companies: [],
        readiness_score: 50,
        strengths: ["React Hooks", "State Management", "Git & Collaboration"],
        weaknesses: ["System Design Scale", "Web Performance Optimization", "pgvector Database Indexing"],
        updated_at: new Date().toISOString()
      };
      this.saveStorage(db);
    }
    return db.profiles[profileId];
  }

  updateProfile(profileId = "default-user", updates: any) {
    const db = this.getStorage();
    const existing = this.getProfile(profileId);
    db.profiles[profileId] = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.saveStorage(db);
    return db.profiles[profileId];
  }

  saveBlitzSession(session: { topic: string; question: string; user_transcription: string; evaluation: any }) {
    const db = this.getStorage();
    const newSession = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      profile_id: "default-user",
      ...session,
      completed_at: new Date().toISOString()
    };
    db.blitz_sessions.push(newSession);
    
    // Dynamically recalculate profile readiness score based on blitz results
    const recentScores = db.blitz_sessions.map((s: any) => s.evaluation?.score || 50);
    const avgScore = Math.round(recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length);
    this.updateProfile("default-user", { readiness_score: avgScore });

    this.saveStorage(db);
    return newSession;
  }

  getBlitzSessions() {
    const db = this.getStorage();
    return db.blitz_sessions;
  }

  saveProjectDefenseSession(session: { repo_name: string; state_history: any[]; final_evaluation?: any }) {
    const db = this.getStorage();
    const newSession = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      profile_id: "default-user",
      ...session,
      created_at: new Date().toISOString()
    };
    db.project_defense_sessions.push(newSession);
    this.saveStorage(db);
    return newSession;
  }

  getProjectDefenseSessions() {
    const db = this.getStorage();
    return db.project_defense_sessions;
  }

  saveCrashPack(pack: { job_description: string; generated_pack: any }) {
    const db = this.getStorage();
    const newPack = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      profile_id: "default-user",
      ...pack,
      created_at: new Date().toISOString()
    };
    db.crash_packs.push(newPack);
    this.saveStorage(db);
    return newPack;
  }

  getCrashPacks() {
    const db = this.getStorage();
    return db.crash_packs;
  }
}

export const mockDb = new MockDatabase();

export const dbService = {
  getProfile: async (profileId = "default-user") => {
    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();
      if (!error && data) return data;
      // If profile doesn't exist, create default
      if (error && error.code === "PGRST116") {
        const defaultProfile = {
          id: profileId,
          github_username: "",
          selected_companies: [],
          readiness_score: 50,
          strengths: ["React Hooks", "State Management", "Git & Collaboration"],
          weaknesses: ["System Design Scale", "Web Performance Optimization", "pgvector Database Indexing"]
        };
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert(defaultProfile)
          .select()
          .single();
        if (!insertError && inserted) return inserted;
      }
    }
    return mockDb.getProfile(profileId);
  },

  updateProfile: async (profileId = "default-user", updates: any) => {
    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileId)
        .select()
        .single();
      if (!error && data) return data;
    }
    return mockDb.updateProfile(profileId, updates);
  },

  saveBlitzSession: async (session: { topic: string; question: string; user_transcription: string; evaluation: any }) => {
    if (supabase) {
      const { data, error } = await supabase
        .from("blitz_sessions")
        .insert({
          profile_id: "default-user",
          topic: session.topic,
          question: session.question,
          user_transcription: session.user_transcription,
          evaluation: session.evaluation
        })
        .select()
        .single();
      if (!error && data) {
        // Recalculate average score for profile
        const { data: allSessions } = await supabase
          .from("blitz_sessions")
          .select("evaluation");
        if (allSessions && allSessions.length > 0) {
          const scores = allSessions.map((s: any) => s.evaluation?.score || 50);
          const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
          await supabase.from("profiles").update({ readiness_score: avg }).eq("id", "default-user");
        }
        return data;
      }
    }
    return mockDb.saveBlitzSession(session);
  },

  getBlitzSessions: async () => {
    if (supabase) {
      const { data, error } = await supabase
        .from("blitz_sessions")
        .select("*")
        .order("completed_at", { ascending: false });
      if (!error && data) return data;
    }
    return mockDb.getBlitzSessions();
  },

  saveProjectDefenseSession: async (session: { repo_name: string; state_history: any[]; final_evaluation?: any }) => {
    if (supabase) {
      const { data, error } = await supabase
        .from("project_defense_sessions")
        .insert({
          profile_id: "default-user",
          repo_name: session.repo_name,
          state_history: session.state_history,
          final_evaluation: session.final_evaluation
        })
        .select()
        .single();
      if (!error && data) return data;
    }
    return mockDb.saveProjectDefenseSession(session);
  },

  getProjectDefenseSessions: async () => {
    if (supabase) {
      const { data, error } = await supabase
        .from("project_defense_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return mockDb.getProjectDefenseSessions();
  },

  saveCrashPack: async (pack: { job_description: string; generated_pack: any }) => {
    if (supabase) {
      const { data, error } = await supabase
        .from("crash_packs")
        .insert({
          profile_id: "default-user",
          job_description: pack.job_description,
          generated_pack: pack.generated_pack
        })
        .select()
        .single();
      if (!error && data) return data;
    }
    return mockDb.saveCrashPack(pack);
  },

  getCrashPacks: async () => {
    if (supabase) {
      const { data, error } = await supabase
        .from("crash_packs")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) return data;
    }
    return mockDb.getCrashPacks();
  }
};
