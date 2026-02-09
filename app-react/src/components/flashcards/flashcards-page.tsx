import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useData } from "@/context/data-context.tsx";
import { useFlashcards } from "@/hooks/use-flashcards.ts";
import { useKeyboard } from "@/hooks/use-keyboard.ts";
import { FlashcardCard } from "./flashcard-card.tsx";
import { RatingButtons } from "./rating-buttons.tsx";
import { DeckSetup } from "./deck-setup.tsx";
import { DeckSummary } from "./deck-summary.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import type { Quality } from "@/types/index.ts";

export function FlashcardsPage() {
  const { questions, loading } = useData();
  const deck = useFlashcards();
  const [searchParams] = useSearchParams();

  // Auto-start due deck if param present
  useEffect(() => {
    if (searchParams.get("deck") === "due" && deck.state.phase === "setup" && questions.length > 0) {
      const dueCards = sr.getDueCards(questions);
      if (dueCards.length > 0) {
        deck.start(dueCards);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, questions.length]);

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
  }, [deck.state.phase, deck.state.flipped, deck]);

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
          <Badge>{q.themeName}</Badge>
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

  return <DeckSetup onStart={deck.start} />;
}
