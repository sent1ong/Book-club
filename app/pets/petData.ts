import { secureClient } from "../security/client";
import { petMemory } from "./memoryCache";
import type { SecretPet } from "./secrets";

export type PetSnapshot = SecretPet & {
  baby_entered_at?: string | null; teen_entered_at?: string | null; last_petted_by?: string | null; last_petted_at?: string | null;
  named_by: string | null; xp: number; color_variant: string | null;
  decoration: string | null; born_at: string;
  stage: "egg" | "baby" | "teen" | "adult" | "dead";
};
export type SavedDiary = { id: number; generation_id: number; diary_date: string; display_name: string;
  title: string; body: string; is_final: boolean; generation_number: number };

export function cachedPet(group: string) {
  const cached = petMemory.peek<PetSnapshot | null>(group, "current");
  const pet = cached?.value;
  // Do not seed an already expired adult as a live pet while lifecycle runs.
  if (pet?.stage === "adult" && pet.adult_at && Date.parse(pet.adult_at) + 14 * 86400000 <= Date.now()) return undefined;
  return cached;
}

export function loadPetSnapshot(group: string, force = false) {
  return petMemory.load<PetSnapshot | null>(group, "current", async () => {
    const read = () => secureClient.from("pet_generations").select("*").eq("group_name", group)
      .order("generation_number", { ascending: false }).limit(1).maybeSingle();
    let result = await read();
    if (result.error) throw Error(result.error.message);
    const current = result.data as PetSnapshot | null;
    // Ordinary live pets need one request. Only overdue adults need the lifecycle
    // RPC before re-reading; the server cron remains responsible without visits.
    if (current?.stage === "adult" && current.adult_at && Date.parse(current.adult_at) + 14 * 86400000 <= Date.now()) {
      const lifecycle = await secureClient.rpc("pet_check_lifecycle", { p_group_name: group });
      if (lifecycle.error) throw Error(lifecycle.error.message);
      if (lifecycle.data === true) petMemory.invalidate(group);
      result = await read();
    }
    if (result.error) throw Error(result.error.message);
    return result.data as PetSnapshot | null;
  }, cachedPet(group) ? 8000 : 0, force);
}

async function allPages<T>(query: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; ) {
    const result = await query().range(offset, offset + 199);
    if (result.error) throw Error(result.error.message);
    const batch = result.data || [];
    rows.push(...batch);
    offset += batch.length;
    // Exact count avoids an unnecessary second request for short/empty lists,
    // while a lower server row cap cannot truncate history silently.
    if (!batch.length || (typeof result.count === "number" && offset >= result.count)) return rows;
  }
}

export function loadPetGenerations(group: string, force = false) {
  return petMemory.load<PetSnapshot[]>(group, "generations", () => allPages<PetSnapshot>(() =>
    secureClient.from("pet_generations").select("*", { count: "exact" })
      .eq("group_name", group).order("generation_number", { ascending: false })
  ), 30000, force);
}
export function loadDiaries(group: string, generation: number, force = false) {
  return petMemory.load<SavedDiary[]>(group, `diaries:${generation}`, () => allPages<SavedDiary>(() =>
    secureClient.from("pet_diaries").select("id,generation_id,generation_number,diary_date,display_name,title,body,is_final", { count: "exact" })
      .eq("group_name", group).eq("generation_id", generation).order("diary_date", { ascending: false })
  ), 30000, force);
}
