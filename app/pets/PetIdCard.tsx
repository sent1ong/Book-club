"use client";
import React, { useEffect, useRef, useState } from "react";
import { PetPopup } from "./PetDiary";
import { petMemory } from "./memoryCache";
import { secureClient } from "../security/client";
import type { PetSnapshot } from "./petData";

export type PetMemento = {
  generation_id: number; group_name: string; species: string; item_key: string;
  item_name: string; emoji: string; introduction: string; confirmed_at: string; is_commemorative: boolean;
};
const NAMES: Record<string,string> = {bogli:"보글이",bosongi:"보송이",byeolkongi:"별콩이",dungdungi:"둥둥이",hornkong:"뿔콩이",kongmongi:"콩몽이"};
const COLORS: Record<string,string> = { original:"#fff5e6", lavender:"#f0e8ff", mint:"#e4f7ed", peach:"#ffe9e7", sky:"#e4f2ff", butter:"#fff7ce" };
export function canShowPetId(pet: PetSnapshot | null, now=Date.now()) {
  return !!pet && ["baby","teen","adult"].includes(pet.stage) && !pet.died_at &&
    (!pet.adult_at || Date.parse(pet.adult_at) + 14*86400000 > now);
}
export function petRegistration(generation: number) { return `PET-${String(generation).padStart(4,"0")}`; }
export function archivedPets(pets: PetSnapshot[]) {
  return pets.filter(p=>p.stage==="dead" || !!p.died_at).slice().sort((a,b)=>a.generation_number-b.generation_number);
}
function dateLabel(date: string | null) {
  if(!date || !Number.isFinite(Date.parse(date))) return "기록 없음";
  return new Date(date).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"});
}
async function loadMementos(group: string, force=false) {
  return petMemory.load<PetMemento[]>(group,"mementos",async()=>{
    const rows: PetMemento[]=[];
    for(let offset=0;;){
      const result=await secureClient.from("pet_mementos").select("generation_id,group_name,species,item_key,item_name,emoji,introduction,confirmed_at,is_commemorative",{count:"exact"})
        .eq("group_name",group).order("generation_id").range(offset,offset+199);
      if(result.error) throw Error("애장품 기록을 불러오지 못했어요.");
      const batch=result.data||[]; rows.push(...batch.filter((r:PetMemento)=>r.group_name===group));offset+=batch.length;
      if(!batch.length || (typeof result.count==="number" && offset>=result.count)) return rows;
    }
  },30000,force);
}
export function usePetMementos(group:string, active:boolean, pet:PetSnapshot|null, reload:number) {
  const [snapshot,setSnapshot]=useState<{group:string;rows:PetMemento[];loading:boolean;error:string}>(()=>({group,rows:petMemory.peek<PetMemento[]>(group,"mementos")?.value||[],loading:false,error:""}));
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!active) return;
    let cancelled=false;
    const cached=petMemory.peek<PetMemento[]>(group,"mementos");
    setSnapshot({group,rows:cached?.value||[],loading:!cached,error:""});
    const missingAdult=pet && ["adult","dead"].includes(pet.stage) && !cached?.value.some(m=>String(m.generation_id)===String(pet.id));
    void loadMementos(group,!!missingAdult).then(rows=>{if(!cancelled)setSnapshot({group,rows,loading:false,error:""});})
      .catch(()=>{if(!cancelled)setSnapshot({group,rows:cached?.value||[],loading:false,error:"애장품 기록을 불러오지 못했어요."});});
    return ()=>{cancelled=true;};
  },[group,active,pet?.id,pet?.stage,reload,retry]);
  useEffect(()=>{if(!active)return;const timer=window.setInterval(()=>{if(document.visibilityState!=="hidden")setRetry(x=>x+1);},30000);return()=>window.clearInterval(timer);},[active]);
  const current=snapshot.group===group?snapshot:{group,rows:[],loading:active,error:""};
  const byId:Record<string,PetMemento>={};for(const m of current.rows)byId[String(m.generation_id)]=m;
  return {...current,byId,retry:()=>setRetry(x=>x+1)};
}

