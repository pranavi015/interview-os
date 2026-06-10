import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { dbService } from "@/lib/db";

// ─── Robust JSON extractor ────────────────────────────────────────────────────

function extractJson(rawText: string): Record<string, unknown> | null {
  const blocks = [...rawText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  for (const block of blocks) {
    const content = block[1].trim();
    if (content.includes('"type": "object"') || content.includes('"$schema"')) continue;
    try { return JSON.parse(content); } catch {}
  }
  for (const block of blocks) {
    try { return JSON.parse(block[1].trim()); } catch {}
  }
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

// ─── POST: Run onboarding diagnostic ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { githubUsername, companies, resumeText } = await req.json();

    const prompt = new PromptTemplate({
      template: `You are an expert technical interviewer and career coach.
Analyze the following candidate profile and determine their current skill level, knowledge gaps, and readiness.

Candidate GitHub: {githubUsername}
Target Companies: {companies}
Resume Summary: {resumeText}

Return ONLY a raw JSON object — no markdown, no schema, no explanation:

{{
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "studyPriorityScores": [
    {{ "topic": "<topic>", "score": <0-100> }},
    {{ "topic": "<topic>", "score": <0-100> }},
    {{ "topic": "<topic>", "score": <0-100> }}
  ]
}}`,
      inputVariables: ["githubUsername", "companies", "resumeText"],
    });

    const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
    const rawText = await chain.invoke({
      githubUsername: githubUsername || "Not provided",
      companies: companies?.join(", ") || "Any Tech Company",
      resumeText: resumeText || "General Software Engineer",
    });

    const parsed = extractJson(rawText);

    // Safe fallback if parsing fails
    const result = {
      strengths: Array.isArray(parsed?.strengths)
        ? parsed.strengths
        : ["Problem Solving", "Clean Code", "Git & Collaboration"],
      weaknesses: Array.isArray(parsed?.weaknesses)
        ? parsed.weaknesses
        : ["System Design Scale", "Advanced DSA", "Performance Optimization"],
      studyPriorityScores: Array.isArray(parsed?.studyPriorityScores)
        ? parsed.studyPriorityScores
        : [
            { topic: "System Design", score: 85 },
            { topic: "DSA", score: 75 },
            { topic: "Behavioral", score: 60 },
          ],
    };

    // Persist to profile
    await dbService.updateProfile("default-user", {
      github_username: githubUsername || "",
      selected_companies: companies || [],
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      readiness_score: 50,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Diagnostic error:", error);
    return NextResponse.json({ error: "Failed to generate diagnostics" }, { status: 500 });
  }
}
