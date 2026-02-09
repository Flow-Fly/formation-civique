import { NavLink } from "react-router-dom";
import { LayoutDashboard, BookOpen, CheckCircle, Layers, Settings } from "lucide-react";

const links = [
  { to: "/dashboard", label: "Tableau", icon: LayoutDashboard },
  { to: "/study", label: "Fiches", icon: BookOpen },
  { to: "/quiz", label: "Quiz", icon: CheckCircle },
  { to: "/flashcards", label: "Cartes", icon: Layers },
  { to: "/settings", label: "Config", icon: Settings },
] as const;

export function NavHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-primary text-primary-foreground flex items-center justify-between px-4 z-50 shadow-md">
      <NavLink to="/dashboard" className="text-lg font-bold text-primary-foreground no-underline hover:no-underline whitespace-nowrap">
        Formation Civique
      </NavLink>
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
    </header>
  );
}
