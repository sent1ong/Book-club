"use client";
import { useEffect, useState } from "react";
import { secureClient } from "../security/client";
import { petMemory } from "./memoryCache";
import type { PetSnapshot } from "./petData";
export type PetSnack = { generation_id: number; group_name: string; species: string; generation_number: number; snack_name: string; emoji: string };
export async function loadSnacks(group: string, force = false) {
  return petMemory.load<PetSnack[]>(group, "snacks", async () => {
    const rows: PetSnack[] = [];
    for (let offset = 0; ; ) {
      const result = await secureClient.from("pet_snacks").select("generation_id,group_name,species,generation_number,snack_name,emoji", { count: "exact" })
        .eq("group_name", group).order("generation_id").range(offset, offset + 199);
      if (result.error) throw Error("간식 기록을 불러오지 못했어요.");
      const batch: PetSnack[] = result.data || [];
      rows.push(...batch.filter(row => row.group_name === group)); offset += batch.length;
      if (!batch.length || (typeof result.count === "number" && offset >= result.count)) return rows;
    }
  }, 30000, force);
}
export function matchingSnack(pet: PetSnapshot, profile?: PetSnack) {
  return pet.stage !== "egg" && profile?.group_name === pet.group_name && String(profile.generation_id) === String(pet.id) && profile.species === pet.species && profile.generation_number === pet.generation_number ? profile : undefined;
}
export function usePetSnacks(group: string, active: boolean, pet: PetSnapshot | null, reload: number) {
  const [snapshot, setSnapshot] = useState<{ group: string; rows: PetSnack[]; loading: boolean; error: string }>(() => ({ group, rows: petMemory.peek<PetSnack[]>(group, "snacks")?.value || [], loading: false, error: "" }));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = petMemory.peek<PetSnack[]>(group, "snacks");
    setSnapshot({ group, rows: cached?.value || [], loading: !cached, error: "" });
    const missing = pet && pet.stage !== "egg" && !cached?.value.some(row => String(row.generation_id) === String(pet.id));
    void loadSnacks(group, !!missing).then(rows => { if (!cancelled) setSnapshot({ group, rows, loading: false, error: "" }); })
      .catch(() => { if (!cancelled) setSnapshot({ group, rows: cached?.value || [], loading: false, error: "간식 기록을 불러오지 못했어요." }); });
    return () => { cancelled = true; };
  }, [group, active, pet?.id, pet?.stage, reload, retry]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") setRetry(n => n + 1); }, 30000);
    return () => clearInterval(timer);
  }, [active]);
  const current = snapshot.group === group ? snapshot : { group, rows: [], loading: active, error: "" };
  const byId: Record<string, PetSnack> = {};
  for (const row of current.rows) byId[String(row.generation_id)] = row;
  return { ...current, byId, retry: () => setRetry(n => n + 1) };
}
