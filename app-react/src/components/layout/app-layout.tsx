import { Outlet } from "react-router-dom";
import { NavHeader } from "./nav-header.tsx";

export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <NavHeader />
      <main className="flex-1 w-full max-w-[960px] mx-auto p-4 pt-[calc(3.5rem+1rem)]">
        <Outlet />
      </main>
    </div>
  );
}
