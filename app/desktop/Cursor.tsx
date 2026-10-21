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
    const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;display:none;max-width:none;user-select:none;will-change:transform;";
    document.body.appendChild(canvas);
    const context = canvas.getContext("2d");
    const nativeRoots = ['input','textarea','select','iframe','[contenteditable="true"]','[draggable="true"]','[data-bc-native-cursor]',
      '.cursor-ew-resize','.cursor-ns-resize','.cursor-col-resize','.cursor-row-resize','.cursor-not-allowed','.cursor-wait','.cursor-progress','.cursor-move','.cursor-grab','.cursor-grabbing','.cursor-crosshair'];
    const nativeSelector = nativeRoots.join(",");
    const exceptions = nativeRoots.flatMap(selector => [selector, selector + " *"]).join(",");
    const style = document.createElement("style");
    // This rule is installed once. Its root attribute stays unchanged across all
    // read-only regions, buttons and animation frames; no per-hit style handoff.
    style.textContent = `html[data-bc-animated-cursor] body,html[data-bc-animated-cursor] body *:not(:where(${exceptions})){cursor:none!important}
      html[data-bc-animated-cursor] :is(input,textarea,select,iframe,[draggable="true"]){cursor:auto!important}
      html[data-bc-animated-cursor] :is([contenteditable="true"],[contenteditable="true"] *){cursor:text!important}`;
    document.head.appendChild(style);
    const decoded = new Map<string, HTMLImageElement>();
    let manifest: Manifest | null = null, ready = false, frame = 0, x = 0, y = 0, inside = false, dragging = false;
    let target: Element | null = null, checkedTarget: Element | null = null, allowed = false, dirty = true, moved = true;
    let mode: "normal" | "pointer" = "normal", started = performance.now(), previousSource = "", lastEntry: Entry | null = null;
    let hotspotX = 0, hotspotY = 0, masked = false;
    let staticTarget: HTMLElement | SVGElement | null = null, staticOriginal = "", staticPriority = "", staticApplied = "";
    const restoreStatic = () => {
      if (staticTarget?.style.getPropertyValue("cursor") === staticApplied) {
        if (staticOriginal) staticTarget.style.setProperty("cursor", staticOriginal, staticPriority);
        else staticTarget.style.removeProperty("cursor");
      }
      staticTarget = null;
    };
    const mask = (value: boolean) => {
      if (masked === value) return;
      masked = value;
      if (value) root.setAttribute("data-bc-animated-cursor", "1"); else root.removeAttribute("data-bc-animated-cursor");
    };
    const position = () => {
      const transform = `translate3d(${x - hotspotX}px,${y - hotspotY}px,0)`;
      if (canvas.style.transform !== transform) canvas.style.transform = transform;
    };
    const hide = () => {
      if (canvas.style.display !== "none") canvas.style.display = "none";
      restoreStatic(); root.removeAttribute("data-bc-cursor-active");
    };
    const eligible = () => {
      if (!ready || !context || !media.matches || !inside || dragging || document.visibilityState !== "visible" || !document.hasFocus()) return false;
      if (moved || dirty) target = document.elementFromPoint(x, y);
      moved = false;
      if (!dirty && target === checkedTarget) return allowed;
      dirty = false; checkedTarget = target;
      allowed = !!target && !target.closest(nativeSelector);
      if (allowed && target) mode = target.closest('button,a[href],[role="button"],summary,label,.cursor-pointer') ? "pointer" : "normal";
      return allowed;
    };
    const draw = (now: number) => {
      const active = eligible();
      const entry = active && manifest ? manifest[selected][mode] : null;
      const enabled = ready && !!context && media.matches && inside && !dragging && document.visibilityState === "visible" && document.hasFocus();
      // Do not toggle the stylesheet for input fields; they have native exceptions.
      const pair = manifest?.[selected];
      mask(!!enabled && !!pair && pair.normal.kind === "ani" && pair.pointer.kind === "ani");
      if (!entry) { hide(); return; }
      if (lastEntry !== entry) { lastEntry = entry; started = now; previousSource = ""; }
      if (entry.kind === "cur") {
        if (canvas.style.display !== "none") canvas.style.display = "none";
        if (target instanceof HTMLElement || target instanceof SVGElement) {
          if (staticTarget !== target) { restoreStatic(); staticTarget = target; staticOriginal = target.style.getPropertyValue("cursor"); staticPriority = target.style.getPropertyPriority("cursor"); }
          const value = `url("${entry.src}") ${entry.hotspotX} ${entry.hotspotY}, ${mode === "pointer" ? "pointer" : "default"}`;
          if (staticApplied !== value || target.style.getPropertyValue("cursor") !== value) { staticApplied = value; target.style.setProperty("cursor", value, "important"); }
        }
      } else {
        restoreStatic();
        const item = resolution(entry.frames[animationFrame(entry, now - started)], window.devicePixelRatio || 1);
        const picture = decoded.get(item.src); if (!picture || !context) { hide(); mask(false); return; }
        if (previousSource !== item.src) {
          if (canvas.width !== item.width) canvas.width = item.width;
          if (canvas.height !== item.height) canvas.height = item.height;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(picture, 0, 0, canvas.width, canvas.height);
          previousSource = item.src;
          canvas.style.width = "32px"; canvas.style.height = `${item.height * 32 / item.width}px`;
        }
        hotspotX = item.hotspotX * 32 / item.width; hotspotY = item.hotspotY * 32 / item.width;
        position(); if (canvas.style.display !== "block") canvas.style.display = "block";
      }
      if (!root.hasAttribute("data-bc-cursor-active")) root.setAttribute("data-bc-cursor-active", "1");
    };
    const render = (now: number) => { draw(now); frame = requestAnimationFrame(render); };
    void fetch("/cursors/manifest.json", { signal: abort.signal }).then(response => { if (!response.ok) throw new Error("Cursor manifest"); return response.json(); }).then(async (next: Manifest) => {
      const pair = next[selected]; if (!pair) throw new Error("Cursor theme");
      const sources = new Set<string>();
      for (const entry of [pair.normal, pair.pointer]) if (entry.kind === "ani") for (const variants of entry.frames) for (const item of variants) sources.add(item.src);
      await Promise.all(Array.from(sources).map(src => new Promise<void>((resolve, reject) => {
        const picture = new Image(); picture.onload = () => {
          void picture.decode().then(() => { decoded.set(src, picture); resolve(); }, reject);
        }; picture.onerror = () => reject(new Error("Cursor frame")); picture.src = src;
      })));
      if (!abort.signal.aborted) { manifest = next; ready = true; }
    }).catch(() => { ready = false; hide(); mask(false); });
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") { inside = false; hide(); mask(false); return; }
      x = event.clientX; y = event.clientY; inside = true; moved = true;
      if (ready && !dragging) {
        if (event.target !== checkedTarget || dirty || !root.hasAttribute("data-bc-cursor-active")) draw(performance.now());
        else if (canvas.style.display === "block") position();
      }
    };
    const leave = () => { inside = false; hide(); mask(false); }, press = (event: PointerEvent) => move(event), release = () => { dirty = true; };
    const drag = () => { dragging = true; hide(); mask(false); }, endDrag = () => { dragging = false; dirty = true; }, blur = () => { dragging = false; leave(); };
    const invalidate = () => { dirty = true; };
    window.addEventListener("scroll", invalidate, { signal: abort.signal, capture: true, passive: true });
    window.addEventListener("resize", invalidate, { signal: abort.signal });
    const options = { signal: abort.signal, capture: true };
    document.addEventListener("pointermove", move, options); document.addEventListener("pointerleave", leave, { signal: abort.signal });
    document.addEventListener("pointerdown", press, options); document.addEventListener("pointerup", release, options);
    document.addEventListener("dragstart", drag, options); document.addEventListener("dragend", endDrag, options);
    // Element blur must not be treated as leaving the browser window.
    window.addEventListener("blur", blur, { signal: abort.signal }); media.addEventListener("change", leave, { signal: abort.signal });
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target !== canvas && record.target !== root)) dirty = true;
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "disabled", "contenteditable", "draggable"] });
    frame = requestAnimationFrame(render);
    return () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); hide(); mask(false); decoded.clear(); canvas.remove(); style.remove(); };
  }, [selected, fine]);
  return null;
}
