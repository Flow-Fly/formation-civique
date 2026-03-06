import type {
  Choice,
  Difficulty,
  ExamCode,
  EvidencePointer,
  QuestionBankItem,
  QuestionInstance,
} from "@/types/index.ts";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values || []) {
    const txt = String(value || "").trim();
    if (!txt) continue;
    const key = normalize(txt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(txt);
  }

  return out;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pickOne<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getExplanation(item: QuestionBankItem, correctText: string): string {
  if (item.explanationByCorrect?.[correctText]) return item.explanationByCorrect[correctText];
  if (item.explanationTemplate) {
    return item.explanationTemplate.replace(/\{\{\s*correct\s*\}\}/g, correctText);
  }
  return `La bonne réponse est : ${correctText}.`;
}

function getDifficulty(item: QuestionBankItem, exam: ExamCode): Difficulty {
  return (item.difficultyByExam?.[exam] as Difficulty) || "medium";
}

function getEvidenceForAnswer(item: QuestionBankItem, answerText: string): EvidencePointer[] {
  const rows = item.answerEvidence || [];
  const target = normalize(answerText);
  const row = rows.find(
    (entry) =>
      normalize(entry.answerText) === target ||
      normalize(entry.normalizedAnswer) === target,
  );
  return row?.evidence || [];
}

function ensureDistractors(
  distractors: string[],
  correctSet: Set<string>,
  themeId: string,
): string[] {
  const fallbackByTheme: Record<string, string[]> = {
    "principes-et-valeurs": ["Réponse incorrecte A", "Réponse incorrecte B", "Réponse incorrecte C", "Réponse incorrecte D"],
    "systeme-institutionnel": ["Institution incorrecte A", "Institution incorrecte B", "Institution incorrecte C", "Institution incorrecte D"],
    "droits-et-devoirs": ["Droit incorrect A", "Droit incorrect B", "Droit incorrect C", "Droit incorrect D"],
    "histoire-geographie-culture": ["Référence incorrecte A", "Référence incorrecte B", "Référence incorrecte C", "Référence incorrecte D"],
    "vivre-societe-francaise": ["Situation incorrecte A", "Situation incorrecte B", "Situation incorrecte C", "Situation incorrecte D"],
  };

  const out = [...distractors];
  const fallback = fallbackByTheme[themeId] || ["Distracteur A", "Distracteur B", "Distracteur C", "Distracteur D"];

  for (const candidate of fallback) {
    if (out.length >= 3) break;
    const key = normalize(candidate);
    if (correctSet.has(key)) continue;
    if (out.some((d) => normalize(d) === key)) continue;
    out.push(candidate);
  }

  while (out.length < 3) {
    out.push(`Distracteur ${out.length + 1}`);
  }

  return out;
}

export function isQuestionMaterializable(item: QuestionBankItem): boolean {
  const correct = dedupe(item.answerPools?.correct || []);
  const correctSet = new Set(correct.map((v) => normalize(v)));
  const distractors = dedupe(item.answerPools?.distractors || []).filter(
    (d) => !correctSet.has(normalize(d)),
  );
  return correct.length >= 1 && distractors.length >= 3;
}

export function materializeQuestion(
  item: QuestionBankItem,
  exam: ExamCode,
  seedInput: string,
): QuestionInstance {
  const seed = hashString(seedInput);
  const rng = createRng(seed);

  const correctPool = dedupe(item.answerPools?.correct || []);
  const correctSet = new Set(correctPool.map((v) => normalize(v)));

  const distractorPool = dedupe(item.answerPools?.distractors || []).filter(
    (d) => !correctSet.has(normalize(d)),
  );

  const safeCorrectPool = correctPool.length > 0
    ? correctPool
    : ["Réponse à compléter (source officielle non enrichie)"];

  const safeDistractorPool = ensureDistractors(distractorPool, correctSet, item.themeId);

  const correctText = pickOne(safeCorrectPool, rng);

  const distractorCandidates = shuffle(safeDistractorPool, rng).slice(0, 3);

  const allTexts = shuffle([correctText, ...distractorCandidates], rng);
  const choices: Choice[] = allTexts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
  const correctAnswer = choices.find((c) => normalize(c.text) === normalize(correctText))?.id || "a";

  const choiceEvidenceById: Record<string, EvidencePointer[]> = {};
  for (const choice of choices) {
    const evidence = getEvidenceForAnswer(item, choice.text);
    if (evidence.length > 0) {
      choiceEvidenceById[choice.id] = evidence;
    }
  }

  const correctEvidence = choiceEvidenceById[correctAnswer] || [];

  return {
    id: item.id,
    exam,
    questionText: item.questionText,
    choices,
    correctAnswer,
    correctText,
    explanation: getExplanation(item, correctText),
    themeId: item.themeId,
    themeName: item.themeName,
    relatedFicheIds: item.relatedFicheIds || [],
    choiceEvidenceById: Object.keys(choiceEvidenceById).length > 0 ? choiceEvidenceById : undefined,
    correctEvidence: correctEvidence.length > 0 ? correctEvidence : undefined,
    difficulty: getDifficulty(item, exam),
  };
}

export function materializeQuestions(
  items: QuestionBankItem[],
  exam: ExamCode,
  sessionSeed: string,
): QuestionInstance[] {
  return items.map((item, idx) => materializeQuestion(item, exam, `${sessionSeed}|${exam}|${item.id}|${idx}`));
}
