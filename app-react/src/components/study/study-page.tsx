import { useSearchParams } from "react-router-dom";
import { useData } from "@/context/data-context.tsx";
import { ThemeBrowser } from "./theme-browser.tsx";
import { FicheReader } from "./fiche-reader.tsx";

export function StudyPage() {
  const { fichesData, questionBank, loading } = useData();
  const [searchParams] = useSearchParams();
  const ficheId = searchParams.get("fiche");

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement des fiches...</div>;
  }

  // Legacy route: ?fiche=... still renders the old FicheReader
  if (ficheId && fichesData) {
    return <FicheReader ficheId={ficheId} fichesData={fichesData} questions={questionBank} />;
  }

  return <ThemeBrowser />;
}
