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
import { EXAM_OPTIONS, getExamMeta } from "@/lib/exams.ts";
import type { ExamCode } from "@/types/index.ts";

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

export function NavHeader({ onSearchClick }: NavHeaderProps) {
  const { activeExam, setActiveExam } = useExam();
  const activeExamMeta = getExamMeta(activeExam);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <NavLink
              to="/dashboard"
              className="text-lg font-bold text-primary-foreground no-underline hover:no-underline whitespace-nowrap"
            >
              Formation Civique
            </NavLink>
            <p className="mt-1 max-w-2xl text-sm text-white/75">
              Fiches, quiz et revision pour comprendre la formation civique et preparer le bon examen.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[16rem]">
              <label
                htmlFor="exam-select"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70"
              >
                Je prepare quel examen ?
              </label>
              <select
                id="exam-select"
                value={activeExam}
                onChange={(e) => setActiveExam(e.target.value as ExamCode)}
                className="h-10 w-full rounded-md border border-white/25 bg-white/10 px-3 text-sm text-white shadow-sm"
                aria-label="Choisir le type d'examen"
              >
                {EXAM_OPTIONS.map((exam) => (
                  <option key={exam.code} value={exam.code} className="text-black">
                    {exam.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 hidden text-xs text-white/70 lg:block">
                {activeExamMeta.description}
              </p>
            </div>

            <button
              type="button"
              onClick={onSearchClick}
              className="flex h-10 w-full min-w-[18rem] items-center justify-between gap-3 rounded-md border border-white/15 bg-white px-3 text-sm text-primary shadow-sm transition-colors hover:bg-white/95 sm:w-auto cursor-pointer"
              aria-label="Rechercher une fiche ou une notion"
            >
              <span className="flex items-center gap-2 font-medium">
                <Search className="w-4 h-4" />
                Rechercher une fiche ou une notion
              </span>
              <kbd className="inline-flex items-center rounded border border-primary/15 bg-primary/5 px-1.5 py-0.5 text-xs font-mono text-primary/80">
                {isMac ? "Cmd + K" : "Ctrl + K"}
              </kbd>
            </button>
          </div>
        </div>

        <nav>
          <ul className="flex gap-1 overflow-x-auto pb-1 list-none">
            {links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium no-underline transition-colors whitespace-nowrap ${
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
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
