import { useState, useEffect, useCallback } from "react";
import type { SuggestionsByQuestionId, SuggestionReviewFeedback } from "@/types.ts";

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<SuggestionsByQuestionId>({});
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/suggestions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuggestions(data);
    } catch {
      // suggestions are optional — silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const saveSuggestionFeedback = useCallback(
    async (
      questionId: string,
      sourceFile: string,
      feedback: Omit<SuggestionReviewFeedback, "updatedAt" | "questionId" | "sourceFile"> & {
        updatedAt?: string;
      },
    ): Promise<SuggestionReviewFeedback> => {
      const res = await fetch("/api/suggestions/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, sourceFile, feedback }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error || `Feedback save failed: ${res.status}`);
      }

      const saved: SuggestionReviewFeedback = await res.json();
      setSuggestions((prev) => {
        const current = prev[questionId] || [];
        return {
          ...prev,
          [questionId]: current.map((item) =>
            item.questionId === questionId && item._sourceFile === sourceFile
              ? { ...item, reviewFeedback: saved }
              : item,
          ),
        };
      });
      return saved;
    },
    [],
  );

  return { suggestions, loading, refetch: fetchSuggestions, saveSuggestionFeedback };
}
