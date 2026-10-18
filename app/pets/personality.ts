"use client";
import { useEffect, useState } from "react";
import { secureClient } from "../security/client";
import { petMemory } from "./memoryCache";
import type { PetSnapshot } from "./petData";
export type PetPersonality = { generation_id: number; group_name: string; species: string; personality_key: string; personality_name: string; description: string };
export async function loadPersonalities(group: string, force = false) {
  return petMemory.load<PetPersonality[]>(group, "personalities", async () => {
    const rows: PetPersonality[] = [];
    for (let offset = 0; ; ) {
      const result = await secureClient.from("pet_personalities").select("generation_id,group_name,species,personality_key,personality_name,description", { count: "exact" })
        .eq("group_name", group).order("generation_id").range(offset, offset + 199);
      if (result.error) throw Error("성격 기록을 불러오지 못했어요.");
      const batch: PetPersonality[] = result.data || [];
      rows.push(...batch.filter(row => row.group_name === group)); offset += batch.length;
      if (!batch.length || (typeof result.count === "number" && offset >= result.count)) return rows;
    }
  }, 30000, force);
}
export function matchingPersonality(pet: PetSnapshot, profile?: PetPersonality) {
  return pet.stage !== "egg" && profile?.group_name === pet.group_name && String(profile.generation_id) === String(pet.id) && profile.species === pet.species ? profile : undefined;
}
export function usePetPersonalities(group: string, active: boolean, pet: PetSnapshot | null, reload: number) {
  const [snapshot, setSnapshot] = useState<{ group: string; rows: PetPersonality[]; loading: boolean; error: string }>(() => ({ group, rows: petMemory.peek<PetPersonality[]>(group, "personalities")?.value || [], loading: false, error: "" }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = petMemory.peek<PetPersonality[]>(group, "personalities");
    setSnapshot({ group, rows: cached?.value || [], loading: !cached, error: "" });
    const missing = pet && pet.stage !== "egg" && !cached?.value.some(row => String(row.generation_id) === String(pet.id));
    void loadPersonalities(group, !!missing).then(rows => { if (!cancelled) setSnapshot({ group, rows, loading: false, error: "" }); })
      .catch(() => { if (!cancelled) setSnapshot({ group, rows: cached?.value || [], loading: false, error: "성격 기록을 불러오지 못했어요." }); });
    return () => { cancelled = true; };
  }, [group, active, pet?.id, pet?.stage, reload, retry]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") setRetry(n => n + 1); }, 30000);
    return () => clearInterval(timer);
  }, [active]);
  const current = snapshot.group === group ? snapshot : { group, rows: [], loading: active, error: "" };
  const byId: Record<string, PetPersonality> = {};
  for (const row of current.rows) byId[String(row.generation_id)] = row;
  return { ...current, byId, retry: () => setRetry(n => n + 1) };
}
