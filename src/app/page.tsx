import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-3xl space-y-6">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
          Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">Software Interviews</span>
        </h1>
        <p className="text-xl text-gray-400">
          Know exactly what to study. Prove you're ready. The operating system for engineering interview preparation.
        </p>
        
        <div className="pt-8">
          <Link 
            href="/onboarding" 
            className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-200 transition-all hover:scale-105 active:scale-95"
          >
            Start your personalized plan
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </main>
  );
}
