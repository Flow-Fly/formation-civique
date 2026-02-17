import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MiniSearch from "minisearch";
import { FileText, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";

// ─── Types ───────────────────────────────────────────────────────────

interface SearchSection {
  id: string;
  title: string;
  content: string;
}

interface SearchEntry {
  id: string;
  title: string;
  path: string;
  themeName: string;
  subcategoryName: string;
  content: string;
  sections: SearchSection[];
}

interface SnippetPart {
  text: string;
  bold: boolean;
}

interface ProcessedResult {
  id: string;
  title: string;
  path: string;
  subcategoryName: string;
  sectionId: string | null;
  snippet: SnippetPart[];
}

interface SubcategoryGroup {
  key: string;
  subcategoryName: string;
  items: ProcessedResult[];
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeTerm(term: string): string {
  return term
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractSnippet(
  content: string,
  query: string,
): SnippetPart[] {
  const normalizedContent = normalizeTerm(content);
  const normalizedQuery = normalizeTerm(query.trim());

  if (!normalizedQuery) {
    return [{ text: content.slice(0, 80) + "...", bold: false }];
  }

  // Try full query, then fall back to first word > 2 chars
  let idx = normalizedContent.indexOf(normalizedQuery);
  let queryLen = normalizedQuery.length;

  if (idx === -1) {
    const words = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (const word of words) {
      const nw = normalizeTerm(word);
      idx = normalizedContent.indexOf(nw);
      if (idx !== -1) {
        queryLen = nw.length;
        break;
      }
    }
  }

  if (idx === -1) {
    return [
      {
        text: content.slice(0, 80) + (content.length > 80 ? "..." : ""),
        bold: false,
      },
    ];
  }

  // Extend to word boundary (show full matched word for prefix matches)
  let wordEnd = idx + queryLen;
  while (
    wordEnd < content.length &&
    /[\p{L}\p{N}]/u.test(content[wordEnd])
  )
    wordEnd++;

  const ctxBefore = 30;
  const ctxAfter = 40;
  const start = Math.max(0, idx - ctxBefore);
  const end = Math.min(content.length, wordEnd + ctxAfter);

  const parts: SnippetPart[] = [];
  if (start > 0) parts.push({ text: "...", bold: false });
  if (idx > start) parts.push({ text: content.slice(start, idx), bold: false });
  parts.push({ text: content.slice(idx, wordEnd), bold: true });
  if (end > wordEnd)
    parts.push({ text: content.slice(wordEnd, end), bold: false });
  if (end < content.length) parts.push({ text: "...", bold: false });

  return parts;
}

function findMatchingSection(
  entry: SearchEntry,
  query: string,
): { sectionId: string | null; snippet: SnippetPart[] } {
  const normalizedQuery = normalizeTerm(query.trim());

  // Try first significant word for section matching too
  const queryTerms = [normalizedQuery];
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  for (const w of words) queryTerms.push(normalizeTerm(w));

  for (const section of entry.sections) {
    const nc = normalizeTerm(section.content);
    if (queryTerms.some((t) => nc.includes(t))) {
      return {
        sectionId: section.id,
        snippet: extractSnippet(section.content, query),
      };
    }
  }

  // Title match — show first section content as context
  if (
    entry.sections.length > 0 &&
    normalizeTerm(entry.title).includes(normalizedQuery)
  ) {
    const text =
      entry.sections[0].content.slice(0, 80) +
      (entry.sections[0].content.length > 80 ? "..." : "");
    return { sectionId: null, snippet: [{ text, bold: false }] };
  }

  // Fallback: snippet from full content
  return {
    sectionId: entry.sections[0]?.id ?? null,
    snippet: extractSnippet(entry.content, query),
  };
}

// ─── Component ───────────────────────────────────────────────────────

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; title: string; path: string; themeName: string; subcategoryName: string }[]
  >([]);
  const miniSearchRef = useRef<MiniSearch | null>(null);
  const entriesMapRef = useRef<Map<string, SearchEntry>>(new Map());
  const loadedRef = useRef(false);

  // Lazy-load search index on first open
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;

    fetch(`${import.meta.env.BASE_URL}data/search-index.json`)
      .then((res) => res.json())
      .then((entries: SearchEntry[]) => {
        const map = new Map<string, SearchEntry>();
        entries.forEach((e) => map.set(e.id, e));
        entriesMapRef.current = map;

        const ms = new MiniSearch<SearchEntry>({
          fields: ["title", "content"],
          storeFields: ["title", "path", "themeName", "subcategoryName"],
          searchOptions: {
            prefix: true,
            fuzzy: 0.2,
            boost: { title: 3 },
          },
          processTerm: normalizeTerm,
        });
        ms.addAll(entries);
        miniSearchRef.current = ms;

        if (query) {
          setResults(ms.search(normalizeTerm(query)) as typeof results);
        }
      })
      .catch((err) => console.error("Failed to load search index:", err));
  }, [open, query]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (!miniSearchRef.current || !value.trim()) {
      setResults([]);
      return;
    }
    setResults(
      miniSearchRef.current.search(normalizeTerm(value)) as typeof results,
    );
  }, []);

  const handleSelect = useCallback(
    (item: ProcessedResult) => {
      const pathNoMd = item.path.replace(/\.md$/, "");
      const hash = item.sectionId ? `#${item.sectionId}` : "";
      navigate(`/study/${pathNoMd}${hash}`);
      onOpenChange(false);
      setQuery("");
      setResults([]);
    },
    [navigate, onOpenChange],
  );

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Process results: find snippets, determine sections, group by subcategory
  const groups = useMemo<SubcategoryGroup[]>(() => {
    if (!query.trim() || results.length === 0) return [];

    const processed: ProcessedResult[] = results.slice(0, 20).map((r) => {
      const entry = entriesMapRef.current.get(r.id);
      if (!entry) {
        return {
          id: r.id,
          title: r.title,
          path: r.path,
          subcategoryName: r.subcategoryName,
          sectionId: null,
          snippet: [{ text: "", bold: false }],
        };
      }
      const { sectionId, snippet } = findMatchingSection(entry, query);
      return {
        id: entry.id,
        title: entry.title,
        path: entry.path,
        subcategoryName: entry.subcategoryName,
        sectionId,
        snippet,
      };
    });

    const groupMap = new Map<string, ProcessedResult[]>();
    for (const item of processed) {
      const key = item.subcategoryName || "Autre";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(item);
    }

    return [...groupMap.entries()].map(([key, items]) => ({
      key,
      subcategoryName: key,
      items,
    }));
  }, [results, query]);

  const totalResults = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-2xl max-h-[80vh] flex flex-col gap-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Rechercher</DialogTitle>
        <Command shouldFilter={false} className="flex flex-col h-full">
          {/* Input row */}
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={handleSearch}
              placeholder="Rechercher dans les fiches..."
              className="pr-8"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-sm opacity-50 hover:opacity-100 cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Result count */}
          {query && totalResults > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
              {totalResults} résultat{totalResults > 1 ? "s" : ""} pour{" "}
              <span className="font-medium text-foreground">{query}</span>
            </div>
          )}

          {/* Results */}
          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            {query && totalResults === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucun résultat.
              </div>
            )}

            {groups.map((group) => (
              <div
                key={group.key}
                className="mb-2 rounded-lg border bg-card overflow-hidden"
              >
                {/* Subcategory header */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm">
                    {group.subcategoryName}
                  </span>
                </div>

                {/* Page results */}
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="!px-0 !py-0 !rounded-none data-[selected=true]:!bg-accent/50"
                  >
                    <div className="w-full py-2.5 px-3 ml-3 border-l-2 border-muted">
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {item.snippet.map((part, i) =>
                          part.bold ? (
                            <strong
                              key={i}
                              className="text-foreground font-semibold"
                            >
                              {part.text}
                            </strong>
                          ) : (
                            <span key={i}>{part.text}</span>
                          ),
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </div>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
