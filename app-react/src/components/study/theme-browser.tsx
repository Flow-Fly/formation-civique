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
import type { FichesData } from "@/types/index.ts";
import * as storage from "@/services/storage.ts";

const dotColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

interface ThemeBrowserProps {
  fichesData: FichesData;
}

export function ThemeBrowser({ fichesData }: ThemeBrowserProps) {
  const readFiches = storage.load<Record<string, number>>("fiches_read", {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fiches d'etude</h1>
      <Card className="p-0 overflow-hidden">
        <Accordion type="multiple">
          {fichesData.index.themes.map((theme, i) => (
            <AccordionItem key={theme.id} value={theme.id}>
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                  <strong>{theme.name}</strong>
                  <Badge variant="secondary" className="ml-1">
                    {theme.subcategories.reduce((a, s) => a + s.fiches.length, 0)} fiches
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {theme.subcategories.map((subcat) => (
                  <div key={subcat.id}>
                    <h3 className="mt-3 mb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      {subcat.name}
                    </h3>
                    {subcat.fiches.map((f) => (
                      <Link
                        key={f.id}
                        to={`/study?fiche=${encodeURIComponent(f.id)}`}
                        className="flex items-center justify-between py-2 px-3 -mx-1 rounded hover:bg-accent hover:translate-x-0.5 no-underline text-foreground border-b border-border last:border-b-0 transition-all"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          {f.title}
                          {readFiches[f.id] && (
                            <Badge variant="outline" className="text-dsfr-success border-dsfr-success">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Lu
                            </Badge>
                          )}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
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
