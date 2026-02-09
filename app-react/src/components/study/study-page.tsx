import { useSearchParams } from "react-router-dom";
import { useData } from "@/context/data-context.tsx";
import { ThemeBrowser } from "./theme-browser.tsx";
import { FicheReader } from "./fiche-reader.tsx";

export function StudyPage() {
  const { fichesData, questions, loading } = useData();
  const [searchParams] = useSearchParams();
  const ficheId = searchParams.get("fiche");

  if (loading || !fichesData) {
    return <div className="text-center py-16 text-muted-foreground">Chargement des fiches...</div>;
  }

  if (ficheId) {
    return <FicheReader ficheId={ficheId} fichesData={fichesData} questions={questions} />;
  }

  return <ThemeBrowser fichesData={fichesData} />;
}
