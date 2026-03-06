import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import * as materializer from "@/services/question-materializer.ts";
import type { EvidencePointer, QualityFlag, QuestionBankItem } from "@/types/index.ts";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPoolIssue(q: QuestionBankItem): boolean {
  const correct = q.answerPools?.correct || [];
  const distractors = q.answerPools?.distractors || [];
  const correctSet = new Set(correct.map((c) => normalize(c)));
  const overlap = distractors.some((d) => correctSet.has(normalize(d)));
  return correct.length < 1 || distractors.length < 3 || overlap;
}

function evidenceLink(evidence: EvidencePointer): string {
  const pathNoMd = evidence.contentPath.replace(/\.md$/, "");
  return `/study/${pathNoMd}#${evidence.sectionId}`;
}

export function QuestionsPage() {
  const { questionBank } = useData();
  const { activeExam } = useExam();

  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [poolFlag, setPoolFlag] = useState("all");
  const [qualityFlag, setQualityFlag] = useState<"all" | QualityFlag>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const examQuestions = useMemo(
    () => questionBank.filter((q) => q.exams.includes(activeExam)),
    [questionBank, activeExam],
  );

  const themes = useMemo(
    () => [...new Map(examQuestions.map((q) => [q.themeId, q.themeName])).entries()],
    [examQuestions],
  );
  const qualityFlags = useMemo(
    () =>
      [...new Set(examQuestions.flatMap((q) => q.qualityFlags || []))]
        .sort((a, b) => a.localeCompare(b)),
    [examQuestions],
  );

  const filtered = useMemo(() => {
    const qn = normalize(query);
    return examQuestions.filter((q) => {
      if (qn && !normalize(`${q.questionText} ${q.id}`).includes(qn)) return false;
      if (themeId !== "all" && q.themeId !== themeId) return false;
      if (difficulty !== "all" && q.difficultyByExam?.[activeExam] !== difficulty) return false;
      if (reviewStatus !== "all" && q.reviewStatus !== reviewStatus) return false;
      if (qualityFlag !== "all" && !(q.qualityFlags || []).includes(qualityFlag)) return false;

      const issue = hasPoolIssue(q);
      if (poolFlag === "issue" && !issue) return false;
      if (poolFlag === "ok" && issue) return false;

      return true;
    });
  }, [examQuestions, query, themeId, difficulty, reviewStatus, poolFlag, qualityFlag, activeExam]);

  const selected = useMemo(
    () => filtered.find((q) => q.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const preview = useMemo(() => {
    if (!selected) return [];
    return [0, 1, 2].map((n) =>
      materializer.materializeQuestion(selected, activeExam, `${activeExam}|preview|${selected.id}|${n}`),
    );
  }, [selected, activeExam]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Questions ({activeExam})</h1>

      <Alert>
        <AlertDescription>
          Simulation basée sur les questions de connaissance publiques; les mises en situation
          officielles ne sont pas publiées.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Recherche texte / id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <Select value={themeId} onValueChange={setThemeId}>
            <SelectTrigger>
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous themes</SelectItem>
              {themes.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Difficulte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes difficultes</SelectItem>
              <SelectItem value="easy">easy</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="hard">hard</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="reviewed">reviewed</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={poolFlag} onValueChange={setPoolFlag}>
            <SelectTrigger>
              <SelectValue placeholder="Pools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous pools</SelectItem>
              <SelectItem value="ok">Pools valides</SelectItem>
              <SelectItem value="issue">Pools a corriger</SelectItem>
            </SelectContent>
          </Select>

          <Select value={qualityFlag} onValueChange={(v) => setQualityFlag(v as "all" | QualityFlag)}>
            <SelectTrigger>
              <SelectValue placeholder="Quality flag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous flags</SelectItem>
              {qualityFlags.map((flag) => (
                <SelectItem key={flag} value={flag}>
                  {flag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Liste ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filtered.map((q) => {
              const poolIssue = hasPoolIssue(q);
              const isSelected = selected?.id === q.id;
              return (
                <button
                  key={q.id}
                  className={`w-full text-left border rounded p-3 transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                  onClick={() => setSelectedId(q.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{q.id}</Badge>
                    <Badge variant="outline">{q.difficultyByExam?.[activeExam] || "medium"}</Badge>
                    <Badge variant={q.reviewStatus === "reviewed" ? "default" : "secondary"}>
                      {q.reviewStatus}
                    </Badge>
                    {poolIssue && <Badge variant="destructive">pool issue</Badge>}
                  </div>
                  <p className="text-sm font-medium">{q.questionText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {q.themeName} · correct={q.answerPools.correct.length} · distractors={q.answerPools.distractors.length}
                  </p>
                  {(q.qualityFlags || []).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      flags: {(q.qualityFlags || []).join(", ")}
                    </p>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Aucune question.</p>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{selected.id}</Badge>
                    <Badge variant="outline">{selected.themeName}</Badge>
                  </div>
                  <p className="text-sm font-medium">{selected.questionText}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pool correct</p>
                  <div className="space-y-1">
                    {selected.answerPools.correct.map((c) => (
                      <p key={c} className="text-sm">• {c}</p>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pool distractors</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selected.answerPools.distractors.map((d) => (
                      <p key={d} className="text-sm">• {d}</p>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Prévisualisation (3 variantes)</p>
                  <div className="space-y-2">
                    {preview.map((p, idx) => (
                      <div key={idx} className="border rounded p-2 text-sm">
                        <p className="font-medium mb-1">Variante {idx + 1}</p>
                        {p.choices.map((c) => (
                          <p key={c.id} className={c.id === p.correctAnswer ? "text-dsfr-success" : ""}>
                            {c.id}) {c.text}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {selected.answerEvidence && selected.answerEvidence.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Preuves (section-level)</p>
                    <div className="space-y-2">
                      {selected.answerEvidence.map((entry) => (
                        <div key={entry.normalizedAnswer} className="border rounded p-2">
                          <p className="text-sm font-medium">{entry.answerText}</p>
                          {(entry.evidence || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">Aucune preuve</p>
                          ) : (
                            <div className="space-y-1 mt-1">
                              {entry.evidence.map((ev, idx) => (
                                <p key={`${ev.contentPath}#${ev.sectionId}:${idx}`} className="text-xs">
                                  <Link to={evidenceLink(ev)} className="text-primary hover:underline">
                                    {ev.sectionTitle || `${ev.contentPath}#${ev.sectionId}`}
                                  </Link>
                                  {ev.quote ? ` — "${ev.quote}"` : ""}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
