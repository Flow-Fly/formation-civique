# Sidebar Navigation & Fiche Merging

## Summary

Two related improvements to the study page UX:

1. **Persistent sidebar navigation** when reading a fiche (docs-site style)
2. **Merge numbered fiche series** (e.g., "L'egalite 1/3, 2/3, 3/3") into single pages

## Part A: Merge Numbered Fiches (Data Pipeline)

### Goal

Reduce 124 pages to ~109 by merging all `(N/M)` numbered series into single pages, consistent with the grouping already done for subcategories like "Cadre legal" or "Artistes emblematiques".

### Affected Series (~15 merges)

| Subcategory | Series | Parts |
|---|---|---|
| La devise de la Republique | L'egalite | 3 |
| La devise de la Republique | La fraternite | 2 |
| La laicite | La definition de la laicite | 2 |
| La laicite | La laicite a l'ecole | 2 |
| Democratie et droit de vote | La democratie et la Republique | 2 |
| Democratie et droit de vote | Les conditions pour voter en France | 2 |
| Democratie et droit de vote | Comment voter une loi | 2 |
| Organisation de la Republique | Le decoupage administratif de la France | 3 |
| Institutions europeennes | Les symboles europeens | 2 |
| Institutions europeennes | Le fonctionnement europeen | 2 |
| Droits fondamentaux | Presentation des principaux textes | 3 |
| Les conflits mondiaux | La Seconde Guerre mondiale (1/3,2/3,3/3) | 3 |
| Zoom sur | Le territoire francais dans le temps | 2 |
| Parentalite | Exercice de l'autorite parentale | 2 |
| Parentalite | Le soutien a la parentalite | 2 |

### Implementation

1. **Update `generate-markdown.mjs`**:
   - Detect `(N/M)` pattern in fiche titles within the same subcategory
   - Group matching fiches by base title
   - Concatenate their content into a single markdown file, using each part's original title as an `## H2` separator
   - Output a single file with the base title (e.g., "L'egalite" instead of "L'egalite (1/3)")
   - Combine all `originalFicheIds` into the merged page's array

2. **Rebuild `content-index.json`**:
   - Run `build-search-index.mjs` or equivalent to regenerate the index
   - Merged pages appear as single entries with all original fiche IDs

3. **Clean up orphaned files**:
   - Delete individual `egalite-1.md`, `egalite-2.md`, `egalite-3.md` etc.
   - Keep only the merged `egalite.md`

4. **Verify**:
   - Total page count drops from 124 to ~109
   - All `originalFicheIds` are preserved (read tracking still works)
   - Search index still covers all content

## Part B: Sidebar Layout (React Components)

### Layout Architecture

```
Desktop (xl+):  [ Sidebar 260px | Content flex-1 | ToC 200px ]
Desktop (lg):   [ Sidebar 260px | Content flex-1 ]  (ToC hidden)
Tablet/Mobile:  [ Content full-width ] + drawer button for sidebar
```

### Changes

#### 1. Widen AppLayout container

`app-react/src/components/layout/app-layout.tsx`:
- Change `max-w-[960px]` to `max-w-7xl` (1280px)

#### 2. Constrain non-study pages

Add `max-w-[960px] mx-auto` wrapper to:
- `DashboardPage`
- `QuizPage`
- `FlashcardsPage`
- `SettingsPage`
- `ThemeBrowser` (the /study listing page, unchanged layout)

#### 3. Create `StudySidebar` component

New file: `app-react/src/components/study/study-sidebar.tsx`

- Reuses the ThemeBrowser accordion logic but in a compact sidebar variant
- Smaller text (`text-xs`/`text-sm`), tighter padding
- No outer `Card` wrapper (sits inside the sidebar panel)
- **Auto-expand**: The accordion for the current theme opens by default, subcategory scrolls into view
- **Active fiche highlight**: The currently viewed fiche gets a left border accent + bold text
- **Read status**: Preserves the "Lu" badges
- **Sticky**: `sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto`
- Accepts `currentTheme`, `currentSubcategory`, `currentSlug` props

#### 4. Refactor `ContentPage` layout

`app-react/src/components/study/content-page.tsx`:

```
<div className="flex gap-6">
  {/* Sidebar - hidden on mobile */}
  <aside className="hidden lg:block w-[260px] shrink-0">
    <StudySidebar
      currentTheme={theme}
      currentSubcategory={subcategory}
      currentSlug={slug}
    />
  </aside>

  {/* Main content */}
  <div className="flex-1 min-w-0 space-y-4">
    <h1>...</h1>
    <FicheContent ... />
    <PrevNextNav ... />
  </div>

  {/* ToC - hidden below xl */}
  <div className="hidden xl:block w-[200px] shrink-0">
    <TableOfContents ... />
  </div>
</div>
```

#### 5. Mobile drawer

- Add a floating button (top area or fixed bottom-left) visible on `lg:hidden`
- Uses Shadcn `Sheet` component with `side="left"`
- Sheet content = `<StudySidebar />` with same props
- Tapping a fiche link closes the sheet (via `onOpenChange`)

#### 6. Remove "Retour aux fiches" link

The sidebar replaces the back link since users can navigate from the sidebar. Optionally keep a minimal breadcrumb for context (Theme > Subcategory > Fiche).

### Component Tree (ContentPage)

```
ContentPage
  MobileMenuButton (lg:hidden) -> Sheet -> StudySidebar
  <flex container>
    StudySidebar (hidden lg:block)
    <content>
      Breadcrumb (optional)
      FicheContent
      PrevNextNav
    </content>
    TableOfContents (hidden xl:block)
  </flex>
```

## Execution Order

Part A (merge fiches) and Part B (sidebar layout) are independent. Recommended order:

1. **Part A first** — Merge the numbered fiches. This simplifies the data and reduces the number of items the sidebar needs to display.
2. **Part B second** — Build the sidebar layout. With fewer pages, the sidebar is less crowded.

Each part can be done in its own feature branch.
