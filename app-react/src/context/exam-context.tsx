import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ExamCode } from "@/types/index.ts";
import * as storage from "@/services/storage.ts";

interface ExamContextValue {
  activeExam: ExamCode;
  setActiveExam: (exam: ExamCode) => void;
}

const EXAM_STORAGE_KEY = "active_exam";
const DEFAULT_EXAM: ExamCode = "CR";

const ExamContext = createContext<ExamContextValue | null>(null);

function isExamCode(value: unknown): value is ExamCode {
  return value === "CSP" || value === "CR" || value === "NAT";
}

function loadActiveExam(): ExamCode {
  const raw = storage.load<unknown>(EXAM_STORAGE_KEY, DEFAULT_EXAM);
  return isExamCode(raw) ? raw : DEFAULT_EXAM;
}

export function ExamProvider({ children }: { children: ReactNode }) {
  const [activeExam, setActiveExamState] = useState<ExamCode>(loadActiveExam);

  useEffect(() => {
    storage.migrateLegacyExamData("CR");
  }, []);

  const setActiveExam = (exam: ExamCode) => {
    setActiveExamState(exam);
    storage.save(EXAM_STORAGE_KEY, exam);
  };

  const value = useMemo(() => ({ activeExam, setActiveExam }), [activeExam]);

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExam(): ExamContextValue {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used within ExamProvider");
  return ctx;
}
