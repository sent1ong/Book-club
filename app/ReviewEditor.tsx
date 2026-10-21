"use client";
import React, { useRef } from "react";
import { FORMAT_MARKER, editReviewText, toggleSelection } from "./reviewMarkup";
export default function ReviewEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null), composing = useRef(false), selection = useRef({ start: 0, end: 0 });
  const text = editReviewText(value);
  const remember = () => { if (ref.current) selection.current = { start: ref.current.selectionStart, end: ref.current.selectionEnd }; };
  const format = (token: string) => {
    if (composing.current || !ref.current) return;
    let source = text, { start, end } = selection.current;
    if (!value.includes(FORMAT_MARKER)) {
      const escape = (s: string) => s.replace(/[\\*~=]/g, "\\$&");
      source = escape(text); start = escape(text.slice(0, start)).length; end = escape(text.slice(0, end)).length;
    }
    const result = toggleSelection(source, start, end, token); if (!result) return;
    const input = ref.current; input.focus(); input.setSelectionRange(0, text.length);
    // Native editing keeps the browser undo transaction where supported.
    if (!document.execCommand("insertText", false, result.text)) input.value = result.text;
    onChange(FORMAT_MARKER + result.text);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(result.start, result.end); remember(); });
  };
  return <div className="min-w-0"><div className="flex flex-nowrap items-center justify-between gap-1 mb-0.5"><label htmlFor="review-input" className="text-[11px] font-bold text-gray-800 whitespace-nowrap">REVIEW (한줄평)</label><div className="flex shrink-0 gap-1" aria-label="선택한 글자 서식">{[["**", "B", "볼드"], ["*", "I", "이탤릭"], ["~~", "S", "취소선"], ["==", "🖍", "형광펜"]].map(([token,label,name]) => <button key={token} type="button" aria-label={name} title={name + " · 글자를 선택한 뒤 누르세요"} className="win-btn w-6 h-[18px] text-[11px] leading-none" style={{ fontWeight: token === "**" ? 700 : undefined, fontStyle: token === "*" ? "italic" : undefined, textDecoration: token === "~~" ? "line-through" : undefined }} onPointerDown={e => e.preventDefault()} onClick={() => format(token)}>{label}</button>)}</div></div><textarea ref={ref} id="review-input" rows={2} value={text} onSelect={remember} onKeyUp={remember} onPointerUp={remember} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; remember(); }} onChange={e => { onChange((value.includes(FORMAT_MARKER) ? FORMAT_MARKER : "") + e.target.value); remember(); }} className="w-full p-1.5 text-xs bg-white win-inset outline-none resize-none" placeholder={"서식: 글자를 드래그한 뒤 원하는 버튼을 눌러 꾸미기.\n키워드: 한줄평 맨 마지막에 입력! 쉼표 없이 띄어쓰기로 구분. 예: #연하공 #연상수"} /></div>;
}
