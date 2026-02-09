import { Progress } from "@/components/ui/progress.tsx";
import type { ThemeMastery } from "@/types/index.ts";

const chartColors = [
  "bg-chart-1 [&>div]:bg-chart-1",
  "bg-chart-2 [&>div]:bg-chart-2",
  "bg-chart-3 [&>div]:bg-chart-3",
  "bg-chart-4 [&>div]:bg-chart-4",
  "bg-chart-5 [&>div]:bg-chart-5",
];

const dotColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

interface ThemeProgressProps {
  themeMastery: ThemeMastery;
}

export function ThemeProgress({ themeMastery }: ThemeProgressProps) {
  return (
    <div className="space-y-3">
      {Object.entries(themeMastery).map(([id, t], i) => {
        const pct = t.total > 0 ? Math.round((t.studied / t.total) * 100) : 0;
        return (
          <div key={id} className="hover:bg-accent/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
            <div className="flex justify-between mb-1">
              <span className="text-sm flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                {t.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {t.studied}/{t.total} ({pct}%)
              </span>
            </div>
            <Progress
              value={pct}
              className={chartColors[i % chartColors.length]}
            />
          </div>
        );
      })}
    </div>
  );
}
