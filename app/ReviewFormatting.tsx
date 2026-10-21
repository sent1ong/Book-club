"use client";
import React, { useState } from "react";
export function renderReviewText(text: string): React.ReactNode {
  return (
    <span className="whitespace-pre-wrap">
      {text.split(/(#[^\s#]+)/g).map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="text-blue-600">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export function SpoilerReviewText({ text }: { text: string }) {
  const [revealedText, setRevealedText] = useState<string | null>(null);
  if (text.includes("(스포일러)") && revealedText !== text) {
    return (
      <button
        type="button"
        onClick={() => setRevealedText(text)}
        className="win-btn px-2 py-1 text-xs text-gray-700"
      >
        ⚠️ 스포일러 리뷰 보기
      </button>
    );
  }
  return renderReviewText(text.replace(/\(스포일러\)/g, ""));
}

