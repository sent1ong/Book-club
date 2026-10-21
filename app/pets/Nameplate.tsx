"use client";
import React, { useEffect, useState } from "react";
import { PetPopup } from "./PetDiary";
const COLORS = { gray: ["기본 회색", "#e0e0e0"], pink: ["연핑크", "#f8dee8"], blue: ["연하늘색", "#dceefa"], mint: ["연민트", "#dcf2e8"], yellow: ["연노랑", "#fff4ce"] } as const;
type Color = keyof typeof COLORS;
export function PetNameplate({ name }: { name: string }) {
  const [color, setColor] = useState<Color>("gray"), [saved, setSaved] = useState<Color>("gray"), [open, setOpen] = useState(false);
  useEffect(() => { try { const value = localStorage.getItem("bookclub98:pet-nameplate"); if (value && value in COLORS) { setColor(value as Color); setSaved(value as Color); } } catch {} }, []);
  const cancel = () => { setColor(saved); setOpen(false); };
  return <><span className="inline-flex items-center gap-1 px-1 text-[#59385b]" style={{ backgroundColor: COLORS[color][1] }}>💗 {name}<button type="button" aria-label="펫 이름표 꾸미기" className="text-xs" onClick={() => setOpen(true)}>🎨</button></span>
    {open && <PetPopup title="펫 이름표 꾸미기" close={cancel}><p className="mb-2">이 브라우저에서만 보이는 이름표 색상이에요.</p><div className="flex flex-wrap gap-2">{(Object.keys(COLORS) as Color[]).map(key => <button type="button" className="win-btn px-2 py-2" key={key} aria-pressed={color === key} style={{ backgroundColor: COLORS[key][1] }} onClick={() => setColor(key)}>{COLORS[key][0]}</button>)}</div><div className="flex gap-2 mt-3"><button className="win-btn px-2 py-1" onClick={() => setColor("gray")}>기본값 복원</button><button className="win-btn px-2 py-1" onClick={() => { try { localStorage.setItem("bookclub98:pet-nameplate", color); } catch {} setSaved(color); setOpen(false); }}>적용</button><button className="win-btn px-2 py-1" onClick={cancel}>취소</button></div></PetPopup>}</>;
}
