import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { FicheModal } from "./fiche-modal.tsx";
import type { ContentPageMeta, EvidencePointer } from "@/types/index.ts";

interface FicheLinkProps {
  question: { relatedFicheIds: string[]; correctEvidence?: EvidencePointer[] };
}

function findContentPage(
  ficheId: string,
  contentIndex: { themes: { subcategories: { pages?: ContentPageMeta[]; groups?: { pages: ContentPageMeta[] }[] }[] }[] } | null,
): ContentPageMeta | null {
  if (!contentIndex) return null;
  for (const theme of contentIndex.themes) {
    for (const subcat of theme.subcategories) {
      for (const page of subcat.pages || []) {
        if (page.originalFicheIds.includes(ficheId)) return page;
      }
      for (const group of subcat.groups || []) {
        for (const page of group.pages) {
          if (page.originalFicheIds.includes(ficheId)) return page;
        }
      }
    }
  }
  return null;
}

function findContentPageByPath(
  contentPath: string,
  contentIndex: { themes: { subcategories: { pages?: ContentPageMeta[]; groups?: { pages: ContentPageMeta[] }[] }[] }[] } | null,
): ContentPageMeta | null {
  if (!contentIndex) return null;
  for (const theme of contentIndex.themes) {
    for (const subcat of theme.subcategories) {
      for (const page of subcat.pages || []) {
        if (page.path === contentPath) return page;
      }
      for (const group of subcat.groups || []) {
        for (const page of group.pages) {
          if (page.path === contentPath) return page;
        }
      }
    }
  }
  return null;
}

export function FicheLink({ question }: FicheLinkProps) {
  const { fichesData, contentIndex } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const ids = question.relatedFicheIds || [];

  const directEvidence = (question.correctEvidence || []).find((e) => e.contentPath && e.sectionId);
  let contentPage: ContentPageMeta | null = null;
  let initialSectionId: string | undefined;
  let modalTitle = "";

  if (directEvidence) {
    contentPage = findContentPageByPath(directEvidence.contentPath, contentIndex);
    initialSectionId = directEvidence.sectionId;
    modalTitle = directEvidence.sectionTitle || "";
  }

  if (!contentPage) {
    if (!ids || ids.length === 0 || !fichesData) return null;
    const fiche = fichesData.fiches.find((f) => f.id === ids[0]);
    if (!fiche) return null;
    contentPage = findContentPage(fiche.id, contentIndex);
    if (!contentPage) return null;
    modalTitle = contentPage.title;
  }

  const slug = contentPage.path.replace(/\.md$/, "").split("/").pop() || "";
  const pageTitle = modalTitle || contentPage.title;

  return (
    <>
      <p className="mt-2 text-sm">
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-sm font-inherit"
        >
          <BookOpen className="w-3.5 h-3.5" />
          En savoir plus &rarr;
        </button>
      </p>
      <FicheModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contentPath={contentPage.path}
        slug={slug}
        pageTitle={pageTitle}
        initialSectionId={initialSectionId}
      />
    </>
  );
}
