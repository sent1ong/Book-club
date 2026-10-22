"use client";
import React, { useRef } from "react";
import { useWindowEscape } from "../ui/windowEscape";
export function StartMenuKeys({ close, children }: { close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useWindowEscape(close, true, 110, () => ref.current);
  return <div ref={ref} role="navigation" aria-label="시작 메뉴" className="absolute bottom-10 left-0 z-50 w-60 bg-[#c0c0c0] win-outset flex shadow-2xl" onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.isDefaultPrevented() || !["ArrowUp", "ArrowDown"].includes(e.key) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []).filter(item => item.getClientRects().length);
    if (!items.length) return; e.preventDefault(); e.stopPropagation();
    const current = items.indexOf(document.activeElement as HTMLButtonElement); const next = (current + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus(); items[next].scrollIntoView({ block: "nearest" });
  }}>{children}</div>;
}
