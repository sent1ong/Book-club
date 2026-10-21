"use client";
import React, { useEffect, useRef, useState } from "react";
import { PetPopup } from "./PetDiary";
import { petMemory } from "./memoryCache";
import type { PetSnapshot } from "./petData";
import { community } from "../community/client";
type CareStats = { group_name: string; generation_id: string; feed_count: number; pet_count: number; last_petted_by: string | null; last_petted_at: string | null };
const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date(value)).replace(/\. /g, ".").replace(/\.$/, "") : null;
export default function PetGrowth({ pet, close }: { pet: PetSnapshot; close: () => void }) {
  const [stats, setStats] = useState<CareStats | null>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const previousXp = useRef(pet.xp);
  const dead = pet.stage === "dead" || !!pet.died_at;
  useEffect(() => {
    let active = true; setError("");
    const force = retry > 0 || previousXp.current !== pet.xp; previousXp.current = pet.xp;
    void petMemory.load<CareStats>(pet.group_name, `care-stats:${pet.id}`, () => community<CareStats>(pet.group_name, { action: "pet-care-stats", generation: String(pet.id) }), dead ? 3600000 : 15000, force)
      .then(value => { if (active && value.group_name === pet.group_name && value.generation_id === String(pet.id)) setStats(value); })
      .catch(() => { if (active) setError("돌봄 기록을 불러오지 못했어요. 다시 시도해 주세요."); });
    return () => { active = false; };
  }, [pet.group_name, pet.id, pet.xp, dead, retry]);
  const stages = [{ key: "baby", label: "아기", entered: pet.baby_entered_at }, { key: "teen", label: "청소년", entered: pet.teen_entered_at }, { key: "adult", label: "성체", entered: pet.adult_at }];
  const same = stats?.generation_id === String(pet.id) && stats.group_name === pet.group_name ? stats : null;
  return <PetPopup title={`📷 PET_GROWTH.exe — ${pet.pet_name || "우리 펫"}`} close={close} front>
    <h2 className="font-bold mb-2">🐾 {pet.pet_name || "우리 펫"}의 성장 프로필</h2>
    <div className="grid grid-cols-3 gap-2 text-center">{stages.map(stage => <div key={stage.key}><img className="mx-auto" src={`/pets/${pet.species}/${stage.key}.png`} alt={`${pet.species} ${stage.label}`} width={60} height={60} onError={event => { event.currentTarget.style.visibility = "hidden"; }} /><b>{stage.label}</b><p className="text-[11px]">{date(stage.entered) || "날짜 기록 없음"}</p></div>)}</div>
    <section className="mt-4 border-t border-gray-400 pt-3" aria-label="누적 돌봄 기록"><h3 className="font-bold mb-2">♡ 함께한 돌봄 기록</h3>
      {error ? <p role="alert">{error}<button type="button" className="win-btn ml-2 px-2 py-1" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p> : same ? <>
        {dead && same.feed_count + same.pet_count === 0 ? <p>기록 없음</p> : <div className="grid grid-cols-2 gap-2 text-center"><p>🍪 먹이 주기<b className="block text-base mt-1">{same.feed_count}회</b></p><p>💕 쓰다듬기<b className="block text-base mt-1">{same.pet_count}회</b></p></div>}
        {same.last_petted_by && date(same.last_petted_at) && <p className="mt-3 break-words">마지막 쓰다듬기: {same.last_petted_by} · {date(same.last_petted_at)}</p>}
        <p className="text-gray-600 text-[11px] mt-2">이 세대에 저장된 성공한 돌봄 기록 기준</p>
      </> : <p role="status">돌봄 기록을 불러오는 중…</p>}
    </section>
  </PetPopup>;
}
