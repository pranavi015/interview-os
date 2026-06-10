# InterviewOS

> AI-powered interview preparation platform that helps candidates practice under pressure, defend their projects, and prepare for interviews in hours—not weeks.

## The Problem

Most interview preparation tools fall into one of three categories:

- Generic study material
- Basic AI mock interviews
- Roadmap generators that tell you what to study

They rarely help candidates answer the questions that actually matter:

- Can you confidently explain your projects?
- Can you defend your technical decisions?
- Can you identify your weak areas before the interview?
- Can you prepare effectively when your interview is tomorrow?

InterviewOS was built to solve those problems.

---

## Core Features

### ⚡ Interview Blitz

A rapid-fire interview simulator designed to improve confidence and communication under pressure.

**Features**
- Voice-based interview practice with configurable time limits (60s / 90s / 3 min)
- JavaScript, React, TypeScript, System Design, and DSA topics
- Real-time answer evaluation
- Feedback on:
  - Accuracy
  - Clarity
  - Conciseness
  - Confidence
- Historical performance tracking with score trend analytics

---

### 🏗️ Project Defense

An AI interviewer that deeply understands your projects and asks realistic follow-up questions.

**Inputs**
- Resume
- GitHub Repository (README + file tree + actual source code)
- Project Documentation

**Capabilities**
- Repository analysis — reads your real code, not just the README
- Adaptive interview flow with 5 deep technical questions
- Teaching moments when answers score below 60
- Architecture discussions
- Tradeoff analysis
- Scalability questioning

**Example Questions**

> Why did you choose MongoDB for this project?

> What bottlenecks would appear if traffic increased 10x?

> Why did you separate this service instead of keeping it inside the monolith?

---

### 🚀 Interview Crash Pack

For candidates with interviews coming up soon.

**Inputs**
- Resume
- Job Description
- GitHub Context
- Previous Interview Performance

**Outputs**
- Must-Know Topics (HIGH / MEDIUM / LOW urgency)
- High-Probability Questions
- Personalized Weak Areas
- Quick Revision Notes

Designed for:
- Interviews tonight
- Interviews tomorrow
- Last-minute preparation

---

## Architecture

```text
Resume
        \
GitHub -----> RAG Layer -----> AI Workflows
        /                         |
Job Description                  |
                                  ↓
                      Interview Blitz
                      Project Defense
                      Crash Pack
```

### Adaptive Project Defense Flow

```text
Analyze Project
       ↓
Generate Question
       ↓
User Answer
       ↓
Evaluate
       ↓
Strong (≥60)?     Weak (<60)?
       ↓               ↓
Next Question    Teaching Moment
                       ↓
                 Next Question
```

---

## Tech Stack

### Frontend

- Next.js 15
- TypeScript
- Tailwind CSS

### Backend

- Next.js Route Handlers

### Database

- Supabase PostgreSQL

### Authentication

- Supabase Auth

### Retrieval

- pgvector
- LangChain

### Agent Workflows

- LangGraph

### AI Models

- Groq (LLaMA 3)

### Voice Processing

- Groq Whisper

---

## AI Engineering Highlights

### Multi-Source RAG

InterviewOS retrieves context from:

- Resumes
- GitHub Repositories (README, file tree, and source code)
- Job Descriptions
- Interview Knowledge Base

to generate highly personalized interview preparation.

---

### Voice-Based Evaluation

Interview Blitz combines:

- Speech-to-Text (Groq Whisper)
- LLM Evaluation
- Personalized Feedback

to simulate real interview pressure.

---

## Why InterviewOS?

Candidates already have access to ChatGPT.

InterviewOS focuses on what generic chatbots cannot easily provide:

- Personalized interview preparation
- Project-specific questioning based on your actual source code
- Adaptive interview flows with teaching moments
- Voice-based pressure practice
- Last-minute interview readiness

---

## Local Setup

### Clone the Repository

```bash
git clone https://github.com/yourusername/interview-os.git

cd interview-os
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

GROQ_API_KEY=your-groq-api-key
```

> Supabase is optional — the app runs fully in LocalStorage/in-memory mode without it.

### Run the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Future Improvements

- Advanced multi-session learning insights
- ElevenLabs voice synthesis for a more realistic interviewer experience
- Company-specific question banks (Google, Meta, Amazon modes)
- Interview session replay with timestamped transcripts
- Mobile PWA for on-the-go practice

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard — analytics, score trends, readiness gauge
│   ├── onboarding/                 # 6-step setup wizard (resume upload, goals, companies)
│   ├── blitz/                      # Voice Blitz game UI
│   ├── defense/                    # Project Defense chat interface
│   ├── crash-pack/                 # Crash Pack generator UI
│   └── api/
│       ├── blitz/stt/              # Groq Whisper transcription endpoint
│       ├── blitz/evaluate/         # LLM answer scoring (accuracy, clarity, conciseness, confidence)
│       ├── defense/                # LangGraph state machine API (start + respond actions)
│       ├── crash-pack/             # JD-personalized crash pack generation
│       ├── diagnose/               # Onboarding skill diagnostic
│       └── resume/parse/           # PDF text extraction endpoint
├── lib/
│   ├── ai/
│   │   └── defense-graph.ts        # LangGraph state machine (5 nodes, adaptive branching)
│   ├── db.ts                       # Supabase + LocalStorage dual-mode database client
│   ├── vectorstore.ts              # RAG pipeline — chunking, TF-IDF scoring, pgvector storage
│   ├── groq.ts                     # Groq LLM client
│   └── pdf-parser.ts               # Dependency-free PDF stream parser
├── context/
│   ├── OnboardingContext.tsx       # Global onboarding state
│   └── AuthContext.tsx             # Auth state (Supabase + LocalStorage fallback)
supabase/
└── migrations/
    └── 00001_init.sql              # Full schema — tables, RLS policies, pgvector, match_documents()
```

---

## Key Engineering Decisions

**Why LangGraph instead of a simple chat loop?**
Project Defense requires persistent state across multiple API calls — question count, topics covered, last score, whether a teaching moment is needed. LangGraph's `StateGraph` handles all branching transitions declaratively without building a custom finite state machine.

**Why Groq?**
Sub-second inference on LLaMA 3 70B. For a real-time interview simulator where the user is waiting for the next question, latency directly determines whether the product feels alive or broken.

**Why a custom PDF parser instead of `pdf-parse` or `pdfjs`?**
Both libraries pull in binary dependencies that break silently in Next.js server/edge environments. The custom stream parser reads PDF cross-reference tables and extracts raw text with zero external dependencies.

**Why LocalStorage fallback instead of requiring Supabase?**
Lets the app run completely without a database account — useful for demos, development, and first-time users. The `dbService` wrapper transparently routes every read/write to either Supabase or a `MockDatabase` class based on whether env vars are present.

**Why TF-IDF instead of vector embeddings for RAG?**
Embeddings require an API call (latency + cost) at index time for every resume and GitHub file ingested. TF-IDF keyword scoring is synchronous, zero-cost, and accurate enough for the current retrieval granularity. The pgvector extension and `match_documents()` RPC function are already wired in Supabase — upgrading to real embeddings requires only replacing the null vector with an API call.

---

## Author

**Pranavi Mathur**

Building at the intersection of:

- AI Engineering
- Product Engineering
- Full-Stack Development

---
