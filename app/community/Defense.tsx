"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { Objection } from "./client";
const DefenseWindow = dynamic(() => import("./DefenseWindow"));
export function DefenseButton({ group, book, objection, reviewer, title }: { group: string; book: string; objection: Objection; reviewer: string; title: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="ml-2 text-xs text-[#800000] underline whitespace-nowrap" onClick={() => setOpen(true)}>🗣️ 최종 변론</button>
    {open && <DefenseWindow group={group} book={book} objection={objection} reviewer={reviewer} title={title} close={() => setOpen(false)} />}</>;
}
