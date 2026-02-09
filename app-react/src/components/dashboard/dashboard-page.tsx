import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { TrendingUp, BookOpen, Clock, Flame, Zap, Trophy } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { useSpacedRepetition } from "@/hooks/use-spaced-repetition.ts";
import { StatCard } from "./stat-card.tsx";
import { ThemeProgress } from "./theme-progress.tsx";
import * as storage from "@/services/storage.ts";
import type { QuizHistoryEntry } from "@/types/index.ts";

export function DashboardPage() {
  const { loading } = useData();
  const { stats, themeMastery, dueCards, streak } = useSpacedRepetition();

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement...</div>;
  }

  const masteryPct =
    stats.total > 0
      ? Math.round(((stats.mastered + stats.learning * 0.4) / stats.total) * 100)
      : 0;
  const readiness = Math.min(
    100,
    Math.round((stats.mastered / stats.total) * 100 * 1.25)
  );

  const quizHistory = storage.load<QuizHistoryEntry[]>("quiz_history", []);
  const lastQuiz = quizHistory.length > 0 ? quizHistory[quizHistory.length - 1] : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={`${masteryPct}%`} label="Progression" icon={TrendingUp} color="blue" delay={0} />
        <StatCard value={`${stats.mastered + stats.learning}/${stats.total}`} label="Etudiees" icon={BookOpen} color="green" delay={75} />
        <StatCard value={dueCards.length} label="A reviser" icon={Clock} color="orange" pulse={dueCards.length > 0} delay={150} />
        <StatCard value={streak.count} label="Jours de suite" icon={Flame} color="purple" delay={225} />
      </div>

      <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle>Estimation de preparation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress
            value={readiness}
            className={readiness >= 80 ? "[&>div]:bg-dsfr-success" : ""}
          />
          <p className="text-sm text-muted-foreground">
            {readiness >= 80
              ? "Vous etes pret(e) pour l'examen !"
              : readiness >= 50
                ? "Continuez a reviser, vous progressez bien."
                : "Commencez par etudier les fiches et faire des quiz."}
          </p>
          {lastQuiz && (
            <p className="text-sm">
              Dernier quiz : {lastQuiz.percentage}% ({lastQuiz.correct}/{lastQuiz.total})
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up" style={{ animationDelay: "375ms" }}>
        <CardHeader>
          <CardTitle>Progression par theme</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeProgress themeMastery={themeMastery} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {dueCards.length > 0 && (
          <Button asChild className="active-scale animate-gentle-pulse">
            <Link to="/flashcards?deck=due">
              <Clock className="w-4 h-4 mr-1.5" />
              Reviser {dueCards.length} carte(s)
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild className="active-scale">
          <Link to="/quiz?mode=practice">
            <Zap className="w-4 h-4 mr-1.5" />
            Quiz rapide
          </Link>
        </Button>
        <Button variant="outline" asChild className="active-scale">
          <Link to="/quiz?mode=exam">
            <Trophy className="w-4 h-4 mr-1.5" />
            Simulation examen
          </Link>
        </Button>
      </div>
    </div>
  );
}
