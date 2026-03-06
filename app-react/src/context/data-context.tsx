import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type {
  FichesData,
  QuestionBankItem,
  ContentIndex,
  ExamConfig,
} from "@/types/index.ts";

interface DataContextValue {
  fichesData: FichesData | null;
  questionBank: QuestionBankItem[];
  examConfig: ExamConfig | null;
  contentIndex: ContentIndex | null;
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [fichesData, setFichesData] = useState<FichesData | null>(null);
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [contentIndex, setContentIndex] = useState<ContentIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [fichesRes, bankRes, examRes, contentIndexRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/fiches.json`),
          fetch(`${import.meta.env.BASE_URL}data/question-bank.json`),
          fetch(`${import.meta.env.BASE_URL}data/exam-config.json`),
          fetch(`${import.meta.env.BASE_URL}data/content-index.json`),
        ]);

        const fichesJson = (await fichesRes.json()) as FichesData;
        const bankJson = (await bankRes.json()) as QuestionBankItem[];
        const examJson = (await examRes.json()) as ExamConfig;
        const contentIndexJson = (await contentIndexRes.json()) as ContentIndex;

        setFichesData(fichesJson);
        setQuestionBank(bankJson);
        setExamConfig(examJson);
        setContentIndex(contentIndexJson);
      } catch (e) {
        console.error("Failed to load data:", e);
        setError("Erreur de chargement des donnees.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <DataContext.Provider
      value={{
        fichesData,
        questionBank,
        examConfig,
        contentIndex,
        loading,
        error,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
