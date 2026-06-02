export interface WeekPlan {
  week: number;
  title: string;
  topics: string[];
  dailyGoalMinutes: number;
}

export interface Roadmap {
  weeks: WeekPlan[];
}

export interface DiagnosticResult {
  strengths: string[];
  weaknesses: string[];
  studyPriorityScores: { topic: string; score: number }[];
}

export interface DeepDiveMessage {
  role: "interviewer" | "candidate";
  content: string;
}

export interface DeepDiveSession {
  repoName: string;
  repoContext: string;
  messages: DeepDiveMessage[];
  questionCount: number;
  maxQuestions: number;
  isComplete: boolean;
  feedback?: string;
}
