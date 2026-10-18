"use client";
import { useEffect, useState } from "react";
import { secureClient } from "../security/client";
import { petMemory } from "./memoryCache";
import type { PetSnapshot } from "./petData";
export type PetFarewell = { generation_id: number; group_name: string; species: string; generation_number: number; body: string; is_commemorative: boolean; confirmed_at: string };
export async function loadFarewells(group: string, force = false) {
  return petMemory.load<PetFarewell[]>(group, "farewells", async () => {
    const rows: PetFarewell[] = [];
    for (let offset = 0; ; ) {
      const result = await secureClient.from("pet_farewells").select("generation_id,group_name,species,generation_number,body,is_commemorative,confirmed_at", { count: "exact" })
        .eq("group_name", group).order("generation_id").range(offset, offset + 199);
      if (result.error) throw Error("마지막 한마디를 불러오지 못했어요.");
      const batch: PetFarewell[] = result.data || [];
      rows.push(...batch.filter(row => row.group_name === group)); offset += batch.length;
      if (!batch.length || (typeof result.count === "number" && offset >= result.count)) return rows;
    }
  }, 30000, force);
}
export function matchingFarewell(pet: PetSnapshot, profile?: PetFarewell) {
  return (pet.stage === "dead" || !!pet.died_at) && profile?.group_name === pet.group_name && String(profile.generation_id) === String(pet.id) && profile.species === pet.species && profile.generation_number === pet.generation_number ? profile : undefined;
}
export function usePetFarewells(group: string, active: boolean, pet: PetSnapshot | null, reload: number) {
  const [snapshot, setSnapshot] = useState<{ group: string; rows: PetFarewell[]; loading: boolean; error: string }>(() => ({ group, rows: petMemory.peek<PetFarewell[]>(group, "farewells")?.value || [], loading: false, error: "" }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = petMemory.peek<PetFarewell[]>(group, "farewells");
    setSnapshot({ group, rows: cached?.value || [], loading: !cached, error: "" });
    const missing = pet && (pet.stage === "dead" || !!pet.died_at) && !cached?.value.some(row => String(row.generation_id) === String(pet.id));
    void loadFarewells(group, !!missing).then(rows => { if (!cancelled) setSnapshot({ group, rows, loading: false, error: "" }); })
      .catch(() => { if (!cancelled) setSnapshot({ group, rows: cached?.value || [], loading: false, error: "마지막 한마디를 불러오지 못했어요." }); });
    return () => { cancelled = true; };
  }, [group, active, pet?.id, pet?.stage, reload, retry]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") setRetry(n => n + 1); }, 30000);
    return () => clearInterval(timer);
  }, [active]);
  const current = snapshot.group === group ? snapshot : { group, rows: [], loading: active, error: "" };
  const byId: Record<string, PetFarewell> = {};
  for (const row of current.rows) byId[String(row.generation_id)] = row;
  return { ...current, byId, retry: () => setRetry(n => n + 1) };
}
