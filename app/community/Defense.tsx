"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import { PetPopup } from "../pets/PetDiary";
import type { Objection } from "./client";
const DefenseWindow = dynamic(() => import("./DefenseWindow"));
export function DefenseButton({ group, book, objection, reviewer, title, members = [], onSaved }: { group: string; book: string; objection: Objection; reviewer: string; title: string; members?: string[]; onSaved?: (row?: Objection) => void }) {
  const [open, setOpen] = useState<"defense" | "witness" | null>(null);
  return <><button type="button" className="ml-2 text-xs text-[#800000] underline whitespace-nowrap" onClick={() => setOpen("defense")}>🗣️ 최종 변론</button>
    {(!objection.closed || objection.witness) && <button type="button" className="ml-2 text-xs text-[#800000] underline whitespace-nowrap" onClick={() => setOpen("witness")}>{objection.witness ? "📜 증언 보기" : "📣 증인 소환"}</button>}
    {open && <React.Suspense fallback={<PetPopup title="OBJECTION.exe" close={() => setOpen(null)}><p role="status">화면을 준비하는 중…</p></PetPopup>}><DefenseWindow group={group} book={book} objection={objection} reviewer={reviewer} title={title} mode={open} members={members} onSaved={onSaved} close={() => setOpen(null)} /></React.Suspense>}</>;
}
