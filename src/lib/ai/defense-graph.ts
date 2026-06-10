import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { groqChat } from "../groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// ─── State Definition ─────────────────────────────────────────────────────────

export interface DefenseState {
  repoName: string;
  repoContext: string;
  messages: Array<{ role: "interviewer" | "candidate"; content: string }>;
  currentQuestionCount: number;
  maxQuestions: number;
  topicsCovered: string[];
  lastScore: number;
  isComplete: boolean;
  finalEvaluation: string;
  // Whether the previous answer triggered teaching mode
  needsTeaching: boolean;
}

export const DefenseStateAnnotation = Annotation.Root({
  repoName: Annotation<string>(),
  repoContext: Annotation<string>(),
  messages: Annotation<Array<{ role: "interviewer" | "candidate"; content: string }>>(),
  currentQuestionCount: Annotation<number>(),
  maxQuestions: Annotation<number>(),
  topicsCovered: Annotation<string[]>(),
  lastScore: Annotation<number>(),
  isComplete: Annotation<boolean>(),
  finalEvaluation: Annotation<string>(),
  needsTeaching: Annotation<boolean>(),
});

// ─── Parsers ──────────────────────────────────────────────────────────────────

const answerEvalParser = StructuredOutputParser.fromZodSchema(
  z.object({
    score: z.number().describe("Technical accuracy score out of 100"),
    topic: z.string().describe("Specific topic of this question (e.g. 'error-handling', 'scaling')"),
    feedback: z.string().describe("Brief feedback on the candidate's answer"),
  })
);

// ─── Helper: Robust JSON extraction from LLM output ──────────────────────────

