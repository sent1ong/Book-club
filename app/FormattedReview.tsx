"use client";
import React, { memo, useMemo } from "react";
import { reviewRuns } from "./reviewMarkup";
type Range = { start: number; end: number };
export const FormattedReview = memo(function FormattedReview({ text, query = "", limit }: { text: string; query?: string; limit?: number }) {
  const runs = useMemo(() => reviewRuns(text), [text]);
  const content = useMemo(() => {
    const plain = runs.map(run => run.text).join("");
    const visible = limit === undefined ? plain : Array.from(plain).slice(0, limit).join("");
    const tags: Range[] = [], hits: Range[] = []; const regex = /#[^\s#]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(visible))) tags.push({ start: match.index, end: match.index + match[0].length });
    const needle = query.trim().toLowerCase(), lower = visible.toLowerCase(); let from = 0, found: number;
    if (needle) while ((found = lower.indexOf(needle, from)) >= 0) { hits.push({ start: found, end: found + needle.length }); from = found + needle.length; }
    let cursor = 0, tag = 0, hit = 0;
    return runs.map((run, index) => {
      const end = Math.min(cursor + run.text.length, visible.length), parts: React.ReactNode[] = [];
      while (cursor < end) {
        while (tags[tag] && tags[tag].end <= cursor) tag++;
        while (hits[hit] && hits[hit].end <= cursor) hit++;
        const t = tags[tag], h = hits[hit], tagged = !!t && t.start <= cursor, marked = !!h && h.start <= cursor;
        const next = Math.min(end, t ? tagged ? t.end : t.start : end, h ? marked ? h.end : h.start : end);
        const value = visible.slice(cursor, next);
        parts.push(<span key={cursor} className={tagged ? "text-blue-600" : undefined}>{marked ? <mark className="bg-[#fff0b0] text-inherit">{value}</mark> : value}</span>);
        cursor = next;
      }
      if (!parts.length) return null;
      return <span key={index} style={{ fontWeight: run.style & 1 ? 700 : undefined, fontStyle: run.style & 2 ? "italic" : undefined, textDecoration: run.style & 4 ? "line-through" : undefined, backgroundColor: run.style & 8 ? "#fff29a" : undefined }}>{parts}</span>;
    });
  }, [runs, query, limit]);
  return <>{content}</>;
});
