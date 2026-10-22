"use client";
import { useEffect, useRef } from "react";
const windows: { close: () => void; layer: number; order: number; element: () => HTMLElement | null }[] = [];
let order = 0;
function escape(event: KeyboardEvent) {
  if (!["Escape", "Tab", "Enter"].includes(event.key) || event.isComposing || event.repeat) return;
  const top = windows.slice().sort((a, b) => b.layer - a.layer || b.order - a.order)[0];
  if (!top) return;
  if (event.key === "Enter") {
    if (event.target instanceof HTMLInputElement && !["button", "submit", "checkbox", "radio"].includes(event.target.type) && event.target.closest("form")) event.preventDefault();
    return;
  }
  if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); top.close(); return; }
  const box = top.element();
  if (!box) return;
  const items = Array.from(box.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(item => item.getClientRects().length && !item.closest('[hidden],[inert]'));
  const first = items[0], last = items[items.length - 1];
  if (!first) { event.preventDefault(); box.focus(); return; }
  if (!box.contains(document.activeElement) || document.activeElement === box || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    event.preventDefault(); event.stopImmediatePropagation(); (event.shiftKey ? last : first).focus();
  }
}
export function useWindowEscape(close: () => void, active = true, layer = 50, element?: () => HTMLElement | null, identity?: string) {
  const latest = useRef(close); latest.current = close;
  const getElement = useRef(element); getElement.current = element;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const item = { close: () => latest.current(), layer, order: ++order, element: () => getElement.current?.() || null };
    if (!windows.length) document.addEventListener("keydown", escape, true);
    windows.push(item);
    const box = item.element();
    if (box) (box.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[autofocus],button:not(:disabled)') || box).focus();
    return () => { const index = windows.indexOf(item); if (index >= 0) windows.splice(index, 1); if (!windows.length) document.removeEventListener("keydown", escape, true); if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLButtonElement>("[data-bc-start]")?.focus(); };
  }, [active, layer, identity]);
}
