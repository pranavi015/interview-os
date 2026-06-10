"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Play, Volume2, ArrowRight, Award, Flame, RefreshCw, BarChart2, ShieldAlert, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { dbService } from "@/lib/db";

const TOPICS = [
  { id: "react", name: "React & Frontend", color: "from-cyan-500 to-blue-600" },
  { id: "javascript", name: "Advanced JS", color: "from-amber-400 to-orange-500" },
  { id: "system-design", name: "System Design", color: "from-purple-500 to-indigo-600" },
  { id: "dsa", name: "Data Structures & Algos", color: "from-emerald-400 to-teal-600" },
];

const PRESETS: Record<string, string[]> = {
  react: [
    "Explain the difference between React's Virtual DOM and the real DOM. How does reconciliation work?",
    "What is the difference between useMemo and useCallback? When would you use them?",
    "How does the useEffect cleanup function work, and when is it executed?"
  ],
  javascript: [
    "What is the event loop in JavaScript? Explain the microtask and macrotask queues.",
    "What is a closure in JavaScript, and what are some common use cases for it?",
    "Explain the difference between Promise.all, Promise.allSettled, and Promise.race."
  ],
  "system-design": [
    "Explain the CAP theorem and why partition tolerance is practically non-negotiable.",
    "What is database sharding? What are the main challenges when implementing it?",
    "How does a load balancer work, and what are some common routing algorithms?"
  ],
  dsa: [
    "What is the time complexity of quicksort in the average and worst cases? How can we avoid the worst case?",
    "Explain the difference between BFS and DFS. What data structures are used to implement them?",
    "What is a hash collision, and what are the common strategies to resolve it?"
  ]
};

const TIMER_OPTIONS = [
  { label: "60s — Standard", value: 60 },
  { label: "90s — Extended", value: 90 },
  { label: "3min — Deep Dive", value: 180 },
];

