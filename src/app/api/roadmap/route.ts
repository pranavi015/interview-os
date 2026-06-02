import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    weeks: z.array(
      z.object({
        week: z.number().describe("Week number starting from 1"),
        title: z.string().describe("Theme of the week e.g. 'React Fundamentals'"),
        topics: z.array(z.string()).describe("3-4 specific topics to study this week"),
        dailyGoalMinutes: z.number().describe("Recommended daily study time in minutes"),
      })
    ).describe("A 4-week personalized study roadmap"),
  })
);

export async function POST(req: NextRequest) {
  try {
    const { strengths, weaknesses, studyPriorityScores, companies } = await req.json();

    const formatInstructions = parser.getFormatInstructions();

    const prompt = new PromptTemplate({
      template: `You are an expert software engineering career coach.
Generate a focused 4-week interview preparation roadmap based on the candidate's diagnostic results.

Strengths: {strengths}
Weak Areas: {weaknesses}
Study Priority Scores: {studyPriorityScores}
Target Companies: {companies}

Focus the roadmap on the weak areas and high-priority scores. Be very specific about topics.
{format_instructions}`,
      inputVariables: ["strengths", "weaknesses", "studyPriorityScores", "companies"],
      partialVariables: { format_instructions: formatInstructions },
    });

    const chain = prompt.pipe(groqChat).pipe(parser);

    const result = await chain.invoke({
      strengths: strengths?.join(", ") || "General programming",
      weaknesses: weaknesses?.join(", ") || "Data Structures, System Design",
      studyPriorityScores: studyPriorityScores?.map((s: { topic: string; score: number }) => `${s.topic}: ${s.score}/100`).join(", ") || "",
      companies: companies?.join(", ") || "Top tech companies",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Roadmap generation error:", error);
    return NextResponse.json({ error: "Failed to generate roadmap" }, { status: 500 });
  }
}
