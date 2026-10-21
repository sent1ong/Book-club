"use client";
import { useEffect, useRef } from "react";
const windows: { close: () => void; layer: number; order: number }[] = [];
let order = 0;
function escape(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing || event.repeat) return;
  const top = windows.slice().sort((a, b) => b.layer - a.layer || b.order - a.order)[0];
  if (top) { event.preventDefault(); event.stopImmediatePropagation(); top.close(); }
}
export function useWindowEscape(close: () => void, active = true, layer = 50) {
  const latest = useRef(close); latest.current = close;
  useEffect(() => {
    if (!active) return;
    const item = { close: () => latest.current(), layer, order: ++order };
    if (!windows.length) document.addEventListener("keydown", escape, true);
    windows.push(item);
    return () => { const index = windows.indexOf(item); if (index >= 0) windows.splice(index, 1); if (!windows.length) document.removeEventListener("keydown", escape, true); };
  }, [active, layer]);
}
