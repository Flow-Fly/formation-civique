import { useMemo } from "react";
import { useData } from "@/context/data-context.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import * as storage from "@/services/storage.ts";
import type { StreakData } from "@/types/index.ts";

export function useSpacedRepetition() {
  const { questions } = useData();

  return useMemo(() => {
    const stats = sr.getMasteryStats(questions);
    const themeMastery = sr.getThemeMastery(questions);
    const dueCards = sr.getDueCards(questions);
    const newCards = sr.getNewCards(questions);
    const streakData = storage.load<StreakData>("streak", { count: 0, lastDate: null });
    const today = new Date().toISOString().slice(0, 10);
    const streak = { ...streakData, isToday: streakData.lastDate === today };

    return { stats, themeMastery, dueCards, newCards, streak };
  }, [questions]);
}
