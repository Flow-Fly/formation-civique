import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

export const QUESTION_PROFILES = [
  "yes_no",
  "date_year",
  "number_unit",
  "website",
  "person",
  "place",
  "institution",
  "definition",
  "quote",
];

export const REVIEW_BUCKETS = ["high_confidence", "manual_review_required"];

export const VALID_QUALITY_FLAGS = new Set([
  "missing_correct_evidence",
  "weak_distractors",
  "placeholder_answer",
  "manual_review_required",
]);

const BASE_STOP_WORDS = new Set([
  "a",
  "afin",
  "ainsi",
  "alors",
  "apres",
  "au",
  "aucun",
  "aussi",
  "autre",
  "autres",
  "aux",
  "avec",
  "avoir",
  "bien",
  "car",
  "ce",
  "cela",
  "celle",
  "celles",
  "celui",
  "cependant",
  "ces",
  "cet",
  "cette",
  "chaque",
  "comme",
  "comment",
  "concernant",
  "contre",
  "dans",
  "de",
  "deja",
  "des",
  "doit",
  "donc",
  "du",
  "elle",
  "elles",
  "entre",
  "est",
  "et",
  "etre",
  "faut",
  "fois",
  "font",
  "ici",
  "il",
  "ils",
  "je",
  "la",
  "laquelle",
  "le",
  "lequel",
  "les",
  "leur",
  "leurs",
  "lorsque",
  "mais",
  "meme",
  "mes",
  "moins",
  "mon",
  "ne",
  "ni",
  "non",
  "notre",
  "nos",
  "on",
  "ont",
  "ou",
  "par",
  "parmi",
  "pas",
  "peut",
  "peuvent",
  "plus",
  "pour",
  "pourquoi",
  "proposition",
  "propositions",
  "qu",
  "que",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "qui",
  "sa",
  "sans",
  "se",
  "selon",
  "ses",
  "si",
  "site",
  "sites",
  "son",
  "sont",
  "sous",
  "suivante",
  "suivantes",
  "sur",
  "ta",
  "te",
  "tes",
  "toi",
  "ton",
  "toute",
  "toutes",
  "tous",
  "un",
  "une",
  "votre",
  "vos",
]);

const CORPUS_NOISE = new Set([
  "correcte",
  "france",
  "francais",
  "francaise",
  "francaises",
  "francaises",
  "francaises",
  "internet",
  "peut",
  "personne",
  "propose",
  "republique",
  "reside",
  "residant",
  "toute",
]);

