import { useState, useEffect, useCallback } from "react";
import type { SuggestionsByQuestionId } from "@/types.ts";

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

  return { suggestions, loading, refetch: fetchSuggestions };
}
