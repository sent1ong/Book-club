"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PetPopup } from "./pets/PetDiary";

export const BACKGROUNDS = [
  ["클래식 틸", "#008080"], ["라벤더", "#BCA9DC"], ["베이비 블루", "#A9CEED"], ["민트", "#B7DDC6"],
  ["피치", "#F1C9BD"], ["버터", "#F0DFA6"], ["핑크", "#EABBD4"], ["차콜", "#565A66"],
] as const;
export const TITLE_COLORS = [["클래식 네이비", "#000080"], ["라벤더", "#8864AE"], ["와인", "#9A4569"],
  ["포레스트", "#397E70"], ["스카이 블루", "#427EBA"], ["차콜", "#474756"]] as const;
export type DesktopColors = { background: string; title: string };
export const DEFAULT_THEME: DesktopColors = { background: "#008080", title: "#000080" };
export const THEME_KEY = "bookclub98:desktop-theme:v1";
export function parseTheme(value: string | null): DesktopColors {
  try {
    const result = JSON.parse(value || "null");
    return { background: BACKGROUNDS.some(([, c]) => c === result?.background) ? result.background : DEFAULT_THEME.background,
      title: TITLE_COLORS.some(([, c]) => c === result?.title) ? result.title : DEFAULT_THEME.title };
  } catch { return { ...DEFAULT_THEME }; }
}
export function sameTheme(a: DesktopColors, b: DesktopColors) { return a.background === b.background && a.title === b.title; }
type ThemeContext = { theme: DesktopColors; preview: (next: DesktopColors) => void; restore: () => void; apply: (next: DesktopColors) => void };
const Theme = createContext<ThemeContext | null>(null);
export function DesktopThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<DesktopColors>(DEFAULT_THEME);
  const saved = useRef<DesktopColors>(DEFAULT_THEME);
  useEffect(() => {
    let initial = DEFAULT_THEME;
    try { initial = parseTheme(localStorage.getItem(THEME_KEY)); } catch { /* Use default when storage is blocked. */ }
    saved.current = initial; setTheme(initial);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--desktop-background", theme.background);
    document.documentElement.style.setProperty("--desktop-title", theme.title);
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => { meta.content = theme.background; });
  }, [theme]);
  const restore = useCallback(() => setTheme(saved.current), []);
  const apply = useCallback((next: DesktopColors) => {
    if (!sameTheme(next, saved.current)) localStorage.setItem(THEME_KEY, JSON.stringify(next));
    saved.current = next; setTheme(next);
  }, []);
  return <Theme.Provider value={{ theme, preview: setTheme, restore, apply }}>{children}</Theme.Provider>;
}
export function DesktopThemeWindow({ close }: { close: () => void }) {
  const context = useContext(Theme);
  if (!context) throw new Error("Theme provider is missing");
  const { theme, preview, restore, apply } = context;
  const [error, setError] = useState("");
  // Unmounting through another app or navigation must cancel the preview too.
  useEffect(() => () => restore(), [restore]);
  const cancel = () => { restore(); close(); };
  return <PetPopup title="DESKTOP_THEME.exe — 화면 꾸미기" close={cancel}>
    <div className="space-y-4">
      <p className="leading-relaxed">색을 고르면 화면에 미리 보여드려요.<br />적용을 눌러야 이 브라우저에 저장돼요.</p>
      <div className="win-inset p-5 flex justify-center" style={{ backgroundColor: theme.background }} aria-label="화면 색상 미리보기">
        <div className="win-outset w-full max-w-[220px] bg-[#c0c0c0] p-1">
          <div className="px-2 py-1 text-white font-bold" style={{ backgroundColor: theme.title }}>BOOK CLUB 98</div>
          <div className="win-inset bg-white m-2 p-3 text-black">나만의 작은 서재 ♡</div>
        </div>
      </div>
      <fieldset><legend className="font-bold mb-2">바탕화면 배경색</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{BACKGROUNDS.map(([name, color]) => <button key={color} type="button" aria-pressed={theme.background === color}
          onClick={() => { setError(""); preview({ ...theme, background: color }); }} className={`win-btn flex items-center gap-2 p-2 text-left min-w-0 ${theme.background === color ? "outline outline-2 outline-[#000080]" : ""}`}>
          <span className="w-5 h-5 shrink-0 border border-black/40" style={{ backgroundColor: color }} /><span>{name}{theme.background === color ? " ✓" : ""}</span>
        </button>)}</div>
      </fieldset>
      <fieldset><legend className="font-bold mb-2">창 제목 표시줄 색상</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{TITLE_COLORS.map(([name, color]) => <button key={color} type="button" aria-pressed={theme.title === color}
          onClick={() => { setError(""); preview({ ...theme, title: color }); }} className={`win-btn flex items-center gap-2 p-2 text-left min-w-0 ${theme.title === color ? "outline outline-2 outline-[#000080]" : ""}`}>
          <span className="w-5 h-5 shrink-0 border border-black/40" style={{ backgroundColor: color }} /><span>{name}{theme.title === color ? " ✓" : ""}</span>
        </button>)}</div>
      </fieldset>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-400 pt-3">
        <button type="button" className="win-btn px-3 py-2 mr-auto" onClick={() => { setError(""); preview({ ...DEFAULT_THEME }); }}>기본값 복원</button>
        <button type="button" className="win-btn px-3 py-2" onClick={cancel}>취소</button>
        <button type="button" className="win-btn px-3 py-2 font-bold" onClick={() => {
          try { apply(theme); close(); } catch { setError("브라우저에 저장하지 못했어요. 저장 공간 설정을 확인해 주세요."); }
        }}>적용</button>
      </div>
    </div>
  </PetPopup>;
}
