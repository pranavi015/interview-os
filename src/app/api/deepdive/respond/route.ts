import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DeepDiveMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { repoName, repoContext, messages, questionCount, maxQuestions } = await req.json();

    if (!repoName || !messages || questionCount === undefined || !maxQuestions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const conversationHistory = messages
      .map((m: DeepDiveMessage) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");

    // If we've reached max questions, the candidate has just answered the last question
    // We should evaluate and complete the interview.
    if (questionCount >= maxQuestions) {
      const evaluationPrompt = new PromptTemplate({
        template: `You are a senior software engineer conducting a technical deep-dive interview feedback session.
You have just completed a technical interview with a candidate about their project repository: {repoName}.

Here is the repository context:
{repoContext}

Here is the transcript of the interview:
{conversationHistory}

Please provide a structured, constructive evaluation of the candidate's performance. Focus on:
1. **Understanding of their own project**: How well did they explain their architectural choices and code structure?
2. **Technical Accuracy**: Were their explanations sound and accurate?
3. **Key Strengths**: What did they do particularly well in this interview?
4. **Improvement Areas & Next Steps**: What knowledge gaps were identified, and what should they study or improve in their project?
5. **Overall Rating**: Give a rating out of 100 with a 1-sentence justification.

Format your response beautifully in Markdown. Be encouraging, precise, and highly detailed.`,
        inputVariables: ["repoName", "repoContext", "conversationHistory"],
      });

      const chain = evaluationPrompt.pipe(groqChat).pipe(new StringOutputParser());
      const feedback = await chain.invoke({ repoName, repoContext, conversationHistory });

      return NextResponse.json({
        messages,
        questionCount,
        isComplete: true,
        feedback,
      });
    }

    // Otherwise, generate the next question
    const nextQuestionPrompt = new PromptTemplate({
      template: `You are a senior software engineer conducting a technical deep-dive interview about a candidate's project.

Project Repository: {repoName}

Repository Context:
{repoContext}

Here is the transcript of the interview so far:
{conversationHistory}

Based on the candidate's latest response and the repository context, ask ONE focused, probing technical follow-up question.
Ensure the question:
- Probes deeper into their last answer OR transition to another aspect of the repository (e.g. error handling, data flow, performance, security).
- References specific file structures, libraries, or patterns in the repository where appropriate.
- Challenges their assumptions or design decisions.
- Keep the question under 60 words and ask it directly. Do not include introductory text like "Here is my next question".`,
      inputVariables: ["repoName", "repoContext", "conversationHistory"],
    });

    const chain = nextQuestionPrompt.pipe(groqChat).pipe(new StringOutputParser());
    const nextQuestion = await chain.invoke({ repoName, repoContext, conversationHistory });

    const updatedMessages = [
      ...messages,
      { role: "interviewer", content: nextQuestion },
    ];

    return NextResponse.json({
      messages: updatedMessages,
      questionCount: questionCount + 1,
      isComplete: false,
    });
  } catch (error) {
    console.error("Deep dive respond error:", error);
    return NextResponse.json({ error: "Failed to continue deep dive" }, { status: 500 });
  }
}