export function PetIdCard({pet,sprite,colorVariant,memento,loading,error}: {
  pet:PetSnapshot;sprite:React.ReactNode;colorVariant:string;memento?:PetMemento;loading?:boolean;error?:string;
}) {
  const adult=pet.stage==="adult"||pet.stage==="dead"||!!pet.died_at;
  const actualItem=memento?.group_name===pet.group_name && String(memento?.generation_id)===String(pet.id) && memento?.species===pet.species ? memento:undefined;
  return <article aria-label={`${pet.generation_number}세대 펫 신분증`} className="w-full min-w-0 border-2 border-[#a58cb1] p-3 text-xs leading-5 shadow-sm" style={{backgroundColor:COLORS[colorVariant]||COLORS.original}}>
    <header className="mb-2 flex flex-wrap items-center justify-between gap-x-2 border-b border-[#b9a6c4] pb-1 text-[#594173]">
      <div><p className="font-bold tracking-wide">BOOK CLUB 98</p><p className="text-xs">PET ID CARD</p></div>
      <strong className="font-mono text-xs">{petRegistration(pet.generation_number)}</strong>
    </header>
    <p className="mb-2 break-all text-xs text-[#6e6077]">{pet.group_name}</p>
    <div className="flex items-start gap-2">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-white/80 bg-white/60" aria-hidden="true">{sprite}</div>
      <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        <dt className="text-xs">이름</dt><dd className="break-all font-bold">{pet.pet_name?.trim()||"이름 없음"}</dd>
        <dt className="text-xs">종족</dt><dd className="break-words">{NAMES[pet.species]||pet.species}</dd>
        <dt className="text-xs">세대</dt><dd>{pet.generation_number}세대</dd>
        <dt className="whitespace-nowrap text-xs">이름 지어준 사람</dt><dd className="break-all">{pet.named_by?.trim()||"기록 없음"}</dd>
      </dl>
    </div>
    {(pet.stage==="dead"||pet.died_at) && <div className="mt-2 border-t border-[#cabbcf] pt-1 text-xs leading-5 text-[#5f5268]">
      <p>최종 경험치: {pet.xp} XP</p>
      <p>🥚 태어난 날(알 입양): {dateLabel(pet.born_at)}</p>
      <p>✨ 성인이 된 날: {dateLabel(pet.adult_at)}</p>
      <p>🪦 무지개다리를 건넌 날: {dateLabel(pet.died_at)}</p>
    </div>}
    {adult && <footer className="mt-2 border-t border-[#cabbcf] pt-2">
      <p className="text-xs font-bold tracking-wide text-[#80628e]">MY FAVORITE THING ♡</p>
      {actualItem ? <><p className="mt-1 break-words font-bold">애장품 · {actualItem.emoji === "🔘" ? (
        <span role="img" aria-label="연보라색 단추" style={{display:"inline-grid",verticalAlign:"-2px",width:14,height:14,
          gridTemplateColumns:"repeat(2, 2px)",gap:2,alignContent:"center",justifyContent:"center",
          borderRadius:"50%",background:"#e5d3f7",border:"1px solid #b89ace",boxShadow:"inset 1px 1px 0 #fff4ff"}}>
          {[0,1,2,3].map(hole=><span key={hole} style={{width:2,height:2,borderRadius:"50%",background:"#9470ae"}} />)}
        </span>
      ) : actualItem.emoji} {actualItem.item_name}</p>
        <p className="mt-1 break-words">{actualItem.introduction}</p>
        <p className="mt-1 text-xs leading-5 text-[#75647d]">{actualItem.is_commemorative?"도입 후 기념 기록":"확정 기록"} · {dateLabel(actualItem.confirmed_at)}</p>
      </> : <p role="status" className="mt-1 text-[#75647d]">{loading?"애장품 기록을 확인하고 있어요.":error||"기록된 애장품이 없어요."}</p>}
    </footer>}
  </article>;
}

export function PetIdPopup({pet,sprite,colorVariant,memento,loading,error,retry,close}:{
  pet:PetSnapshot;sprite:React.ReactNode;colorVariant:string;memento?:PetMemento;loading:boolean;error:string;retry:()=>void;close:()=>void;
}) {
  return <PetPopup title="PET.exe — 펫 신분증" close={close} front>
    <PetIdCard pet={pet} sprite={sprite} colorVariant={colorVariant} memento={memento} loading={loading} error={error}/>
    {error && <button type="button" className="win-btn mt-2 px-2 py-1" onClick={retry}>애장품 다시 확인</button>}
  </PetPopup>;
}

export function PetIdGallery({pets,renderCard}:{pets:PetSnapshot[];renderCard:(pet:PetSnapshot)=>React.ReactNode}) {
  const ordered=archivedPets(pets);
  const container=useRef<HTMLDivElement>(null);
  const [height,setHeight]=useState<number>();
  useEffect(()=>{
    const box=container.current;if(!box)return;
    const cards=Array.from(box.children) as HTMLElement[];
    const measure=()=>{
      const max=Math.max(0,...cards.map(card=>card.firstElementChild?.getBoundingClientRect().height||0));
      if(max>0)setHeight(Math.ceil(max));
    };
    measure();const observer=new ResizeObserver(measure);
    cards.forEach(card=>{if(card.firstElementChild)observer.observe(card.firstElementChild);});
    return()=>observer.disconnect();
  },[pets]);
  if(!ordered.length)return <p className="mt-3 text-gray-600">아직 기록된 이전 세대가 없어요.</p>;
  return <div ref={container} className="mt-3 snap-y snap-proximity overflow-y-auto overscroll-contain" style={{height:height||340}} aria-label="오래된 세대순 역대 펫 신분증">
    {ordered.map(pet=><div key={pet.id} className="w-full snap-start" style={{minHeight:height}}>{renderCard(pet)}</div>)}
  </div>;
}
