import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

// Same pattern as Layout.tsx's sidebar-collapsed flag, generalized: read the
// stored value once on mount, write it back on every change. Used for filter
// selections that should survive a reload/navigation instead of silently
// resetting - a quota error or malformed stored value just falls back to
// `initial` rather than breaking the page.
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore - filters just won't persist this time
    }
  }, [key, value]);

  return [value, setValue];
}
