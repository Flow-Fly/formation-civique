import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { CheckCircle } from "lucide-react";
import { useData } from "@/context/data-context.tsx";
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

function isPageRead(
  page: ContentPageMeta,
  readFiches: Record<string, number>,
): boolean {
  if (readFiches[`content:${page.id}`]) return true;
  return page.originalFicheIds.some((id) => readFiches[id]);
}

interface StudySidebarProps {
  currentTheme?: string;
  currentSubcategory?: string;
  currentSlug?: string;
  onNavigate?: () => void;
}

export function StudySidebar({
  currentTheme,
  currentSubcategory,
  currentSlug,
  onNavigate,
}: StudySidebarProps) {
  const { contentIndex } = useData();
  const readFiches = storage.load<Record<string, number>>("fiches_read", {});
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Scroll active fiche into view on mount
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [currentSlug]);

  if (!contentIndex) return null;

  // Auto-expand the current theme
  const defaultOpenThemes = currentTheme ? [currentTheme] : [];

  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
        Fiches d'etude
      </p>
      <Accordion type="multiple" defaultValue={defaultOpenThemes}>
        {contentIndex.themes.map((theme, i) => (
          <AccordionItem
            key={theme.id}
            value={theme.id}
            className="border-b-0"
          >
            <AccordionTrigger className="px-2 py-2 text-sm hover:no-underline">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[i % dotColors.length]}`}
                />
                <span className="font-medium text-left text-xs">
                  {theme.name}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-1 pl-2">
              {theme.subcategories.map((subcat) => (
                <div key={subcat.id} className="mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-2 mb-1">
                    {subcat.name}
                  </p>

                  {/* Ungrouped pages */}
                  {subcat.pages?.map((page) => (
                    <SidebarLink
                      key={page.id}
                      page={page}
                      isRead={isPageRead(page, readFiches)}
                      isActive={
                        theme.id === currentTheme &&
                        subcat.id === currentSubcategory &&
                        page.id === currentSlug
                      }
                      activeRef={activeRef}
                      onNavigate={onNavigate}
                    />
                  ))}

                  {/* Grouped pages */}
                  {subcat.groups?.map((group) => (
                    <div key={group.id}>
                      {group.pages.map((page) => (
                        <SidebarLink
                          key={page.id}
                          page={page}
                          isRead={isPageRead(page, readFiches)}
                          isActive={
                            theme.id === currentTheme &&
                            subcat.id === currentSubcategory &&
                            page.id === currentSlug
                          }
                          activeRef={activeRef}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </nav>
  );
}

function SidebarLink({
  page,
  isRead,
  isActive,
  activeRef,
  onNavigate,
}: {
  page: ContentPageMeta;
  isRead: boolean;
  isActive: boolean;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
  onNavigate?: () => void;
}) {
  return (
    <Link
      ref={isActive ? activeRef : undefined}
      to={pageLink(page)}
      onClick={onNavigate}
      className={`flex items-center gap-1.5 py-1 px-2 rounded text-xs no-underline transition-colors ${
        isActive
          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-px pl-[calc(0.5rem-1px)]"
          : "text-foreground/80 hover:bg-accent hover:text-foreground"
      }`}
    >
      <span className="truncate flex-1">{page.title}</span>
      {isRead && (
        <CheckCircle className="w-3 h-3 text-dsfr-success shrink-0" />
      )}
    </Link>
  );
}
