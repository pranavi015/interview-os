# InterviewOS

**Interview autopilot for candidates.** InterviewOS reads your resume, your real GitHub code and the job description, then makes you practice under pressure, defend your projects, and revise exactly what matters, in hours instead of weeks.

Live demo: [interview-os-platform.vercel.app](https://interview-os-platform.vercel.app)

---

## What Does InterviewOS Do?

You tell InterviewOS:

- Your resume
- Your GitHub repositories and project documentation
- The job description you are preparing for
- Your goals and target companies (6-step onboarding)

InterviewOS then:

1. Runs a skill diagnostic to find your weak areas
2. Lets you practice rapid-fire voice interviews with a timer (**Interview Blitz**)
3. Interviews you on your own projects, reading your actual source code, not just the README (**Project Defense**)
4. Generates a personalized last-minute revision plan for a specific job description (**Interview Crash Pack**)
5. Tracks your scores over time on a dashboard with score trends and a readiness gauge

Most tools give you generic study material, a basic AI mock interview, or a roadmap of what to study. InterviewOS focuses on the questions that actually decide interviews:

- Can you confidently explain your projects?
- Can you defend your technical decisions?
- Can you find your weak areas before the interview does?
- Can you prepare properly when your interview is tomorrow?

---

## Three Modes

### Interview Blitz

A rapid-fire voice interview simulator for building confidence and communication under pressure.

- Voice answers with configurable time limits (60s / 90s / 3 min)
- Topics: JavaScript, React, TypeScript, System Design, DSA
- Real-time evaluation on **accuracy, clarity, conciseness and confidence**
- Historical performance tracking with score trends

### Project Defense

An AI interviewer that understands your project and asks realistic follow-ups.

- **Inputs:** resume, GitHub repository (README + file tree + source code), project documentation
- 5 deep technical questions with an adaptive flow
- A **teaching moment** whenever an answer scores below 60
- Covers architecture, tradeoffs and scalability

Example questions:

> Why did you choose MongoDB for this project?
> What bottlenecks would appear if traffic increased 10x?
> Why did you separate this service instead of keeping it inside the monolith?

### Interview Crash Pack

For candidates whose interview is tonight or tomorrow.

- **Inputs:** resume, job description, GitHub context, previous interview performance
- **Outputs:** must-know topics (HIGH / MEDIUM / LOW urgency), high-probability questions, personalized weak areas, quick revision notes

All three modes share the same core: a RAG layer over your resume, GitHub code and job description, feeding LangGraph and LLM workflows.

---

## How It Works

```
Resume
        \
GitHub -----> RAG Layer -----> AI Workflows
        /                         |
Job Description                   |
                                  v
                       Interview Blitz
                       Project Defense
                       Crash Pack
```

### Adaptive Project Defense Flow

```
Analyze Project
       |
Generate Question
       |
User Answer
       |
Evaluate
       |
Strong (>= 60)?        Weak (< 60)?
       |                    |
Next Question         Teaching Moment
                            |
                       Next Question
```

---

## Tech Stack

| What | Tool |
| --- | --- |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend API | Next.js Route Handlers |
| Agent Orchestration | LangGraph |
| LLM | Groq (LLaMA 3) |
| Speech-to-Text | Groq Whisper |
| Retrieval | LangChain, TF-IDF scoring, pgvector (wired for embeddings) |
| Database | Supabase PostgreSQL (optional, falls back to LocalStorage) |
| Authentication | Supabase Auth (optional, falls back to LocalStorage) |
| Deployment | Vercel |

---

## Project Structure

```
interview-os/
- src/
  - app/
    - page.tsx          (Dashboard: analytics, score trends, readiness gauge)
    - onboarding/       (6-step setup wizard: resume upload, goals, companies)
    - blitz/            (Voice Blitz game UI)
    - defense/          (Project Defense chat interface)
    - crash-pack/       (Crash Pack generator UI)
    - api/
      - blitz/stt/      (Groq Whisper transcription)
      - blitz/evaluate/ (LLM answer scoring)
      - defense/        (LangGraph state machine: start + respond)
      - crash-pack/     (JD-personalized crash pack generation)
      - diagnose/       (Onboarding skill diagnostic)
      - resume/parse/   (PDF text extraction)
  - lib/
    - ai/defense-graph.ts  (LangGraph state machine, 5 nodes, adaptive branching)
    - db.ts                (Supabase + LocalStorage dual-mode client)
    - vectorstore.ts       (RAG: chunking, TF-IDF scoring, pgvector storage)
    - groq.ts              (Groq LLM client)
    - pdf-parser.ts        (Dependency-free PDF stream parser)
  - context/
    - OnboardingContext.tsx
    - AuthContext.tsx
- supabase/migrations/     (00001_init.sql: tables, RLS policies, pgvector, match_documents())
- public/
- .env.local               (create this yourself, see below)
- package.json
- README.md
```

---

## Getting Started (Local Setup)

### Prerequisites

- Node.js 18 or higher
- A free [Groq API key](https://console.groq.com)
- Supabase project (optional)

### Step 1: Clone the repo

```bash
git clone https://github.com/pranavi015/interview-os.git
cd interview-os
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Configure environment variables

Create a `.env.local` file in the project root:

```
GROQ_API_KEY=your-groq-api-key

# Optional
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> Supabase is optional. Without it, the app runs fully in LocalStorage / in-memory mode.

### Step 4: Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Engineering Decisions

**Why LangGraph instead of a simple chat loop?**
Project Defense needs state that persists across API calls: question count, topics covered, last score, and whether a teaching moment is due. LangGraph's `StateGraph` handles the branching declaratively, so there is no hand-built state machine.

**Why Groq?**
Sub-second inference on LLaMA 3 70B. In a real-time simulator, latency decides whether the product feels alive or broken.

**Why a custom PDF parser?**
`pdf-parse` and `pdfjs` pull in binary dependencies that fail silently in Next.js server and edge environments. The custom parser reads cross-reference tables and extracts text with zero external dependencies.

**Why a LocalStorage fallback?**
The app runs without a database account, which helps demos, development and first-time users. The `dbService` wrapper routes every read and write to Supabase or a `MockDatabase` depending on which env vars exist.

**Why TF-IDF instead of embeddings (for now)?**
Embeddings need an API call per ingested resume and GitHub file, adding latency and cost. TF-IDF is synchronous, free and accurate enough at the current retrieval granularity. pgvector and the `match_documents()` function are already set up, so moving to real embeddings only means replacing the null vector with an embedding call.

---

## Author

**Pranavi Mathur**, building at the intersection of AI engineering, product engineering and full-stack development.
