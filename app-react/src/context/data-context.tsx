import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FichesData, Question } from "@/types/index.ts";

interface DataContextValue {
  fichesData: FichesData | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [fichesData, setFichesData] = useState<FichesData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [fichesRes, questionsRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/fiches.json`),
          fetch(`${import.meta.env.BASE_URL}data/questions.json`),
        ]);
        const fichesJson = (await fichesRes.json()) as FichesData;
        const questionsJson = (await questionsRes.json()) as Question[];
        setFichesData(fichesJson);
        setQuestions(questionsJson);
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
    <DataContext.Provider value={{ fichesData, questions, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