const PROFILE_PROMPT_RULES = {
  yes_no:
    "Formate les 4 choix comme des propositions commencant par « Oui, » ou « Non, » et garde le meme registre visible pour chaque option.",
  date_year:
    "Formate les 4 choix comme des annees ou des dates concises. N'ecris pas de phrase explicative dans les choix.",
  number_unit:
    "Formate les 4 choix comme des valeurs numeriques du meme type visible. Si une unite apparait, elle doit etre coherente sur les 4 choix.",
  website:
    "Formate les 4 choix comme des noms de sites ou domaines au meme format visible (par exemple service-public.fr).",
  person:
    "Formate les 4 choix comme des noms de personnes ou figures historiques du meme type visible.",
  place:
    "Formate les 4 choix comme des lieux geographiques du meme type visible (ville, pays, region, ile, mer, montagne, etc.).",
  institution:
    "Formate les 4 choix comme des institutions, fonctions ou autorites du meme type visible.",
  definition:
    "Formate les 4 choix comme des definitions courtes ou des enonces du meme registre grammatical.",
  quote:
    "Formate les 4 choix comme des citations ou fragments a completer du meme format visible.",
};

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\w\s.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupe(values) {
  const out = [];
  const seen = new Set();
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

export function countTokens(text) {
  return normalize(text).split(" ").filter(Boolean).length;
}

export function hasPlaceholderPattern(text) {
  const n = normalize(text);
  return (
    n.includes("proposition incorrecte") ||
    n.includes("distracteur") ||
    n.includes("reponse a completer") ||
    n.includes("aucune de ces reponses")
  );
}

export function hasPlaceholderInOptions(correct, distractors) {
  return [...(correct || []), ...(distractors || [])].some((value) => hasPlaceholderPattern(value));
}

export function isDomainLike(text) {
  return /[a-z0-9-]+\.(fr|gouv\.fr|eu|org|com)\b/i.test(String(text || "").trim());
}

export function isYearLike(text) {
  return /\b(1[0-9]{3}|20[0-9]{2}|2100)\b/.test(String(text || "").trim());
}

export function isDateLike(text) {
  const raw = String(text || "").trim();
  return (
    isYearLike(raw) ||
    /\b\d{1,2}\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/i.test(raw)
  );
}

export function isNumberUnitLike(text) {
  return /^\s*\d+([ ,./-]\d+)?(\s*[a-zA-Z%€]+.*)?$/.test(String(text || "").trim());
}

export function isQuotedLike(text) {
  const raw = String(text || "").trim();
  return /^["«].+["»]$/.test(raw) || raw.includes("...") || raw.includes("[…]") || raw.includes("[...]");
}

function tokenize(text, extraStopWords = new Set()) {
  const stopWords = new Set([...BASE_STOP_WORDS, ...extraStopWords]);
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function extractKeywords(text, extraStopWords = new Set()) {
  return [...new Set(tokenize(text, extraStopWords))];
}

function extractBigramsFromTokens(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return [...new Set(bigrams)];
}

export function classifyQuestionProfile(questionText) {
  const n = normalize(questionText);

  if (
    n.startsWith("completez") ||
    n.includes("paroles de la marseillaise") ||
    n.includes("aux armes") ||
    n.includes("allons enfants") ||
    n.includes("\"") ||
    n.includes("«")
  ) {
    return "quote";
  }

  if (n.includes("site internet") || n.includes(".fr") || n.includes("site officiel")) {
    return "website";
  }

  if (
    n.startsWith("peut on") ||
    n.startsWith("est ce que") ||
    n.startsWith("a t on") ||
    n.startsWith("faut il") ||
    n.startsWith("une personne peut elle") ||
    n.startsWith("est il") ||
    n.startsWith("la laicite impose t elle")
  ) {
    return "yes_no";
  }

  if (
    n.includes("en quelle annee") ||
    n.includes("de quand date") ||
    n.includes("depuis quand") ||
    n.includes("quand a eu lieu") ||
    n.includes("quand est celebree") ||
    n.includes("quel jour")
  ) {
    return "date_year";
  }

  if (
    n.includes("combien") ||
    n.includes("quelle est la population") ||
    n.includes("a quel age") ||
    n.includes("quelle est la duree") ||
    n.includes("a quelle frequence")
  ) {
    return "number_unit";
  }

  if (
    n.startsWith("qui est") ||
    n.startsWith("qui etait") ||
    n.startsWith("qui a") ||
    n.startsWith("quel roi") ||
    n.startsWith("quel president") ||
    n.startsWith("quel peintre") ||
    n.startsWith("quel ecrivain")
  ) {
    return "person";
  }

  if (
    n.startsWith("ou") ||
    n.includes("dans quelle ville") ||
    n.includes("dans quelle region") ||
    n.includes("quel pays") ||
    n.includes("quelle mer") ||
    n.includes("quel ocean") ||
    n.includes("quelle chaine de montagnes") ||
    n.includes("quelle ile")
  ) {
    return "place";
  }

  if (
    n.includes("qui nomme") ||
    n.includes("qui dirige") ||
    n.includes("quel est le role") ||
    n.includes("quelle institution") ||
    n.includes("qui vote les lois") ||
    n.includes("qui sanctionne")
  ) {
    return "institution";
  }

  return "definition";
}

function matchesProfile(profile, text) {
  const raw = String(text || "").trim();

  if (!raw) return false;

  if (profile === "website") return isDomainLike(raw);
  if (profile === "date_year") return isDateLike(raw);
  if (profile === "number_unit") return isNumberUnitLike(raw);
  if (profile === "quote") return isQuotedLike(raw);
  if (profile === "yes_no") return /^(oui|non)\b/i.test(raw);
  return true;
}

function strictProfileCheck(profile) {
  return ["website", "date_year", "number_unit", "quote", "yes_no"].includes(profile);
}

export function buildStyleMetrics(questionProfile, correct, distractors) {
  const correctText = String((correct || [])[0] || "");
  const distractorTexts = (distractors || []).map((value) => String(value || ""));
  const correctCharLength = correctText.length;
  const distractorCharLengths = distractorTexts.map((value) => value.length);
  const correctTokenLength = countTokens(correctText);
  const distractorTokenLengths = distractorTexts.map((value) => countTokens(value));
  const avgDistractorCharLength =
    distractorCharLengths.length > 0
      ? distractorCharLengths.reduce((sum, value) => sum + value, 0) / distractorCharLengths.length
      : 0;
  const avgDistractorTokenLength =
    distractorTokenLengths.length > 0
      ? distractorTokenLengths.reduce((sum, value) => sum + value, 0) / distractorTokenLengths.length
      : 0;
  const charLengthRatio = avgDistractorCharLength > 0 ? correctCharLength / avgDistractorCharLength : 0;
  const tokenLengthRatio = avgDistractorTokenLength > 0 ? correctTokenLength / avgDistractorTokenLength : 0;

  const allChoices = [correctText, ...distractorTexts];
  const profileMatchResults = allChoices.map((choice) => matchesProfile(questionProfile, choice));
  const mismatchedOptions = allChoices.filter((_, index) => !profileMatchResults[index]);

  return {
    questionProfile,
    correctCharLength,
    distractorCharLengths,
    correctTokenLength,
    distractorTokenLengths,
    charLengthRatio,
    tokenLengthRatio,
    obviousLengthCue:
      charLengthRatio > 1.6 ||
      charLengthRatio < 0.65 ||
      tokenLengthRatio > 1.7 ||
      tokenLengthRatio < 0.65,
    strictProfileCheck: strictProfileCheck(questionProfile),
    profileMatchCount: profileMatchResults.filter(Boolean).length,
    optionCount: allChoices.length,
    mismatchedOptions,
  };
}

export function buildReviewBucket({
  correct,
  distractors,
  qualityFlags,
  answerEvidence,
  questionEvidence,
  exactQuotesOnly,
  candidateFicheIds,
  relatedFicheIds,
  styleMetrics,
  extraReasons = [],
}) {
  const reasons = [...extraReasons];
  const correctCount = Array.isArray(correct) ? correct.length : 0;
  const distractorCount = Array.isArray(distractors) ? distractors.length : 0;
  const relatedSet = new Set((candidateFicheIds || []).map((value) => String(value || "").trim()).filter(Boolean));

  if (correctCount !== 1) reasons.push("must_have_exactly_one_correct_answer");
  if (distractorCount !== 3) reasons.push("must_have_exactly_three_distractors");

  const normalizedCorrect = new Set((correct || []).map((value) => normalize(value)));
  if ((distractors || []).some((value) => normalizedCorrect.has(normalize(value)))) {
    reasons.push("correct_distractor_overlap");
  }

  if (hasPlaceholderInOptions(correct, distractors)) reasons.push("placeholder_option_detected");
  if ((qualityFlags || []).includes("placeholder_answer")) reasons.push("placeholder_flag_present");

  const correctEvidenceRows = Array.isArray(answerEvidence) ? answerEvidence : [];
  if (
    correctEvidenceRows.length !== 1 ||
    !Array.isArray(correctEvidenceRows[0]?.evidence) ||
    correctEvidenceRows[0].evidence.length === 0
  ) {
    reasons.push("missing_required_correct_evidence");
  }

  if (!Array.isArray(questionEvidence) || questionEvidence.length === 0) {
    reasons.push("missing_question_evidence");
  }

  if (!exactQuotesOnly) reasons.push("non_exact_quote_match");

  if (relatedSet.size > 0) {
    const allReferencedFicheIds = dedupe([
      ...((relatedFicheIds || []).map((value) => String(value || "").trim())),
      ...(correctEvidenceRows.flatMap((entry) => (entry.evidence || []).map((ev) => ev.ficheId))),
      ...((questionEvidence || []).map((ev) => ev.ficheId)),
    ]).filter(Boolean);

    if (allReferencedFicheIds.some((ficheId) => !relatedSet.has(ficheId))) {
      reasons.push("evidence_outside_shortlist");
    }
  }

  if (styleMetrics?.obviousLengthCue) reasons.push("obvious_length_cue");
  if (
    styleMetrics?.strictProfileCheck &&
    styleMetrics.profileMatchCount < styleMetrics.optionCount
  ) {
    reasons.push("visible_type_mismatch");
  }

  const dedupedReasons = dedupe(reasons);
  return {
    reviewBucket: dedupedReasons.length === 0 ? "high_confidence" : "manual_review_required",
    reviewReasons: dedupedReasons,
  };
}

function buildFicheMetaMap(indexJson) {
  const ficheMeta = new Map();
  for (const theme of indexJson?.themes || []) {
    for (const subcategory of theme.subcategories || []) {
      for (const fiche of subcategory.fiches || []) {
        ficheMeta.set(fiche.id, {
          themeName: theme.name,
          subcategoryName: subcategory.name,
          ficheTitle: fiche.title,
        });
      }
    }
  }
  return ficheMeta;
}

export function loadAllFiches(rootDir) {
  const fichesDir = join(rootDir, "data-init", "fiches");
  const indexJson = JSON.parse(readFileSync(join(fichesDir, "index.json"), "utf-8"));
  const ficheMetaById = buildFicheMetaMap(indexJson);
  const fiches = [];

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith(".json") || entry === "index.json") continue;
      const parsed = JSON.parse(readFileSync(fullPath, "utf-8"));
      const meta = ficheMetaById.get(parsed.id) || {};
      fiches.push({
        ...parsed,
        themeName: parsed.themeName || meta.themeName || "",
        subcategoryName: meta.subcategoryName || "",
      });
    }
  }

  walk(fichesDir);
  return fiches;
}

