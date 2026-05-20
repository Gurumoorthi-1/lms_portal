import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useExamStore = create(
  persist(
    (set) => ({
      currentExam: null,
      examResults: null,
      setExam: (examData) => set({ currentExam: examData }),
      setExamResults: (results) => set({ examResults: results }),
      clearExam: () => set({ currentExam: null, examResults: null }),
    }),
    {
      name: 'exam-storage',
    }
  )
);

