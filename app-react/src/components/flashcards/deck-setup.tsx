import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Clock, Sparkles, BookOpen, Layers, PartyPopper } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { StatCard } from "@/components/dashboard/stat-card.tsx";
import * as sr from "@/services/spaced-repetition.ts";
import type { Question } from "@/types/index.ts";

interface DeckSetupProps {
  onStart: (cards: Question[]) => void;
}

export function DeckSetup({ onStart }: DeckSetupProps) {
  const { questions } = useData();
  const dueCards = sr.getDueCards(questions);
  const newCards = sr.getNewCards(questions);
  const themes = [...new Map(questions.map((q) => [q.themeId, q.themeName])).entries()];

  function startDeck(deck: string, themeId?: string) {
    let cards: Question[];
    if (deck === "due") cards = dueCards;
    else if (deck === "new") cards = newCards.slice(0, 20);
    else if (deck === "theme")
      cards = questions.filter((q) => q.themeId === themeId).sort(() => Math.random() - 0.5);
    else cards = [...questions].sort(() => Math.random() - 0.5);

    if (cards.length === 0) {
      alert("Aucune carte disponible.");
      return;
    }
    onStart(cards);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cartes memoire</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={dueCards.length} label="A reviser" icon={Clock} color="orange" delay={0} />
        <StatCard value={newCards.length} label="Nouvelles" icon={Sparkles} color="blue" delay={75} />
        <StatCard value={questions.length - newCards.length} label="Etudiees" icon={BookOpen} color="green" delay={150} />
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
            Toutes ({questions.length})
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Par theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {themes.map(([id, name]) => {
            const count = questions.filter((q) => q.themeId === id).length;
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
