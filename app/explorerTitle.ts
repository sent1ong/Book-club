"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export const TITLE_LIMIT = 60;
export const explorerTitleKey = (group: string) => `bookclub98:explorer-title:v1:${encodeURIComponent(group)}`;
export function parseExplorerTitle(raw: string | null): string | null {
  try {
    const value = JSON.parse(raw || "null");
    return typeof value === "string" && value.trim() && Array.from(value.trim()).length <= TITLE_LIMIT ? value.trim() : null;
  } catch { return null; }
}
export function useExplorerTitle(group: string) {
  const defaultTitle = `EXPLORER - ${group}의 서재 목록`;
  const [draft, setDraft] = useState<{ group: string; value: string | null }>({ group, value: null });
  const saved = useRef<{ group: string; value: string | null }>({ group, value: null });
  useEffect(() => {
    let value: string | null = null;
    try { value = parseExplorerTitle(localStorage.getItem(explorerTitleKey(group))); } catch { /* Default title still works without storage. */ }
    saved.current = { group, value }; setDraft({ group, value });
  }, [group]);
  const preview = useCallback((value: string) => setDraft({ group, value: value.trim() ? value : null }), [group]);
  const restore = useCallback(() => setDraft(saved.current.group === group ? saved.current : { group, value: null }), [group]);
  const apply = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean || Array.from(clean).length > TITLE_LIMIT) throw new Error(`제목은 1~${TITLE_LIMIT}자로 입력해 주세요.`);
    const next = clean === defaultTitle ? null : clean;
    const old = saved.current.group === group ? saved.current.value : null;
    if (old !== next) {
      if (next === null) localStorage.removeItem(explorerTitleKey(group));
      else localStorage.setItem(explorerTitleKey(group), JSON.stringify(next));
    }
    saved.current = { group, value: next }; setDraft(saved.current);
  }, [group, defaultTitle]);
  return { text: (draft.group === group ? draft.value : null) || defaultTitle, defaultTitle, preview, restore, apply };
}
export type ExplorerTitle = ReturnType<typeof useExplorerTitle>;
