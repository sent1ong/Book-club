"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CURSORS, CursorEffect, type CursorKey } from "./Cursor";
import { configureSound, disposeSound, systemSound, unlockSound } from "./sounds";
export type Effects = { sound: boolean; volume: number; cursor: CursorKey };
export const DEFAULT_EFFECTS: Effects = { sound: false, volume: 0.3, cursor: "default" };
export const EFFECTS_KEY = "bookclub98:desktop-effects:v1";
export function parseEffects(raw: string | null): Effects {
  try { const value = JSON.parse(raw || "null"); return { sound: value?.sound === true, volume: typeof value?.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : 0.3, cursor: CURSORS.some(([key]) => key === value?.cursor) ? value.cursor : "default" }; }
  catch { return { ...DEFAULT_EFFECTS }; }
}
type Context = { value: Effects; preview: (value: Effects) => void; restore: () => void; apply: (value: Effects) => void };
const Settings = createContext<Context | null>(null);
export function DesktopEffectsProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState(DEFAULT_EFFECTS), saved = useRef(DEFAULT_EFFECTS);
  useEffect(() => { try { saved.current = parseEffects(localStorage.getItem(EFFECTS_KEY)); setValue(saved.current); } catch {} }, []);
  useEffect(() => { configureSound(value); }, [value]);
  const preview = useCallback((next: Effects) => { configureSound(next); setValue(next); }, []);
  const restore = useCallback(() => { configureSound(saved.current); setValue(saved.current); }, []);
  const apply = useCallback((next: Effects) => { localStorage.setItem(EFFECTS_KEY, JSON.stringify(next)); saved.current = next; configureSound(next); setValue(next); }, []);
  useEffect(() => {
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const gesture = () => unlockSound();
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || !(event.target instanceof Element) || !event.target.closest('button:not(:disabled),a[href],[role="button"]')) return;
      clearTimeout(clickTimer); clickTimer = setTimeout(() => systemSound("click"), 75);
    };
    let dialogs = document.querySelectorAll('[role="dialog"]').length;
    const observer = new MutationObserver(records => {
      const next = document.querySelectorAll('[role="dialog"]').length;
      if (next !== dialogs) { clearTimeout(clickTimer); systemSound(next > dialogs ? "open" : "close"); dialogs = next; }
      else if (records.some(record => Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches('[role="alert"]') || node.querySelector('[role="alert"]'))))) { clearTimeout(clickTimer); systemSound("error"); }
    });
    document.addEventListener("pointerdown", gesture, true); document.addEventListener("keydown", gesture, true); document.addEventListener("click", click, true);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => { clearTimeout(clickTimer); observer.disconnect(); document.removeEventListener("pointerdown", gesture, true); document.removeEventListener("keydown", gesture, true); document.removeEventListener("click", click, true); disposeSound(); };
  }, []);
  return <Settings.Provider value={{ value, preview, restore, apply }}><CursorEffect selected={value.cursor} />{children}</Settings.Provider>;
}
export function EffectsEditor({ kind, back, close }: { kind: "sound" | "cursor"; back: () => void; close: () => void }) {
  const context = useContext(Settings); if (!context) throw new Error("Effects provider missing");
  const { value, preview, restore, apply } = context;
  const [error, setError] = useState(""), [fine, setFine] = useState(false);
  useEffect(() => { const query = matchMedia("(any-hover: hover) and (any-pointer: fine)"); const update = () => setFine(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  useEffect(() => () => restore(), [restore]);
  return <div className="space-y-4">
    <button type="button" className="win-btn px-2 py-1" onClick={back}>← 메뉴로</button>
    <p>선택하면 미리 적용돼요. 적용을 눌러야 저장돼요.</p>
    {kind === "sound" ? <>
      <label className="flex items-center gap-2"><input type="checkbox" checked={value.sound} onChange={e => { const next = { ...value, sound: e.target.checked }; preview(next); if (next.sound) unlockSound(); }} />시스템 효과음 켜기</label>
      <label className="block">볼륨 · {Math.round(value.volume * 100)}%<input aria-label="효과음 볼륨" className="block w-full mt-2" type="range" min={0} max={100} value={Math.round(value.volume * 100)} onChange={e => preview({ ...value, volume: Number(e.target.value) / 100 })} /></label>
      <button type="button" className="win-btn px-3 py-2" disabled={!value.sound} onClick={() => { unlockSound(); setTimeout(() => systemSound("notice"), 0); }}>미리 듣기</button><p className="leading-5">기본값은 꺼짐이에요.<br />JUKEBOX 음악 볼륨과는 별개로 동작해요.</p>
    </> : <>
      {!fine && <p role="status">마우스 커서는 PC에서 사용할 수 있어요.</p>}
      <fieldset className="grid grid-cols-2 gap-2"><legend className="font-bold mb-2">커서 선택</legend>{CURSORS.map(([key, label]) => <label key={key} className="win-btn p-2 flex gap-2 items-center"><input type="radio" name="desktop-cursor" value={key} checked={value.cursor === key} onChange={() => preview({ ...value, cursor: key })} />{label}</label>)}</fieldset>
      <p className="leading-5">원래 커서의 움직임을 그대로 재생해요.<br />텍스트 입력·드래그 중에는 기본 커서를 사용해요.</p>
    </>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-2 justify-end border-t border-gray-400 pt-3">
      <button type="button" className="win-btn px-3 py-2 mr-auto" onClick={() => preview(kind === "sound" ? { ...value, sound: false, volume: 0.3 } : { ...value, cursor: "default" })}>기본값 복원</button>
      <button type="button" className="win-btn px-3 py-2" onClick={() => { restore(); close(); }}>취소</button>
      <button type="button" className="win-btn px-3 py-2 font-bold" onClick={() => { try { apply(value); close(); } catch { setError("브라우저에 저장하지 못했어요. 저장 공간 설정을 확인해 주세요."); } }}>적용</button>
    </div>
  </div>;
}
