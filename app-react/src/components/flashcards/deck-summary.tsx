import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { RotateCcw, ThumbsDown, ThumbsUp, Sparkles, Layers, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RatingName } from "@/types/index.ts";

const CONFETTI_COLORS = [
  "#000091", "#e1000f", "#009081", "#6a6af4", "#ff6b6b",
  "#ffd700", "#34d399", "#a78bfa", "#fb923c", "#38bdf8",
];

function LightConfetti() {
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${Math.random() * 1.5}s`,
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

interface DeckSummaryProps {
  reviewed: number;
  ratings: Record<RatingName, number>;
  onRestart: () => void;
}

const ratingColors: Record<RatingName, string> = {
  again: "text-destructive",
  hard: "text-dsfr-warning",
  good: "text-dsfr-success",
  easy: "text-primary",
};

const ratingLabels: Record<RatingName, string> = {
  again: "Encore",
  hard: "Difficile",
  good: "Bien",
  easy: "Facile",
};

const ratingIcons: Record<RatingName, LucideIcon> = {
  again: RotateCcw,
  hard: ThumbsDown,
  good: ThumbsUp,
  easy: Sparkles,
};

export function DeckSummary({ reviewed, ratings, onRestart }: DeckSummaryProps) {
  const isPositive = (ratings.good + ratings.easy) > (ratings.again + ratings.hard);

  return (
    <div className="space-y-4">
      {isPositive && <LightConfetti />}

      <h1 className="text-2xl font-bold text-center">Session terminee !</h1>

      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-5xl font-bold text-primary animate-fade-in-up">{reviewed}</div>
          <div className="text-sm text-muted-foreground mt-1">cartes revisees</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repartition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center">
            {(Object.keys(ratingLabels) as RatingName[]).map((key) => {
              const Icon = ratingIcons[key];
              return (
                <div key={key}>
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${ratingColors[key]}`} />
                  <div className={`text-2xl font-bold ${ratingColors[key]}`}>
                    {ratings[key]}
                  </div>
                  <div className="text-sm text-muted-foreground">{ratingLabels[key]}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={onRestart} className="active-scale">
          <Layers className="w-4 h-4 mr-1.5" />
          Nouveau paquet
        </Button>
        <Button variant="outline" asChild className="active-scale">
          <Link to="/dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1.5" />
            Tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  );
}
