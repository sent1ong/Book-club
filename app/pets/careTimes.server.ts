import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../security/server";

export type CareTimes = Record<string, { feed: string | null; pet: string | null }>;

// Return only the two real timestamps needed by each pet, never the care history.
export async function readCareTimes(db: SupabaseClient, group: string, ids: (string | number)[]): Promise<CareTimes> {
  const owned = await db.from("pet_generations").select("id")
    .eq("group_name", group).in("id", ids);
  if (owned.error) throw new ApiError("펫을 확인하지 못했어요.", 503);
  const allowed = new Set((owned.data || []).map(row => String(row.id)));
  if (ids.some(id => !allowed.has(String(id)))) throw new ApiError("이 모임의 펫을 선택해 주세요.", 404);
  const rows = await Promise.all(ids.map(async id => {
    const stamps = await Promise.all((["feed", "pet"] as const).map(async kind => {
      const result = await db.from("pet_care_actions").select("created_at")
        .eq("group_name", group).eq("generation_id", id).eq("action_type", kind)
        .not("created_at", "is", null).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (result.error) throw new ApiError("돌봄 시각을 확인하지 못했어요.", 503);
      return result.data?.created_at || null;
    }));
    return [String(id), { feed: stamps[0], pet: stamps[1] }] as const;
  }));
  return Object.fromEntries(rows);
}
