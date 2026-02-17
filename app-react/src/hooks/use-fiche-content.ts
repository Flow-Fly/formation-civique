import { useState, useEffect, useMemo } from "react";

export interface Frontmatter {
  title: string;
  themeId: string;
  themeName: string;
  subcategoryId: string;
  subcategoryName: string;
  objectives: string[];
  originalFicheIds: string[];
}

export function parseFrontmatter(raw: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {
        title: "",
        themeId: "",
        themeName: "",
        subcategoryId: "",
        subcategoryName: "",
        objectives: [],
        originalFicheIds: [],
      },
      body: raw,
    };
  }

  const fmText = match[1];
  const body = match[2];
  const fm: Record<string, string | string[]> = {};
  let currentKey = "";
  let currentArray: string[] | null = null;

  for (const line of fmText.split("\n")) {
    const kvMatch = line.match(/^(\w+):\s*(.+)?$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = (kvMatch[2] || "").trim();
      if (val) {
        fm[currentKey] = val.replace(/^"(.*)"$/, "$1");
      }
      currentArray = null;
      continue;
    }
    const arrayMatch = line.match(/^\s+-\s*(.+)$/);
    if (arrayMatch && currentKey) {
      if (!currentArray) {
        currentArray = [];
        fm[currentKey] = currentArray;
      }
      currentArray.push(arrayMatch[1].replace(/^"(.*)"$/, "$1"));
    }
  }

  return {
    frontmatter: {
      title: (fm.title as string) || "",
      themeId: (fm.themeId as string) || "",
      themeName: (fm.themeName as string) || "",
      subcategoryId: (fm.subcategoryId as string) || "",
      subcategoryName: (fm.subcategoryName as string) || "",
      objectives: Array.isArray(fm.objectives) ? fm.objectives : [],
      originalFicheIds: Array.isArray(fm.originalFicheIds)
        ? fm.originalFicheIds
        : [],
    },
    body,
  };
}

export function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useFicheContent(contentPath: string | null) {
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentPath) {
      setRawContent(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`${import.meta.env.BASE_URL}content/${contentPath}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setRawContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [contentPath]);

  const { frontmatter, body } = useMemo(
    () =>
      rawContent
        ? parseFrontmatter(rawContent)
        : { frontmatter: null, body: "" },
    [rawContent],
  );

  return { frontmatter, body, loading, error };
}
