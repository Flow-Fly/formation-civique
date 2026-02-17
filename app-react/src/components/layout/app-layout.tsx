import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { NavHeader } from "./nav-header.tsx";
import { SearchDialog } from "@/components/search/search-dialog.tsx";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col">
      <NavHeader onSearchClick={() => setSearchOpen(true)} />
      <main className="flex-1 w-full max-w-[960px] mx-auto p-4 pt-[calc(3.5rem+1rem)]">
        <Outlet />
      </main>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
