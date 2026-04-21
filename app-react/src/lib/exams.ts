import type { ExamCode } from "@/types/index.ts";

export interface ExamMeta {
  code: ExamCode;
  shortLabel: string;
  label: string;
  description: string;
  audience: string;
  firstStep: string;
}

const EXAM_META: Record<ExamCode, ExamMeta> = {
  NAT: {
    code: "NAT",
    shortLabel: "Naturalisation",
    label: "Naturalisation (NAT)",
    description: "Questions, fiches et quiz pour preparer la naturalisation.",
    audience: "Ce parcours est utile si vous preparez la naturalisation.",
    firstStep: "Commencez par lire quelques fiches, puis verifiez vos acquis avec un quiz rapide.",
  },
  CSP: {
    code: "CSP",
    shortLabel: "Contrat de sejour pluriannuel",
    label: "Contrat de sejour pluriannuel (CSP)",
    description: "Questions, fiches et quiz pour le contrat de sejour pluriannuel.",
    audience: "Ce parcours est utile si vous preparez le contrat de sejour pluriannuel.",
    firstStep: "Commencez par les fiches, puis lancez un quiz d'entrainement sur les themes a consolider.",
  },
  CR: {
    code: "CR",
    shortLabel: "Carte de resident",
    label: "Carte de resident (CR)",
    description: "Questions, fiches et quiz pour la carte de resident.",
    audience: "Ce parcours est utile si vous preparez la carte de resident.",
    firstStep: "Commencez par les fiches, puis revenez sur les questions et cartes a reviser.",
  },
};

export const EXAM_OPTIONS = (["CSP", "CR", "NAT"] as ExamCode[]).map((code) => EXAM_META[code]);

export function getExamMeta(exam: ExamCode): ExamMeta {
  return EXAM_META[exam];
}
