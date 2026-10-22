"use client";
import React, { useEffect, useRef, useState } from "react";

export function ShelfReason({ text }: { text: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false), [overflow, setOverflow] = useState(false);
  useEffect(() => { setExpanded(false); }, [text]);
  useEffect(() => {
    const element = box.current;
    if (!element || expanded) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  return <p ref={box} className={expanded ? "whitespace-pre-wrap break-words leading-5 cursor-pointer" : `truncate leading-5 ${overflow ? "cursor-pointer" : ""}`}
    role={overflow ? "button" : undefined} tabIndex={overflow ? 0 : undefined}
    aria-expanded={overflow ? expanded : undefined} title={overflow ? expanded ? "선정 이유 접기" : "선정 이유 전체 보기" : undefined}
    onClick={() => { if (overflow) setExpanded(value => !value); }} onKeyDown={event => { if (overflow && ["Enter", " "].includes(event.key)) { event.preventDefault(); setExpanded(value => !value); } }}>{text}</p>;
}
