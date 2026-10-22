import React from "react";
import type { WorkRating } from "./reviewRelations";

export function WorkRatingSummary({ rating }: { rating?: WorkRating }) {
  if (!rating) return null;
  return <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] sm:text-xs font-normal" title={`유효 별점 ${rating.participants}명`}>
    <span className="text-gray-600"><span className="hidden sm:inline">(</span>평균 ★{rating.average.toFixed(1)}<span className="hidden sm:inline">)</span></span>
    {rating.gap >= 2 && <span title="모임원별 가장 최근 유효 별점의 최고·최저 차이">
      <span className="sm:hidden">· </span>{rating.gap >= 3 ? "⚡" : "👀"}<span className="hidden sm:inline"> 별점 차이 </span>{rating.gap.toFixed(1)}
    </span>}
  </span>;
}
