import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { getExamMeta } from "@/lib/exams.ts";
import { compareQuestionsForExam, getQuestionStudyLinks } from "@/lib/question-links.ts";

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

export function QuestionsPage() {
  const {
    questionBank,
    contentIndex,
    fichesData,
    examConfig,
    loading,
    error,
  } = useData();
  const { activeExam } = useExam();
  const examMeta = getExamMeta(activeExam);
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const themeParam = searchParams.get("theme") ?? "all";
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [themeId, setThemeId] = useState(() => searchParams.get("theme") ?? "all");

  useEffect(() => {
    setQuery(queryParam);
    setThemeId(themeParam);
  }, [queryParam, themeParam]);

  const examQuestions = useMemo(
    () =>
      questionBank
        .filter((question) => question.exams.includes(activeExam))
        .sort((a, b) => compareQuestionsForExam(a, b, activeExam)),
    [questionBank, activeExam],
  );

  const themes = useMemo(
    () => [...new Map(examQuestions.map((question) => [question.themeId, question.themeName])).entries()],
    [examQuestions],
  );

  const validThemeId = themeId === "all" || themes.some(([id]) => id === themeId)
    ? themeId
    : "all";

  const filteredQuestions = useMemo(() => {
    const normalizedQuery = normalize(query);

    return examQuestions.filter((question) => {
      if (normalizedQuery && !normalize(`${question.id} ${question.questionText}`).includes(normalizedQuery)) {
        return false;
      }

      if (validThemeId !== "all" && question.themeId !== validThemeId) {
        return false;
      }

      return true;
    });
  }, [examQuestions, query, validThemeId]);

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement des questions...</div>;
  }

  if (error) {
    return <div className="text-center py-16 text-muted-foreground">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Questions pour {examMeta.shortLabel}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parcourez toutes les questions de {examMeta.shortLabel} et ouvrez les fiches liees
          pour retrouver la reponse dans le cours.
        </p>
      </div>

      {examConfig?.[activeExam]?.disclaimer && (
        <Alert>
          <AlertDescription>{examConfig[activeExam].disclaimer}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une question, un mot-cle ou un numero"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <Select value={validThemeId} onValueChange={setThemeId}>
            <SelectTrigger>
              <SelectValue placeholder="Theme" />
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

          <p className="text-sm text-muted-foreground md:col-span-2">
            {filteredQuestions.length} question(s) affichee(s) sur {examQuestions.length}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune question ne correspond aux filtres actuels.
            </p>
          ) : (
            filteredQuestions.map((question) => {
              const questionNumber = question.sourceMetaByExam[activeExam]?.globalNumber;
              const studyLinks = getQuestionStudyLinks(question, contentIndex, fichesData);

              return (
                <div key={question.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {typeof questionNumber === "number" && (
                      <Badge variant="outline">#{questionNumber}</Badge>
                    )}
                    <Badge>{question.id}</Badge>
                    <Badge variant="secondary">{question.themeName}</Badge>
                  </div>

                  <p className="text-base font-medium leading-relaxed">{question.questionText}</p>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Fiches liees
                    </p>

                    {studyLinks.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {studyLinks.map((link) => (
                          <Button
                            key={link.key}
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-auto justify-start whitespace-normal py-2 text-left"
                          >
                            <Link to={link.to}>
                              <BookOpen className="w-3.5 h-3.5 mr-1 shrink-0" />
                              {link.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune fiche liee disponible pour le moment.
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
