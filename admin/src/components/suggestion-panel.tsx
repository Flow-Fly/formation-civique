import { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { SuggestionItem } from "@/types.ts";

interface SuggestionPanelProps {
  suggestions: SuggestionItem[];
  onApply: (suggestion: SuggestionItem["suggestion"]) => void;
  applying: boolean;
}

export function SuggestionPanel({ suggestions, onApply, applying }: SuggestionPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(
    suggestions.length > 0 ? 0 : null,
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="border rounded-lg p-3 bg-accent/30 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Pipeline suggestions ({suggestions.length})</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((s, idx) => {
          const isExpanded = expandedIdx === idx;
          const isValid = s.validation?.valid === true;
          const wasApplied = s.apply?.applied === true;

          return (
            <div key={idx} className="border rounded bg-card p-2">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-1.5">
                  {isValid ? (
                    <Badge className="text-[10px] px-1.5 py-0">valid</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">invalid</Badge>
                  )}
                  {wasApplied && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">applied</Badge>
                  )}
                  {s.accepted && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">accepted</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    C={s.suggestion.correct?.length || 0} D={s.suggestion.distractors?.length || 0}
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Correct</p>
                    {(s.suggestion.correct || []).map((c) => (
                      <p key={c} className="text-xs text-green-700">+ {c}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distractors</p>
                    {(s.suggestion.distractors || []).map((d) => (
                      <p key={d} className="text-xs text-muted-foreground">- {d}</p>
                    ))}
                  </div>

                  {s.suggestion.explanationByCorrect && Object.keys(s.suggestion.explanationByCorrect).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Explanations</p>
                      {Object.entries(s.suggestion.explanationByCorrect).map(([ans, expl]) => (
                        <div key={ans} className="mt-1">
                          <p className="text-[10px] font-medium text-green-700">{ans}</p>
                          <p className="text-[10px] text-muted-foreground">{expl}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.suggestion.answerEvidence && s.suggestion.answerEvidence.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence</p>
                      {s.suggestion.answerEvidence.map((entry) => (
                        <div key={entry.normalizedAnswer} className="mt-1">
                          <p className="text-[10px] font-medium">{entry.answerText}</p>
                          {entry.evidence.map((ev, eidx) => (
                            <p key={eidx} className="text-[10px] text-muted-foreground ml-2">
                              {ev.sectionTitle}
                              {ev.quote && ` — "${ev.quote.slice(0, 80)}${ev.quote.length > 80 ? "..." : ""}"`}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {s.validation?.errors && s.validation.errors.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-destructive">Validation errors</p>
                      {s.validation.errors.map((err, eidx) => (
                        <p key={eidx} className="text-[10px] text-destructive">{err}</p>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="default"
                    disabled={applying}
                    onClick={() => onApply(s.suggestion)}
                    className="w-full"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {applying ? "Applying..." : "Apply this suggestion"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