export function buildFicheLinkIndex(fiches) {
  return (fiches || []).map((fiche) => {
    const contentText = [
      fiche.title,
      fiche.themeName,
      fiche.subcategoryName,
      ...(fiche.objectives || []),
      ...(fiche.sections || []).map((section) => `${section.heading || ""} ${section.content || ""}`),
    ].join(" ");
    const titleKeywords = new Set(extractKeywords(fiche.title, CORPUS_NOISE));
    const themeKeywords = new Set(extractKeywords(fiche.themeName, CORPUS_NOISE));
    const subcategoryKeywords = new Set(extractKeywords(fiche.subcategoryName, CORPUS_NOISE));
    const objectiveKeywords = new Set(extractKeywords((fiche.objectives || []).join(" "), CORPUS_NOISE));
    const headingKeywords = new Set(
      extractKeywords((fiche.sections || []).map((section) => section.heading || "").join(" "), CORPUS_NOISE),
    );
    const contentKeywords = new Set(extractKeywords(contentText, CORPUS_NOISE));
    const combinedKeywords = dedupe([
      ...titleKeywords,
      ...themeKeywords,
      ...subcategoryKeywords,
      ...objectiveKeywords,
      ...headingKeywords,
      ...contentKeywords,
    ]);

    return {
      ficheId: fiche.id,
      title: fiche.title,
      themeId: fiche.themeId,
      themeName: fiche.themeName || "",
      subcategoryName: fiche.subcategoryName || "",
      titleKeywords,
      themeKeywords,
      subcategoryKeywords,
      objectiveKeywords,
      headingKeywords,
      contentKeywords,
      normalizedText: normalize(contentText),
      normalizedTitle: normalize(fiche.title),
      normalizedSubcategoryName: normalize(fiche.subcategoryName),
      keywordPreview: combinedKeywords.slice(0, 24),
    };
  });
}

