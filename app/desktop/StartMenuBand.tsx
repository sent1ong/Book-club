"use client";
import React, { useEffect, useRef, useState } from "react";

export function StartMenuBand({ group }: { group: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const label = `BOOK CLUB 98 · ${group}`;
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setHeight(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={box} data-start-menu-band className="w-8 shrink-0 relative overflow-hidden select-none"
    style={{ backgroundColor: "var(--desktop-title, #000080)" }}>
    <span title={label} className="absolute text-center text-white font-extrabold text-xs whitespace-nowrap tracking-widest drop-shadow overflow-hidden text-ellipsis"
      style={{ left: "50%", top: "50%", width: Math.max(0, height - 16), transform: "translate(-50%, -50%) rotate(-90deg)" }}>{label}</span>
  </div>;
}
