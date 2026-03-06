import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { useFlashcards } from "@/hooks/use-flashcards.ts";
import { useKeyboard } from "@/hooks/use-keyboard.ts";
import { FlashcardCard } from "./flashcard-card.tsx";
import { RatingButtons } from "./rating-buttons.tsx";
import { DeckSetup } from "./deck-setup.tsx";
import { DeckSummary } from "./deck-summary.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import * as materializer from "@/services/question-materializer.ts";
import type { Quality } from "@/types/index.ts";

export function FlashcardsPage() {
  const { questionBank, loading } = useData();
  const { activeExam } = useExam();
  const deck = useFlashcards();
  const [searchParams] = useSearchParams();

  const examQuestions = useMemo(
    () =>
      questionBank.filter(
        (q) => q.exams.includes(activeExam) && materializer.isQuestionMaterializable(q),
      ),
    [questionBank, activeExam],
  );

  // Auto-start due deck if param present
  useEffect(() => {
    if (searchParams.get("deck") === "due" && deck.state.phase === "setup" && examQuestions.length > 0) {
      const dueCards = sr.getDueCards(examQuestions, activeExam);
      if (dueCards.length > 0) {
        const sessionSeed = `${activeExam}|flashcards|due|${Date.now()}`;
        deck.start(materializer.materializeQuestions(dueCards, activeExam, sessionSeed), activeExam);
      }
    }
  }, [searchParams, examQuestions, activeExam, deck]);

  const keyMap = useMemo((): Record<string, () => void> => {
    if (deck.state.phase !== "active") return {};
    if (!deck.state.flipped) {
      return {
        " ": () => deck.flip(),
        Enter: () => deck.flip(),
      };
    }
    return {
      "1": () => deck.rate(0 as Quality),
      "2": () => deck.rate(2 as Quality),
      "3": () => deck.rate(3 as Quality),
      "4": () => deck.rate(5 as Quality),
    };
  }, [deck]);

  useKeyboard(keyMap, deck.state.phase === "active");

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement...</div>;
  }

  if (deck.state.phase === "summary") {
    return (
      <DeckSummary
        reviewed={deck.state.reviewed}
        ratings={deck.state.ratings}
        onRestart={deck.reset}
      />
    );
  }

  if (deck.state.phase === "active") {
    const q = deck.state.cards[deck.state.current];
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Carte {deck.state.current + 1}/{deck.state.cards.length}
          </span>
          <Badge>
            {activeExam} · {q.themeName}
          </Badge>
        </div>

        <Progress value={(deck.state.current / deck.state.cards.length) * 100} />

        <FlashcardCard
          question={q}
          flipped={deck.state.flipped}
          onFlip={deck.flip}
        />

        {deck.state.flipped && <RatingButtons onRate={deck.rate} />}
      </div>
    );
  }

  return <DeckSetup onStart={(cards) => deck.start(cards, activeExam)} />;
}
