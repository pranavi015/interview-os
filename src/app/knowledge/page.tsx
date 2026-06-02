"use client";

import React, { useState, useRef, useEffect } from "react";
import { Loader2, Send, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "Explain React Reconciliation",
  "How does the JavaScript Event Loop work?",
  "What is the CAP Theorem?",
  "Explain useCallback vs useMemo",
  "How does Binary Search work?",
  "What is database sharding?",
];

export default function KnowledgePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Welcome to the **InterviewOS Knowledge Base**. Ask me anything about React, JavaScript, TypeScript, System Design, or DSA — and I'll give you a concise, interview-ready answer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || data.error || "Something went wrong.",
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Knowledge Base</h1>
            <p className="text-xs text-gray-400">AI-powered interview prep — React, JS, DSA, System Design</p>
          </div>
        </div>
        <Link href="/roadmap" className="text-sm text-gray-500 hover:text-white transition-colors">
          ← My Roadmap
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mr-3 mt-1">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-[#1a1a1a] border border-gray-800 text-gray-100 rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0 mr-3 mt-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-4 max-w-3xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUGGESTED.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-left text-xs bg-[#1a1a1a] border border-gray-800 hover:border-blue-500 rounded-xl px-3 py-2.5 text-gray-300 hover:text-white transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-gray-800 px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder='Ask anything — "Explain closures in JavaScript"'
            disabled={loading}
            className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white px-4 py-3 rounded-xl transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