function buildCandidateReasons(matches) {
  return matches
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 6)
    .map((match) => `${match.label} (+${match.score})`);
}

export function scoreQuestionToFicheCandidates(question, ficheLinkIndex, limit = 3) {
  const questionProfile = classifyQuestionProfile(question.questionText);
  const keywords = extractKeywords(question.questionText, CORPUS_NOISE);
  const bigrams = extractBigramsFromTokens(keywords);

  const candidates = (ficheLinkIndex || [])
    .map((fiche) => {
      let score = 0;
      const matches = [];

      if (fiche.themeId === question.themeId) {
        score += 30;
        matches.push({ label: "same theme", score: 30 });
      }

      for (const keyword of keywords) {
        if (fiche.titleKeywords.has(keyword)) {
          score += 15;
          matches.push({ label: `title:${keyword}`, score: 15 });
        }
        if (fiche.subcategoryKeywords.has(keyword)) {
          score += 11;
          matches.push({ label: `subcategory:${keyword}`, score: 11 });
        }
        if (fiche.objectiveKeywords.has(keyword)) {
          score += 7;
          matches.push({ label: `objective:${keyword}`, score: 7 });
        }
        if (fiche.headingKeywords.has(keyword)) {
          score += 6;
          matches.push({ label: `heading:${keyword}`, score: 6 });
        }
        if (fiche.contentKeywords.has(keyword)) {
          score += 2;
          matches.push({ label: `content:${keyword}`, score: 2 });
        }
      }

      for (const bigram of bigrams) {
        if (fiche.normalizedTitle.includes(bigram)) {
          score += 18;
          matches.push({ label: `title-bigram:${bigram}`, score: 18 });
        } else if (fiche.normalizedSubcategoryName.includes(bigram)) {
          score += 12;
          matches.push({ label: `subcategory-bigram:${bigram}`, score: 12 });
        } else if (fiche.normalizedText.includes(bigram)) {
          score += 6;
          matches.push({ label: `content-bigram:${bigram}`, score: 6 });
        }
      }

      if (questionProfile === "website" && fiche.normalizedText.includes("site internet")) {
        score += 2;
        matches.push({ label: "website cue", score: 2 });
      }

      return {
        ficheId: fiche.ficheId,
        title: fiche.title,
        themeId: fiche.themeId,
        themeName: fiche.themeName,
        subcategoryName: fiche.subcategoryName,
        score,
        questionProfile,
        matchedTerms: dedupe(
          matches
            .map((match) => match.label.split(":")[1] || "")
            .filter(Boolean),
        ),
        reasons: buildCandidateReasons(matches),
      };
    })
    .sort((left, right) => right.score - left.score || left.ficheId.localeCompare(right.ficheId));

  return candidates.slice(0, limit);
}

