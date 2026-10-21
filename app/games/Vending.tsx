"use client";
import { plainReview, reviewTags } from "../reviewMarkup";
import React, { useState } from "react";
import { useWindowEscape } from "../windowEscape";
import { SpoilerReviewText } from "../ReviewFormatting";
type BookReview = { id: number; group_name: string; user_name: string; title: string; review: string; author?: string; genre?: string; rating?: string };
export default function VendingWindow({ active, reviews, tagCounts, onClose }: { active: boolean; reviews: BookReview[]; tagCounts: [string, number][]; onClose: () => void }) {
  const box = React.useRef<HTMLDivElement>(null);
  useWindowEscape(onClose, active, 50, () => box.current);
  const [vendingStatus, setVendingStatus] = useState<
    "idle" | "inserting" | "spinning" | "result"
  >("idle");
  const [vendingTags, setVendingTags] = useState<string[]>([]);
  const [vendingBook, setVendingBook] = useState<
    (typeof reviews)[number] | null
  >(null);
  const runVendingMachine = () => {
    if (vendingStatus === "spinning" || vendingStatus === "inserting") return;

    // 1. 전체 키워드 풀 확보
    const allUniqueTags = tagCounts.map(([tag]) => tag);
    if (allUniqueTags.length < 3) {
      alert(
        "등록된 #키워드가 최소 3개 이상이어야 자판기를 가동할 수 있습니다!",
      );
      return;
    }

    setVendingStatus("inserting");

    // 동전 투입 연출 (0.6초 후 슬롯 회전)
    setTimeout(() => {
      setVendingStatus("spinning");

      // 1.5초 동안 슬롯 돌아간 후 결과 도출
      setTimeout(() => {
        // 랜덤 키워드 3개 추첨
        const shuffled = [...allUniqueTags].sort(() => 0.5 - Math.random());
        const pickedTags = shuffled.slice(0, 3);
        setVendingTags(pickedTags);

        // 뽑힌 3개 키워드 중 하나라도 포함된 작품 검색
        const matchedBooks = reviews.filter(
          (r) => r.review && pickedTags.some((tag) => plainReview(r.review).includes(tag)),
        );

        if (matchedBooks.length > 0) {
          const randomMatched =
            matchedBooks[Math.floor(Math.random() * matchedBooks.length)];
          setVendingBook(randomMatched);
        } else {
          // 일치하는 작품이 없다면 전체 중 1권 무작위 매칭
          const randomFallback =
            reviews[Math.floor(Math.random() * reviews.length)];
          setVendingBook(randomFallback || null);
        }

        setVendingStatus("result");
      }, 1500);
    }, 600);
  };

  // 태그보드에서 선택된 태그 필터 (null이면 전체/태그목록 보기)

  // 모든 리뷰의 한줄평에서 #태그 추출 및 빈도 계산
  if (!active) return null;
  return (<div ref={box} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-md bg-[#c0c0c0] p-1 flex flex-col shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-amber-800 to-amber-600 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>🎰</span>
                <span>VENDING.exe - 키워드 캡슐 자판기</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setVendingStatus("idle");
                }}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 자판기 본체 기기 디자인 */}
            <div className="p-4 bg-gray-200 border-2 border-white flex flex-col items-center">
              {/* 상단 캡슐 쇼윈도우 */}
              <div className="w-full bg-[#111827] border-4 border-gray-400 p-4 rounded shadow-inner text-center min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden">
                {vendingStatus === "idle" && (
                  <div className="space-y-2">
                    <div className="text-3xl animate-bounce">🪙</div>
                    <p className="text-xs text-amber-300 font-mono tracking-wider">
                      INSERT COIN TO OPERATE
                    </p>
                    <p className="text-[11px] text-gray-400">
                      동전을 넣으면 운명의 키워드 3개를 뽑아줍니다.
                    </p>
                  </div>
                )}

                {vendingStatus === "inserting" && (
                  <div className="space-y-1">
                    <span className="text-2xl animate-spin inline-block">
                      🟡
                    </span>
                    <p className="text-xs text-yellow-400 font-mono font-bold">
                      COIN ACCEPTED!
                    </p>
                  </div>
                )}

                {vendingStatus === "spinning" && (
                  <div className="space-y-2">
                    <div className="text-3xl animate-pulse">🔮 🎲 ⚡</div>
                    <p className="text-xs text-cyan-400 font-mono animate-pulse">
                      뽑기 레버 회전 중... [ROLLING]
                    </p>
                  </div>
                )}

                {vendingStatus === "result" && (
                  <div className="space-y-2.5 w-full">
                    <span className="text-sm font-black bg-amber-900/90 text-amber-300 px-3 py-1 rounded font-mono border border-amber-500 shadow">
                      ★ 럭키 키워드 당첨 ★
                    </span>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {vendingTags.map((tag) => {
                        const matchedTags: string[] =
                          reviewTags(vendingBook?.review || "");

                        const isMatched = matchedTags.includes(tag);

                        return (
                          <div
                            key={tag}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <span
                              className={`text-[10px] font-black ${
                                isMatched ? "text-green-400" : "invisible"
                              }`}
                            >
                              ✓ MATCH!
                            </span>

                            <span
                              className={`text-black px-2 py-1 rounded text-xs font-black shadow ${
                                isMatched
                                  ? "bg-green-300 ring-2 ring-green-500"
                                  : "bg-yellow-400"
                              }`}
                            >
                              {tag}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 하단 투출구 및 조작 패널 */}
              <div className="w-full mt-3 bg-gray-300 p-3 border border-gray-400 win-outset flex flex-col items-center gap-3">
                {/* 결과 도서 디스플레이 (결과가 있을 때 캡슐 배출구에서 열림) */}
                {vendingStatus === "result" && vendingBook && (
                  <div className="w-full bg-white border-2 border-dashed border-amber-500 p-2.5 rounded shadow-sm text-left animate-fade-in">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[11px] bg-gray-800 text-white px-1.5 py-0.2 rounded font-mono">
                        {vendingBook.genre}
                      </span>
                      <span className="text-xs text-amber-700 font-bold">
                        {vendingBook.rating}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-900 truncate">
                      {vendingBook.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 mb-1.5">
                      {vendingBook.author || "미상"} · 추천자:{" "}
                      {vendingBook.user_name}
                    </p>
                    <p className="text-xs bg-amber-50 p-1.5 rounded text-gray-700 italic max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                      "
                      <SpoilerReviewText
                        text={vendingBook.review || "키워드와 함께 즐겨보세요!"}
                      />
                      "
                    </p>
                  </div>
                )}

                {/* 동전 투입 / 레버 조작 버튼 */}
                <div className="flex w-full justify-end items-center pt-1">
                  <button
                    type="button"
                    onClick={runVendingMachine}
                    disabled={
                      vendingStatus === "spinning" ||
                      vendingStatus === "inserting"
                    }
                    className="win-btn px-4 py-2 font-bold text-xs bg-[#c0c0c0] active:translate-y-0.5 flex items-center gap-1.5 shadow"
                  >
                    <span>
                      {vendingStatus === "result"
                        ? "🔄 다시 뽑기"
                        : "🪙 동전 넣고 돌리기"}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* 하단 창 닫기 버튼 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setVendingStatus("idle");
                }}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>);
}
