import { ChatGroq } from "@langchain/groq";

if (!process.env.GROQ_API_KEY) {
  console.warn("Missing GROQ_API_KEY environment variable. AI features will not work.");
}

// We use llama-3.1-8b-instant or llama-3.3-70b-versatile for high speed inference
export const groqChat = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY || "dummy_key_for_build",
  model: "llama-3.1-8b-instant",
  temperature: 0.2,
});
