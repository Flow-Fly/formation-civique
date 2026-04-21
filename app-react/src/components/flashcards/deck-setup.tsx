import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Clock, Sparkles, BookOpen, Layers, PartyPopper } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { StatCard } from "@/components/dashboard/stat-card.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import * as materializer from "@/services/question-materializer.ts";
import { getExamMeta } from "@/lib/exams.ts";
import type { QuestionInstance } from "@/types/index.ts";

interface DeckSetupProps {
  onStart: (cards: QuestionInstance[]) => void;
}

export function DeckSetup({ onStart }: DeckSetupProps) {
  const { questionBank } = useData();
  const { activeExam } = useExam();
  const examMeta = getExamMeta(activeExam);

  const examQuestions = questionBank.filter(
    (q) => q.exams.includes(activeExam) && materializer.isQuestionMaterializable(q),
  );

  const dueCards = sr.getDueCards(examQuestions, activeExam);
  const newCards = sr.getNewCards(examQuestions, activeExam);
  const themes = [...new Map(examQuestions.map((q) => [q.themeId, q.themeName])).entries()];

  function materialize(cards: typeof examQuestions): QuestionInstance[] {
    const sessionSeed = `${activeExam}|flashcards|${Date.now()}`;
    return materializer.materializeQuestions(cards, activeExam, sessionSeed);
  }

  function startDeck(deck: string, themeId?: string) {
    let cards: typeof examQuestions;
    if (deck === "due") cards = dueCards;
    else if (deck === "new") cards = newCards.slice(0, 20);
    else if (deck === "theme") {
      cards = examQuestions.filter((q) => q.themeId === themeId).sort(() => Math.random() - 0.5);
    } else {
      cards = [...examQuestions].sort(() => Math.random() - 0.5);
    }

    if (cards.length === 0) {
      alert("Aucune carte disponible.");
      return;
    }

    onStart(materialize(cards));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Cartes memoire pour {examMeta.shortLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Utilisez-les pour revoir rapidement ce que vous avez deja vu et relancer les notions a memoriser.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={dueCards.length} label="A reviser" icon={Clock} color="orange" delay={0} />
        <StatCard value={newCards.length} label="Nouvelles" icon={Sparkles} color="blue" delay={75} />
        <StatCard
          value={examQuestions.length - newCards.length}
          label="Etudiees"
          icon={BookOpen}
          color="green"
          delay={150}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choisir un paquet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dueCards.length > 0 ? (
            <Button className="w-full active-scale" onClick={() => startDeck("due")}>
              <Clock className="w-4 h-4 mr-1.5" />
              A reviser ({dueCards.length})
            </Button>
          ) : (
            <div className="text-center py-4 text-dsfr-success">
              <PartyPopper className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Tout est a jour !</p>
              <p className="text-sm text-muted-foreground">Aucune carte a reviser</p>
            </div>
          )}
          <Button variant="outline" className="w-full active-scale" onClick={() => startDeck("new")}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            Nouvelles cartes ({Math.min(20, newCards.length)})
          </Button>
          <Button variant="outline" className="w-full active-scale" onClick={() => startDeck("all")}>
            <Layers className="w-4 h-4 mr-1.5" />
            Toutes ({examQuestions.length})
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Par theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {themes.map(([id, name]) => {
            const count = examQuestions.filter((q) => q.themeId === id).length;
            return (
              <Button
                key={id}
                variant="outline"
                className="w-full active-scale"
                onClick={() => startDeck("theme", id)}
              >
                {name} ({count})
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center">
        Raccourcis :{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">Espace</kbd>{" "}
        retourner &middot;{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">1</kbd>{" "}
        Encore &middot;{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">2</kbd>{" "}
        Difficile &middot;{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">3</kbd>{" "}
        Bien &middot;{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">4</kbd>{" "}
        Facile
      </p>
    </div>
  );
}
