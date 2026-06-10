-- ============================================================================
-- InterviewOS V1 — Supabase Database Schema + RLS Policies
-- Run this in your Supabase SQL Editor or via Supabase CLI migrations.
-- ============================================================================

-- Enable pgvector extension for semantic search embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles: one per user, holds readiness score + skill snapshot
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY DEFAULT 'default-user',
  github_username TEXT NOT NULL DEFAULT '',
  selected_companies TEXT[] DEFAULT '{}',
  readiness_score INTEGER DEFAULT 50 CHECK (readiness_score BETWEEN 0 AND 100),
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  resume_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blitz Sessions: voice Q&A history
CREATE TABLE IF NOT EXISTS blitz_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      TEXT REFERENCES profiles(id) ON DELETE CASCADE DEFAULT 'default-user',
  topic           TEXT NOT NULL,
  question        TEXT NOT NULL,
  user_transcription TEXT DEFAULT '',
  evaluation      JSONB DEFAULT '{}',
  completed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Project Defense Sessions: LangGraph interview history
CREATE TABLE IF NOT EXISTS project_defense_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      TEXT REFERENCES profiles(id) ON DELETE CASCADE DEFAULT 'default-user',
  repo_name       TEXT NOT NULL,
  state_history   JSONB DEFAULT '[]',
  final_evaluation JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Crash Packs: generated study briefings
CREATE TABLE IF NOT EXISTS crash_packs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      TEXT REFERENCES profiles(id) ON DELETE CASCADE DEFAULT 'default-user',
  job_description TEXT NOT NULL,
  generated_pack  JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Documents: RAG vector store (pgvector)
-- embedding dimension 1536 = OpenAI text-embedding-ada-002
-- Change to 384 if using HuggingFace all-MiniLM-L6-v2
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  TEXT REFERENCES profiles(id) ON DELETE CASCADE DEFAULT 'default-user',
  file_path   TEXT NOT NULL DEFAULT 'unknown',
  content     TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Speed up per-user lookups
CREATE INDEX IF NOT EXISTS idx_blitz_profile ON blitz_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_defense_profile ON project_defense_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_docs_profile ON documents(profile_id);

-- Full-text search on document content
CREATE INDEX IF NOT EXISTS idx_docs_content_fts
  ON documents
  USING GIN (to_tsvector('english', content));

-- pgvector HNSW index for fast nearest-neighbour search (requires pg_vector >= 0.5)
-- Comment out if not yet supported by your Supabase plan:
CREATE INDEX IF NOT EXISTS idx_docs_embedding
  ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- SUPABASE RLS POLICIES
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE blitz_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_defense_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_packs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents              ENABLE ROW LEVEL SECURITY;

-- ----- profiles -----
-- Each user can only read/write their own profile row.
-- auth.uid()::text maps to the profile id.

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid()::text);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid()::text);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- ----- blitz_sessions -----
CREATE POLICY "Users can view their own blitz sessions"
  ON blitz_sessions FOR SELECT
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can insert their own blitz sessions"
  ON blitz_sessions FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- ----- project_defense_sessions -----
CREATE POLICY "Users can view their own defense sessions"
  ON project_defense_sessions FOR SELECT
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can insert their own defense sessions"
  ON project_defense_sessions FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- ----- crash_packs -----
CREATE POLICY "Users can view their own crash packs"
  ON crash_packs FOR SELECT
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can insert their own crash packs"
  ON crash_packs FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- ----- documents -----
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (profile_id = auth.uid()::text);

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (profile_id = auth.uid()::text);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- match_documents: pgvector semantic similarity search
-- Returns the top K most similar document chunks for a query embedding.
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 4,
  filter_profile_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  file_path TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    d.id,
    d.content,
    d.metadata,
    d.file_path,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    d.embedding IS NOT NULL
    AND (filter_profile_id IS NULL OR d.profile_id = filter_profile_id)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Auto-update updated_at on profile changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
