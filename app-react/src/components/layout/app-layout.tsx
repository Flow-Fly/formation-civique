import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { NavHeader } from "./nav-header.tsx";
import { SearchDialog } from "@/components/search/search-dialog.tsx";
import { APP_OPEN_SEARCH_EVENT } from "@/lib/search.ts";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }

    function handleOpenSearch() {
      setSearchOpen(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(APP_OPEN_SEARCH_EVENT, handleOpenSearch);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(APP_OPEN_SEARCH_EVENT, handleOpenSearch);
    };
  }, []);

  return (
    <div className="min-h-dvh flex flex-col">
      <NavHeader onSearchClick={() => setSearchOpen(true)} />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
