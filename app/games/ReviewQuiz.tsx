"use client";
import { plainReview } from "../reviewMarkup";
import React, { useState } from "react";
import { useWindowEscape } from "../windowEscape";
import { renderReviewText } from "../ReviewFormatting";
type BookReview = { id: number; group_name: string; user_name: string; title: string; review: string; author?: string; genre?: string; rating?: string };
type ReviewQuizQuestion = {
  id: number;
  text: string;
  reviewer: string;
  answer: string;
  options: string[];
  spoiler: boolean;
};

function shuffleQuizItems<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildReviewQuiz(
  rows: BookReview[],
  groupName: string,
): ReviewQuizQuestion[] {
  const seen = new Set<number>();
  const valid = rows.filter((row) => {
    if (row.group_name !== groupName || seen.has(row.id)) return false;
    seen.add(row.id);
    return Boolean(
      row.user_name?.trim() &&
        row.title?.trim() &&
        plainReview(row.review)?.replace(/\(스포일러\)/g, "").trim(),
    );
  });
  const titlesByUser = new Map<string, Set<string>>();
  for (const row of valid) {
    const titles = titlesByUser.get(row.user_name) ?? new Set<string>();
    titles.add(row.title.trim());
    titlesByUser.set(row.user_name, titles);
  }
  const eligible = valid.filter(
    (row) => (titlesByUser.get(row.user_name)?.size ?? 0) >= 4,
  );
  // 부족할 때 같은 리뷰를 반복해서 10문항을 채우지 않습니다.
  if (eligible.length < 10) return [];
  return shuffleQuizItems(eligible)
    .slice(0, 10)
    .map((row) => {
      const answer = row.title.trim();
      const alternatives = Array.from(titlesByUser.get(row.user_name)!).filter(
        (title) => title !== answer,
      );
      return {
        id: row.id,
        text: plainReview(row.review).replace(/\(스포일러\)/g, "").trim(),
        reviewer: row.user_name,
        answer,
        options: shuffleQuizItems([
          answer,
          ...shuffleQuizItems(alternatives).slice(0, 3),
        ]),
        spoiler: row.review.includes("(스포일러)"),
      };
    });
}

