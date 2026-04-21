import { useMemo } from "react";
import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";
import { getExamMeta } from "@/lib/exams.ts";
import { getLinkedQuestions } from "@/lib/question-links.ts";
import type { ExamCode, QuestionBankItem } from "@/types/index.ts";

interface LinkedQuestionsCardProps {
  questionBank: QuestionBankItem[];
  activeExam: ExamCode;
  ficheIds: string[];
  className?: string;
}

export function LinkedQuestionsCard({
  questionBank,
  activeExam,
  ficheIds,
  className,
}: LinkedQuestionsCardProps) {
  const examMeta = getExamMeta(activeExam);
  const linkedQuestions = useMemo(
    () => getLinkedQuestions(questionBank, activeExam, ficheIds),
    [questionBank, activeExam, ficheIds],
  );

  if (linkedQuestions.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          Questions liees
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {linkedQuestions.length} question(s) associee(s) a cette fiche pour {examMeta.shortLabel}.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {linkedQuestions.map((question) => {
            const questionNumber = question.sourceMetaByExam[activeExam]?.globalNumber;

            return (
              <Link
                key={question.id}
                to={`/questions?q=${encodeURIComponent(question.id)}`}
                className={cn(
                  "block rounded-lg border border-border p-3 no-underline transition-colors",
                  "hover:bg-accent hover:border-primary/30",
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {typeof questionNumber === "number" && (
                    <Badge variant="outline">#{questionNumber}</Badge>
                  )}
                  <Badge variant="secondary">{question.id}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {question.questionText}
                </p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