export default function BlitzPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "RECORDING" | "EVALUATING" | "RESULT">("IDLE");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timerDuration, setTimerDuration] = useState(60);
  const [timer, setTimer] = useState(60);
  const [transcription, setTranscription] = useState("");
  const [evaluation, setEvaluation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Load streak on mount
    if (typeof window !== "undefined") {
      const savedStreak = localStorage.getItem("blitz_streak");
      if (savedStreak) setStreak(parseInt(savedStreak));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (gameState === "RECORDING") {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const speakQuestion = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startBlitz = (topicId: string) => {
    setSelectedTopic(topicId);
    setCurrentQuestionIndex(0);
    setGameState("PLAYING");
    setEvaluation(null);
    setTranscription("");
    setError(null);
    const firstQuestion = PRESETS[topicId][0];
    speakQuestion(firstQuestion);
  };

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analyzer for visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      // Start canvas drawing loop
      drawWaveform();

      const options = { mimeType: "audio/webm" };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleAudioSubmit(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setTimer(timerDuration);
      setGameState("RECORDING");
    } catch (err: any) {
      console.error(err);
      setError("Please allow microphone access to practice speaking.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    // Stop canvas visualizer
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        // Gradient color for bars
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, "#3b82f6");
        grad.addColorStop(1, "#8b5cf6");

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };
    draw();
  };

  const handleAudioSubmit = async (audioBlob: Blob) => {
    setGameState("EVALUATING");
    try {
      // 1. Upload to STT
      const formData = new FormData();
      formData.append("file", audioBlob, "speech.webm");

      const sttRes = await fetch("/api/blitz/stt", {
        method: "POST",
        body: formData,
      });

      if (!sttRes.ok) throw new Error("Transcription failed");
      const { text } = await sttRes.json();
      setTranscription(text);

      if (!text || text.trim().length < 5) {
        throw new Error("We couldn't hear or transcribe your answer. Please try speaking louder/longer.");
      }

      // 2. Evaluate
      const evalRes = await fetch("/api/blitz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          question: PRESETS[selectedTopic!][currentQuestionIndex],
          user_transcription: text,
        }),
      });

      if (!evalRes.ok) throw new Error("Evaluation failed");
      const evalData = await evalRes.json();
      setEvaluation(evalData);

      // Save to database
      await dbService.saveBlitzSession({
        topic: selectedTopic!,
        question: PRESETS[selectedTopic!][currentQuestionIndex],
        user_transcription: text,
        evaluation: evalData,
      });

      // Update local streak
      if (evalData.score >= 70) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        localStorage.setItem("blitz_streak", String(newStreak));
      } else {
        setStreak(0);
        localStorage.setItem("blitz_streak", "0");
      }

      setGameState("RESULT");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setGameState("PLAYING");
    }
  };

  const nextQuestion = () => {
    const questions = PRESETS[selectedTopic!];
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setGameState("PLAYING");
      setEvaluation(null);
      setTranscription("");
      setError(null);
      speakQuestion(questions[currentQuestionIndex + 1]);
    } else {
      // Completed topic
      setGameState("IDLE");
      setSelectedTopic(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-gray-900 bg-[#0c0c0e]/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          ◀ INTERVIEWOS <span className="text-white text-xs px-2 py-0.5 bg-zinc-800 rounded">BLITZ</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/25">
            <Flame className="w-4 h-4 fill-orange-400" />
            <span>{streak} Day Streak</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
        {gameState === "IDLE" && (
          <div className="w-full text-center space-y-8 py-10">
            <div className="max-w-2xl mx-auto space-y-4">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Rapid-Fire <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Speech Blitz</span>
              </h1>
              <p className="text-zinc-400 text-lg">
                Pick a topic, listen to the question, and answer verbally. Race the clock to defend your answer under real interview pressure.
              </p>
            </div>

            {/* Timer Selection */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Response Time Limit</span>
              <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-1.5">
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    id={`timer-${opt.value}`}
                    onClick={() => setTimerDuration(opt.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                      timerDuration === opt.value
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  id={`topic-${topic.id}`}
                  onClick={() => startBlitz(topic.id)}
                  className={`relative group overflow-hidden rounded-2xl p-6 text-left border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all duration-300 hover:scale-[1.02] active:scale-95`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${topic.color}`} />
                  <h3 className="font-bold text-xl mb-1">{topic.name}</h3>
                  <p className="text-zinc-500 text-sm">3 challenges • <span className="text-zinc-400 font-semibold">{timerDuration}s</span> per answer</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-blue-400 group-hover:text-blue-300 gap-1">
                    Start Blitz <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {(gameState === "PLAYING" || gameState === "RECORDING" || gameState === "EVALUATING") && (
          <div className="w-full max-w-2xl bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 backdrop-blur space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse w-full" />
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800 px-3 py-1 rounded-full">
                Question {currentQuestionIndex + 1} of 3
              </span>
              {gameState === "RECORDING" && (
                <span className="text-sm font-bold text-red-500 flex items-center gap-1.5 animate-pulse bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                  00:{timer < 10 ? `0${timer}` : timer}
                </span>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold leading-relaxed text-zinc-100">
                {PRESETS[selectedTopic!][currentQuestionIndex]}
              </h2>
              <button
                onClick={() => speakQuestion(PRESETS[selectedTopic!][currentQuestionIndex])}
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
              >
                <Volume2 className="w-4 h-4 text-blue-400" />
                Listen again
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Speaking visualizer block */}
            <div className="flex flex-col items-center justify-center py-6">
              {gameState === "RECORDING" ? (
                <div className="w-full space-y-4">
                  <canvas ref={canvasRef} width={600} height={120} className="w-full h-24 bg-zinc-950 rounded-xl border border-zinc-900" />
                  <button
                    onClick={stopRecording}
                    className="mx-auto flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-500/20"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Stop & Submit Answer
                  </button>
                </div>
              ) : gameState === "EVALUATING" ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-zinc-400 font-medium animate-pulse">Transcribing & Grading Response...</p>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-3 bg-white text-black hover:bg-zinc-200 font-extrabold px-8 py-4 rounded-full text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  <Mic className="w-5 h-5" />
                  Hold Space or Click to Answer
                </button>
              )}
            </div>
          </div>
        )}

        {gameState === "RESULT" && evaluation && (
          <div className="w-full max-w-3xl space-y-6">
            {/* Main Grade Header */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 backdrop-blur shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-extrabold flex items-center gap-2.5">
                    <CheckCircle2 className="text-emerald-500 w-8 h-8" />
                    Evaluation Complete
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">Topic: {selectedTopic?.toUpperCase()}</p>
                </div>

                <div className="flex items-center gap-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
                  <div className="text-center">
                    <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                      {evaluation.score}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Overall</div>
                  </div>
                </div>
              </div>

              {/* Sub-metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                {[
                  { name: "Accuracy", val: evaluation.accuracy, color: "text-blue-400" },
                  { name: "Clarity", val: evaluation.clarity, color: "text-purple-400" },
                  { name: "Conciseness", val: evaluation.conciseness, color: "text-amber-400" },
                  { name: "Confidence", val: evaluation.confidence, color: "text-emerald-400" },
                ].map((m) => (
                  <div key={m.name} className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 text-center">
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{m.name}</div>
                    <div className={`text-2xl font-bold mt-1 ${m.color}`}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript & AI Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="font-bold text-lg text-zinc-300">Your Answer</h3>
                <p className="text-zinc-400 text-sm leading-relaxed italic bg-zinc-950/30 p-4 rounded-xl border border-zinc-900">
                  &ldquo;{transcription}&rdquo;
                </p>
              </div>

              <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-3xl p-6 space-y-4">
                <h3 className="font-bold text-lg text-zinc-300">Key Feedback</h3>
                <ul className="space-y-3">
                  {evaluation.feedback.map((f: string, i: number) => (
                    <li key={i} className="text-zinc-400 text-sm flex gap-2">
                      <span className="text-emerald-500 font-bold flex-shrink-0">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sample Best Answer */}
            <div className="bg-gradient-to-br from-indigo-950/30 to-purple-950/30 border border-indigo-500/20 rounded-3xl p-8 space-y-4">
              <h3 className="font-extrabold text-lg text-indigo-300 flex items-center gap-2">
                <Award className="w-5 h-5" /> Recommended Best Answer
              </h3>
              <p className="text-zinc-300 text-sm leading-relaxed">
                {evaluation.betterAlternative}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setGameState("IDLE")}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Quit Session
              </button>
              <button
                onClick={nextQuestion}
                className="bg-white text-black hover:bg-zinc-200 font-bold px-8 py-3 rounded-full transition-colors flex items-center gap-1.5"
              >
                {currentQuestionIndex + 1 < PRESETS[selectedTopic!].length ? "Next Question" : "Complete Blitz"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
