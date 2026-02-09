import { formatTime } from "@/services/quiz-engine.ts";

interface QuizTimerProps {
  timeRemaining: number;
}

export function QuizTimer({ timeRemaining }: QuizTimerProps) {
  const isDanger = timeRemaining < 60;
  const isWarning = timeRemaining < 300 && !isDanger;

  return (
    <span
      className={`text-xl font-bold tabular-nums ${
        isDanger
          ? "text-destructive animate-timer-pulse"
          : isWarning
            ? "text-dsfr-warning"
            : "text-foreground"
      }`}
    >
      {formatTime(timeRemaining)}
    </span>
  );
}
