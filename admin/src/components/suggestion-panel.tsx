import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Sparkles, Link2, ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import type {
  FeedbackVerdict,
  OptionReviewFeedback,
  QuestionReviewVerdict,
  SuggestionItem,
  SuggestionReviewFeedback,
} from "@/types.ts";

interface SuggestionPanelProps {
  suggestions: SuggestionItem[];
  onApplyAnswer: (suggestion: SuggestionItem["suggestion"]) => void;
  onApplyLink: (suggestion: SuggestionItem["suggestion"]) => void;
  onSaveFeedback: (
    questionId: string,
    sourceFile: string,
    feedback: Omit<SuggestionReviewFeedback, "updatedAt" | "questionId" | "sourceFile">,
  ) => Promise<void> | void;
  applying: boolean;
  savingFeedbackKey: string | null;
}

const OPTION_VERDICTS: Array<{ value: FeedbackVerdict; label: string }> = [
  { value: "unreviewed", label: "No review" },
  { value: "keep", label: "Keep" },
  { value: "rewrite", label: "Rewrite" },
  { value: "reject", label: "Reject" },
];

const OVERALL_VERDICTS: Array<{ value: QuestionReviewVerdict; label: string }> = [
  { value: "unreviewed", label: "No review" },
  { value: "ready", label: "Ready" },
  { value: "revise", label: "Revise" },
  { value: "skip", label: "Skip" },
];

