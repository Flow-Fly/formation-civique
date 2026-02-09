import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Zap, GraduationCap, ArrowRight } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import * as engine from "@/services/quiz-engine.ts";
import type { Question } from "@/types/index.ts";

interface QuizSetupProps {
  onStart: (questions: Question[], options: { timed: boolean; timeLimit?: number; isExam: boolean }) => void;
}

export function QuizSetup({ onStart }: QuizSetupProps) {
  const { questions } = useData();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "practice";
  const defaultTheme = searchParams.get("theme") || "";

  const [themeId, setThemeId] = useState(defaultTheme);
  const [count, setCount] = useState("20");

  const themes = [...new Map(questions.map((q) => [q.themeId, q.themeName])).entries()];

  function handleStartExam() {
    const selected = engine.selectQuestions(questions, { count: 40 });
    onStart(selected, { timed: true, timeLimit: 45 * 60, isExam: true });
  }

  function handleStartPractice() {
    const selected = engine.selectQuestions(questions, {
      count: parseInt(count, 10),
      themeId: themeId && themeId !== "all" ? themeId : null,
    });
    if (selected.length === 0) {
      alert("Aucune question disponible pour ce theme.");
      return;
    }
    onStart(selected, { timed: false, isExam: false });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        {mode === "exam" ? "Simulation d'examen" : "Quiz"}
      </h1>

      <Card className={mode === "exam" ? "border-l-4 border-l-destructive" : ""}>
        <CardHeader>
          <CardTitle>{mode === "exam" ? "Examen civique" : "Entrainement"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "exam" ? (
            <>
              <p>
                Simulation de l'examen civique : <strong>40 questions</strong>,{" "}
                <strong>45 minutes</strong>, seuil de reussite : <strong>80%</strong>.
              </p>
              <Button className="w-full active-scale" size="lg" onClick={handleStartExam}>
                Commencer l'examen
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Theme</label>
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les themes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les themes</SelectItem>
                    {themes.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nombre de questions</label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full active-scale" size="lg" onClick={handleStartPractice}>
                Commencer
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant={mode === "practice" ? "default" : "outline"} asChild className="active-scale">
          <Link to="/quiz?mode=practice">
            <Zap className="w-4 h-4 mr-1.5" />
            Entrainement
          </Link>
        </Button>
        <Button variant={mode === "exam" ? "default" : "outline"} asChild className="active-scale">
          <Link to="/quiz?mode=exam">
            <GraduationCap className="w-4 h-4 mr-1.5" />
            Examen
          </Link>
        </Button>
      </div>
    </div>
  );
}
