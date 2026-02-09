import { Card } from "@/components/ui/card.tsx";
import { FicheLink } from "@/components/study/fiche-link.tsx";
import { CheckCircle } from "lucide-react";
import type { Question } from "@/types/index.ts";

interface FlashcardCardProps {
  question: Question;
  flipped: boolean;
  onFlip: () => void;
}

export function FlashcardCard({ question, flipped, onFlip }: FlashcardCardProps) {
  const correctChoice = question.choices.find((c) => c.id === question.correctAnswer);

  return (
    <div className="flashcard-container">
      <div
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => !flipped && onFlip()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !flipped) {
            e.preventDefault();
            onFlip();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Retourner la carte"
      >
        <Card className="flashcard-face border bg-card shadow-lg">
          <div className="text-center">
            <div className="text-lg font-medium leading-relaxed">
              {question.questionText}
            </div>
            <p className="text-sm text-muted-foreground mt-4 animate-pulse">Cliquez pour retourner</p>
          </div>
        </Card>
        <Card className="flashcard-face flashcard-back border bg-gradient-to-br from-accent to-accent/60 shadow-lg">
          <div>
            <p className="font-bold text-dsfr-success mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              {correctChoice?.text || ""}
            </p>
            <p className="text-sm">{question.explanation}</p>
            <FicheLink question={question} />
          </div>
        </Card>
      </div>
    </div>
  );
}