function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, " ")
    .replace(/[^\w\s.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLinkSuggestion(item: SuggestionItem): boolean {
  return item.kind === "fiche_link" || Boolean(item.suggestion?.ficheCandidates?.length);
}

function buildOptionFeedback(
  optionText: string,
  role: OptionReviewFeedback["role"],
  existing?: OptionReviewFeedback,
): OptionReviewFeedback {
  return {
    optionText,
    normalizedOption: normalize(optionText),
    role,
    verdict: existing?.verdict || "unreviewed",
    comment: existing?.comment || "",
  };
}

function buildFeedbackDraft(item: SuggestionItem): SuggestionReviewFeedback {
  const existingByKey = new Map(
    (item.reviewFeedback?.optionFeedback || []).map((entry) => [
      `${entry.role}:${entry.normalizedOption}`,
      entry,
    ]),
  );
  const optionFeedback = [
    ...(item.suggestion.correct || []).map((optionText) =>
      buildOptionFeedback(
        optionText,
        "correct",
        existingByKey.get(`correct:${normalize(optionText)}`),
      ),
    ),
    ...(item.suggestion.distractors || []).map((optionText) =>
      buildOptionFeedback(
        optionText,
        "distractor",
        existingByKey.get(`distractor:${normalize(optionText)}`),
      ),
    ),
  ];

  return {
    sourceFile: item._sourceFile || "",
    questionId: item.questionId,
    overallVerdict: item.reviewFeedback?.overallVerdict || "unreviewed",
    overallComment: item.reviewFeedback?.overallComment || "",
    optionFeedback,
    updatedAt: item.reviewFeedback?.updatedAt || "",
  };
}

function buildDrafts(suggestions: SuggestionItem[]): Record<string, SuggestionReviewFeedback> {
  return Object.fromEntries(
    suggestions.map((item, index) => [draftStateKey(item, index), buildFeedbackDraft(item)]),
  );
}

function draftStateKey(item: SuggestionItem, index: number): string {
  return `${item._sourceFile || item.kind || "answer_pool"}::${item.questionId}::${index}`;
}

function feedbackSaveKey(item: SuggestionItem): string {
  return `${item._sourceFile || ""}::${item.questionId}`;
}

function ChoiceButtons<T extends string>({
  current,
  options,
  onChange,
}: {
  current: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? "rounded border border-primary bg-primary px-2 py-1 text-[10px] text-primary-foreground"
                : "rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SuggestionPanel({
  suggestions,
  onApplyAnswer,
  onApplyLink,
  onSaveFeedback,
  applying,
  savingFeedbackKey,
}: SuggestionPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(
    suggestions.length > 0 ? `${suggestions[0].kind || "answer_pool"}-0` : null,
  );
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, SuggestionReviewFeedback>>(
    () => buildDrafts(suggestions),
  );

  useEffect(() => {
    setFeedbackDrafts(buildDrafts(suggestions));
  }, [suggestions]);

  const grouped = useMemo(() => {
    const link = suggestions.filter((item) => isLinkSuggestion(item));
    const answer = suggestions.filter((item) => !isLinkSuggestion(item));
    return { link, answer };
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  function updateDraft(
    key: string,
    updater: (draft: SuggestionReviewFeedback) => SuggestionReviewFeedback,
  ) {
    setFeedbackDrafts((prev) => ({
      ...prev,
      [key]: updater(prev[key]),
    }));
  }

  function updateOptionDraft(
    key: string,
    optionKey: string,
    patch: Partial<OptionReviewFeedback>,
  ) {
    updateDraft(key, (draft) => ({
      ...draft,
      optionFeedback: draft.optionFeedback.map((entry) =>
        `${entry.role}:${entry.normalizedOption}` === optionKey
          ? { ...entry, ...patch }
          : entry,
      ),
    }));
  }

  async function saveFeedback(item: SuggestionItem, key: string) {
    const draft = feedbackDrafts[key];
    if (!draft || !draft.sourceFile) return;

    await onSaveFeedback(item.questionId, draft.sourceFile, {
      overallVerdict: draft.overallVerdict,
      overallComment: draft.overallComment.trim(),
      optionFeedback: draft.optionFeedback.map((entry) => ({
        ...entry,
        comment: entry.comment.trim(),
      })),
    });
  }

  return (
    <div className="border rounded-lg p-3 bg-accent/30 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Pipeline suggestions ({suggestions.length})</h3>
      </div>

      {grouped.link.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Link review
            </h4>
          </div>
          {grouped.link.map((item, idx) => {
            const key = `link-${idx}`;
            const isExpanded = expandedKey === key;
            const isValid = item.validation?.valid === true;

            return (
              <div key={key} className="border rounded bg-card p-2">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className="text-[10px] px-1.5 py-0">fiche_link</Badge>
                    <Badge variant={isValid ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {isValid ? "valid" : "invalid"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {(item.candidateFicheIds || []).length} candidate(s)
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Profile: {item.questionProfile || "unknown"}
                    </p>
                    {(item.suggestion.ficheCandidates || []).map((candidate) => (
                      <div key={candidate.ficheId} className="border rounded p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">{candidate.title}</p>
                          <Badge variant="outline" className="text-[10px]">{candidate.score}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{candidate.ficheId}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {candidate.themeName} · {candidate.subcategoryName}
                        </p>
                        {(candidate.reasons || []).length > 0 && (
                          <div className="mt-1 space-y-1">
                            {candidate.reasons.map((reason) => (
                              <p key={reason} className="text-[10px] text-muted-foreground">- {reason}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {item.validation?.errors && item.validation.errors.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-destructive">Validation errors</p>
                        {item.validation.errors.map((error, errorIndex) => (
                          <p key={errorIndex} className="text-[10px] text-destructive">{error}</p>
                        ))}
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="default"
                      disabled={applying || !isValid}
                      onClick={() => onApplyLink(item.suggestion)}
                      className="w-full"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      {applying ? "Applying..." : "Apply fiche shortlist"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {grouped.answer.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              QCM review
            </h4>
          </div>
          {grouped.answer.map((item, idx) => {
            const key = `answer-${idx}`;
            const draftKey = draftStateKey(item, idx);
            const draft = feedbackDrafts[draftKey];
            const isExpanded = expandedKey === key;
            const isValid = item.validation?.valid === true;
            const bucket = item.suggestion.reviewBucket;
            const isSavingFeedback = savingFeedbackKey === feedbackSaveKey(item);

            return (
              <div key={key} className="border rounded bg-card p-2">
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className="text-[10px] px-1.5 py-0">answer_pool</Badge>
                    <Badge variant={isValid ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {isValid ? "valid" : "invalid"}
                    </Badge>
                    {bucket && (
                      <Badge
                        variant={bucket === "high_confidence" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {bucket}
                      </Badge>
                    )}
                    {draft?.overallVerdict && draft.overallVerdict !== "unreviewed" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        review: {draft.overallVerdict}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {item.questionProfile || item.suggestion.questionProfile} · C={item.suggestion.correct?.length || 0} D={item.suggestion.distractors?.length || 0}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && draft && (
                  <div className="mt-2 space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      Candidate fiches: {(item.suggestion.candidateFicheIds || item.candidateFicheIds || []).join(", ") || "(none)"}
                    </p>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Correct</p>
                      {(item.suggestion.correct || []).map((value) => (
                        <p key={value} className="text-xs text-green-700">+ {value}</p>
                      ))}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distractors</p>
                      {(item.suggestion.distractors || []).map((value) => (
                        <p key={value} className="text-xs text-muted-foreground">- {value}</p>
                      ))}
                    </div>

                    {item.suggestion.reviewReasons && item.suggestion.reviewReasons.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Review reasons</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.suggestion.reviewReasons.map((reason) => (
                            <Badge key={reason} variant="secondary" className="text-[10px]">{reason}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.suggestion.styleMetrics && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Style metrics</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground mt-1">
                          <p>char ratio: {item.suggestion.styleMetrics.charLengthRatio.toFixed(2)}</p>
                          <p>token ratio: {item.suggestion.styleMetrics.tokenLengthRatio.toFixed(2)}</p>
                          <p>
                            profile matches: {item.suggestion.styleMetrics.profileMatchCount}/
                            {item.suggestion.styleMetrics.optionCount}
                          </p>
                          <p>length cue: {item.suggestion.styleMetrics.obviousLengthCue ? "yes" : "no"}</p>
                        </div>
                        {item.suggestion.styleMetrics.mismatchedOptions.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {item.suggestion.styleMetrics.mismatchedOptions.map((value) => (
                              <p key={value} className="text-[10px] text-muted-foreground">- {value}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {item.suggestion.answerEvidence && item.suggestion.answerEvidence.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Answer evidence</p>
                        {item.suggestion.answerEvidence.map((entry) => (
                          <div key={entry.normalizedAnswer} className="mt-1">
                            <p className="text-[10px] font-medium">{entry.answerText}</p>
                            {entry.evidence.map((ev, evidenceIndex) => (
                              <p key={evidenceIndex} className="text-[10px] text-muted-foreground ml-2">
                                {ev.sectionTitle || `${ev.contentPath}#${ev.sectionId}`}
                                {ev.quote && ` — "${ev.quote.slice(0, 100)}${ev.quote.length > 100 ? "..." : ""}"`}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.suggestion.questionEvidence && item.suggestion.questionEvidence.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Question evidence</p>
                        {item.suggestion.questionEvidence.map((ev, evidenceIndex) => (
                          <p key={evidenceIndex} className="text-[10px] text-muted-foreground">
                            {ev.sectionTitle || `${ev.contentPath}#${ev.sectionId}`}
                            {ev.quote && ` — "${ev.quote.slice(0, 100)}${ev.quote.length > 100 ? "..." : ""}"`}
                          </p>
                        ))}
                      </div>
                    )}

                    {item.validation?.errors && item.validation.errors.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-destructive">Validation errors</p>
                        {item.validation.errors.map((error, errorIndex) => (
                          <p key={errorIndex} className="text-[10px] text-destructive">{error}</p>
                        ))}
                      </div>
                    )}

                    {item.validation?.warnings && item.validation.warnings.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-amber-600">Validation warnings</p>
                        {item.validation.warnings.map((warning, warningIndex) => (
                          <p key={warningIndex} className="text-[10px] text-amber-600">{warning}</p>
                        ))}
                      </div>
                    )}

                    <div className="border rounded-md p-3 bg-muted/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold">Review feedback</p>
                        {draft.updatedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            last saved: {new Date(draft.updatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Overall verdict
                        </p>
                        <ChoiceButtons
                          current={draft.overallVerdict}
                          options={OVERALL_VERDICTS}
                          onChange={(value) =>
                            updateDraft(draftKey, (current) => ({ ...current, overallVerdict: value }))
                          }
                        />
                        <textarea
                          value={draft.overallComment}
                          onChange={(event) =>
                            updateDraft(draftKey, (current) => ({
                              ...current,
                              overallComment: event.target.value,
                            }))
                          }
                          placeholder="Global note for this suggestion. Example: correct too narrow, distractors too obvious."
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Option-by-option
                        </p>
                        {draft.optionFeedback.map((entry) => {
                          const optionKey = `${entry.role}:${entry.normalizedOption}`;
                          return (
                            <div key={optionKey} className="border rounded-md p-2 bg-background space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={entry.role === "correct" ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {entry.role}
                                </Badge>
                                <p className="text-xs">{entry.optionText}</p>
                              </div>
                              <ChoiceButtons
                                current={entry.verdict}
                                options={OPTION_VERDICTS}
                                onChange={(value) => updateOptionDraft(draftKey, optionKey, { verdict: value })}
                              />
                              <input
                                value={entry.comment}
                                onChange={(event) =>
                                  updateOptionDraft(draftKey, optionKey, { comment: event.target.value })
                                }
                                placeholder="Short note. Example: too religion-centric, good, weak distractor."
                                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item._sourceFile || isSavingFeedback}
                        onClick={() => saveFeedback(item, draftKey)}
                        className="w-full"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 mr-1" />
                        {isSavingFeedback ? "Saving feedback..." : "Save review feedback"}
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="default"
                      disabled={applying || !isValid}
                      onClick={() => onApplyAnswer(item.suggestion)}
                      className="w-full"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      {applying ? "Applying..." : "Apply validated QCM"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
