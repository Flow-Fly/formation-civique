import { useState, useEffect, useCallback } from "react";
import type { QuestionBankItem } from "@/types.ts";

export function useQuestions() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/questions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQuestions(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const patchQuestion = useCallback(
    async (id: string, patch: Partial<QuestionBankItem>): Promise<QuestionBankItem> => {
      const res = await fetch(`/api/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      const updated: QuestionBankItem = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
      return updated;
    },
    [],
  );

  const applySuggestion = useCallback(
    async (id: string, suggestion: unknown): Promise<QuestionBankItem> => {
      const res = await fetch(`/api/questions/${id}/apply-answer-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error || `Apply failed: ${res.status}`);
      }
      const updated: QuestionBankItem = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
      return updated;
    },
    [],
  );

  const applyLinkSuggestion = useCallback(
    async (id: string, suggestion: unknown): Promise<QuestionBankItem> => {
      const res = await fetch(`/api/questions/${id}/apply-link-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error || `Apply failed: ${res.status}`);
      }
      const updated: QuestionBankItem = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
      return updated;
    },
    [],
  );

  return {
    questions,
    loading,
    error,
    patchQuestion,
    applySuggestion,
    applyLinkSuggestion,
    refetch: fetchQuestions,
  };
}
