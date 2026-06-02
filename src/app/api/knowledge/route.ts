import { NextRequest, NextResponse } from "next/server";
import { groqChat } from "@/lib/groq";
import { retrieveRelevantDocs } from "@/lib/vectorstore";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    // Retrieve relevant documents from the knowledge base
    const docs = await retrieveRelevantDocs(question, 3);
    const context = docs.map(d => d.pageContent).join("\n\n");

    const ragPrompt = new PromptTemplate({
      template: `You are an expert software engineering interview coach.
Use the following context from the knowledge base to answer the candidate's question clearly and concisely.
Include a practical code example if relevant. Keep your response under 300 words.

Context:
{context}

Question: {question}

Answer:`,
      inputVariables: ["context", "question"],
    });

    const chain = ragPrompt.pipe(groqChat).pipe(new StringOutputParser());

    const answer = await chain.invoke({
      context: context || "No specific context found. Answer from general knowledge.",
      question,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Knowledge API error:", error);
    return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
  }
}
