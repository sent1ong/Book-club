"use client";
import React, { useEffect, useMemo, useState } from "react";
import { peekShelf, forgetShelf, type Shelf, type ShelfPick } from "./client";
import { PetPopup } from "../pets/PetDiary";

export function useShelfPicks(group: string) {
  const [snapshot, setSnapshot] = useState<Shelf | undefined>(() => peekShelf(group));
  useEffect(() => {
    const update = () => setSnapshot(peekShelf(group));
    update(); window.addEventListener("bc98:shelf-updated", update);
    const clear = (event: Event) => { if ((event as CustomEvent).detail === group) { forgetShelf(group); setSnapshot(undefined); } };
    window.addEventListener("bc98:pet-access-denied", clear);
    return () => { window.removeEventListener("bc98:shelf-updated", update); window.removeEventListener("bc98:pet-access-denied", clear); };
  }, [group]);
  return useMemo(() => {
    const map = new Map<string, ShelfPick[]>();
    if (snapshot?.group_name === group) for (const pick of snapshot.picks) {
      const rows = map.get(String(pick.book_id)) || []; rows.push(pick); map.set(String(pick.book_id), rows);
    }
    return map;
  }, [snapshot, group]);
}
export const ShelfBadge = React.memo(function ShelfBadge({ picks }: { picks?: ShelfPick[] }) {
  const [open, setOpen] = useState(false);
  if (!picks?.length) return null;
  return <><button type="button" className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-1 whitespace-nowrap" onClick={() => setOpen(true)}>🏆 올해의 픽{picks.length > 1 ? ` ×${picks.length}` : ""}</button>
    {open && <PetPopup title="🏆 올해의 픽" close={() => setOpen(false)}>{picks.map(pick => <div key={pick.user_name} className="mb-3 break-words"><b>{pick.user_name} · {pick.title}</b><p className="whitespace-pre-wrap mt-1">{pick.reason}</p></div>)}</PetPopup>}</>;
});
