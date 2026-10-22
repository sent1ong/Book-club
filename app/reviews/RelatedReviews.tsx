"use client";
import React, { createContext, memo, useContext, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { SpoilerReviewText } from "./ReviewFormatting";
import { WorkRatingSummary } from "./WorkRatingSummary";
import type { WorkRating } from "./reviewRelations";
type RelatedReview = { id: number; group_name: string; user_name: string; genre: string; title: string; author: string; review: string; rating: string; ost_youtube_url?: string | null; ost_title?: string | null; ost_artist?: string | null };
function makeStore() {
  let current: number | null = null;
  const subscribers = new Set<() => void>();
  return { subscribe: (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; }, selected: () => current,
    toggle: (id: number) => { current = current === id ? null : id; subscribers.forEach(listener => listener()); } };
}
const Selection = createContext<ReturnType<typeof makeStore> | null>(null);
export function RelatedReviewsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore); return <Selection.Provider value={store}>{children}</Selection.Provider>;
}
import { getJukeboxVideoId } from "../jukeboxVideo";
export const RelatedReviews = memo(function RelatedReviews({ bookId, sameBookReviews, rating, onPlay, onReview }: { bookId: number; sameBookReviews: RelatedReview[]; rating?: WorkRating; onPlay: (row: RelatedReview) => void; onReview?: (id: number) => void }) {
  const store = useContext(Selection)!;
  const isSameBookExpanded = useSyncExternalStore(store.subscribe, () => store.selected() === bookId, () => false);
  const toggle = () => store.toggle(bookId);
  return (<div className="mt-2 mb-2">
                          {/* 펼치기 / 접기 버튼 */}
                          <button
                            type="button"
                            onClick={() =>
                              toggle()
                            }
                            className="win-btn w-full px-3 py-2 text-xs font-bold text-left flex items-center justify-between gap-2"
                            aria-expanded={isSameBookExpanded}
                          >
                            <span className="min-w-0 inline-flex items-center gap-1">
                              <span className="truncate">📚 <span className="hidden sm:inline">같은 작품의 </span>다른 리뷰</span>
                              <span className="shrink-0">{sameBookReviews.length}개</span>
                              <WorkRatingSummary rating={rating} />
                            </span>
                            <span className="whitespace-nowrap shrink-0">
                              {isSameBookExpanded ? "▲ 접기" : "▼ 펼쳐보기"}
                            </span>
                          </button>

                          {/* 다른 모임원 리뷰 목록 */}
                          {isSameBookExpanded && (
                            <div className="mt-1 p-2 bg-[#f3f3f3] win-inset space-y-2">
                              {sameBookReviews.map((other) => (
                                <div
                                  key={other.id}
                                  className="bg-white border border-[#999] p-3 text-xs space-y-2"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="font-bold text-[#000080]">
                                      ✍️ {other.user_name}
                                    </span>

                                    <span className="font-bold text-amber-700 shrink-0">
                                      {other.rating}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-gray-500 break-words">
                                    📖 {other.title} · {other.author}{onReview && <button type="button" className="ml-2 underline bc-accent py-1" onClick={() => onReview(other.id)}>원본 보기 ↗</button>}
                                  </div>

                                  {/* 스포일러는 기존 컴포넌트로 가리기 */}
                                  {other.review?.trim() ? (
                                    <div className="text-xs text-gray-800 leading-relaxed break-words select-text">
                                      <SpoilerReviewText text={other.review} />
                                    </div>
                                  ) : (
                                    <p className="text-gray-400">
                                      작성된 감상평이 없어요.
                                    </p>
                                  )}

                                  {/* 다른 모임원이 등록한 OST */}
                                  {other.ost_youtube_url &&
                                    getJukeboxVideoId(
                                      other.ost_youtube_url,
                                    ) && (
                                      <div className="flex items-center gap-2 bc-ost border p-2">
                                        <Image
                                          src="/icons/music.png"
                                          alt=""
                                          width={20}
                                          height={20}
                                          unoptimized
                                          className="object-contain shrink-0"
                                        />

                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-bold bc-accent">
                                            🎵 이 책의 OST
                                          </p>
                                          <p className="text-[11px] font-bold text-gray-800 break-words">
                                            {other.ost_title || "제목 없음"}
                                            {" — "}
                                            {other.ost_artist ||
                                              "아티스트 미상"}
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onPlay(other);
                                          }}
                                          className="win-btn shrink-0 w-7 h-7 flex items-center justify-center text-black text-sm"
                                          aria-label={`${other.ost_title || "OST"} 재생`}
                                          title="OST 재생"
                                        >
                                          ▶
                                        </button>
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>);
});
