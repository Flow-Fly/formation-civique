import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { ChevronRight, CheckCircle } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { getExamMeta } from "@/lib/exams.ts";
import * as storage from "@/services/storage.ts";
import type { ContentPageMeta } from "@/types/index.ts";

const dotColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function pageLink(page: ContentPageMeta): string {
  const parts = page.path.replace(/\.md$/, "").split("/");
  return `/study/${parts.join("/")}`;
}

function countPages(subcat: { pages?: ContentPageMeta[]; groups?: { pages: ContentPageMeta[] }[] }): number {
  let count = (subcat.pages || []).length;
  if (subcat.groups) {
    for (const g of subcat.groups) {
      count += g.pages.length;
    }
  }
  return count;
}

function isPageRead(page: ContentPageMeta, readFiches: Record<string, number>): boolean {
  // A page is read if any of its original fiche IDs is marked read, or the content page itself
  if (readFiches[`content:${page.id}`]) return true;
  return page.originalFicheIds.some((id) => readFiches[id]);
}

export function ThemeBrowser() {
  const { contentIndex } = useData();
  const { activeExam } = useExam();
  const examMeta = getExamMeta(activeExam);
  const readFiches = storage.load<Record<string, number>>("fiches_read", {}, activeExam);

  if (!contentIndex) {
    return <div className="text-center py-16 text-muted-foreground">Chargement des fiches...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Fiches pour {examMeta.shortLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Commencez ici pour comprendre le cours avant de passer aux quiz et aux cartes memoire.
        </p>
      </div>
      <Card className="p-0 overflow-hidden">
        <Accordion type="multiple">
          {contentIndex.themes.map((theme, i) => (
            <AccordionItem key={theme.id} value={theme.id}>
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                  <strong>{theme.name}</strong>
                  <Badge variant="secondary" className="ml-1">
                    {theme.subcategories.reduce((a, s) => a + countPages(s), 0)} fiches
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {theme.subcategories.map((subcat) => (
                  <div key={subcat.id}>
                    <h3 className="mt-3 mb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      {subcat.name}
                    </h3>

                    {/* Ungrouped pages */}
                    {subcat.pages?.map((page) => (
                      <PageLink key={page.id} page={page} isRead={isPageRead(page, readFiches)} />
                    ))}

                    {/* Grouped pages */}
                    {subcat.groups?.map((group) => (
                      <div key={group.id}>
                        <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground/80 pl-2">
                          {group.name}
                        </p>
                        {group.pages.map((page) => (
                          <PageLink key={page.id} page={page} isRead={isPageRead(page, readFiches)} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function PageLink({ page, isRead }: { page: ContentPageMeta; isRead: boolean }) {
  return (
    <Link
      to={pageLink(page)}
      className="flex items-center justify-between py-2 px-3 -mx-1 rounded hover:bg-accent hover:translate-x-0.5 no-underline text-foreground border-b border-border last:border-b-0 transition-all"
    >
      <span className="flex items-center gap-2 text-sm">
        {page.title}
        {isRead && (
          <Badge variant="outline" className="text-dsfr-success border-dsfr-success">
            <CheckCircle className="w-3 h-3 mr-1" />
            Lu
          </Badge>
        )}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}
