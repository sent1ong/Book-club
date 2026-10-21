"use client";
import React, { memo } from "react";
import { savedNotice } from "./SaveNotice";
export const CopyTitle = memo(function CopyTitle({ title }: { title: string }) {
  return <button type="button" aria-label="작품 제목 복사" title="작품 제목 복사" className="text-xs px-1 shrink-0" onClick={async () => { try { await navigator.clipboard.writeText(title); savedNotice("제목을 복사했어요."); } catch { alert("복사하지 못했어요. 제목을 선택해 복사해 주세요."); } }}>⧉</button>;
});