function extractJson(rawText: string): Record<string, unknown> | null {
  // Try ```json blocks first, excluding schema output
  const blocks = [...rawText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
  for (const block of blocks) {
    const content = block[1].trim();
    if (content.includes('"score"') && !content.includes('"type":')) {
      try {
        return JSON.parse(content);
      } catch {}
    }
  }
  // Try any JSON block
  if (blocks.length > 0) {
    try {
      return JSON.parse(blocks[0][1].trim());
    } catch {}
  }
  // Try bare JSON object in text
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

async function analyzeProjectNode(state: typeof DefenseStateAnnotation.State) {
  if (state.repoContext && state.repoContext.length > 50) return {};

  const prompt = new PromptTemplate({
    template: `You are a project analyzer. Summarize the key architectural points of this project.
Project: {repoName}
Context: {repoContext}

Provide a short 3-bullet list of the key architectural components or techniques used in this repository.`,
    inputVariables: ["repoName", "repoContext"],
  });

  const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
  const summary = await chain.invoke({
    repoName: state.repoName,
    repoContext: state.repoContext || "No readme context found.",
  });

  return {
    repoContext: `${state.repoContext}\n\nArchitectural Analysis:\n${summary}`,
  };
}

async function generateQuestionNode(state: typeof DefenseStateAnnotation.State) {
  if (state.isComplete) return {};

  const history = state.messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n\n");

  const prompt = new PromptTemplate({
    template: `You are a tough, senior software engineering interviewer.
We are conducting a stateful Project Defense interview on the project: {repoName}.

Project Architecture & Context (including README, file tree, and source code):
{repoContext}

Topics covered so far: {topicsCovered}

Interview Transcript:
{history}

Ask the NEXT probing technical question.
- Do NOT repeat questions or ask about already covered topics: {topicsCovered}.
- Reference specific code patterns, files, or architectural decisions you observed in the source code.
- Dive deep into implementation choices, error handling, concurrency, performance trade-offs, or scalability.
- Keep the question concise and challenging (under 60 words).`,
    inputVariables: ["repoName", "repoContext", "topicsCovered", "history"],
  });

  const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
  const nextQuestion = await chain.invoke({
    repoName: state.repoName,
    repoContext: state.repoContext,
    topicsCovered: state.topicsCovered.join(", ") || "None",
    history: history || "Start of interview",
  });

  return {
    messages: [...state.messages, { role: "interviewer" as const, content: nextQuestion }],
    currentQuestionCount: state.currentQuestionCount + 1,
    needsTeaching: false,
  };
}

async function evaluateAnswerNode(state: typeof DefenseStateAnnotation.State) {
  const msgs = state.messages;
  if (msgs.length < 2) return {};

  const lastCandidateMsg = msgs[msgs.length - 1];
  const lastInterviewerMsg = msgs[msgs.length - 2];

  if (lastCandidateMsg.role !== "candidate") return {};

  const formatInstructions = answerEvalParser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template: `Evaluate the candidate's answer to the interviewer's question.

Interviewer's Question: "{question}"
Candidate's Answer: "{answer}"

Assess how technically sound and complete the answer is.
A score >= 60 means acceptable. A score < 60 means the candidate needs guidance.
{format_instructions}`,
    inputVariables: ["question", "answer"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
  const rawText = await chain.invoke({
    question: lastInterviewerMsg.content,
    answer: lastCandidateMsg.content,
  });

  let evaluation: { score: number; topic: string; feedback: string } = {
    score: 75,
    topic: "general",
    feedback: "Answer evaluated.",
  };

  const parsed = extractJson(rawText);
  if (parsed && typeof parsed.score === "number") {
    evaluation = parsed as typeof evaluation;
  }

  const score = typeof evaluation.score === "number" ? evaluation.score : 75;

  return {
    lastScore: score,
    topicsCovered: [...state.topicsCovered, evaluation.topic || "general"],
    needsTeaching: score < 60,
  };
}

/**
 * Teaching Node — triggered when lastScore < 60.
 * The AI provides a short, targeted teaching moment before moving to the next question.
 */
async function teachingNode(state: typeof DefenseStateAnnotation.State) {
  const msgs = state.messages;
  // The last two messages are: interviewer question, candidate answer
  const lastCandidateMsg = msgs[msgs.length - 1];
  const lastInterviewerMsg = msgs.length >= 2 ? msgs[msgs.length - 2] : null;

  const prompt = new PromptTemplate({
    template: `You are a helpful senior engineer providing a teaching moment during a technical interview.

The candidate struggled to answer this question:
"{question}"

Their answer was:
"{answer}"

Score received: {score}/100

Provide a concise, encouraging teaching moment (3-5 sentences) that:
1. Acknowledges what they got right (if anything).
2. Clearly explains the correct concept or approach they missed.
3. References the project "{repoName}" to make it concrete and contextual.
4. Ends with encouragement to keep going.

Do NOT ask another question — just teach and encourage.`,
    inputVariables: ["question", "answer", "score", "repoName"],
  });

  const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
  const teachingMoment = await chain.invoke({
    question: lastInterviewerMsg?.content || "the previous question",
    answer: lastCandidateMsg?.content || "",
    score: String(state.lastScore),
    repoName: state.repoName,
  });

  // Inject teaching moment as an interviewer message
  return {
    messages: [
      ...state.messages,
      {
        role: "interviewer" as const,
        content: `💡 **Teaching Moment:** ${teachingMoment}`,
      },
    ],
    needsTeaching: false,
  };
}

async function generateFinalEvaluationNode(state: typeof DefenseStateAnnotation.State) {
  const history = state.messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n\n");

  const prompt = new PromptTemplate({
    template: `You are a lead architect grading a candidate's Project Defense interview.
Project Repository: {repoName}
Interview Transcript:
{history}

Provide a comprehensive feedback report containing:
1. **Overall Defense Score**: (0 to 100)
2. **Architectural Understanding**: Grade their design logic.
3. **Defense Capability**: How well did they handle pushback and justify their trade-offs?
4. **Key Strengths**: 2 bullet points.
5. **Gaps to Address**: 2-3 specific topics they should study.

Format in beautiful markdown.`,
    inputVariables: ["repoName", "history"],
  });

  const chain = prompt.pipe(groqChat).pipe(new StringOutputParser());
  const finalEval = await chain.invoke({
    repoName: state.repoName,
    history,
  });

  return {
    isComplete: true,
    finalEvaluation: finalEval,
  };
}

// ─── Build LangGraph ──────────────────────────────────────────────────────────

const workflow = new StateGraph(DefenseStateAnnotation)
  .addNode("analyze_project", analyzeProjectNode, { ends: ["generate_question"] })
  .addNode("generate_question", generateQuestionNode, {
    ends: ["final_evaluation", "__end__"],
  })
  .addNode("evaluate_answer", evaluateAnswerNode, {
    ends: ["teaching", "generate_question"],
  })
  .addNode("teaching", teachingNode, { ends: ["generate_question"] })
  .addNode("final_evaluation", generateFinalEvaluationNode, { ends: ["__end__"] });

// ─── Routing ──────────────────────────────────────────────────────────────────

// Entry point: no messages → start fresh; has messages → evaluate answer
workflow.addConditionalEdges(
  "__start__",
  (state) => {
    if (!state.messages || state.messages.length === 0) return "analyze_project";
    return "evaluate_answer";
  },
  {
    analyze_project: "analyze_project",
    evaluate_answer: "evaluate_answer",
  }
);

// After project analysis → generate first question
workflow.addEdge("analyze_project", "generate_question");

// After evaluating: if score < 60 → teach; else → next question
workflow.addConditionalEdges(
  "evaluate_answer",
  (state) => {
    if (state.needsTeaching) return "teaching";
    return "generate_question";
  },
  {
    teaching: "teaching",
    generate_question: "generate_question",
  }
);

// After teaching moment → always generate next question
workflow.addEdge("teaching", "generate_question");

// After generating a question: if max questions reached → finalize; else → done (wait for user)
workflow.addConditionalEdges(
  "generate_question",
  (state) => {
    if (state.currentQuestionCount >= state.maxQuestions) return "final_evaluation";
    return "__end__";
  },
  {
    final_evaluation: "final_evaluation",
    __end__: "__end__",
  }
);

workflow.addEdge("final_evaluation", "__end__");

export const defenseGraph = workflow.compile();
