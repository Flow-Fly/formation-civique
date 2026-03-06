import { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Save, X } from "lucide-react";
import type { QuestionBankItem, Difficulty, ExamCode, QualityFlag } from "@/types.ts";

interface QuestionEditorProps {
  question: QuestionBankItem;
  onSave: (patch: Partial<QuestionBankItem>) => void;
  onCancel: () => void;
}

const ALL_FLAGS: QualityFlag[] = [
  "missing_correct_evidence",
  "weak_distractors",
  "placeholder_answer",
  "manual_review_required",
];

export function QuestionEditor({ question: q, onSave, onCancel }: QuestionEditorProps) {
  const [correctText, setCorrectText] = useState(q.answerPools.correct.join("\n"));
  const [distractorsText, setDistractorsText] = useState(q.answerPools.distractors.join("\n"));
  const [explanationTemplate, setExplanationTemplate] = useState(q.explanationTemplate || "");
  const [flags, setFlags] = useState<QualityFlag[]>(q.qualityFlags || []);
  const [difficulty, setDifficulty] = useState<Record<string, Difficulty>>(() => {
    const d: Record<string, Difficulty> = {};
    for (const [exam, diff] of Object.entries(q.difficultyByExam)) {
      if (diff) d[exam] = diff;
    }
    return d;
  });

  const handleSave = () => {
    const correct = correctText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const distractors = distractorsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const patch: Partial<QuestionBankItem> = {
      answerPools: { correct, distractors },
      qualityFlags: flags,
      difficultyByExam: difficulty as Partial<Record<ExamCode, Difficulty>>,
    };
    if (explanationTemplate.trim()) {
      patch.explanationTemplate = explanationTemplate.trim();
    }
    onSave(patch);
  };

  const toggleFlag = (flag: QualityFlag) => {
    setFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>{q.id}</Badge>
          <span className="text-sm font-medium">Editing</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} data-save-btn>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1">{q.questionText}</p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
          Correct answers (one per line)
        </label>
        <textarea
          value={correctText}
          onChange={(e) => setCorrectText(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
          Distractors (one per line)
        </label>
        <textarea
          value={distractorsText}
          onChange={(e) => setDistractorsText(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
          Explanation template
        </label>
        <textarea
          value={explanationTemplate}
          onChange={(e) => setExplanationTemplate(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Difficulty by exam
        </p>
        <div className="flex gap-3">
          {q.exams.map((exam) => (
            <div key={exam} className="flex items-center gap-1.5">
              <span className="text-xs font-medium">{exam}</span>
              <Select
                value={difficulty[exam] || "medium"}
                onValueChange={(v) => setDifficulty((prev) => ({ ...prev, [exam]: v as Difficulty }))}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">easy</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="hard">hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Quality flags</p>
        <div className="flex flex-wrap gap-2">
          {ALL_FLAGS.map((flag) => (
            <button
              key={flag}
              onClick={() => toggleFlag(flag)}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                flags.includes(flag)
                  ? "bg-destructive text-white border-destructive"
                  : "border-border hover:bg-accent"
              }`}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
