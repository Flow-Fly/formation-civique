import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { FicheContent } from "./fiche-content.tsx";
import { useFicheContent } from "@/hooks/use-fiche-content.ts";

interface FicheModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentPath: string;
  slug: string;
  pageTitle: string;
}

export function FicheModal({
  open,
  onOpenChange,
  contentPath,
  slug,
  pageTitle,
}: FicheModalProps) {
  const { frontmatter, body, loading, error } = useFicheContent(
    open ? contentPath : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
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
            <FicheContent frontmatter={frontmatter} body={body} slug={slug} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
