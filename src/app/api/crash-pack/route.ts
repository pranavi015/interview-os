import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { dbService } from "@/lib/db";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ─── Robust JSON extractor (handles Groq/Llama markdown-wrapped responses) ────

function extractJson(rawText: string): Record<string, unknown> | null {
  // 1. Try ```json blocks — skip schema/type-definition blocks
  const blocks = [...rawText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  for (const block of blocks) {
    const content = block[1].trim();
    if (content.includes('"type": "object"') || content.includes('"$schema"')) continue;
    try {
      return JSON.parse(content);
    } catch {}
  }

  // 2. Try any code block
  for (const block of blocks) {
    try {
      return JSON.parse(block[1].trim());
    } catch {}
  }

  // 3. Bare JSON object in the text
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

// ─── Fallback crash pack when parsing fails ───────────────────────────────────

function buildFallback(jobDescription: string) {
  return {
    mustKnowTopics: [
      {
        topic: "System Design",
        urgency: "HIGH",
        reason: "Most senior roles heavily test scalability and architecture thinking.",
      },
      {
        topic: "Data Structures & Algorithms",
        urgency: "HIGH",
        reason: "Core coding interviews universally test DSA problem-solving.",
      },
      {
        topic: "Behavioral (STAR method)",
        urgency: "MEDIUM",
        reason: "Structured storytelling differentiates strong candidates.",
      },
    ],
    revisionNotes: [
      {
        title: "Key Concepts to Review",
        content:
          "- Review the core requirements listed in the job description\n- Focus on the primary tech stack mentioned\n- Practice explaining your past projects using STAR format",
      },
    ],
    targetScenarios: [
      {
        scenario: "Design a system mentioned in the JD",
        answerStrategy:
          "Start with requirements clarification, then outline high-level components, then drill into bottlenecks.",
      },
    ],
  };
}

// ─── POST: Generate Crash Pack ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    if (!jobDescription || jobDescription.trim().length === 0) {
      return NextResponse.json({ error: "Job Description is required" }, { status: 400 });
    }

    const [profile, blitzSessions] = await Promise.all([
      dbService.getProfile("default-user"),
      dbService.getBlitzSessions(),
    ]);

    const blitzHistorySummary =
      blitzSessions && blitzSessions.length > 0
        ? blitzSessions
            .map(
              (s: any) =>
                `- Topic: ${s.topic}, Score: ${s.evaluation?.score || 50}`
            )
            .join("\n")
        : "No blitz sessions completed yet.";

    const prompt = new PromptTemplate({
      template: `You are a Principal Engineering Consultant preparing a candidate for a software engineering interview.

Target Job Description:
"""
{jobDescription}
"""

Candidate Strengths: {strengths}
Candidate Weaknesses: {weaknesses}

Recent Practice Scores:
{blitzHistory}

Generate a hyper-personalized "Interview Crash Pack". Return ONLY a raw JSON object — no markdown formatting, no schema, no explanation — just the JSON:

{{
  "mustKnowTopics": [
    {{ "topic": "...", "urgency": "HIGH|MEDIUM|LOW", "reason": "..." }},
    {{ "topic": "...", "urgency": "HIGH|MEDIUM|LOW", "reason": "..." }},
    {{ "topic": "...", "urgency": "HIGH|MEDIUM|LOW", "reason": "..." }}
  ],
  "revisionNotes": [
    {{ "title": "...", "content": "- bullet\\n- bullet\\n- bullet" }},
    {{ "title": "...", "content": "- bullet\\n- bullet\\n- bullet" }}
  ],
  "targetScenarios": [
    {{ "scenario": "...", "answerStrategy": "..." }},
    {{ "scenario": "...", "answerStrategy": "..." }},
    {{ "scenario": "...", "answerStrategy": "..." }}
  ]
}}`,
      inputVariables: ["jobDescription", "strengths", "weaknesses", "blitzHistory"],
    });

    const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
    const rawText = await chain.invoke({
      jobDescription,
      strengths: profile.strengths?.join(", ") || "General Programming",
      weaknesses: profile.weaknesses?.join(", ") || "None identified",
      blitzHistory: blitzHistorySummary,
    });

    const parsed = extractJson(rawText);
    const generatedBrief = parsed ?? buildFallback(jobDescription);

    // Validate and normalize arrays
    if (!Array.isArray((generatedBrief as any).mustKnowTopics)) {
      (generatedBrief as any).mustKnowTopics = buildFallback(jobDescription).mustKnowTopics;
    }
    if (!Array.isArray((generatedBrief as any).revisionNotes)) {
      (generatedBrief as any).revisionNotes = buildFallback(jobDescription).revisionNotes;
    }
    if (!Array.isArray((generatedBrief as any).targetScenarios)) {
      (generatedBrief as any).targetScenarios = buildFallback(jobDescription).targetScenarios;
    }

    const savedPack = await dbService.saveCrashPack({
      job_description: jobDescription,
      generated_pack: generatedBrief,
    });

    return NextResponse.json(savedPack);
  } catch (error: any) {
    console.error("Crash Pack generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate Crash Pack" },
      { status: 500 }
    );
  }
}

// ─── GET: Fetch saved crash packs ─────────────────────────────────────────────

export async function GET() {
  try {
    const packs = await dbService.getCrashPacks();
    return NextResponse.json(packs);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch Crash Packs" }, { status: 500 });
  }
}
