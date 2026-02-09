import { useEffect } from "react";

export function useKeyboard(keyMap: Record<string, () => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      const fn = keyMap[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [keyMap, enabled]);
}