export function pickQuestionFicheIds(question, candidateFicheIds = []) {
  const validated = dedupe(question.relatedFicheIds || []);
  if (validated.length > 0) return validated;
  return dedupe(candidateFicheIds || []);
}

export function scoreSectionsForQuestion(question, sectionIndex, ficheIds, limit = 10) {
  const selectedFicheIds = new Set((ficheIds || []).map((value) => String(value || "").trim()).filter(Boolean));
  if (selectedFicheIds.size === 0) return [];

  const questionProfile = classifyQuestionProfile(question.questionText);
  const questionKeywords = extractKeywords(question.questionText, CORPUS_NOISE);
  const keywordSet = new Set(questionKeywords);
  const bigrams = extractBigramsFromTokens(questionKeywords);

  const scored = [];

  for (const section of sectionIndex.sections || []) {
    const sectionFicheIds = Array.isArray(section.originalFicheIds) ? section.originalFicheIds : [];
    if (!sectionFicheIds.some((ficheId) => selectedFicheIds.has(ficheId))) continue;

    let score = 0;

    if (section.themeId === question.themeId) score += 12;

    const terms = new Set(section.terms || []);
    for (const keyword of keywordSet) {
      if (terms.has(keyword)) score += 6;
    }

    const normalizedSectionText = normalize(`${section.sectionTitle || ""} ${section.sectionText || ""}`);
    for (const bigram of bigrams) {
      if (normalizedSectionText.includes(bigram)) score += 7;
    }

    if (questionProfile === "website" && normalizedSectionText.includes("site internet")) score += 4;
    if (questionProfile === "date_year" && /\b(1[0-9]{3}|20[0-9]{2})\b/.test(normalizedSectionText)) score += 3;
    if (questionProfile === "quote" && normalizedSectionText.includes("marseillaise")) score += 3;

    if (score === 0) continue;

    scored.push({
      ...section,
      score,
    });
  }

  return scored
    .sort((left, right) => right.score - left.score || String(left.sectionId).localeCompare(String(right.sectionId)))
    .slice(0, limit);
}

