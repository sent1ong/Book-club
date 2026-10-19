"use client";
import React, { useEffect, useState } from "react";
export const CURSORS = [["default", "기본 커서"], ["Chiikawa", "치이카와"], ["corgi", "웰시코기"], ["mm", "마이멜로디"], ["smile", "이모티콘"], ["Usagi", "우사기"]] as const;
export type CursorKey = typeof CURSORS[number][0];
export type Frame = { src: string; width: number; height: number; hotspotX: number; hotspotY: number };
type Static = Frame & { kind: "cur" };
export type Animated = { kind: "ani"; frames: Frame[][]; sequence: number[]; jiffies: number[]; durationMs: number };
type Entry = Static | Animated;
type Manifest = Record<string, { normal: Entry; pointer: Entry }>;
export function animationFrame(entry: Animated, elapsed: number) {
  let time = ((elapsed % entry.durationMs) + entry.durationMs) % entry.durationMs;
  for (let step = 0; step < entry.sequence.length; step++) {
    const duration = entry.jiffies[step] * 1000 / 60;
    if (time < duration) return entry.sequence[step];
    time -= duration;
  }
  return entry.sequence[entry.sequence.length - 1];
}
export function resolution(variants: Frame[], dpr: number) {
  const sorted = [...variants].sort((a, b) => a.width - b.width);
  return sorted.find(frame => frame.width >= 32 * dpr) || sorted[sorted.length - 1];
}
export function CursorEffect({ selected }: { selected: CursorKey }) {
  const [fine, setFine] = useState(false);
  useEffect(() => { const query = matchMedia("(any-hover: hover) and (any-pointer: fine)"); const update = () => setFine(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  useEffect(() => {
    if (selected === "default" || !fine) return;
    const media = matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const abort = new AbortController(), root = document.documentElement;
    const image = document.createElement("img"); image.alt = ""; image.setAttribute("aria-hidden", "true");
    image.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;display:none;max-width:none;user-select:none;";
    image.draggable = false; document.body.appendChild(image);
    const style = document.createElement("style");
    style.textContent = 'html[data-bc-cursor-active] *,html[data-bc-cursor-active]{cursor:var(--bc-active-cursor)!important}'; document.head.appendChild(style);
    let manifest: Manifest | null = null, ready = false, frame = 0, x = 0, y = 0, inside = false, down = false, dragging = false;
    let target: Element | null = null, checkedTarget: Element | null = null, allowed = false, dirty = true, mode: "normal" | "pointer" = "normal", started = performance.now(), previousSource = "", lastEntry: Entry | null = null;
    const hide = () => { image.style.display = "none"; root.removeAttribute("data-bc-cursor-active"); root.style.removeProperty("--bc-active-cursor"); };
    const eligible = () => {
      if (!ready || !media.matches || !inside || down || dragging || document.visibilityState !== "visible" || !document.hasFocus()) return false;
      target = document.elementFromPoint(x, y);
      if (!dirty && target === checkedTarget) return allowed;
      dirty = false; checkedTarget = target; allowed = false;
      // Read native cursor only when the hover target changes.
      root.removeAttribute("data-bc-cursor-active");
      if (!target || target.closest('input,textarea,select,[contenteditable="true"],iframe,[draggable="true"]')) return false;
      const native = getComputedStyle(target).cursor;
      if (!['auto', 'default', 'pointer', ''].includes(native)) return false;
      mode = native === "pointer" || !!target.closest('button,a[href],[role="button"],summary,label') ? "pointer" : "normal";
      allowed = true; return true;
    };
    const render = (now: number) => {
      if (eligible() && manifest) {
        const entry = manifest[selected][mode];
        if (lastEntry !== entry) { lastEntry = entry; started = now; previousSource = ""; }
        if (entry.kind === "cur") {
          image.style.display = "none";
          root.style.setProperty("--bc-active-cursor", `url("${entry.src}") ${entry.hotspotX} ${entry.hotspotY}, ${mode === "pointer" ? "pointer" : "default"}`);
        } else {
          const item = resolution(entry.frames[animationFrame(entry, now - started)], window.devicePixelRatio || 1);
          const scale = 32 / item.width;
          if (previousSource !== item.src) { image.src = item.src; previousSource = item.src; }
          image.style.width = "32px"; image.style.height = `${item.height * scale}px`;
          image.style.transform = `translate3d(${x - item.hotspotX * scale}px,${y - item.hotspotY * scale}px,0)`;
          image.style.display = "block"; root.style.setProperty("--bc-active-cursor", "none");
        }
        root.setAttribute("data-bc-cursor-active", "1");
      } else hide();
      frame = requestAnimationFrame(render);
    };
    void fetch("/cursors/manifest.json", { signal: abort.signal }).then(response => { if (!response.ok) throw new Error("Cursor manifest"); return response.json(); }).then(async (next: Manifest) => {
      const pair = next[selected]; if (!pair) throw new Error("Cursor theme");
      const sources = new Set<string>();
      for (const entry of [pair.normal, pair.pointer]) {
        if (entry.kind === "ani") for (const variants of entry.frames) for (const item of variants) sources.add(item.src);
        // CUR is decoded by CSS, preserving its original hotspot; do not decode it as a PNG.
      }
      await Promise.all(Array.from(sources).map(src => new Promise<void>((resolve, reject) => { const preload = new Image(); preload.onload = () => resolve(); preload.onerror = () => reject(new Error("Cursor frame")); preload.src = src; })));
      if (!abort.signal.aborted) { manifest = next; ready = true; }
    }).catch(() => { hide(); });
    const move = (event: PointerEvent) => { if (event.pointerType !== "mouse") { inside = false; hide(); return; } x = event.clientX; y = event.clientY; inside = true; dirty = true; };
    const leave = () => { inside = false; hide(); }, press = () => { down = true; hide(); }, release = () => { down = false; }, drag = () => { dragging = true; hide(); }, endDrag = () => { dragging = false; }, blur = () => { down = false; dragging = false; leave(); };
    const options = { signal: abort.signal, capture: true };
    document.addEventListener("pointermove", move, options); document.addEventListener("pointerleave", leave, { signal: abort.signal });
    document.addEventListener("pointerdown", press, options); document.addEventListener("pointerup", release, options);
    document.addEventListener("dragstart", drag, options); document.addEventListener("dragend", endDrag, options);
    window.addEventListener("blur", blur, options); media.addEventListener("change", leave, { signal: abort.signal });
    const observer = new MutationObserver(() => { dirty = true; }); observer.observe(document.body, { subtree: true, childList: true });
    frame = requestAnimationFrame(render);
    return () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); hide(); image.remove(); style.remove(); };
  }, [selected, fine]);
  return null;
}
