import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { RefreshCw, LayoutDashboard, BookOpen } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import type { QuizAnswer, QuizScore } from "@/types/index.ts";
import type { Question } from "@/types/index.ts";

const CONFETTI_COLORS = [
  "#000091", "#e1000f", "#009081", "#6a6af4", "#ff6b6b",
  "#ffd700", "#34d399", "#a78bfa", "#fb923c", "#38bdf8",
];

function Confetti({ count = 40 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
  }));

  return (
    <div className="confetti-container">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.bg,
            animationDelay: p.delay,
            animationDuration: `${p.duration}, 0.5s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}
    </div>
  );
}

function ScoreRing({ percentage, passed }: { percentage: number; passed: boolean }) {
  const [offset, setOffset] = useState(283);
  const circumference = 283; // 2 * PI * 45
  const target = circumference - (circumference * percentage) / 100;

  useEffect(() => {
    const t = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(t);
  }, [target]);

  return (
    <div className="relative w-[120px] h-[120px] mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="50" cy="50" r="45" fill="none" strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`score-ring-circle ${passed ? "stroke-dsfr-success" : "stroke-destructive"}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{percentage}%</span>
      </div>
    </div>
  );
}

interface QuizResultsProps {
  score: QuizScore;
  answers: QuizAnswer[];
  isExam: boolean;
  onRetry: () => void;
  onReviewMistakes: (questions: Question[]) => void;
}

export function QuizResults({ score, answers, isExam, onRetry, onReviewMistakes }: QuizResultsProps) {
  const { questions } = useData();
  const mistakes = answers.filter((a) => !a.isCorrect);

  function handleReviewMistakes() {
    const mistakeQuestions = mistakes
      .map((m) => questions.find((q) => q.id === m.questionId))
      .filter((q): q is Question => q !== undefined);
    onReviewMistakes(mistakeQuestions);
  }

  return (
    <div className="space-y-4">
      {score.passed && <Confetti />}

      <h1 className="text-2xl font-bold text-center">
        {isExam ? "Resultats de l'examen" : "Resultats"}
      </h1>

      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <ScoreRing percentage={score.percentage} passed={score.passed} />
          <p className="text-sm text-muted-foreground">
            {score.correct}/{score.total}
          </p>
          <p
            className={`text-lg font-bold animate-fade-in-up ${
              score.passed ? "text-dsfr-success" : "text-destructive"
            }`}
          >
            {score.passed ? "Reussi !" : "Non reussi"}
          </p>
          {isExam && (
            <p className="text-sm text-muted-foreground">
              Seuil : 80% ({Math.ceil(score.total * 0.8)}/{score.total})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Par theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(score.themes).map(([id, t]) => (
            <div key={id} className="flex justify-between text-sm">
              <span>{t.name}</span>
              <span
                className={
                  t.correct === t.total
                    ? "text-dsfr-success font-medium"
                    : ""
                }
              >
                {t.correct}/{t.total}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {mistakes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Erreurs ({mistakes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mistakes.map((m) => {
              const q = questions.find((qq) => qq.id === m.questionId);
              if (!q) return null;
              const correctText = q.choices.find((c) => c.id === m.correct)?.text || "";
              return (
                <div key={m.questionId} className="py-2 border-b border-border last:border-b-0">
                  <p className="text-sm font-medium">{q.questionText}</p>
                  <p className="text-sm text-dsfr-success mt-1">Reponse : {correctText}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={onRetry} className="active-scale">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Recommencer
        </Button>
        <Button variant="outline" asChild className="active-scale">
          <Link to="/dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1.5" />
            Tableau de bord
          </Link>
        </Button>
        {mistakes.length > 0 && (
          <Button variant="outline" onClick={handleReviewMistakes} className="active-scale">
            <BookOpen className="w-4 h-4 mr-1.5" />
            Reviser les erreurs
          </Button>
        )}
      </div>
    </div>
  );
}
