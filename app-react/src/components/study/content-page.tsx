import { useMemo, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TableOfContents } from "./table-of-contents.tsx";
import { FicheContent } from "./fiche-content.tsx";
import { useData } from "@/context/data-context.tsx";
import { useFicheContent } from "@/hooks/use-fiche-content.ts";
import type { ContentPageMeta } from "@/types/index.ts";

export function ContentPage() {
  const { theme, subcategory, slug } = useParams<{
    theme: string;
    subcategory: string;
    slug: string;
  }>();
  const { contentIndex } = useData();
  const location = useLocation();
  const scrolledRef = useRef(false);

  const contentPath = `${theme}/${subcategory}/${slug}.md`;
  const { frontmatter, body, loading, error } = useFicheContent(contentPath);

  // Reset scroll flag on slug change
  useEffect(() => {
    scrolledRef.current = false;
  }, [slug]);

  // Scroll to section when navigating from search (URL has #section-id)
  useEffect(() => {
    if (!location.hash || loading || scrolledRef.current) return;
    scrolledRef.current = true;
    const id = location.hash.slice(1);
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("section-highlight");
        setTimeout(() => el.classList.remove("section-highlight"), 2500);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [loading, location.hash]);

  // Find prev/next pages in the subcategory
  const { prev, next } = useMemo(() => {
    if (!contentIndex || !theme || !subcategory || !slug) {
      return { prev: null, next: null };
    }

    const themeData = contentIndex.themes.find((t) => t.id === theme);
    if (!themeData) return { prev: null, next: null };

    const subcatData = themeData.subcategories.find(
      (s) => s.id === subcategory,
    );
    if (!subcatData) return { prev: null, next: null };

    const allPages: ContentPageMeta[] = [];
    if (subcatData.pages) allPages.push(...subcatData.pages);
    if (subcatData.groups) {
      for (const group of subcatData.groups) {
        allPages.push(...group.pages);
      }
    }

    const idx = allPages.findIndex((p) => p.id === slug);
    return {
      prev: idx > 0 ? allPages[idx - 1] : null,
      next: idx < allPages.length - 1 ? allPages[idx + 1] : null,
    };
  }, [contentIndex, theme, subcategory, slug]);

  function pageLink(page: ContentPageMeta): string {
    const parts = page.path.replace(/\.md$/, "").split("/");
    return `/study/${parts.join("/")}`;
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (error || !frontmatter) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Fiche non trouvee.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/study"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux fiches
        </Link>
        <Badge>{frontmatter.themeName}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <h1 className="text-2xl font-bold">{frontmatter.title}</h1>

          <FicheContent
            frontmatter={frontmatter}
            body={body}
            slug={slug!}
          />

          <div className="flex justify-between pt-4">
            {prev ? (
              <Button variant="outline" asChild className="active-scale">
                <Link to={pageLink(prev)}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Precedent
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="outline" asChild className="active-scale">
                <Link to={pageLink(next)}>
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <TableOfContents markdown={body} />
        </div>
      </div>
    </div>
  );
}
