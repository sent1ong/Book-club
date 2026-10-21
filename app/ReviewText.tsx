"use client";

import React, { memo, useMemo, useState } from "react";

export function Highlight({ text, query = "" }: { text: string; query?: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase(), nodes: React.ReactNode[] = [];
  let start = 0, found: number;
  while ((found = lower.indexOf(needle, start)) !== -1) {
    nodes.push(text.slice(start, found), <mark key={found} className="bg-[#fff0b0] text-inherit">{text.slice(found, found + needle.length)}</mark>);
    start = found + needle.length;
  }
  nodes.push(text.slice(start));
  return <>{nodes}</>;
}

export function reviewPreview(text: string) {
  const characters = Array.from(text);
  if (characters.length < 500) return text;
  let end = characters.slice(0, 350).join("").length;
  const before = text.slice(0, end), tokenStart = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n")) + 1;
  if (before.lastIndexOf("#") >= tokenStart) {
    while (end < text.length && !/\s/.test(text[end])) end++;
  } else {
    const boundary = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"), before.lastIndexOf(". "), before.lastIndexOf("! "));
    if (boundary >= end - 50) end = boundary;
    if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  }
  return text.slice(0, end).trimEnd();
}

export const ReviewText = memo(function ReviewText({ text, query = "" }: { text: string; query?: string }) {
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const preview = useMemo(() => reviewPreview(text), [text]);
  const collapsible = useMemo(() => Array.from(text).length >= 500, [text]);
  const expanded = expandedText === text;
  const visible = expanded ? text : preview;
  return <div className="text-gray-800 bg-gray-50 p-2 rounded win-inset mt-1 break-all text-xs leading-normal">
    <span className="whitespace-pre-wrap">{visible.split(/(#[^\s#]+)/g).map((part, index) =>
      <span key={index} className={index % 2 ? "text-blue-600" : undefined}><Highlight text={part} query={query} /></span>)}{visible.length < text.length ? "…" : ""}</span>
    {collapsible && <button type="button" className="block mt-1 text-[#000080] underline" aria-expanded={expanded} onClick={() => setExpandedText(expanded ? null : text)}>{expanded ? "▲ 접기" : "▼ 더 읽기"}</button>}
  </div>;
});
