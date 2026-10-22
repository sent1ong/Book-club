"use client";
import { useEffect, useState } from "react";
import { secureClient } from "../security/client";
import { isRegisteredGroup } from "../security/groups";
import { petMemory } from "./memoryCache";

type Times = Record<string, { feed: string | null; pet: string | null }>;
export function useCareTimes(group: string, miniId: number | undefined, currentId: number | undefined, reload: number) {
  const [snapshot, setSnapshot] = useState<{ key: string; times: Times; error: string }>({ key: "", times: {}, error: "" });
  const ids = Array.from(new Set([miniId, currentId].filter((id): id is number => id !== undefined))).sort((a, b) => a - b);
  const resource = "care-times:" + ids.join(",");
  const key = JSON.stringify([group, resource]);
  useEffect(() => {
    if (!isRegisteredGroup(group) || !ids.length) return;
    let cancelled = false, inFlight = false;
    const load = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const times = await petMemory.load<Times>(group, resource, async () => {
          const result = await secureClient.careTimes(group, ids);
          if (result.error) throw Error(result.error.message);
          return result.data;
        }, 15000);
        if (!cancelled) setSnapshot({ key, times, error: "" });
      } catch {
        if (!cancelled) setSnapshot({ key, times: {}, error: "돌봄 시각을 확인하지 못했어요." });
      } finally { inFlight = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    const onVisible = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [group, resource, reload]);
  return snapshot.key === key ? snapshot : { key, times: {}, error: "" };
}
