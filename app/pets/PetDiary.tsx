"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const DiaryWindow = dynamic(() => import("./DiaryWindow"));
import { createPortal } from "react-dom";
import { useWindowEscape } from "../windowEscape";

export function PetPopup({ title, close, children, front = false }: {
  title: string; close: () => void; children: React.ReactNode; front?: boolean;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  useWindowEscape(close, true, front ? 90 : 80, () => box.current);
  return createPortal(<div className={`fixed inset-0 flex items-center justify-center bg-black/40 p-3 ${front ? "z-[90]" : "z-[80]"}`}>
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          const items = box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']");
          if (!items?.length) return;
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box.current)) { event.preventDefault(); first.focus(); }
        }
      }} className="w-full max-w-md max-h-[85dvh] flex flex-col bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black outline-none">
      <div className="desktop-titlebar shrink-0 flex items-center justify-between bg-[#000080] px-2 py-1 text-xs font-bold text-white">
        <span>{title}</span><button type="button" onClick={close} aria-label={`${title} 닫기`} className="win-btn flex h-5 w-5 items-center justify-center text-black">✕</button>
      </div>
      <div className="min-h-0 overflow-y-auto p-3 text-xs">{children}</div>
    </div>
  </div>, document.body);
}


export function PetDiary(props: { group: string; close: () => void }) { return <DiaryWindow {...props} />; }
