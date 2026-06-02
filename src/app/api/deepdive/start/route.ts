import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function fetchRepoReadme(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!res.ok) return "No README found.";
    const text = await res.text();
    return text.slice(0, 3000); // Trim to keep within context limits
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
      .slice(0, 50)
      .map((t: { path: string }) => t.path);
    return paths.join("\n");
  } catch {
    return "Could not fetch file tree.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { githubUsername, repoName } = await req.json();
    if (!githubUsername || !repoName) {
      return NextResponse.json({ error: "githubUsername and repoName are required" }, { status: 400 });
    }

    const [readme, fileTree] = await Promise.all([
      fetchRepoReadme(githubUsername, repoName),
      fetchRepoTree(githubUsername, repoName),
    ]);

    const repoContext = `README:\n${readme}\n\nFile Structure:\n${fileTree}`;

    const prompt = new PromptTemplate({
      template: `You are a senior software engineer conducting a technical deep-dive interview about a candidate's project.

Project Repository: {repoName}

{repoContext}

Based on the repository README and file structure above, ask ONE focused, probing technical question about:
- Architecture decisions
- Technology choices
- Scalability or performance considerations
- Error handling or edge cases

Ask the question directly. Be specific to THIS project — reference actual file names or patterns you see. Keep it under 50 words.`,
      inputVariables: ["repoName", "repoContext"],
    });

    const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
    const firstQuestion = await chain.invoke({ repoName, repoContext });

    return NextResponse.json({
      repoName,
      repoContext,
      firstQuestion,
    });
  } catch (error) {
    console.error("Deep dive start error:", error);
    return NextResponse.json({ error: "Failed to start deep dive" }, { status: 500 });
  }
}
