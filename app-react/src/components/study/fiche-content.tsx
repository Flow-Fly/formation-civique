import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Check, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { generateHeadingId } from "@/hooks/use-fiche-content.ts";
import type { Frontmatter } from "@/hooks/use-fiche-content.ts";
import { useExam } from "@/context/exam-context.tsx";
import * as storage from "@/services/storage.ts";

interface FicheContentProps {
  frontmatter: Frontmatter;
  body: string;
  slug: string;
  showMarkAsRead?: boolean;
  className?: string;
}

export function FicheContent({
  frontmatter,
  body,
  slug,
  showMarkAsRead = true,
  className,
}: FicheContentProps) {
  const { activeExam } = useExam();
  const [markedRead, setMarkedRead] = useState(false);

  useEffect(() => {
    const read = storage.load<Record<string, number>>("fiches_read", {}, activeExam);
    setMarkedRead(`content:${slug}` in read);
  }, [slug, activeExam]);

  function handleMarkRead() {
    const read = storage.load<Record<string, number>>("fiches_read", {}, activeExam);
    for (const ficheId of frontmatter.originalFicheIds) {
      read[ficheId] = Date.now();
    }
    read[`content:${slug}`] = Date.now();
    storage.save("fiches_read", read, activeExam);
    setMarkedRead(true);
  }

  return (
    <div className={className}>
      {frontmatter.objectives.length > 0 && (
        <div className="bg-accent p-4 rounded-lg border-l-4 border-l-primary mb-4">
          <strong className="text-sm flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-primary" />
            Objectifs :
          </strong>
          <ul className="mt-1 pl-6 list-disc space-y-1">
            {frontmatter.objectives.map((o, i) => (
              <li key={i} className="text-sm">
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children, ...props }) => {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h2 id={id} {...props}>
                  {children}
                </h2>
              );
            },
            h3: ({ children, ...props }) => {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h3 id={id} {...props}>
                  {children}
                </h3>
              );
            },
            img: ({ src, alt, ...props }) => {
              const resolvedSrc = src?.startsWith("/")
                ? `${import.meta.env.BASE_URL}${src.slice(1)}`
                : src;
              return (
                <img
                  src={resolvedSrc}
                  alt={alt || ""}
                  className="rounded-lg max-w-full h-auto"
                  loading="lazy"
                  {...props}
                />
              );
            },
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            ),
          }}
        >
          {body}
        </ReactMarkdown>
      </div>

      {showMarkAsRead && (
        <Button
          size="sm"
          variant={markedRead ? "default" : "outline"}
          onClick={handleMarkRead}
          disabled={markedRead}
          className={`active-scale mt-4 ${
            markedRead ? "bg-dsfr-success hover:bg-dsfr-success" : ""
          }`}
        >
          {markedRead ? (
            <>
              <Check className="w-4 h-4 mr-1" /> Lu !
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4 mr-1" /> Marquer comme lu
            </>
          )}
        </Button>
      )}
    </div>
  );
}
