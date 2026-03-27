import type {
  ContentIndex,
  ContentPageMeta,
  ExamCode,
  EvidencePointer,
  FichesData,
  QuestionBankItem,
} from "@/types/index.ts";

export interface QuestionStudyLink {
  key: string;
  label: string;
  to: string;
}

export function contentPageLink(page: ContentPageMeta, sectionId?: string): string {
  const parts = page.path.replace(/\.md$/, "").split("/");
  const route = `/study/${parts.join("/")}`;
  return sectionId ? `${route}#${sectionId}` : route;
}

export function findContentPageByFicheId(
  contentIndex: ContentIndex | null,
  ficheId: string,
): ContentPageMeta | null {
  if (!contentIndex) return null;

  for (const theme of contentIndex.themes) {
    for (const subcategory of theme.subcategories) {
      for (const page of subcategory.pages || []) {
        if (page.originalFicheIds.includes(ficheId)) return page;
      }
      for (const group of subcategory.groups || []) {
        for (const page of group.pages) {
          if (page.originalFicheIds.includes(ficheId)) return page;
        }
      }
    }
  }

  return null;
}

export function findContentPageByPath(
  contentIndex: ContentIndex | null,
  contentPath: string,
): ContentPageMeta | null {
  if (!contentIndex) return null;

  for (const theme of contentIndex.themes) {
    for (const subcategory of theme.subcategories) {
      for (const page of subcategory.pages || []) {
        if (page.path === contentPath) return page;
      }
      for (const group of subcategory.groups || []) {
        for (const page of group.pages) {
          if (page.path === contentPath) return page;
        }
      }
    }
  }

  return null;
}

function collectQuestionEvidence(
  question: Pick<QuestionBankItem, "answerEvidence" | "questionEvidence">,
): EvidencePointer[] {
  const answerEvidence = (question.answerEvidence || []).flatMap((entry) => entry.evidence || []);
  return [...answerEvidence, ...(question.questionEvidence || [])];
}

export function getQuestionStudyLinks(
  question: Pick<QuestionBankItem, "relatedFicheIds" | "answerEvidence" | "questionEvidence">,
  contentIndex: ContentIndex | null,
  fichesData: FichesData | null,
): QuestionStudyLink[] {
  const ficheTitleById = new Map((fichesData?.fiches || []).map((fiche) => [fiche.id, fiche.title]));
  const evidencePointers = collectQuestionEvidence(question);
  const evidenceByFicheId = new Map<string, EvidencePointer>();
  const evidenceByPath = new Map<string, EvidencePointer>();
  const links: QuestionStudyLink[] = [];
  const linkByKey = new Map<string, QuestionStudyLink>();
  const seen = new Set<string>();

  for (const evidence of evidencePointers) {
    if (evidence.ficheId && !evidenceByFicheId.has(evidence.ficheId)) {
      evidenceByFicheId.set(evidence.ficheId, evidence);
    }
    if (evidence.contentPath && !evidenceByPath.has(evidence.contentPath)) {
      evidenceByPath.set(evidence.contentPath, evidence);
    }
  }

  function pushPage(page: ContentPageMeta, sectionId?: string) {
    const existing = linkByKey.get(page.path);
    const nextTo = contentPageLink(page, sectionId);

    if (existing) {
      if (sectionId && !existing.to.includes("#")) {
        existing.to = nextTo;
      }
      return;
    }

    const link = {
      key: page.path,
      label: page.title,
      to: nextTo,
    };

    linkByKey.set(page.path, link);
    seen.add(page.path);
    links.push(link);
  }

  function pushLegacyFiche(ficheId: string) {
    const key = `legacy:${ficheId}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      key,
      label: ficheTitleById.get(ficheId) || ficheId,
      to: `/study?fiche=${encodeURIComponent(ficheId)}`,
    });
  }

  for (const ficheId of question.relatedFicheIds || []) {
    const evidence = evidenceByFicheId.get(ficheId);
    const page = evidence?.contentPath
      ? findContentPageByPath(contentIndex, evidence.contentPath)
      : findContentPageByFicheId(contentIndex, ficheId);

    if (page) {
      pushPage(page, evidence?.sectionId);
    } else {
      pushLegacyFiche(ficheId);
    }
  }

  if (links.length === 0) {
    for (const evidence of evidenceByPath.values()) {
      const page = findContentPageByPath(contentIndex, evidence.contentPath);
      if (page) pushPage(page, evidence.sectionId);
    }
  }

  return links;
}

export function compareQuestionsForExam(
  a: QuestionBankItem,
  b: QuestionBankItem,
  exam: ExamCode,
): number {
  const aGlobal = a.sourceMetaByExam[exam]?.globalNumber ?? Number.MAX_SAFE_INTEGER;
  const bGlobal = b.sourceMetaByExam[exam]?.globalNumber ?? Number.MAX_SAFE_INTEGER;
  if (aGlobal !== bGlobal) return aGlobal - bGlobal;

  const aLocal = a.sourceMetaByExam[exam]?.localNumber ?? Number.MAX_SAFE_INTEGER;
  const bLocal = b.sourceMetaByExam[exam]?.localNumber ?? Number.MAX_SAFE_INTEGER;
  if (aLocal !== bLocal) return aLocal - bLocal;

  return a.id.localeCompare(b.id);
}

export function getLinkedQuestions(
  questionBank: QuestionBankItem[],
  exam: ExamCode,
  ficheIds: string[],
): QuestionBankItem[] {
  const ficheIdSet = new Set(ficheIds);

  return questionBank
    .filter(
      (question) =>
        question.exams.includes(exam) &&
        question.relatedFicheIds.some((ficheId) => ficheIdSet.has(ficheId)),
    )
    .sort((a, b) => compareQuestionsForExam(a, b, exam));
}
