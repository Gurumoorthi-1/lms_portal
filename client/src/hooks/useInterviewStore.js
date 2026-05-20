import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useInterviewStore = create(
  persist(
    (set) => ({
      resumeData: null,
      skills: [],
      experience: [],
      aptitudeResults: null,
      codingResults: null,
      interviewResults: null,
      performanceProfile: null,
      
      setResumeData: (data) => set({ 
        resumeData: data, 
        skills: data.skills || [], 
        experience: data.experience || [] 
      }),
      setAptitudeResults: (results) => set({ aptitudeResults: results }),
      setCodingResults: (results) => set({ codingResults: results }),
      setInterviewResults: (results) => set({ interviewResults: results }),
      setPerformanceProfile: (profile) => set({ performanceProfile: profile }),
      clearSession: () => set({ 
        resumeData: null, 
        skills: [], 
        experience: [], 
        aptitudeResults: null, 
        codingResults: null, 
        interviewResults: null 
      }),
    }),
    {
      name: 'lms-interview-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

