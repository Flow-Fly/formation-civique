import { useMemo, useState, useCallback, useEffect } from "react";
import { FilterBar } from "@/components/filter-bar.tsx";
import { QuestionList } from "@/components/question-list.tsx";
import { QuestionDetail } from "@/components/question-detail.tsx";
import { QuestionEditor } from "@/components/question-editor.tsx";
import { SuggestionPanel } from "@/components/suggestion-panel.tsx";
import { useQuestions } from "@/hooks/use-questions.ts";
import { useSuggestions } from "@/hooks/use-suggestions.ts";
import type { QuestionBankItem, QualityFlag, SuggestionReviewFeedback } from "@/types.ts";

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
  return correct.length !== 1 || distractors.length !== 3 || overlap;
}

export function App() {
  const { questions, loading, error, patchQuestion, applySuggestion, applyLinkSuggestion } = useQuestions();
  const { suggestions, saveSuggestionFeedback } = useSuggestions();

  // Filters
  const [query, setQuery] = useState("");
  const [exam, setExam] = useState("all");
  const [themeId, setThemeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [qualityFlag, setQualityFlag] = useState("all");
  const [poolFlag, setPoolFlag] = useState("all");
  const [linkFlag, setLinkFlag] = useState("all");

  // Selection & editing
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingFeedbackKey, setSavingFeedbackKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Derived data
  const themes = useMemo(
    () => [...new Map(questions.map((q) => [q.themeId, q.themeName])).entries()],
    [questions],
  );

  const allQualityFlags = useMemo(
    () =>
      [...new Set(questions.flatMap((q) => q.qualityFlags || []))].sort() as QualityFlag[],
    [questions],
  );

  const filtered = useMemo(() => {
    const qn = normalize(query);
    return questions.filter((q) => {
      if (qn && !normalize(`${q.questionText} ${q.id}`).includes(qn)) return false;
      if (exam !== "all" && !q.exams.includes(exam as QuestionBankItem["exams"][number])) return false;
      if (themeId !== "all" && q.themeId !== themeId) return false;
      if (status !== "all" && q.reviewStatus !== status) return false;
      if (qualityFlag !== "all" && !(q.qualityFlags || []).includes(qualityFlag as QualityFlag)) return false;
      const issue = hasPoolIssue(q);
      if (poolFlag === "issue" && !issue) return false;
      if (poolFlag === "ok" && issue) return false;
      const hasLinks = (q.relatedFicheIds || []).length > 0;
      if (linkFlag === "linked" && !hasLinks) return false;
      if (linkFlag === "unlinked" && hasLinks) return false;
      return true;
    });
  }, [questions, query, exam, themeId, status, qualityFlag, poolFlag, linkFlag]);

  const selected = useMemo(
    () => filtered.find((q) => q.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // Sync selectedId when current selection is filtered out
  useEffect(() => {
    if (selectedId && !filtered.find((q) => q.id === selectedId) && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedSuggestions = useMemo(
    () => (selected ? suggestions[selected.id] || [] : []),
    [selected, suggestions],
  );

  const counts = useMemo(() => ({
    total: questions.length,
    filtered: filtered.length,
    pending: questions.filter((q) => q.reviewStatus === "pending").length,
    reviewed: questions.filter((q) => q.reviewStatus === "reviewed").length,
  }), [questions, filtered]);

  // Actions
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSave = useCallback(
    async (patch: Partial<QuestionBankItem>) => {
      if (!selected) return;
      try {
        await patchQuestion(selected.id, patch);
        setEditing(false);
        showToast(`Saved ${selected.id}`);
      } catch (err) {
        showToast(`Error: ${err}`);
      }
    },
    [selected, patchQuestion, showToast],
  );

  const handleToggleStatus = useCallback(async () => {
    if (!selected) return;
    const newStatus = selected.reviewStatus === "reviewed" ? "pending" : "reviewed";
    try {
      await patchQuestion(selected.id, { reviewStatus: newStatus });
      showToast(`${selected.id} → ${newStatus}`);
    } catch (err) {
      showToast(`Error: ${err}`);
    }
  }, [selected, patchQuestion, showToast]);

  const handleApplySuggestion = useCallback(
    async (suggestion: unknown) => {
      if (!selected) return;
      setApplying(true);
      try {
        await applySuggestion(selected.id, suggestion);
        showToast(`Applied suggestion to ${selected.id}`);
      } catch (err) {
        showToast(`Error: ${err}`);
      } finally {
        setApplying(false);
      }
    },
    [selected, applySuggestion, showToast],
  );

  const handleApplyLinkSuggestion = useCallback(
    async (suggestion: unknown) => {
      if (!selected) return;
      setApplying(true);
      try {
        await applyLinkSuggestion(selected.id, suggestion);
        showToast(`Applied fiche shortlist to ${selected.id}`);
      } catch (err) {
        showToast(`Error: ${err}`);
      } finally {
        setApplying(false);
      }
    },
    [selected, applyLinkSuggestion, showToast],
  );

  const handleSaveSuggestionFeedback = useCallback(
    async (
      questionId: string,
      sourceFile: string,
      feedback: Omit<SuggestionReviewFeedback, "updatedAt" | "questionId" | "sourceFile">,
    ) => {
      const key = `${sourceFile}::${questionId}`;
      setSavingFeedbackKey(key);
      try {
        await saveSuggestionFeedback(questionId, sourceFile, feedback);
        showToast(`Saved review feedback for ${questionId}`);
      } catch (err) {
        showToast(`Error: ${err}`);
      } finally {
        setSavingFeedbackKey(null);
      }
    },
    [saveSuggestionFeedback, showToast],
  );

  // Navigate to next/prev pending
  const pendingIds = useMemo(
    () => filtered.filter((q) => q.reviewStatus === "pending").map((q) => q.id),
    [filtered],
  );

  const navigatePending = useCallback(
    (direction: 1 | -1) => {
      if (pendingIds.length === 0) return;
      const currentIdx = selected ? pendingIds.indexOf(selected.id) : -1;
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === 1 ? 0 : pendingIds.length - 1;
      } else {
        nextIdx = (currentIdx + direction + pendingIds.length) % pendingIds.length;
      }
      setSelectedId(pendingIds[nextIdx]);
      setEditing(false);
    },
    [pendingIds, selected],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

      // Cmd+S to save (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editing) {
          // trigger save via form submit — we'll handle it differently
          document.querySelector<HTMLButtonElement>("[data-save-btn]")?.click();
        }
        return;
      }

      if (isInput) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const idx = filtered.findIndex((q) => q.id === selectedId);
        if (idx < filtered.length - 1) setSelectedId(filtered[idx + 1].id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const idx = filtered.findIndex((q) => q.id === selectedId);
        if (idx > 0) setSelectedId(filtered[idx - 1].id);
      } else if (e.key === "e" && !editing) {
        e.preventDefault();
        setEditing(true);
      } else if (e.key === "Escape" && editing) {
        e.preventDefault();
        setEditing(false);
      } else if (e.key === "n") {
        e.preventDefault();
        navigatePending(1);
      } else if (e.key === "p") {
        e.preventDefault();
        navigatePending(-1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedId, editing, navigatePending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading question bank...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Error loading questions</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Make sure the API server is running on :3001</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-card">
        <h1 className="text-lg font-bold">Question Bank Editor</h1>
        <div className="text-xs text-muted-foreground space-x-3">
          <span>
            <kbd className="px-1 py-0.5 border rounded text-[10px]">j/k</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 border rounded text-[10px]">e</kbd> edit
          </span>
          <span>
            <kbd className="px-1 py-0.5 border rounded text-[10px]">esc</kbd> cancel
          </span>
          <span>
            <kbd className="px-1 py-0.5 border rounded text-[10px]">n/p</kbd> next/prev pending
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-2">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          exam={exam}
          onExamChange={setExam}
          themeId={themeId}
          onThemeChange={setThemeId}
          themes={themes}
          status={status}
          onStatusChange={setStatus}
          qualityFlag={qualityFlag}
          onQualityFlagChange={setQualityFlag}
          qualityFlags={allQualityFlags}
          poolFlag={poolFlag}
          onPoolFlagChange={setPoolFlag}
          linkFlag={linkFlag}
          onLinkFlagChange={setLinkFlag}
          counts={counts}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden px-4 pb-4 gap-4">
        {/* Left: question list (35%) */}
        <div className="w-[35%] min-w-[300px]">
          <QuestionList
            questions={filtered}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setSelectedId(id);
              setEditing(false);
            }}
          />
        </div>

        {/* Right: detail / editor + suggestions (65%) */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">No question selected</p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-card">
              {editing ? (
                <QuestionEditor
                  question={selected}
                  onSave={handleSave}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <QuestionDetail
                  question={selected}
                  onEdit={() => setEditing(true)}
                  onToggleStatus={handleToggleStatus}
                />
              )}
            </div>
          )}

          {selected && selectedSuggestions.length > 0 && !editing && (
            <SuggestionPanel
              key={selected.id}
              suggestions={selectedSuggestions}
              onApplyAnswer={handleApplySuggestion}
              onApplyLink={handleApplyLinkSuggestion}
              applying={applying}
              savingFeedbackKey={savingFeedbackKey}
              onSaveFeedback={handleSaveSuggestionFeedback}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-2 rounded-md text-sm shadow-lg animate-fade-in-up">
          {toast}
        </div>
      )}
    </div>
  );
}
