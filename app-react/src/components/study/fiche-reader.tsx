import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeft, ArrowRight, Lightbulb, BookOpen, Check, HelpCircle } from "lucide-react";
import type { Fiche, FichesData, Question } from "@/types/index.ts";
import * as storage from "@/services/storage.ts";

function renderSectionContent(content: string): ReactNode[] {
  return content.split("\n\n").map((p, i) => {
    if (p.startsWith("- ")) {
      const items = p
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map((l) => l.slice(2));
      return (
        <ul key={i} className="list-disc pl-6 mb-2 space-y-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm">
              {item}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mb-2 text-sm leading-relaxed">
        {p}
      </p>
    );
  });
}

interface FicheReaderProps {
  ficheId: string;
  fichesData: FichesData;
  questions: Question[];
}

export function FicheReader({
  ficheId,
  fichesData,
  questions,
}: FicheReaderProps) {
  const fiche = fichesData.fiches.find((f) => f.id === ficheId);
  const [markedRead, setMarkedRead] = useState(false);

  if (!fiche) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Fiche non trouvee.
      </div>
    );
  }

  const relatedQ = questions
    .filter((q) => q.themeId === fiche.themeId)
    .slice(0, 5);

  const sameSub = fichesData.fiches.filter(
    (f: Fiche) =>
      f.themeId === fiche.themeId && f.subcategoryId === fiche.subcategoryId,
  );
  const idx = sameSub.findIndex((f: Fiche) => f.id === ficheId);
  const prev = idx > 0 ? sameSub[idx - 1] : null;
  const next = idx < sameSub.length - 1 ? sameSub[idx + 1] : null;

  function handleMarkRead() {
    const read = storage.load<Record<string, number>>("fiches_read", {});
    read[ficheId] = Date.now();
    storage.save("fiches_read", read);
    setMarkedRead(true);
  }

  return (
    <div className="space-y-4">
      <Link
        to="/study"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux fiches
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge>{fiche.themeName}</Badge>
            <Button
              size="sm"
              variant={markedRead ? "default" : "outline"}
              onClick={handleMarkRead}
              disabled={markedRead}
              className={`active-scale ${
                markedRead ? "bg-dsfr-success hover:bg-dsfr-success" : ""
              }`}
            >
              {markedRead ? (
                <><Check className="w-4 h-4 mr-1" /> Lu !</>
              ) : (
                <><BookOpen className="w-4 h-4 mr-1" /> Marquer comme lu</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <h1 className="text-xl font-bold">{fiche.title}</h1>

          {fiche.objectives.length > 0 && (
            <div className="bg-accent p-4 rounded-lg border-l-4 border-l-primary">
              <strong className="text-sm flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-primary" />
                Objectifs :
              </strong>
              <ul className="mt-1 pl-6 list-disc space-y-1">
                {fiche.objectives.map((o, i) => (
                  <li key={i} className="text-sm">
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {fiche.sections.filter((s) => s.heading.toLowerCase() !== "pour aller plus loin").map((s, i) => (
              <div key={i}>
                <h3 className="text-base font-semibold mt-4 mb-2">
                  {s.heading}
                </h3>
                {renderSectionContent(s.content)}
              </div>
            ))}
          </div>

          {fiche.references.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Pour aller plus loin</h3>
              <ul className="pl-6 list-disc space-y-1">
                {fiche.references.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <Button
          size="sm"
          variant={markedRead ? "default" : "outline"}
          onClick={handleMarkRead}
          disabled={markedRead}
          className={`active-scale ${markedRead ? "bg-dsfr-success hover:bg-dsfr-success" : ""}`}
        >
          {markedRead ? (
            <><Check className="w-4 h-4 mr-1" /> Lu !</>
          ) : (
            <><BookOpen className="w-4 h-4 mr-1" /> Marquer comme lu</>
          )}
        </Button>
      </Card>

      <div className="flex justify-between">
        {prev ? (
          <Button variant="outline" asChild className="active-scale">
            <Link to={`/study?fiche=${encodeURIComponent(prev.id)}`}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Precedent
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="outline" asChild className="active-scale">
            <Link to={`/study?fiche=${encodeURIComponent(next.id)}`}>
              Suivant
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </div>

      {relatedQ.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              Questions liees
            </h3>
          </CardHeader>
          <CardContent className="space-y-2">
            {relatedQ.map((q) => (
              <div
                key={q.id}
                className="py-2 border-b border-border last:border-b-0"
              >
                <span className="text-sm">{q.questionText}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" asChild className="mt-2 active-scale">
              <Link to={`/quiz?mode=practice&theme=${fiche.themeId}`}>
                Quiz sur ce theme
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