export function buildAnswerSuggestionPrompt({
  question,
  questionProfile,
  sections,
  candidateFicheIds,
  styleExamples,
}) {
  return [
    "Tu es un redacteur expert de QCM de formation civique.",
    "Travaille uniquement avec les sections fournies. N'invente rien hors des fiches candidates.",
    "",
    "Objectif:",
    "- produire exactement 1 bonne reponse et exactement 3 distracteurs plausibles",
    "- ancrer la bonne reponse avec une evidence section-level",
    "- fournir une questionEvidence qui montre que le sujet est bien traite par les fiches candidates",
    "- rester dans un format de choix homogène et sans indice de longueur",
    "",
    "Contraintes globales:",
    "- Retourne un objet JSON valide, sans markdown.",
    "- correct doit contenir exactement 1 entree.",
    "- distractors doit contenir exactement 3 entrees et aucune ne doit recouvrir la bonne reponse.",
    "- relatedFicheIds ne doit contenir que des IDs presents dans candidateFicheIds.",
    "- answerEvidence doit contenir exactement 1 ligne pour la bonne reponse et au moins 1 evidence.",
    "- questionEvidence doit contenir au moins 1 evidence.",
    "- Chaque quote doit etre une citation exacte issue d'une section fournie.",
    "- N'utilise aucun placeholder.",
    "- Les 4 choix doivent etre du meme type visible.",
    `- Profil de question a respecter: ${questionProfile}.`,
    `- Regle de profil: ${PROFILE_PROMPT_RULES[questionProfile] || PROFILE_PROMPT_RULES.definition}`,
    "",
    "Format JSON attendu:",
    JSON.stringify({
      questionProfile,
      candidateFicheIds,
      correct: ["string"],
      distractors: ["string", "string", "string"],
      explanationByCorrect: { "<correct-answer>": "explication concise" },
      answerEvidence: [
        {
          answerText: "string",
          normalizedAnswer: "string-normalise",
          evidence: [
            {
              ficheId: "string",
              contentPath: "theme/subcategory/page.md",
              sectionId: "section-id",
              sectionTitle: "Titre section",
              quote: "citation exacte",
            },
          ],
        },
      ],
      questionEvidence: [
        {
          ficheId: "string",
          contentPath: "theme/subcategory/page.md",
          sectionId: "section-id",
          sectionTitle: "Titre section",
          quote: "citation exacte",
        },
      ],
      relatedFicheIds: candidateFicheIds,
      qualityFlags: [],
    }, null, 2),
    "",
    "Question:",
    JSON.stringify(
      {
        id: question.id,
        themeId: question.themeId,
        themeName: question.themeName,
        exams: question.exams || [],
        questionText: question.questionText,
        questionProfile,
        candidateFicheIds,
      },
      null,
      2,
    ),
    "",
    "Exemples de style deja valides:",
    JSON.stringify(styleExamples || [], null, 2),
    "",
    "Sections autorisees:",
    JSON.stringify(
      (sections || []).map((section) => ({
        ficheIds: section.originalFicheIds || [],
        contentPath: section.contentPath,
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
        sectionText: String(section.sectionText || "").slice(0, 1200),
      })),
      null,
      2,
    ),
  ].join("\n");
}

export function selectReviewedStyleExamples(question, questionBank, limit = 3) {
  const targetProfile = classifyQuestionProfile(question.questionText);

  return (questionBank || [])
    .filter((item) => item.id !== question.id && item.reviewStatus === "reviewed")
    .map((item) => ({
      item,
      profile: classifyQuestionProfile(item.questionText),
    }))
    .sort((left, right) => {
      const leftScore =
        (left.profile === targetProfile ? 6 : 0) +
        (left.item.themeId === question.themeId ? 4 : 0) +
        ((left.item.exams || []).includes("CR") ? 2 : 0);
      const rightScore =
        (right.profile === targetProfile ? 6 : 0) +
        (right.item.themeId === question.themeId ? 4 : 0) +
        ((right.item.exams || []).includes("CR") ? 2 : 0);
      return rightScore - leftScore || left.item.id.localeCompare(right.item.id);
    })
    .slice(0, limit)
    .map(({ item, profile }) => ({
      id: item.id,
      questionProfile: profile,
      questionText: item.questionText,
      correct: (item.answerPools?.correct || []).slice(0, 1),
      distractors: (item.answerPools?.distractors || []).slice(0, 3),
    }));
}
