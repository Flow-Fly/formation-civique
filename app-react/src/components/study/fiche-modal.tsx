import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { FicheContent } from "./fiche-content.tsx";
import { LinkedQuestionsCard } from "./linked-questions-card.tsx";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { useFicheContent } from "@/hooks/use-fiche-content.ts";

interface FicheModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentPath: string;
  slug: string;
  pageTitle: string;
  initialSectionId?: string;
}

export function FicheModal({
  open,
  onOpenChange,
  contentPath,
  slug,
  pageTitle,
  initialSectionId,
}: FicheModalProps) {
  const { questionBank } = useData();
  const { activeExam } = useExam();
  const { frontmatter, body, loading, error } = useFicheContent(
    open ? contentPath : null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || loading || !frontmatter || !initialSectionId) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      const target = container?.querySelector<HTMLElement>(`#${CSS.escape(initialSectionId)}`);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("section-highlight");
      setTimeout(() => target.classList.remove("section-highlight"), 2200);
    }, 120);

    return () => clearTimeout(timer);
  }, [open, loading, frontmatter, initialSectionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
        </DialogHeader>

        <div ref={containerRef} className="flex-1 overflow-y-auto pr-2">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-muted-foreground">
              Impossible de charger la fiche.
            </div>
          )}
          {frontmatter && (
            <div className="space-y-4">
              <FicheContent frontmatter={frontmatter} body={body} slug={slug} />
              <LinkedQuestionsCard
                questionBank={questionBank}
                activeExam={activeExam}
                ficheIds={frontmatter.originalFicheIds}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
