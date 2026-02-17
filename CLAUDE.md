# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formation Civique is a French civics education app with spaced repetition, quizzes, and flashcards. It covers 226 fiches across 5 themes and 258 MCQ questions scraped from formation-civique.interieur.gouv.fr.

## Repository Layout

- **app-react/** — Primary app: React 19 + Vite + TypeScript + Tailwind v4 + Shadcn/UI
- **app/** — Original vanilla JS app (no build step, ES modules, deprecated)
- **scripts/** — Node.js data pipeline (scraper, parser, validator, bundler)
- **data/** — Bundled JSON data files consumed by the web apps

## Commands

All React app commands run from `app-react/`:

```bash
cd app-react
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

Data pipeline scripts run from the repo root:

```bash
node scripts/scraper.mjs           # Crawl source site into data/
node scripts/parse-questions.mjs   # Parse questions markdown → JSON
node scripts/validate-data.mjs     # Validate all 258 Q&A entries
node scripts/bundle-data.mjs       # Bundle fiches + questions for web app
node scripts/link-questions-fiches.mjs  # Link questions to fiches via keyword scoring
```

No test framework is configured.

## Architecture (app-react/)

### Routing
React Router v7 with `createHashRouter` — all routes use `#/` prefix for GitHub Pages compatibility. Routes: dashboard, study, quiz, flashcards, settings.

### State Management
- **Context**: `DataProvider` (loads fiches + questions via fetch), `ThemeProvider` (dark mode)
- **Hooks with useReducer**: `useQuiz` and `useFlashcards` manage multi-phase flows (setup → active → results/summary)
- **Services** (pure functions, no state): `storage.ts`, `spaced-repetition.ts`, `quiz-engine.ts`

### Data Flow
1. `DataProvider` fetches `public/data/fiches.json` + `questions.json` at startup
2. Components access data via `useData()` hook
3. Quiz/flashcard hooks dispatch actions through reducers
4. Services persist to localStorage with `fc_` prefix (cross-compatible with original app)

### Spaced Repetition (SM-2)
Simplified 4-button rating: Again (0), Hard (2), Good (3), Easy (5). Card mastery threshold: interval >= 21 days. State stored in `fc_sm2_data`.

### Styling
- Tailwind CSS v4 with `@tailwindcss/vite` plugin — theme defined inline in `index.css` via `@theme`, no separate tailwind config file
- DSFR (French gov design system) colors mapped to Shadcn oklch CSS variables
- Dark mode via Tailwind `class` strategy (`.dark` on `<html>`)
- 3D flip animation for flashcards defined in `index.css` (not expressible in pure Tailwind)

### Component Organization
All in `src/components/`: `layout/`, `dashboard/`, `study/`, `quiz/`, `flashcards/`, `settings/`, `ui/` (Shadcn base components).

## Key Conventions

- **Path alias**: `@/*` maps to `src/*` — always use it for imports
- **Import extensions**: Include `.tsx`/`.ts` extensions in import paths
- **TypeScript**: Strict mode, no `any`, discriminated unions for reducer actions
- **Types**: Centralized in `src/types/index.ts`
- **localStorage keys**: Always prefixed with `fc_` (e.g., `fc_sm2_data`, `fc_quiz_history`, `fc_streak`, `fc_settings`)

## Deployment

GitHub Actions deploys `app-react/dist/` to GitHub Pages on push to main. Vite base path is `/formation-civique/`.
