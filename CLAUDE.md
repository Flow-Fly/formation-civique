# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formation Civique is a French civics education app with spaced repetition, quizzes, and flashcards. It covers 226 fiches and a canonical multi-exam question bank (CSP/CR/NAT).

## Repository Layout

- **app-react/** — Primary app: React 19 + Vite + TypeScript + Tailwind v4 + Shadcn/UI
- **scripts/** — Node.js data pipeline (scraper, parser, validator, bundler)
- **data-init/** — Canonical editable datasets (fiches, questions, facts, suggestions)
- **app-react/public/data/** — Runtime JSON files consumed by the React app

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
node scripts/scraper.mjs           # Crawl source site into data-init/
node scripts/parse-questions.mjs   # Parse multi-exam markdown sources
node scripts/bootstrap-question-bank.mjs  # Build data-init/question-bank.json
node scripts/build-fiche-section-index.mjs # Build section-level fiche index
node scripts/suggest-question-fiche-links.mjs --status pending
node scripts/build-question-context.mjs --status pending --pending-index 1 --out /tmp/q1.prompt.md
node scripts/build-question-context.mjs --id crx005 --candidate-fiche-ids fiche-a,fiche-b
node scripts/generate-answer-pool-suggestions.mjs --status pending --provider copilot --model gpt-5
node scripts/validate-answer-pool-suggestions.mjs --input data-init/suggestions/answer-pools.pending.json
node scripts/apply-answer-pool-suggestions.mjs --input data-init/suggestions/answer-pools.pending.validated.json
node scripts/pipeline-complete.mjs --status pending --run-id lot2 --limit 20 --provider copilot --model gpt-5
node scripts/validate-question-bank.mjs
node scripts/test-qcm-workflow.mjs
node scripts/bundle-data.mjs       # Bundle data-init/* to app-react/public/data/*
```

No test framework is configured.

## Architecture (app-react/)

### Routing
React Router v7 with `createHashRouter` — all routes use `#/` prefix for GitHub Pages compatibility. Routes: dashboard, study, quiz, flashcards, questions, settings.

### State Management
- **Context**: `DataProvider` (loads fiches + question-bank via fetch), `ExamProvider` (active exam), `ThemeProvider` (dark mode)
- **Hooks with useReducer**: `useQuiz` and `useFlashcards` manage multi-phase flows (setup → active → results/summary)
- **Services** (pure functions, no state): `storage.ts`, `spaced-repetition.ts`, `quiz-engine.ts`

### Data Flow
1. `DataProvider` fetches `public/data/fiches.json` + `question-bank.json` + `exam-config.json` at startup
2. Components access data via `useData()` hook
3. Quiz/flashcard hooks dispatch actions through reducers
4. Services persist to localStorage with `fc_` prefix

### Suggested Pipeline
1. Parse and bootstrap: `parse-questions` -> `bootstrap-question-bank`
2. Build section index: `build-fiche-section-index`
3. Suggest fiche links for pending unlinked questions: `suggest-question-fiche-links`
4. Human review / apply fiche shortlist in admin
5. Generate mono-provider QCM suggestions for linked questions: `generate-answer-pool-suggestions`
6. Validate suggestions: `validate-answer-pool-suggestions`
7. Human review / acceptance in admin
8. Apply accepted suggestions: `apply-answer-pool-suggestions`
9. Validate bank and bundle runtime JSON: `validate-question-bank` -> `bundle-data`

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
- **localStorage keys**: Always prefixed with `fc_`; question progression keys are exam-scoped (e.g., `fc_sm2_data__CR`, `fc_quiz_history__CSP`)

## Deployment

GitHub Actions deploys `app-react/dist/` to GitHub Pages on push to main. Vite base path is `/formation-civique/`.
