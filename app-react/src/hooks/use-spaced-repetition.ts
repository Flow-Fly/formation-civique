import { useMemo } from "react";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import * as storage from "@/services/storage.ts";
import type { StreakData } from "@/types/index.ts";

export function useSpacedRepetition() {
  const { questionBank } = useData();
  const { activeExam } = useExam();

  const examQuestions = useMemo(
    () => questionBank.filter((q) => q.exams.includes(activeExam)),
    [questionBank, activeExam],
  );

  return useMemo(() => {
    const stats = sr.getMasteryStats(examQuestions, activeExam);
    const themeMastery = sr.getThemeMastery(examQuestions, activeExam);
    const dueCards = sr.getDueCards(examQuestions, activeExam);
    const newCards = sr.getNewCards(examQuestions, activeExam);
    const streakData = storage.load<StreakData>("streak", { count: 0, lastDate: null }, activeExam);
    const today = new Date().toISOString().slice(0, 10);
    const streak = { ...streakData, isToday: streakData.lastDate === today };

    return { stats, themeMastery, dueCards, newCards, streak, examQuestions };
  }, [examQuestions, activeExam]);
}
