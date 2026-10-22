"use client";
import React, { useState } from "react";
export function DuplicateReviewNotice({ title, author, view }: { title: string; author: string; view: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <div className="text-xs bg-[#fff9dd] win-inset p-2" role="status">
    <p>⚠️ 이미 이 작품을 기록한 적이 있는 것 같아요.</p><p>기존 리뷰: {title} — {author}</p>
    <div className="flex gap-2 mt-1"><button type="button" className="win-btn px-2 py-1" onClick={view}>기존 리뷰 보기</button><button type="button" className="win-btn px-2 py-1" onClick={() => setDismissed(true)}>계속 기록하기</button></div>
  </div>;
}

