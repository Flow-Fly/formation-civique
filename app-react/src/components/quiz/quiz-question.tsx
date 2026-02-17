import { useMemo } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { FicheLink } from "@/components/study/fiche-link.tsx";
import { QuizTimer } from "./quiz-timer.tsx";
import { ArrowRight } from "lucide-react";
import type { Question } from "@/types/index.ts";

const DISPLAY_LABELS = ["A", "B", "C", "D"];

interface QuizQuestionProps {
  question: Question;
  current: number;
  total: number;
  timed: boolean;
  timeRemaining: number;
  isExam: boolean;
  showingFeedback: boolean;
  selectedChoice: string | null;
  onSelectChoice: (choiceId: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function QuizQuestion({
  question,
  current,
  total,
  timed,
  timeRemaining,
  isExam,
  showingFeedback,
  selectedChoice,
  onSelectChoice,
  onNext,
  onSkip,
}: QuizQuestionProps) {
  const q = question;
  const isCorrect = selectedChoice === q.correctAnswer;

  // Shuffle choices once per question (stable across re-renders and feedback)
  const shuffledChoices = useMemo(() => {
    const arr = [...q.choices];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          Question {current + 1}/{total}
        </span>
        {timed && <QuizTimer timeRemaining={timeRemaining} />}
      </div>

      <Progress value={((current + 1) / total) * 100} className="transition-all duration-500" />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Badge>{q.themeName}</Badge>
          <h2 className="text-lg font-semibold">{q.questionText}</h2>

          <div className="space-y-2">
            {shuffledChoices.map((c, i) => {
              let variant = "default";
              if (showingFeedback && c.id === q.correctAnswer) variant = "correct";
              if (showingFeedback && c.id === selectedChoice && c.id !== q.correctAnswer)
                variant = "incorrect";
              if (!showingFeedback && c.id === selectedChoice) variant = "selected";

              return (
                <button
                  key={c.id}
                  className={`flex items-start gap-3 p-3 w-full text-left rounded-lg border-2 transition-all duration-200 ${
                    variant === "correct"
                      ? "border-dsfr-success bg-dsfr-success-bg ring-2 ring-dsfr-success/30"
                      : variant === "incorrect"
                        ? "border-destructive bg-dsfr-error-bg ring-2 ring-destructive/30"
                        : variant === "selected"
                          ? "border-primary bg-accent animate-choice-pop"
                          : "border-border hover:border-primary hover:bg-accent"
                  } ${showingFeedback ? "pointer-events-none" : "cursor-pointer"}`}
                  onClick={() => !showingFeedback && onSelectChoice(c.id)}
                  disabled={showingFeedback}
                >
                  <span
                    className={`flex items-center justify-center w-7 h-7 min-w-[1.75rem] rounded-full text-sm font-bold ${
                      variant === "correct"
                        ? "bg-dsfr-success text-white"
                        : variant === "incorrect"
                          ? "bg-destructive text-white"
                          : "bg-muted"
                    }`}
                  >
                    {DISPLAY_LABELS[i]}
                  </span>
                  <span className="text-sm pt-0.5">{c.text}</span>
                </button>
              );
            })}
          </div>

          {showingFeedback && (
            <div
              className={`p-4 rounded-lg ${
                isCorrect ? "bg-dsfr-success-bg" : "bg-dsfr-error-bg"
              }`}
            >
              <strong className="text-sm">
                {isCorrect ? "Bonne reponse !" : "Mauvaise reponse"}
              </strong>
              <p className="text-sm mt-1">{q.explanation}</p>
              <FicheLink question={q} />
            </div>
          )}
        </CardContent>
      </Card>

      {showingFeedback && (
        <Button className="w-full active-scale" onClick={onNext}>
          {current + 1 < total ? (
            <>
              Question suivante
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </>
          ) : (
            "Voir les resultats"
          )}
        </Button>
      )}

      {!showingFeedback && isExam && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={onSkip} className="active-scale">
            Passer
          </Button>
        </div>
      )}
    </div>
  );
}
