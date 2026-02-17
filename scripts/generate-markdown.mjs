#!/usr/bin/env node

/**
 * Generate Markdown files from cached HTML fiche pages.
 *
 * - Reads cached HTML from .cache/html/
 * - Converts content to markdown with Turndown
 * - Rewrites S3 image URLs to local /images/fiches/{filename}
 * - Merges grouped fiches into single pages with --- separators
 * - Outputs .md files with YAML frontmatter to app-react/public/content/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "cheerio";
import TurndownService from "turndown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, ".cache", "html");
const INDEX_PATH = join(ROOT, "data-init", "fiches", "index.json");
const CONTENT_DIR = join(ROOT, "app-react", "public", "content");

const BASE_URL = "https://formation-civique.interieur.gouv.fr";

// ─── Group definitions for large subcategories ──────────────────────

const GROUP_DEFINITIONS = {
  "histoire-geographie-culture": {
    culture: [
      {
        id: "puissance-et-langue",
        name: "Puissance et langue",
        slugs: [
          "une-puissance-culturelle",
          "patrimoine-francais-la-langue-francaise-dans-le-monde",
        ],
      },
      {
        id: "sites-et-gastronomie",
        name: "Sites emblématiques et gastronomie",
        slugs: [
          "patrimoine-francais-sites-emblematiques-et-gastronomie",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-d-auvergne-rhone-alpes",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-bourgogne-franche-comte",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-bretagne",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-dans-le-centre-val-de-loire",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-corse",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-du-grand-est",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-des-hauts-de-france",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-d-ile-de-france",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-normandie",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-nouvelle-aquitaine",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-d-occitanie",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-des-pays-de-la-loire",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-provence-alpes-cote-azur",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-guadeloupe",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-martinique",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-guyane",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-la-reunion",
          "patrimoine-francais-sites-emblematiques-et-gastronomie-de-mayotte",
        ],
      },
      {
        id: "artistes-emblematiques",
        name: "Artistes emblématiques",
        slugs: [
          "patrimoine-francais-artistes-emblematiques-parmi-les-auteurs-1",
          "patrimoine-francais-artistes-emblematiques-parmi-les-auteurs-2",
          "patrimoine-francais-artistes-emblematiques-parmi-les-auteurs-3",
          "patrimoine-francais-artistes-emblematiques-parmi-les-peintres",
          "patrimoine-francais-artistes-emblematiques-dans-univers-musique",
          "patrimoine-francais-artistes-emblematiques-parmi-les-sculpteurs",
          "patrimoine-francais-artistes-emblematiques-devenus-francais",
        ],
      },
      {
        id: "culture-et-citoyennete",
        name: "Culture et citoyenneté",
        slugs: [
          "patrimoine-francais-le-citoyen-acteur-et-conservateur-de-la-culture-en-france",
          "patrimoine-francais-acces-a-la-culture",
        ],
      },
    ],
    "les-regimes-politiques-depuis-1789": [
      {
        id: "avant-la-revolution",
        name: "Avant la Révolution",
        slugs: [
          "les-regimes-politiques",
          "des-merovingiens-a-l-ancien-regime",
          "l-ancien-regime-jusqu-en-1789",
        ],
      },
      {
        id: "revolution-au-xixe",
        name: "De la Révolution au XIXe siècle",
        slugs: [
          "la-fin-de-la-monarchie-absolue-et-le-debut-de-la-iere-republique-1789-1792",
          "la-premiere-republique-1792-1804",
          "le-consulat-1799-1804",
          "le-1er-empire-1804-1815",
          "la-restauration-et-la-monarchie-de-juillet-1815-1848",
          "la-deuxieme-republique-1848-1851",
          "le-2nd-empire-1852-1870",
        ],
      },
      {
        id: "xxe-siecle",
        name: "XXe siècle à nos jours",
        slugs: [
          "la-troisieme-republique-1870-1940",
          "le-regime-de-vichy-1940-1944",
          "le-gouvernement-provisoire-de-la-republique-francaise-1944-1946",
          "la-quatrieme-republique-1946-1958",
          "la-cinquieme-republique",
        ],
      },
    ],
    "les-regions-francaises": [
      {
        id: "metropole",
        name: "France métropolitaine",
        slugs: [
          "auvergne-rhone-alpes",
          "bourgogne-franche-comte",
          "bretagne",
          "centre-val-de-loire",
          "corse",
          "grand-est",
          "hauts-de-france",
          "ile-de-france",
          "normandie",
          "nouvelle-aquitaine",
          "occitanie",
          "pays-de-la-loire",
          "provence-alpes-cote-d-azur",
        ],
      },
      {
        id: "outre-mer",
        name: "Outre-mer",
        slugs: [
          "guadeloupe",
          "martinique",
          "guyane",
          "la-reunion",
          "mayotte",
        ],
      },
    ],
  },
  "vivre-societe-francaise": {
    emploi: [
      {
        id: "orientation",
        name: "Orientation",
        slugs: [
          "orientation-1",
          "orientation-2",
          "orientation-3",
          "orientation-4",
          "orientation-5",
        ],
      },
      {
        id: "formation",
        name: "Formation",
        slugs: ["formation-1", "formation-2", "formation-3"],
      },
      {
        id: "types-emploi",
        name: "Types d'emploi",
        slugs: ["types-emploi-1", "types-emploi-2", "types-emploi-3"],
      },
      {
        id: "recrutement",
        name: "Recrutement",
        slugs: ["recrutement-1", "recrutement-2", "recrutement-3"],
      },
      {
        id: "droit-du-travail",
        name: "Droit du travail",
        slugs: [
          "le-droit-au-travail-1",
          "le-droit-au-travail-2",
          "le-droit-au-travail-3",
          "le-droit-au-travail-4",
          "le-droit-au-travail-5",
        ],
      },
    ],
    sante: [
      {
        id: "acces-aux-soins",
        name: "Accès aux soins",
        slugs: [
          "acces-aux-soins-le-parcours-de-sante",
          "acces-aux-soins-le-medecin-generaliste",
          "acces-aux-soins-le-medecin-specialiste",
          "acces-aux-soins-les-structures-d-accueil-gratuites",
          "acces-aux-soins-services-et-numeros-d-urgence",
          "acces-aux-soins-les-medecins-et-pharmacies-de-garde",
        ],
      },
      {
        id: "prise-en-charge",
        name: "Prise en charge",
        slugs: [
          "la-prise-en-charge-les-differentes-couvertures-maladie",
          "sante-la-prise-en-charge-en-cas-de-enouvellement-du-titre-de-sejour",
          "sante-la-prise-en-charge-les-demarches-pour-etre-rembourse",
          "la-prise-en-charge-les-demarches-pour-acceder-a-la-protection-universelle-maladie",
          "sante-la-prise-en-charge-durant-la-maternite",
          "sante-les-droits-du-patient",
        ],
      },
      {
        id: "prevention",
        name: "Prévention",
        slugs: [
          "prevention-et-promotion-de-la-sante-1",
          "prevention-et-promotion-de-la-sante-2",
          "prevention-et-promotion-de-la-sante-la-sante-mentale",
        ],
      },
    ],
    "demarches-administratives": [
      {
        id: "quotidien",
        name: "Démarches du quotidien",
        slugs: [
          "les-demarches-du-quotidien-comme-la-domiciliation",
          "les-demarches-du-quotidien-comme-louverture-dun-compte-bancaire",
          "les-demarches-du-quotidien-comme-le-permis-de-conduire-1",
          "les-demarches-du-quotidien-comme-le-permis-de-conduire-2",
          "les-demarches-du-quotidien-comme-lassurance-responsabilite-civile",
        ],
      },
      {
        id: "etat-civil-et-nationalite",
        name: "État civil et nationalité",
        slugs: [
          "l-impot-en-france-et-la-declaration-de-revenus",
          "les-demarches-relatives-au-sejour-en-france",
          "les-demarches-dacces-a-la-nationalite-francaise",
          "la-declaration-de-naissance",
          "la-declaration-de-mariage",
          "la-declaration-de-deces",
        ],
      },
      {
        id: "logement-et-urgences",
        name: "Logement et urgences",
        slugs: [
          "les-demarches-relatives-au-logement-1",
          "les-demarches-relatives-au-logement-2",
          "annexe-les-numeros-durgence",
        ],
      },
    ],
  },
  "droits-et-devoirs": {
    "obligations-et-devoirs-des-personnes-residant-en-france": [
      {
        id: "cadre-legal",
        name: "Cadre légal",
        slugs: [
          "la-limite-des-libertes-individuelles",
          "se-conformer-aux-lois-les-infractions",
          "se-conformer-aux-lois-les-acteurs",
          "les-obligations-en-tant-que-resident-francais",
          "les-obligations-en-tant-que-citoyen-francais",
        ],
      },
      {
        id: "violences-et-protection",
        name: "Violences et protection",
        slugs: [
          "linterdiction-de-toutes-les-formes-de-violences",
          "l-interdiction-des-violences-faites-aux-enfants",
          "linterdiction-des-mutilations-sexuelles-f%C3%A9minines",
          "linterdiction-des-violences-sexuelles",
          "la-traite-des-etres-humains-et-la-prostitution",
          "la-protection-des-victimes-de-violences",
          "le-role-des-temoins-en-cas-de-violences",
          "obligations-et-devoirs-des-personnes-residants-en-france-adopter-une-attitude-respectueuse-vis-a-vis-de-environnement",
        ],
      },
    ],
  },
};

// ─── Turndown setup ─────────────────────────────────────────────────

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Custom rule: rewrite S3 image URLs to local paths
turndown.addRule("s3Images", {
  filter: "img",
  replacement: (_content, node) => {
    const src = node.getAttribute("src") || "";
    const alt = node.getAttribute("alt") || "";
    const localPath = rewriteImageUrl(src);
    if (!localPath) return "";
    return `![${alt}](${localPath})`;
  },
});

// Remove screen-reader-only spans
turndown.addRule("srOnly", {
  filter: (node) =>
    node.nodeName === "SPAN" &&
    node.getAttribute("class")?.includes("fr-sr-only"),
  replacement: () => "",
});

// ─── Image URL helpers ──────────────────────────────────────────────

function rewriteImageUrl(src) {
  // Extract filename from S3 URL like:
  // https://s3.eu-west-par.io.cloud.ovh.net/sf-fci/sf-fci/images/dignite-humaine.original.png?X-Amz-...
  const match = src.match(/\/images\/([^?]+)/);
  if (!match) return null;
  const filename = match[1]; // e.g. "dignite-humaine.original.png"
  return `/images/fiches/${filename}`;
}

// ─── HTML → Markdown conversion ─────────────────────────────────────

function htmlToMarkdown(htmlContent) {
  const $ = load(htmlContent);

  // Remove header, footer, breadcrumb, nav
  $("header, footer, nav, .fr-breadcrumb").remove();

  // Extract the main content blocks
  const blocks = [];

  // Get the page title
  const title = $("main h1").first().text().trim();

  // Extract objectives from the card block
  const objectives = [];
  $(".fr-card__content").each((_i, card) => {
    const cardTitle = $(card).find(".fr-card__title").text().trim();
    if (cardTitle.includes("Objectifs")) {
      $(card)
        .find(".fr-card__desc")
        .each((_j, desc) => {
          const text = $(desc).text().trim();
          if (text) objectives.push(text);
        });
    }
  });

  // Remove the objectives card and the title from the flow
  $(".cmsfr-block-item_grid").remove();
  $("main h1").first().remove();

  // Process content blocks in order (direct children of main only, to avoid nested duplicates)
  $("main").children(".fr-container").each((_i, container) => {
    const $c = $(container);

    // Skip empty hr blocks
    if ($c.hasClass("cmsfr-block-hr")) return;

    // Callout blocks (Pour aller plus loin)
    if ($c.hasClass("cmsfr-block-callout") || $c.find(".fr-callout").length) {
      const calloutTitle = $c.find(".fr-callout__title").text().trim();
      const calloutHtml = $c.find(".fr-callout__text").html() || "";
      if (calloutTitle || calloutHtml) {
        blocks.push({
          type: "callout",
          title: calloutTitle,
          html: calloutHtml,
        });
      }
      return;
    }

    // Image-and-text blocks
    if (
      $c.hasClass("cmsfr-block-imageandtext") ||
      $c.find(".cmsfr-block-image-and-text").length
    ) {
      const html = $c.find(".cmsfr-block-image-and-text").html() || $c.html();
      blocks.push({ type: "content", html });
      return;
    }

    // Paragraph blocks
    if ($c.hasClass("cmsfr-block-paragraph")) {
      const html = $c.html() || "";
      if (html.trim()) {
        blocks.push({ type: "content", html });
      }
      return;
    }

    // Any other block with actual content
    const html = $c.html() || "";
    if (html.trim() && !$c.hasClass("fr-my-4w")) {
      blocks.push({ type: "content", html });
    }
  });

  // Convert blocks to markdown
  let markdown = "";

  for (const block of blocks) {
    if (block.type === "callout") {
      const linksMd = turndown.turndown(block.html).trim();
      if (linksMd) {
        markdown += `\n\n### ${block.title}\n\n${linksMd}`;
      }
    } else {
      const md = turndown.turndown(block.html).trim();
      if (md) {
        markdown += "\n\n" + md;
      }
    }
  }

  return { title, objectives, markdown: markdown.trim() };
}

// ─── Cache key mapping ──────────────────────────────────────────────

function ficheUrlToCacheKey(url) {
  return url
    .replace(BASE_URL, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 200);
}

function findCacheFile(fiche) {
  // Build URL from fiche data — need the original URL path
  // Fiche URLs follow: /fiches-par-thematiques/{theme-slug}/{subcategory-slug}/{fiche-slug}/
  // We need to reconstruct the cache key
  const ficheJson = JSON.parse(
    readFileSync(
      join(
        ROOT,
        "data-init",
        "fiches",
        fiche.themeId,
        fiche.subcategoryId,
        fiche.slug + ".json",
      ),
      "utf-8",
    ),
  );
  const url = ficheJson.url;
  const key = ficheUrlToCacheKey(url);
  const cachePath = join(CACHE_DIR, key + ".html");
  if (existsSync(cachePath)) return cachePath;

  // Fallback: try URL-encoded version of cache key
  console.warn(`  [warn] Cache miss for ${fiche.slug} (tried ${key})`);
  return null;
}

// ─── Frontmatter generation ─────────────────────────────────────────

function yamlEscape(str) {
  if (/[:"'\n#{}[\],&*!|>%@`]/.test(str) || str.trim() !== str) {
    return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${str}"`;
}

function generateFrontmatter({ title, themeId, themeName, subcategoryId, subcategoryName, objectives, originalFicheIds }) {
  let fm = "---\n";
  fm += `title: ${yamlEscape(title)}\n`;
  fm += `themeId: ${themeId}\n`;
  fm += `themeName: ${yamlEscape(themeName)}\n`;
  fm += `subcategoryId: ${subcategoryId}\n`;
  fm += `subcategoryName: ${yamlEscape(subcategoryName)}\n`;
  if (objectives.length > 0) {
    fm += "objectives:\n";
    for (const obj of objectives) {
      fm += `  - ${yamlEscape(obj)}\n`;
    }
  }
  fm += "originalFicheIds:\n";
  for (const id of originalFicheIds) {
    fm += `  - ${yamlEscape(id)}\n`;
  }
  fm += "---\n";
  return fm;
}

// ─── Slug decoding ──────────────────────────────────────────────────

function safeDecodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

// ─── Heading level bumping ──────────────────────────────────────────

function bumpHeadings(markdown, levels = 1) {
  // Bump all ATX headings by `levels`
  return markdown.replace(/^(#{1,6}) /gm, (match, hashes) => {
    const newLevel = Math.min(hashes.length + levels, 6);
    return "#".repeat(newLevel) + " ";
  });
}

// ─── Main ───────────────────────────────────────────────────────────

const index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));

let totalPages = 0;
let totalMerged = 0;

for (const theme of index.themes) {
  for (const subcat of theme.subcategories) {
    const groups = GROUP_DEFINITIONS[theme.id]?.[subcat.id];
    const outDir = join(CONTENT_DIR, theme.id, subcat.id);
    mkdirSync(outDir, { recursive: true });

    if (groups) {
      // Grouped subcategory: merge fiches per group
      const assignedSlugs = new Set();

      for (const group of groups) {
        const ficheEntries = group.slugs
          .map((slug) => subcat.fiches.find((f) => f.slug === slug))
          .filter(Boolean);

        if (ficheEntries.length === 0) {
          console.warn(`  [warn] Group "${group.name}" has no matching fiches`);
          continue;
        }

        group.slugs.forEach((s) => assignedSlugs.add(s));

        const allObjectives = [];
        const allOriginalIds = [];
        const markdownParts = [];

        for (const fiche of ficheEntries) {
          const cachePath = findCacheFile({
            ...fiche,
            themeId: theme.id,
            subcategoryId: subcat.id,
          });
          if (!cachePath) continue;

          const html = readFileSync(cachePath, "utf-8");
          const { title: ficheTitle, objectives, markdown } = htmlToMarkdown(html);

          allOriginalIds.push(fiche.id);
          allObjectives.push(...objectives);

          // Bump headings so each fiche starts at ##
          const bumped = bumpHeadings(markdown, 1);
          markdownParts.push(`## ${ficheTitle}\n\n${bumped}`);
        }

        const frontmatter = generateFrontmatter({
          title: group.name,
          themeId: theme.id,
          themeName: theme.name,
          subcategoryId: subcat.id,
          subcategoryName: subcat.name,
          objectives: [...new Set(allObjectives)],
          originalFicheIds: allOriginalIds,
        });

        const content = frontmatter + "\n" + markdownParts.join("\n\n---\n\n");
        const outPath = join(outDir, group.id + ".md");
        writeFileSync(outPath, content, "utf-8");
        totalPages++;
        totalMerged += ficheEntries.length;
        console.log(
          `  [group] ${theme.id}/${subcat.id}/${group.id}.md (${ficheEntries.length} fiches)`,
        );
      }

      // Any unassigned fiches in this subcategory get individual pages
      for (const fiche of subcat.fiches) {
        if (assignedSlugs.has(fiche.slug)) continue;

        const cachePath = findCacheFile({
          ...fiche,
          themeId: theme.id,
          subcategoryId: subcat.id,
        });
        if (!cachePath) continue;

        const html = readFileSync(cachePath, "utf-8");
        const { title, objectives, markdown } = htmlToMarkdown(html);

        const frontmatter = generateFrontmatter({
          title,
          themeId: theme.id,
          themeName: theme.name,
          subcategoryId: subcat.id,
          subcategoryName: subcat.name,
          objectives,
          originalFicheIds: [fiche.id],
        });

        const slug = safeDecodeSlug(fiche.slug);
        const outPath = join(outDir, slug + ".md");
        writeFileSync(outPath, frontmatter + "\n" + markdown, "utf-8");
        totalPages++;
        console.log(`  [solo]  ${theme.id}/${subcat.id}/${slug}.md`);
      }
    } else {
      // Ungrouped subcategory: one page per fiche
      for (const fiche of subcat.fiches) {
        const cachePath = findCacheFile({
          ...fiche,
          themeId: theme.id,
          subcategoryId: subcat.id,
        });
        if (!cachePath) continue;

        const html = readFileSync(cachePath, "utf-8");
        const { title, objectives, markdown } = htmlToMarkdown(html);

        const frontmatter = generateFrontmatter({
          title,
          themeId: theme.id,
          themeName: theme.name,
          subcategoryId: subcat.id,
          subcategoryName: subcat.name,
          objectives,
          originalFicheIds: [fiche.id],
        });

        const slug = safeDecodeSlug(fiche.slug);
        const outPath = join(outDir, slug + ".md");
        writeFileSync(outPath, frontmatter + "\n" + markdown, "utf-8");
        totalPages++;
        console.log(`  [fiche] ${theme.id}/${subcat.id}/${slug}.md`);
      }
    }
  }
}

console.log(
  `\nDone: ${totalPages} markdown pages generated (${totalMerged} fiches merged into groups)`,
);
