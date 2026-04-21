import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";

const colorMap = {
  blue: "bg-primary/10 text-primary",
  green: "bg-dsfr-success/15 text-dsfr-success",
  orange: "bg-dsfr-warning/15 text-dsfr-warning",
  purple: "bg-chart-5/15 text-chart-5",
} as const;

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  color?: keyof typeof colorMap;
  pulse?: boolean;
  delay?: number;
  hint?: string;
  to?: string;
}

export function StatCard({
  value,
  label,
  icon: Icon,
  color = "blue",
  pulse,
  delay = 0,
  hint,
  to,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "animate-fade-in-up transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        to && "cursor-pointer hover:border-primary/30",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="text-center py-4">
        {Icon && (
          <div className="flex justify-center mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorMap[color]} ${pulse ? "animate-gentle-pulse" : ""}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        )}
        <div className="text-3xl font-bold text-primary">{value}</div>
        <div className="text-sm text-muted-foreground mt-1">{label}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );

  if (!to) return card;

  return (
    <Link
      to={to}
      className="block no-underline rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </Link>
  );
}
