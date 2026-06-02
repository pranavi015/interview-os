import { Document } from "@langchain/core/documents";

// Simple in-memory vector store using keyword matching instead of embeddings.
// This avoids needing MemoryVectorStore or any embedding API key for dev.
// TODO: Replace with SupabaseVectorStore + pgvector + real embeddings in production.

const knowledgeDocs: Document[] = [
  new Document({ pageContent: "React Reconciliation is the algorithm React uses to diff the virtual DOM. When state changes, React creates a new virtual DOM tree and compares it with the previous one using a diffing algorithm that runs in O(n) time. Keys in lists help React track which items changed.", metadata: { topic: "React" } }),
  new Document({ pageContent: "React Hooks rules: only call hooks at the top level (not inside loops or conditionals), only call hooks from React function components or custom hooks. useState returns [state, setter]. useEffect runs after render and can return a cleanup function.", metadata: { topic: "React" } }),
  new Document({ pageContent: "useCallback memoizes a function reference, useMemo memoizes a computed value. Use them to avoid unnecessary re-renders of child components that receive these as props. React.memo wraps a component to skip re-renders if props haven't changed.", metadata: { topic: "React" } }),
  new Document({ pageContent: "JavaScript Event Loop: The call stack runs synchronous code. The microtask queue (Promises, queueMicrotask) drains completely after each task. The macrotask queue (setTimeout, setInterval) runs one task at a time. Microtasks always run before the next macrotask.", metadata: { topic: "JavaScript" } }),
  new Document({ pageContent: "JavaScript Closures: A closure is a function that captures variables from its enclosing lexical scope even after the outer function has returned. Common use cases: data encapsulation, factory functions, memoization, partial application.", metadata: { topic: "JavaScript" } }),
  new Document({ pageContent: "JavaScript Promises vs async/await: async/await is syntactic sugar over Promises. await pauses execution inside an async function until the Promise resolves. Promise.all runs Promises concurrently and rejects fast if any rejects. Promise.allSettled waits for all regardless of rejection.", metadata: { topic: "JavaScript" } }),
  new Document({ pageContent: "TypeScript Generics allow you to write reusable, type-safe components. Example: function identity<T>(arg: T): T. Common generic utilities: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, Readonly<T>, Record<K, V>.", metadata: { topic: "TypeScript" } }),
  new Document({ pageContent: "System Design — Load Balancers distribute incoming traffic across multiple servers. Types: Round Robin, Least Connections, IP Hash. Load balancers also handle health checks and SSL termination. Examples: Nginx, AWS ALB.", metadata: { topic: "System Design" } }),
  new Document({ pageContent: "System Design — CAP Theorem: A distributed system can only guarantee 2 of 3: Consistency (every read returns the latest write), Availability (every request gets a response), Partition Tolerance (system works despite network partitions). In practice, partition tolerance is required, so you choose between CP or AP systems.", metadata: { topic: "System Design" } }),
  new Document({ pageContent: "System Design — Database Sharding splits data across multiple databases by a shard key. Vertical sharding splits by column groups; horizontal sharding (partitioning) splits by rows. Challenges include cross-shard queries and rebalancing.", metadata: { topic: "System Design" } }),
  new Document({ pageContent: "Data Structures — Big O Complexity. Array access O(1), search O(n). Hash Map get/set O(1) average. Binary Search O(log n). Sorting (Merge/Quick) O(n log n). Graph BFS/DFS O(V+E). Heap insert/extract O(log n).", metadata: { topic: "DSA" } }),
  new Document({ pageContent: "Data Structures — Binary Trees: In-order traversal (left, root, right) gives sorted output for BSTs. Pre-order (root, left, right) is used for copying trees. Post-order (left, right, root) is used for deletion. Level-order uses a queue (BFS).", metadata: { topic: "DSA" } }),
  new Document({ pageContent: "CSS Box Model: content → padding → border → margin. box-sizing: border-box makes width/height include padding and border. Flexbox: justify-content aligns on main axis, align-items aligns on cross axis. Grid: use grid-template-columns and grid-template-rows.", metadata: { topic: "CSS" } }),
  new Document({ pageContent: "Next.js App Router: Server Components render on the server by default and cannot use hooks or browser APIs. Add 'use client' directive to make a component a Client Component. Server Actions allow calling server-side functions directly from client components using the 'use server' directive.", metadata: { topic: "Next.js" } }),
];

/**
 * Simple keyword-based similarity retrieval.
 * Scores each document by counting how many query words appear in its content.
 */
function scoreDocument(query: string, doc: Document): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const content = doc.pageContent.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (content.includes(word)) score++;
  }
  return score;
}

export async function retrieveRelevantDocs(query: string, topK = 3): Promise<Document[]> {
  const scored = knowledgeDocs.map(doc => ({ doc, score: scoreDocument(query, doc) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(s => s.score > 0).map(s => s.doc);
}
