import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Pencil, Check, RotateCcw } from "lucide-react";
import type { QuestionBankItem } from "@/types.ts";

interface QuestionDetailProps {
  question: QuestionBankItem;
  onEdit: () => void;
  onToggleStatus: () => void;
}

export function QuestionDetail({ question: q, onEdit, onToggleStatus }: QuestionDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>{q.id}</Badge>
          <Badge variant="outline">{q.exams.join("/")}</Badge>
          <Badge variant={q.reviewStatus === "reviewed" ? "default" : "secondary"}>
            {q.reviewStatus}
          </Badge>
          <Badge variant={(q.relatedFicheIds || []).length > 0 ? "outline" : "destructive"}>
            {(q.relatedFicheIds || []).length > 0 ? "linked" : "unlinked"}
          </Badge>
          {q.reviewBucket && (
            <Badge variant={q.reviewBucket === "high_confidence" ? "default" : "secondary"}>
              {q.reviewBucket}
            </Badge>
          )}
          {(q.qualityFlags || []).map((f) => (
            <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onToggleStatus}>
            {q.reviewStatus === "reviewed" ? (
              <><RotateCcw className="w-3.5 h-3.5 mr-1" /> Mark pending</>
            ) : (
              <><Check className="w-3.5 h-3.5 mr-1" /> Mark reviewed</>
            )}
          </Button>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Question</p>
        <p className="text-sm font-medium">{q.questionText}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Theme: {q.themeName} · Difficulty: {Object.entries(q.difficultyByExam).map(([e, d]) => `${e}=${d}`).join(", ") || "unset"}
        </p>
        {q.questionProfile && (
          <p className="text-xs text-muted-foreground">Profile: {q.questionProfile}</p>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Correct answers ({q.answerPools.correct.length})
        </p>
        <div className="space-y-1">
          {q.answerPools.correct.map((c) => (
            <p key={c} className="text-sm text-green-700">+ {c}</p>
          ))}
          {q.answerPools.correct.length === 0 && (
            <p className="text-xs text-muted-foreground italic">None</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Distractors ({q.answerPools.distractors.length})
        </p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {q.answerPools.distractors.map((d) => (
            <p key={d} className="text-sm text-muted-foreground">- {d}</p>
          ))}
          {q.answerPools.distractors.length === 0 && (
            <p className="text-xs text-muted-foreground italic">None</p>
          )}
        </div>
      </div>

      {q.explanationByCorrect && Object.keys(q.explanationByCorrect).length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Explanations</p>
          <div className="space-y-2">
            {Object.entries(q.explanationByCorrect).map(([answer, expl]) => (
              <div key={answer} className="border rounded p-2">
                <p className="text-xs font-medium text-green-700 mb-1">{answer}</p>
                <p className="text-xs text-muted-foreground">{expl}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {q.answerEvidence && q.answerEvidence.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Answer evidence</p>
          <div className="space-y-2">
            {q.answerEvidence.map((entry) => (
              <div key={entry.normalizedAnswer} className="border rounded p-2">
                <p className="text-xs font-medium">{entry.answerText}</p>
                {entry.evidence.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground mt-1">No evidence</p>
                ) : (
                  <div className="space-y-1 mt-1">
                    {entry.evidence.map((ev, idx) => (
                      <p key={`${ev.contentPath}#${ev.sectionId}:${idx}`} className="text-[10px] text-muted-foreground">
                        {ev.sectionTitle || `${ev.contentPath}#${ev.sectionId}`}
                        {ev.quote && <span className="italic"> — &quot;{ev.quote.slice(0, 120)}{ev.quote.length > 120 ? "..." : ""}&quot;</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {q.questionEvidence && q.questionEvidence.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Question evidence</p>
          <div className="space-y-1">
            {q.questionEvidence.map((ev, idx) => (
              <p key={`${ev.contentPath}#${ev.sectionId}:${idx}`} className="text-[10px] text-muted-foreground">
                {ev.sectionTitle || `${ev.contentPath}#${ev.sectionId}`}
                {ev.quote && <span className="italic"> — &quot;{ev.quote.slice(0, 120)}{ev.quote.length > 120 ? "..." : ""}&quot;</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {q.reviewReasons && q.reviewReasons.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Review reasons</p>
          <div className="flex flex-wrap gap-1">
            {q.reviewReasons.map((reason) => (
              <Badge key={reason} variant="secondary" className="text-[10px]">{reason}</Badge>
            ))}
          </div>
        </div>
      )}

      {q.styleMetrics && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Style metrics</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <p>char ratio: {q.styleMetrics.charLengthRatio.toFixed(2)}</p>
            <p>token ratio: {q.styleMetrics.tokenLengthRatio.toFixed(2)}</p>
            <p>profile matches: {q.styleMetrics.profileMatchCount}/{q.styleMetrics.optionCount}</p>
            <p>length cue: {q.styleMetrics.obviousLengthCue ? "yes" : "no"}</p>
          </div>
          {q.styleMetrics.mismatchedOptions.length > 0 && (
            <div className="mt-2 space-y-1">
              {q.styleMetrics.mismatchedOptions.map((value) => (
                <p key={value} className="text-[10px] text-muted-foreground">- {value}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {q.relatedFicheIds.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Related fiches</p>
          <div className="flex flex-wrap gap-1">
            {q.relatedFicheIds.map((id) => (
              <Badge key={id} variant="outline" className="text-[10px]">{id}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
