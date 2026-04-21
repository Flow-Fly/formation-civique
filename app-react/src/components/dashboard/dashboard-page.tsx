import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  TrendingUp,
  BookOpen,
  Clock,
  Flame,
  Zap,
  Trophy,
  Search,
  FileText,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { useSpacedRepetition } from "@/hooks/use-spaced-repetition.ts";
import { EXAM_OPTIONS, getExamMeta } from "@/lib/exams.ts";
import { openSearchDialog } from "@/lib/search.ts";
import { StatCard } from "./stat-card.tsx";
import { ThemeProgress } from "./theme-progress.tsx";
import * as storage from "@/services/storage.ts";
import type { QuizHistoryEntry } from "@/types/index.ts";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

export function DashboardPage() {
  const { loading, examConfig } = useData();
  const { activeExam } = useExam();
  const { stats, themeMastery, dueCards, streak } = useSpacedRepetition();

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement...</div>;
  }

  const examMeta = getExamMeta(activeExam);
  const rules = examConfig?.[activeExam];
  const masteryPct =
    stats.total > 0
      ? Math.round(((stats.mastered + stats.learning * 0.4) / stats.total) * 100)
      : 0;
  const readiness =
    stats.total > 0
      ? Math.min(100, Math.round((stats.mastered / stats.total) * 100 * 1.25))
      : 0;

  const quizHistory = storage.load<QuizHistoryEntry[]>("quiz_history", [], activeExam);
  const lastQuiz = quizHistory.length > 0 ? quizHistory[quizHistory.length - 1] : null;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{examMeta.label}</Badge>
            {rules && (
              <Badge variant="outline">
                {rules.questionCount} questions · {rules.timeLimitMinutes} min · {rules.passCorrectAnswers} bonnes reponses
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Preparation {examMeta.shortLabel}</h1>
          <p className="max-w-3xl text-base text-muted-foreground">
            Fiches officielles, quiz et revision par questions pour comprendre la formation civique
            et avancer dans le bon parcours des la premiere visite.
          </p>
        </div>

        <Card className="overflow-hidden border-primary/15 bg-linear-to-br from-primary/[0.04] via-background to-secondary/70">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap gap-2">
              {EXAM_OPTIONS.map((option) => (
                <Badge
                  key={option.code}
                  variant={option.code === activeExam ? "default" : "outline"}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
            <CardTitle className="text-2xl leading-tight">Commencez par le bon parcours</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ce tableau de bord filtre les fiches, quiz, questions et statistiques pour{" "}
              {examMeta.shortLabel}. Si ce n&apos;est pas le bon examen, changez-le dans le
              selecteur en haut.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-background/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Ce que fait le site
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Lire les fiches officielles, retrouver les questions associees et vous entrainer
                  avec quiz et cartes memoire.
                </p>
              </div>

              <div className="rounded-lg border bg-background/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Pour qui ?
                </p>
                <p className="mt-2 text-sm leading-relaxed">{examMeta.audience}</p>
                <p className="mt-2 text-sm leading-relaxed">{examMeta.firstStep}</p>
              </div>

              <div className="rounded-lg border bg-background/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Besoin d&apos;un point precis ?
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  La recherche retrouve une fiche, une notion ou un mot-cle comme laicite,
                  prefecture, ecole ou logement.
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openSearchDialog}>
                  <Search className="w-4 h-4 mr-1.5" />
                  Ouvrir la recherche
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="active-scale">
                <Link to="/study">
                  <FileText className="w-4 h-4 mr-1.5" />
                  Lire les fiches
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="active-scale">
                <Link to="/quiz?mode=practice">
                  <Zap className="w-4 h-4 mr-1.5" />
                  Faire un quiz
                </Link>
              </Button>
              <Button variant="outline" asChild className="active-scale">
                <Link to="/questions">
                  <ListChecks className="w-4 h-4 mr-1.5" />
                  Reviser les questions
                </Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Astuce : utilisez{" "}
              <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                {isMac ? "Cmd + K" : "Ctrl + K"}
              </kbd>{" "}
              pour ouvrir la recherche depuis n&apos;importe quelle page.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Vos reperes de revision</h2>
        <p className="text-sm text-muted-foreground">
          Les chiffres ci-dessous concernent uniquement votre progression sur {examMeta.shortLabel}.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={`${masteryPct}%`} label="Progression" icon={TrendingUp} color="blue" delay={0} />
        <StatCard value={`${stats.mastered + stats.learning}/${stats.total}`} label="Etudiees" icon={BookOpen} color="green" delay={75} />
        <StatCard
          value={dueCards.length}
          label="A reviser"
          icon={Clock}
          color="orange"
          pulse={dueCards.length > 0}
          delay={150}
          hint={dueCards.length > 0 ? "Cliquer pour lancer la revision" : undefined}
          to={dueCards.length > 0 ? "/flashcards?deck=due" : undefined}
        />
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
