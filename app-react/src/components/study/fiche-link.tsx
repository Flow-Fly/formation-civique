import { Link } from "react-router-dom";
import { useData } from "@/context/data-context.tsx";
import type { Question } from "@/types/index.ts";

interface FicheLinkProps {
  question: Question;
}

export function FicheLink({ question }: FicheLinkProps) {
  const { fichesData } = useData();
  const ids = question.relatedFicheIds;
  if (!ids || ids.length === 0 || !fichesData) return null;

  const fiche = fichesData.fiches.find((f) => f.id === ids[0]);
  if (!fiche) return null;

  return (
    <p className="mt-2 text-sm">
      <Link to={`/study?fiche=${encodeURIComponent(fiche.id)}`} className="text-primary hover:underline">
        Fiche : {fiche.title} &rarr;
      </Link>
    </p>
  );
}
