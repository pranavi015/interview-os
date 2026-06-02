"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DiagnosticResult, Roadmap } from '@/types';

interface OnboardingState {
  resumeFile: File | null;
  resumeName: string;
  githubUsername: string;
  selectedCompanies: string[];
  diagnostic: DiagnosticResult | null;
  roadmap: Roadmap | null;
}

interface OnboardingContextType {
  state: OnboardingState;
  setResumeFile: (file: File | null) => void;
  setGithubUsername: (username: string) => void;
  toggleCompany: (company: string) => void;
  setDiagnostic: (data: DiagnosticResult) => void;
  setRoadmap: (data: Roadmap) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    resumeFile: null,
    resumeName: '',
    githubUsername: '',
    selectedCompanies: [],
    diagnostic: null,
    roadmap: null,
  });

  // Hydrate state from localStorage on client-side mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('interview_os_progress');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState(prev => ({
            ...prev,
            githubUsername: parsed.githubUsername || '',
            selectedCompanies: parsed.selectedCompanies || [],
            diagnostic: parsed.diagnostic || null,
            roadmap: parsed.roadmap || null,
            resumeName: parsed.resumeName || '',
          }));
        } catch (e) {
          console.error('Failed to parse cached onboarding progress:', e);
        }
      }
    }
  }, []);

  // Save changes to localStorage whenever relevant state fields change
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const { githubUsername, selectedCompanies, diagnostic, roadmap, resumeName } = state;
      localStorage.setItem(
        'interview_os_progress',
        JSON.stringify({ githubUsername, selectedCompanies, diagnostic, roadmap, resumeName })
      );
    }
  }, [state.githubUsername, state.selectedCompanies, state.diagnostic, state.roadmap, state.resumeName]);

  const setResumeFile = (file: File | null) =>
    setState(prev => ({ ...prev, resumeFile: file, resumeName: file ? file.name : '' }));

  const setGithubUsername = (username: string) =>
    setState(prev => ({ ...prev, githubUsername: username }));

  const toggleCompany = (company: string) =>
    setState(prev => {
      const isSelected = prev.selectedCompanies.includes(company);
      return {
        ...prev,
        selectedCompanies: isSelected
          ? prev.selectedCompanies.filter(c => c !== company)
          : [...prev.selectedCompanies, company],
      };
    });

  const setDiagnostic = (data: DiagnosticResult) =>
    setState(prev => ({ ...prev, diagnostic: data }));

  const setRoadmap = (data: Roadmap) =>
    setState(prev => ({ ...prev, roadmap: data }));

  return (
    <OnboardingContext.Provider value={{ state, setResumeFile, setGithubUsername, toggleCompany, setDiagnostic, setRoadmap }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
