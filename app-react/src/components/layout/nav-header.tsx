import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CheckCircle,
  Layers,
  Settings,
  Search,
  ListChecks,
} from "lucide-react";

const links = [
  { to: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/study", label: "Fiches", icon: BookOpen },
  { to: "/quiz", label: "Quiz", icon: CheckCircle },
  { to: "/flashcards", label: "Cartes", icon: Layers },
  { to: "/questions", label: "Questions", icon: ListChecks },
  { to: "/settings", label: "Reglages", icon: Settings },
] as const;

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

interface NavHeaderProps {
  onSearchClick: () => void;
}

function renderNavItems() {
  return links.map(({ to, label, icon: Icon }) => (
    <li key={to}>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium no-underline transition-colors whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-sm ${
            isActive
              ? "bg-white/20 text-white"
              : "text-white/80 hover:bg-white/12 hover:text-white"
          }`
        }
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </NavLink>
    </li>
  ));
}

export function NavHeader({ onSearchClick }: NavHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-primary/96 text-primary-foreground shadow-md backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-2">
        <div className="flex items-center gap-2 lg:gap-3">
          <NavLink
            to="/dashboard"
            className="mr-auto text-base font-bold text-primary-foreground no-underline hover:no-underline whitespace-nowrap sm:text-lg"
          >
            Formation Civique
          </NavLink>

          <nav className="hidden min-w-0 flex-1 lg:block">
            <ul className="flex justify-center gap-1 list-none">{renderNavItems()}</ul>
          </nav>

          <button
            type="button"
            onClick={onSearchClick}
            className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white px-2.5 text-sm text-primary shadow-sm transition-colors hover:bg-white/95 cursor-pointer sm:px-3"
            aria-label="Rechercher une fiche ou une notion"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline font-medium">Recherche</span>
            <kbd className="hidden xl:inline-flex items-center rounded border border-primary/15 bg-primary/5 px-1.5 py-0.5 text-xs font-mono text-primary/80">
              {isMac ? "Cmd + K" : "Ctrl + K"}
            </kbd>
          </button>
        </div>

        <nav className="mt-2 overflow-x-auto lg:hidden">
          <ul className="flex gap-1 pb-1 list-none">{renderNavItems()}</ul>
        </nav>
      </div>
    </header>
  );
}
