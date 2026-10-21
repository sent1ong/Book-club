"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useWindowEscape } from "../windowEscape";
import { petMemory } from "./memoryCache";
import { loadPetGenerations, loadDiaries, type SavedDiary } from "./petData";

type Generation = { id: number; generation_number: number; pet_name: string | null; color_variant: string | null };
type Diary = SavedDiary;
const FILTERS = ["none", "hue-rotate(25deg) saturate(1.1)", "hue-rotate(115deg) saturate(1.05)",
  "hue-rotate(315deg) saturate(1.1)", "hue-rotate(175deg) saturate(1.05)", "hue-rotate(55deg) saturate(1.1)"];
const HELP = "📓 비밀 일기장\n\n펫은 알에서 깨어나면 하루에 한 편씩 일기를 써요.\n\n아기부터 성인까지, 종마다 다른 말투로 이야기를 남긴답니다. ♡\n\nPET.exe 오른쪽 아래 일기장을 눌러보세요.\n\n세대가 바뀌어도 일기는 계속 남아요!";

export function PetPopup({ title, close, children, front = false }: {
  title: string; close: () => void; children: React.ReactNode; front?: boolean;
}) {
  useWindowEscape(close, true, front ? 90 : 80);
  const box = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<div className={`fixed inset-0 flex items-center justify-center bg-black/40 p-3 ${front ? "z-[90]" : "z-[80]"}`}>
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          const items = box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']");
          if (!items?.length) return;
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box.current)) { event.preventDefault(); first.focus(); }
        }
      }} className="w-full max-w-md max-h-[85dvh] flex flex-col bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black outline-none">
      <div className="desktop-titlebar shrink-0 flex items-center justify-between bg-[#000080] px-2 py-1 text-xs font-bold text-white">
        <span>{title}</span><button type="button" onClick={close} aria-label={`${title} 닫기`} className="win-btn flex h-5 w-5 items-center justify-center text-black">✕</button>
      </div>
      <div className="min-h-0 overflow-y-auto p-3 text-xs">{children}</div>
    </div>
  </div>, document.body);
}

export function PetDiary({ group, close }: { group: string; close: () => void }) {
  const [generations, setGenerations] = useState<Generation[]>(() => petMemory.peek<Generation[]>(group, "generations")?.value || []);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [entry, setEntry] = useState<Diary | null>(null);
  const [help, setHelp] = useState(false);
  const [loading, setLoading] = useState(!petMemory.peek(group, "generations"));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const closeRef = React.useRef(close);
  closeRef.current = close;
  useEffect(() => { setEntry(null); }, [group, selected?.id]);
  useEffect(() => {
    let cancelled = false;
    const cached = selected ? petMemory.peek<Diary[]>(group, `diaries:${selected.id}`) : petMemory.peek<Generation[]>(group, "generations");
    setLoading(!cached); setError(""); setNotice("");
    if (selected) setDiaries((cached?.value || []) as Diary[]);
    else setGenerations((cached?.value || []) as Generation[]);
    void (async () => {
      try {
        const rows: any[] = selected ? await loadDiaries(group, selected.id) : await loadPetGenerations(group);
        if (!cancelled) { if (selected) setDiaries(rows); else setGenerations(rows); }
      } catch (e) {
        if (!cancelled) {
          if (cached) setNotice("최근에 불러온 내용을 표시하고 있어요. 갱신하려면 다시 시도해 주세요.");
          else setError("일기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
      }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [group, selected?.id, retry]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") setRetry(value => value + 1); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    const denied = (event: Event) => { if ((event as CustomEvent).detail === group) closeRef.current(); };
    window.addEventListener("bc98:pet-access-denied", denied);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("bc98:pet-access-denied", denied); };
  }, [group]);
  return <>
    <PetPopup title="PET_DIARY.exe" close={close}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">{selected ? `${selected.generation_number}세대 · ${selected.pet_name?.trim() || `${selected.generation_number}세대`}` : "세대별 비밀 일기"}</span>
        <button type="button" onClick={() => setHelp(true)} aria-label="비밀 일기장 도움말" className="win-btn h-5 w-5 shrink-0 font-bold">?</button>
      </div>
      {selected && <button type="button" className="win-btn mb-2 px-2 py-1" onClick={() => { if (entry) setEntry(null); else setSelected(null); }}>← {entry ? "일기 목록" : "세대 목록"}</button>}
      {notice && <p role="status" className="mb-2 leading-5">{notice} <button type="button" className="win-btn px-1" onClick={() => setRetry(x => x + 1)}>다시 시도</button></p>}
      {loading ? <p role="status">불러오는 중...</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="win-btn mt-2 px-2 py-1" onClick={() => setRetry(x => x + 1)}>다시 시도</button></div>
        : entry ? <article className="win-inset bg-[#fffbea] p-3"><h2 className="mb-1 font-bold">{entry.title}</h2><p className="mb-3 text-gray-600">{entry.diary_date}</p><p className="whitespace-pre-wrap break-words leading-6">{entry.body}</p><p className="mt-4 text-right">— {entry.display_name}</p></article>
        : !selected ? <div className="win-inset max-h-[224px] overflow-y-auto bg-white" aria-label="세대 목록">
          {!generations.length && <p className="p-3">아직 펫 세대가 없어요.</p>}
          {generations.map(g => <button key={g.id} type="button" onClick={() => setSelected(g)} className="flex h-11 w-full items-center gap-2 border-b px-2 text-left hover:bg-[#e8e8ff] focus:bg-[#e8e8ff]">
            <Image src="/pets/deco/star_mark.png" alt="" width={22} height={22} unoptimized style={{ filter: FILTERS[(g.generation_number - 1) % FILTERS.length] }} />
            <span className="min-w-0 break-words">{g.generation_number}세대 · {g.pet_name?.trim() || `${g.generation_number}세대`}</span>
          </button>)}
        </div> : <div className="win-inset max-h-[220px] overflow-y-auto bg-white" aria-label="일기 목록">
          {!diaries.length && <p className="p-3 leading-6">아직 저장된 일기가 없어요.</p>}
          {diaries.map(d => <button type="button" key={d.id} onClick={() => setEntry(d)} className="flex min-h-11 w-full flex-col justify-center border-b px-2 py-1 text-left hover:bg-[#e8e8ff]"><span className="text-gray-600">{d.diary_date}</span><span>{d.title}</span></button>)}
        </div>}
    </PetPopup>
    {help && <PetPopup title="PET_DIARY.exe — 도움말" close={() => setHelp(false)} front><p className="whitespace-pre-wrap leading-6">{HELP}</p></PetPopup>}
  </>;
}
