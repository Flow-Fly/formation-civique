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
import { useExam } from "@/context/exam-context.tsx";
import type { ExamCode } from "@/types/index.ts";

const links = [
  { to: "/dashboard", label: "Tableau", icon: LayoutDashboard },
  { to: "/study", label: "Fiches", icon: BookOpen },
  { to: "/quiz", label: "Quiz", icon: CheckCircle },
  { to: "/flashcards", label: "Cartes", icon: Layers },
  { to: "/questions", label: "Questions", icon: ListChecks },
  { to: "/settings", label: "Config", icon: Settings },
] as const;

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

interface NavHeaderProps {
  onSearchClick: () => void;
}

export function NavHeader({ onSearchClick }: NavHeaderProps) {
  const { activeExam, setActiveExam } = useExam();

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 z-50 shadow-md">
      <NavLink
        to="/dashboard"
        className="text-lg font-bold text-primary-foreground no-underline hover:no-underline whitespace-nowrap"
      >
        Formation Civique
      </NavLink>
      <div className="flex items-center gap-2">
        <select
          value={activeExam}
          onChange={(e) => setActiveExam(e.target.value as ExamCode)}
          className="h-8 rounded border border-white/30 bg-white/10 px-2 text-xs text-white"
          aria-label="Choisir le type d'examen"
        >
          <option value="CSP" className="text-black">CSP</option>
          <option value="CR" className="text-black">CR</option>
          <option value="NAT" className="text-black">NAT</option>
        </select>

        <button
          onClick={onSearchClick}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
          aria-label="Rechercher"
        >
          <Search className="w-4 h-4" />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-xs font-mono">
            {isMac ? "⌘" : "Ctrl+"}K
          </kbd>
        </button>

        <nav>
          <ul className="flex gap-1 list-none">
            {links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1 px-2 py-1 rounded text-sm font-medium no-underline transition-colors ${
                      isActive
                        ? "bg-white/25 text-white border-b-2 border-white"
                        : "text-white/80 hover:bg-white/15 hover:text-white"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
