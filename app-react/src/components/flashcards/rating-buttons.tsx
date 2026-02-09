import { Button } from "@/components/ui/button.tsx";
import { RotateCcw, ThumbsDown, ThumbsUp, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Quality } from "@/types/index.ts";

interface RatingButtonsProps {
  onRate: (quality: Quality) => void;
}

const ratings: { quality: Quality; label: string; className: string; key: string; icon: LucideIcon }[] = [
  { quality: 0, label: "Encore", className: "bg-destructive hover:bg-destructive/90 text-white", key: "1", icon: RotateCcw },
  { quality: 2, label: "Difficile", className: "bg-dsfr-warning hover:bg-dsfr-warning/90 text-white", key: "2", icon: ThumbsDown },
  { quality: 3, label: "Bien", className: "bg-dsfr-success hover:bg-dsfr-success/90 text-white", key: "3", icon: ThumbsUp },
  { quality: 5, label: "Facile", className: "bg-primary hover:bg-primary/90 text-primary-foreground", key: "4", icon: Sparkles },
];

export function RatingButtons({ onRate }: RatingButtonsProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {ratings.map((r) => {
          const Icon = r.icon;
          return (
            <Button
              key={r.quality}
              className={`${r.className} active-scale`}
              onClick={() => onRate(r.quality)}
            >
              <Icon className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{r.label}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">1</kbd>{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">2</kbd>{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">3</kbd>{" "}
        <kbd className="inline-flex items-center justify-center px-1.5 min-w-[1.5rem] bg-muted border border-border rounded text-xs font-mono">4</kbd>
      </p>
    </div>
  );
}
