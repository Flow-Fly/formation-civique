import { useMemo, useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Zap, GraduationCap, ArrowRight, AlertCircle } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { getExamMeta } from "@/lib/exams.ts";
import * as engine from "@/services/quiz-engine.ts";
import * as materializer from "@/services/question-materializer.ts";
import * as storage from "@/services/storage.ts";
import type { ExamCode, QuestionBankItem, QuestionInstance } from "@/types/index.ts";

interface QuizSetupProps {
  onStart: (
    questions: QuestionInstance[],
    options: { timed: boolean; timeLimit?: number; isExam: boolean; exam: ExamCode },
  ) => void;
}

interface QuestionCycleEntry {
  order: string[];
  index: number;
}

type QuestionCycleState = Record<string, QuestionCycleEntry>;

const QUESTION_CYCLE_STORAGE_KEY = "quiz_question_cycle";

function shuffleQuestionIds(questions: QuestionBankItem[]): string[] {
  return engine.selectQuestions(questions, { count: questions.length }).map((question) => question.id);
}

function reconcileCycleOrder(
  questions: QuestionBankItem[],
  previousOrder: string[] | undefined,
): string[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const id of previousOrder || []) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    kept.push(id);
  }

  const missing = questions.filter((question) => !seen.has(question.id));
  return [...kept, ...shuffleQuestionIds(missing)];
}

function takeIdsFromOrder(
  order: string[],
  startIndex: number,
  selectedIds: Set<string>,
  count: number,
): { ids: string[]; nextIndex: number } {
  const ids: string[] = [];
  let cursor = startIndex;

  while (cursor < order.length && ids.length < count) {
    const id = order[cursor];
    cursor += 1;
    if (selectedIds.has(id)) continue;
    ids.push(id);
  }

  return { ids, nextIndex: cursor };
}

function getSelectionKey(mode: string, themeId: string | null): string {
  if (mode === "exam") return "exam";
  return `practice:${themeId && themeId !== "all" ? themeId : "all"}`;
}

function selectQuestionsFromCycle(
  questions: QuestionBankItem[],
  count: number,
  exam: ExamCode,
  selectionKey: string,
): QuestionBankItem[] {
  if (questions.length === 0 || count <= 0) return [];

  const targetCount = Math.min(count, questions.length);
  const cycleState = storage.load<QuestionCycleState>(QUESTION_CYCLE_STORAGE_KEY, {}, exam);
  const existingEntry = cycleState[selectionKey];

  let order = reconcileCycleOrder(questions, existingEntry?.order);
  let index = Math.min(Math.max(existingEntry?.index || 0, 0), order.length);

  const selectedIds = new Set<string>();
  const orderedSelection: string[] = [];

  while (orderedSelection.length < targetCount) {
    const { ids, nextIndex } = takeIdsFromOrder(
      order,
      index,
      selectedIds,
      targetCount - orderedSelection.length,
    );

    for (const id of ids) {
      selectedIds.add(id);
      orderedSelection.push(id);
    }

    index = nextIndex;
    if (orderedSelection.length >= targetCount) break;

    order = shuffleQuestionIds(questions);
    index = 0;
  }

  const byId = new Map(questions.map((question) => [question.id, question]));
  cycleState[selectionKey] = { order, index };
  storage.save(QUESTION_CYCLE_STORAGE_KEY, cycleState, exam);

  return orderedSelection
    .map((id) => byId.get(id))
    .filter((question): question is QuestionBankItem => Boolean(question));
}

export function QuizSetup({ onStart }: QuizSetupProps) {
  const { questionBank, examConfig } = useData();
  const { activeExam } = useExam();
  const examMeta = getExamMeta(activeExam);
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "practice";
  const defaultTheme = searchParams.get("theme") || "";

  const [themeId, setThemeId] = useState(defaultTheme);
  const [count, setCount] = useState("20");

  const examQuestions = useMemo(
    () =>
      questionBank.filter(
        (q) => q.exams.includes(activeExam) && materializer.isQuestionMaterializable(q),
      ),
    [questionBank, activeExam],
  );

  const themes = [...new Map(examQuestions.map((q) => [q.themeId, q.themeName])).entries()];
  const rules = examConfig?.[activeExam];

  function materializeSelection(selected: typeof examQuestions): QuestionInstance[] {
    const seed = `${activeExam}|quiz|${mode}|${Date.now()}`;
    return materializer.materializeQuestions(selected, activeExam, seed);
  }

  function handleStartExam() {
    if (!rules) return;
    const selected = selectQuestionsFromCycle(
      examQuestions,
      rules.questionCount,
      activeExam,
      getSelectionKey(mode, null),
    );
    const instances = materializeSelection(selected);
    onStart(instances, {
      timed: true,
      timeLimit: rules.timeLimitMinutes * 60,
      isExam: true,
      exam: activeExam,
    });
  }

  function handleStartPractice() {
    const selected = selectQuestionsFromCycle(
      examQuestions.filter((question) =>
        themeId && themeId !== "all" ? question.themeId === themeId : true,
      ),
      parseInt(count, 10),
      activeExam,
      getSelectionKey(mode, themeId || null),
    );
    if (selected.length === 0) {
      alert("Aucune question disponible pour ce theme.");
      return;
    }
    onStart(materializeSelection(selected), { timed: false, isExam: false, exam: activeExam });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {mode === "exam"
            ? `Simulation pour ${examMeta.shortLabel}`
            : `Quiz pour ${examMeta.shortLabel}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "exam"
            ? `Lancez une simulation complete du parcours ${examMeta.label}.`
            : `Choisissez un theme pour vous entrainer sur ${examMeta.shortLabel}.`}
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Simulation basée sur les questions de connaissance publiques; les mises en situation
          officielles ne sont pas publiées.
        </AlertDescription>
      </Alert>

      <Card className={mode === "exam" ? "border-l-4 border-l-destructive" : ""}>
        <CardHeader>
          <CardTitle>{mode === "exam" ? "Simulation complete" : "Quiz d'entrainement"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "exam" ? (
            <>
              <p className="text-sm leading-relaxed">
                Simulation du parcours {examMeta.label} :{" "}
                <strong>{rules?.questionCount ?? 40} questions</strong>,{" "}
                <strong>{rules?.timeLimitMinutes ?? 45} minutes</strong>, seuil de reussite :{" "}
                <strong>{rules?.passScorePercent ?? 80}%</strong>.
              </p>
              <Button className="w-full active-scale" size="lg" onClick={handleStartExam}>
                Commencer la simulation
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Theme a travailler</label>
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
                Lancer le quiz
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
            Quiz par theme
          </Link>
        </Button>
        <Button variant={mode === "exam" ? "default" : "outline"} asChild className="active-scale">
          <Link to="/quiz?mode=exam">
            <GraduationCap className="w-4 h-4 mr-1.5" />
            Simulation complete
          </Link>
        </Button>
      </div>
    </div>
  );
}
