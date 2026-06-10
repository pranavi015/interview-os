import { Document } from "@langchain/core/documents";
import { supabase } from "./db";

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Splits a long text into overlapping chunks for retrieval.
 * Uses sentence boundaries where possible.
 */
export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).length > chunkSize) {
      if (current.length > 0) {
        chunks.push(current.trim());
        // Overlap: carry last `overlap` chars into next chunk
        current = current.slice(-overlap) + " " + sentence;
      } else {
        // Sentence itself is too long — force split
        chunks.push(sentence.slice(0, chunkSize));
        current = sentence.slice(chunkSize - overlap);
      }
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

// ─── TF-IDF Keyword Embedding ─────────────────────────────────────────────────

/**
 * Converts a text to a sparse TF-IDF style keyword vector.
 * Used when a real embedding model is unavailable.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeTfIdf(query: string, doc: string): number {
  const queryTokens = new Set(tokenize(query));
  const docTokens = tokenize(doc);
  const docFreq = new Map<string, number>();

  for (const token of docTokens) {
    docFreq.set(token, (docFreq.get(token) || 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    const tf = (docFreq.get(token) || 0) / docTokens.length;
    score += tf;
  }

  return score;
}

// ─── In-Memory Document Index ─────────────────────────────────────────────────

interface IndexedDocument {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

const memoryIndex: IndexedDocument[] = [];

/**
 * Adds chunks to the in-memory index (used as fallback when Supabase is not configured).
 */
export function indexDocuments(
  chunks: string[],
  metadata: Record<string, string>
) {
  for (const chunk of chunks) {
    memoryIndex.push({
      id: `${metadata.source}-${memoryIndex.length}`,
      content: chunk,
      metadata,
    });
  }
}

/**
 * Retrieves the top-K relevant chunks from in-memory index using TF-IDF scoring.
 */
export function retrieveFromMemory(
  query: string,
  topK = 4,
  filter?: Record<string, string>
): Document[] {
  let pool = memoryIndex;

  if (filter) {
    pool = pool.filter((doc) =>
      Object.entries(filter).every(([k, v]) => doc.metadata[k] === v)
    );
  }

  const scored = pool.map((doc) => ({
    doc,
    score: computeTfIdf(query, doc.content),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topK)
    .filter((s) => s.score > 0)
    .map(
      (s) =>
        new Document({
          pageContent: s.doc.content,
          metadata: s.doc.metadata,
        })
    );
}

// ─── Supabase pgvector Pipeline ───────────────────────────────────────────────

/**
 * Stores document chunks in Supabase with a placeholder embedding vector.
 * When a real embedding model is connected, replace the null vector with actual embeddings.
 */
export async function storeChunksInSupabase(
  chunks: string[],
  metadata: Record<string, string>,
  profileId = "default-user"
): Promise<void> {
  if (!supabase) {
    // Fallback to in-memory index
    indexDocuments(chunks, metadata);
    return;
  }

  const rows = chunks.map((chunk) => ({
    profile_id: profileId,
    file_path: metadata.source || "unknown",
    content: chunk,
    embedding: null, // TODO: Replace with real embedding vector from OpenAI/HuggingFace
    metadata: { ...metadata },
  }));

  const { error } = await supabase.from("documents").insert(rows);

  if (error) {
    console.error("Supabase pgvector insert failed:", error);
    // Fallback to in-memory
    indexDocuments(chunks, metadata);
  }
}

/**
 * Retrieves relevant chunks from Supabase via text search (full-text when pgvector embeddings unavailable).
 * When real embeddings are added, this should call the `match_documents` RPC function.
 */
export async function retrieveFromSupabase(
  query: string,
  topK = 4,
  filter?: { profile_id?: string }
): Promise<Document[]> {
  if (!supabase) {
    return retrieveFromMemory(query);
  }

  // Use Supabase full-text search as interim until embeddings are enabled
  let queryBuilder = supabase
    .from("documents")
    .select("content, metadata, file_path")
    .textSearch("content", query.split(" ").join(" | "), { type: "websearch" })
    .limit(topK);

  if (filter?.profile_id) {
    queryBuilder = queryBuilder.eq("profile_id", filter.profile_id);
  }

  const { data, error } = await queryBuilder;

  if (error || !data || data.length === 0) {
    // Fallback to in-memory TF-IDF
    return retrieveFromMemory(query, topK);
  }

  return data.map(
    (row: any) =>
      new Document({
        pageContent: row.content,
        metadata: row.metadata || { source: row.file_path },
      })
  );
}

// ─── Main Retrieval Entry Point ───────────────────────────────────────────────

/**
 * Universal retrieval function. Automatically routes to Supabase or in-memory fallback.
 */
export async function retrieveRelevantDocs(
  query: string,
  topK = 4,
  filter?: { profile_id?: string }
): Promise<Document[]> {
  return retrieveFromSupabase(query, topK, filter);
}

/**
 * Ingests a block of text (resume, README, JD) by chunking and storing it.
 */
export async function ingestText(
  text: string,
  metadata: Record<string, string>,
  profileId = "default-user"
): Promise<void> {
  const chunks = chunkText(text);
  await storeChunksInSupabase(chunks, metadata, profileId);
  console.log(`Ingested ${chunks.length} chunks from ${metadata.source}`);
}
