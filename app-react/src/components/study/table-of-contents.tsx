import { useEffect, useState } from "react";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  markdown: string;
}

function extractHeadings(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, "").trim();
      const id = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      entries.push({ id, text, level });
    }
  }
  return entries;
}

export function TableOfContents({ markdown }: TableOfContentsProps) {
  const headings = extractHeadings(markdown);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Sur cette page
      </p>
      <ul className="space-y-1 text-sm border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(h.id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`block py-1 transition-colors text-left w-full cursor-pointer ${
                h.level === 3 ? "pl-6" : "pl-3"
              } ${
                activeId === h.id
                  ? "text-primary border-l-2 border-primary -ml-px font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
