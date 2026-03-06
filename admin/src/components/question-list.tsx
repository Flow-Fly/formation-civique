import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import type { QuestionBankItem } from "@/types.ts";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, " ")
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

interface QuestionListProps {
  questions: QuestionBankItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function QuestionList({ questions, selectedId, onSelect }: QuestionListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedId]);

  return (
    <div ref={listRef} className="overflow-y-auto h-[calc(100vh-200px)] space-y-1 pr-1">
      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground p-4">No questions match filters.</p>
      )}
      {questions.map((q) => {
        const isSelected = q.id === selectedId;
        const poolIssue = hasPoolIssue(q);
        return (
          <button
            key={q.id}
            ref={isSelected ? selectedRef : undefined}
            className={`w-full text-left border rounded p-2.5 transition-colors text-sm ${
              isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            }`}
            onClick={() => onSelect(q.id)}
          >
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{q.id}</Badge>
              <Badge
                variant={q.reviewStatus === "reviewed" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {q.reviewStatus}
              </Badge>
              {poolIssue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">pool!</Badge>
              )}
              {(q.qualityFlags || []).length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(q.qualityFlags || []).length} flag(s)
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium leading-tight line-clamp-2">{q.questionText}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {q.exams.join("/")} · {q.themeName} · C={q.answerPools.correct.length} D={q.answerPools.distractors.length}
            </p>
          </button>
        );
      })}
    </div>
  );
}