export default function ReviewQuizWindow({ groupName, onClose, rows, status, onRetry }: {
 groupName: string; onClose: () => void; rows: BookReview[]; status: "loading" | "ready" | "error"; onRetry: () => void;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  useWindowEscape(onClose, true, 50, () => box.current);
  const errorMessage = "리뷰를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
  const [questions, setQuestions] = useState<ReviewQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [startMessage, setStartMessage] = useState("");
  const [index, setIndex] = useState(0);

  const start = () => {
    const next = buildReviewQuiz(rows, groupName);
    if (next.length !== 10) {
      setStartMessage(
        "아직 10문항을 만들 수 없어요. 같은 모임원이 서로 다른 제목 4권 이상에 남긴 비어 있지 않은 리뷰가 필요하며, 이 조건을 충족하는 리뷰가 모임 전체에 10개 이상 있어야 합니다.",
      );
      return;
    }
    setQuestions(next);
    setAnswers([]);
    setSelected(null);
    setFinished(false);
    setSpoilerRevealed(false);
    setStartMessage("");
    setIndex(0);
  };
  const question = questions[index];
  const submitted = answers.length > index;
  const canRead = !question?.spoiler || spoilerRevealed;
  const score = answers.reduce(
    (total, answer, i) => total + (answer === questions[i]?.answer ? 1 : 0),
    0,
  );
  const submit = () => {
    if (!question || selected === null || !canRead || finished) return;
    // 함수형 업데이트로 빠르게 두 번 눌러도 답안은 한 번만 기록합니다.
    setAnswers((previous) =>
      previous.length === index ? [...previous, selected] : previous,
    );
  };
  const next = () => {
    if (!submitted) return;
    if (index === questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((previous) => previous + 1);
    setSelected(null);
    setSpoilerRevealed(false);
  };

  return (
    <div ref={box} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-quiz-title"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black"
      >
        <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
          <span id="review-quiz-title">리뷰 퀴즈.exe</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="리뷰 퀴즈 닫기"
            className="win-btn text-black px-1"
          >
            ✕
          </button>
        </div>
        <div className="p-3 space-y-3 text-sm">
          {status === "loading" ? (
            <p role="status">모임 리뷰를 불러오는 중...</p>
          ) : status === "error" ? (
            <div className="space-y-3">
              <p role="alert">{errorMessage}</p>
              <button
                type="button"
                className="win-btn px-3 py-1"
                onClick={onRetry}
              >
                다시 불러오기
              </button>
            </div>
          ) : finished ? (
            <div
              className="bg-white win-inset p-4 space-y-3 text-center"
              aria-live="polite"
            >
              <p className="font-bold text-lg">🎉 퀴즈 완료!</p>
              <p>
                10문항 중 {score}개 정답 · {score * 10}점 / 100점
              </p>
              <button
                type="button"
                className="win-btn px-3 py-1"
                onClick={start}
              >
                다시 도전
              </button>
            </div>
          ) : !question ? (
            <div className="space-y-3">
              <p className="bg-white win-inset p-3">
                리뷰를 읽고 책 제목을 맞혀 보세요! 보기 4개는 모두 같은 모임원이
                리뷰한 책입니다. 제출하면 리뷰 작성자가 공개됩니다.
              </p>
              <p className="text-xs">
                총 10문항 · 정답당 10점 · 스포일러 리뷰는 별도 확인 후
                표시됩니다.
              </p>
              {startMessage && (
                <p role="status" className="bg-white win-inset p-3">
                  {startMessage}
                </p>
              )}
              <button
                type="button"
                className="win-btn px-3 py-1 font-bold"
                onClick={start}
              >
                퀴즈 시작
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between font-bold">
                <span>{index + 1} / 10문항</span>
                <span>점수: {score * 10}점</span>
              </div>
              <div className="bg-white win-inset p-3 whitespace-pre-wrap break-words select-text">
                {canRead ? (
                  renderReviewText(question.text)
                ) : (
                  <div className="space-y-2">
                    <p>⚠️ 스포일러가 포함된 리뷰입니다.</p>
                    <button
                      type="button"
                      className="win-btn px-3 py-1"
                      onClick={() => setSpoilerRevealed(true)}
                    >
                      확인하고 리뷰 보기
                    </button>
                  </div>
                )}
              </div>
              <fieldset disabled={submitted || !canRead} className="space-y-2">
                <legend className="mb-2 font-bold">
                  어떤 책의 리뷰일까요?
                </legend>
                {question.options.map((title, optionIndex) => (
                  <label
                    key={title}
                    className={`flex items-start gap-2 p-2 cursor-pointer win-inset ${submitted && title === question.answer ? "bg-green-100" : "bg-white"}`}
                  >
                    <input
                      type="radio"
                      name="review-quiz-answer"
                      value={title}
                      checked={selected === title}
                      onChange={() => setSelected(title)}
                      className="mt-1"
                    />
                    <span className="break-words min-w-0">
                      {optionIndex + 1}. {title}
                    </span>
                  </label>
                ))}
              </fieldset>
              {submitted ? (
                <div className="space-y-2" aria-live="polite">
                  <div className="bg-white win-inset p-3 space-y-1">
                    <p className="font-bold">
                      {answers[index] === question.answer
                        ? "⭕ 정답입니다!"
                        : "❌ 아쉽지만 오답입니다."}
                    </p>
                    <p>정답: {question.answer}</p>
                    <p>✍️ 리뷰 작성자: {question.reviewer} 님</p>
                  </div>
                  <button
                    type="button"
                    className="win-btn px-3 py-1 font-bold"
                    onClick={next}
                  >
                    {index === 9 ? "최종 점수 보기" : "다음 문제"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={selected === null || !canRead}
                  onClick={submit}
                  className="win-btn px-3 py-1 font-bold disabled:opacity-50"
                >
                  정답 제출
                </button>
              )}
            </>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="win-btn px-3 py-1"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

