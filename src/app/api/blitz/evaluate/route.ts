import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ─── Robust JSON extraction (handles Groq/Llama markdown-wrapped output) ──────

function extractJson(rawText: string): Record<string, unknown> | null {
  // 1. Try ```json blocks — skip schema-only blocks
  const blocks = [...rawText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  for (const block of blocks) {
    const content = block[1].trim();
    // Skip blocks that are just the JSON schema definition
    if (content.includes('"type": "object"') || content.includes('"$schema"')) continue;
    try {
      return JSON.parse(content);
    } catch {}
  }

  // 2. Try any ```...``` block
  for (const block of blocks) {
    try {
      return JSON.parse(block[1].trim());
    } catch {}
  }

  // 3. Try extracting a raw JSON object from the text
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { topic, question, user_transcription } = await req.json();

    if (!user_transcription || user_transcription.trim().length === 0) {
      return NextResponse.json(
        { error: "No transcription provided for evaluation" },
        { status: 400 }
      );
    }

    const prompt = new PromptTemplate({
      template: `You are an expert technical interviewer evaluating a candidate's verbal response.

Topic: {topic}
Question: {question}
Candidate's Answer: "{user_transcription}"

Evaluate the response and return ONLY a valid JSON object — no markdown, no explanation, no schema, just the raw JSON:

{{
  "score": <overall 0-100>,
  "accuracy": <0-100>,
  "clarity": <0-100>,
  "conciseness": <0-100>,
  "confidence": <0-100>,
  "feedback": ["<point 1>", "<point 2>", "<point 3>"],
  "betterAlternative": "<a concise, professional model answer>"
}}`,
      inputVariables: ["topic", "question", "user_transcription"],
    });

    const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
    const rawText = await chain.invoke({ topic, question, user_transcription });

    // Parse with robust extractor
    const parsed = extractJson(rawText);

    if (!parsed) {
      console.error("Could not parse evaluation JSON. Raw output:", rawText);
      // Return a safe fallback so the UI doesn't crash
      return NextResponse.json({
        score: 65,
        accuracy: 65,
        clarity: 65,
        conciseness: 65,
        confidence: 65,
        feedback: [
          "Answer was received but could not be fully evaluated.",
          "Try speaking more clearly and with greater technical depth.",
        ],
        betterAlternative:
          "A strong answer would clearly define the concept, explain how it works, and provide a real-world example.",
      });
    }

    // Ensure all numeric fields are valid numbers
    const safe = (val: unknown, fallback = 70) =>
      typeof val === "number" && !isNaN(val) ? Math.round(val) : fallback;

    const result = {
      score: safe(parsed.score),
      accuracy: safe(parsed.accuracy),
      clarity: safe(parsed.clarity),
      conciseness: safe(parsed.conciseness),
      confidence: safe(parsed.confidence),
      feedback: Array.isArray(parsed.feedback)
        ? parsed.feedback
        : ["Feedback unavailable."],
      betterAlternative:
        typeof parsed.betterAlternative === "string"
          ? parsed.betterAlternative
          : "See topic documentation for a model answer.",
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}
