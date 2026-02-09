import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";

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
}

export function StatCard({ value, label, icon: Icon, color = "blue", pulse, delay = 0 }: StatCardProps) {
  return (
    <Card
      className="animate-fade-in-up hover:-translate-y-1 hover:shadow-md transition-all duration-200"
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
      </CardContent>
    </Card>
  );
}
