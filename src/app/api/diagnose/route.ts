import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// Define the exact schema from the PRD
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    strengths: z.array(z.string()).describe("List of 3 technical strength areas"),
    weaknesses: z.array(z.string()).describe("List of 3 technical weak areas to improve"),
    studyPriorityScores: z.array(
      z.object({
        topic: z.string(),
        score: z.number(),
      })
    ).describe("List of 3 topics with a score from 0-100 indicating study priority urgency"),
  })
);

export async function POST(req: NextRequest) {
  try {
    const { githubUsername, companies, resumeText } = await req.json();

    const formatInstructions = parser.getFormatInstructions();

    const prompt = new PromptTemplate({
      template: `You are an expert technical interviewer and career coach.
Analyze the following candidate profile and determine their current skill level, knowledge gaps, and readiness.

Candidate GitHub: {githubUsername}
Target Companies: {companies}
Resume Summary: {resumeText}

Based on this, generate a diagnostic output.
{format_instructions}`,
      inputVariables: ["githubUsername", "companies", "resumeText"],
      partialVariables: { format_instructions: formatInstructions },
    });

    const chain = prompt.pipe(groqChat).pipe(parser);

    const result = await chain.invoke({
      githubUsername: githubUsername || "Not provided",
      companies: companies?.join(", ") || "Any Tech Company",
      resumeText: resumeText || "General Software Engineer",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Diagnostic error:", error);
    return NextResponse.json({ error: "Failed to generate diagnostics" }, { status: 500 });
  }
}
