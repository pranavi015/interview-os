import { NextRequest, NextResponse } from "next/server";
import { defenseGraph } from "@/lib/ai/defense-graph";
import { dbService } from "@/lib/db";

// ─── GitHub Helpers ───────────────────────────────────────────────────────────

async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!res.ok) return "No README found.";
    const text = await res.text();
    return text.slice(0, 3000);
  } catch {
    return "Could not fetch README.";
  }
}

async function fetchRepoTree(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
    if (!res.ok) return "Could not fetch file tree.";
    const data = await res.json();
    const paths = (data.tree || [])
      .filter((t: { type: string }) => t.type === "blob")
      .slice(0, 60)
      .map((t: { path: string }) => t.path);
    return paths.join("\n");
  } catch {
    return "Could not fetch file tree.";
  }
}

/**
 * Fetches the actual source code of important files in the repo.
 * Prioritises key files: entry points, main components, APIs, config files.
 */
async function fetchSourceCode(owner: string, repo: string): Promise<string> {
  // Patterns for "important" files to fetch content from
  const IMPORTANT_PATTERNS = [
    /^(src\/)?(app|pages)\/(page|index|layout|_app)\.(tsx?|jsx?)$/,
    /^(src\/)?app\/api\/.+\/route\.ts$/,
    /^(src\/)?lib\/.+\.(ts|js)$/,
    /^(src\/)?components\/.+\.(tsx?|jsx?)$/,
    /^(package\.json|next\.config\.(js|ts)|tailwind\.config\.(js|ts))$/,
    /^(prisma\/schema\.prisma|drizzle\.config\.(ts|js))$/,
  ];

  try {
    // First fetch the tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    );
    if (!treeRes.ok) return "Could not fetch file tree for source code.";

    const treeData = await treeRes.json();
    const allBlobs: Array<{ path: string; url: string }> = (treeData.tree || [])
      .filter((t: any) => t.type === "blob");

    // Pick the most important files (max 6 to avoid rate limiting)
    const selectedFiles = allBlobs
      .filter((f) => IMPORTANT_PATTERNS.some((pat) => pat.test(f.path)))
      .slice(0, 6);

    if (selectedFiles.length === 0) {
      return "No important source files identified.";
    }

    // Fetch content for each selected file
    const fileContents = await Promise.all(
      selectedFiles.map(async (file) => {
        try {
          const contentRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
            { headers: { Accept: "application/vnd.github.v3.raw" } }
          );
          if (!contentRes.ok) return null;
          const code = await contentRes.text();
          return `\n\n### ${file.path}\n\`\`\`\n${code.slice(0, 1500)}\n\`\`\``;
        } catch {
          return null;
        }
      })
    );

    const snippets = fileContents.filter(Boolean).join("");
    return snippets.length > 0
      ? `## Source Code Excerpts\n${snippets}`
      : "Could not fetch source code content.";
  } catch {
    return "Source code fetch failed.";
  }
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, repoName, githubUsername } = body;

    if (action === "start") {
      if (!repoName || !githubUsername) {
        return NextResponse.json({ error: "Missing repoName or githubUsername" }, { status: 400 });
      }

      // Fetch README, file tree, and actual source code in parallel
      const [readme, fileTree, sourceCode] = await Promise.all([
        fetchRepoReadme(githubUsername, repoName),
        fetchRepoTree(githubUsername, repoName),
        fetchSourceCode(githubUsername, repoName),
      ]);

      const initialContext = [
        `## README\n${readme}`,
        `## File Structure\n${fileTree}`,
        sourceCode,
      ].join("\n\n");

      const initialState = {
        repoName,
        repoContext: initialContext,
        messages: [],
        currentQuestionCount: 0,
        maxQuestions: 5,
        topicsCovered: [],
        lastScore: 0,
        isComplete: false,
        finalEvaluation: "",
      };

      const resultState = await defenseGraph.invoke(initialState);

      return NextResponse.json(resultState);
    }

    if (action === "respond") {
      const { state, candidateResponse } = body;
      if (!state || !candidateResponse) {
        return NextResponse.json({ error: "Missing state or candidateResponse" }, { status: 400 });
      }

      const updatedMessages = [
        ...state.messages,
        { role: "candidate" as const, content: candidateResponse },
      ];

      const currentState = {
        ...state,
        messages: updatedMessages,
      };

      const nextState = await defenseGraph.invoke(currentState);

      if (nextState.isComplete) {
        await dbService.saveProjectDefenseSession({
          repo_name: state.repoName,
          state_history: nextState.messages,
          final_evaluation: {
            text: nextState.finalEvaluation,
            score: nextState.lastScore,
          },
        });
      }

      return NextResponse.json(nextState);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Project Defense API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
