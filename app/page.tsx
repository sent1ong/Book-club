"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BookReview {
  id?: number;
  user_name: string;
  title: string;
  author: string;
  review: string;
  genre: string;
  rating: string;
  group_name: string;
  created_at?: string;
}

function BookClubContent() {
  const searchParams = useSearchParams();
  const groupName = searchParams.get("group") || "기본모임";

  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    user_name: "",
    title: "",
    author: "",
    review: "",
    genre: "소설",
    rating: "★★★★★",
  });

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("group_name", groupName)
      .order("id", { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
  };

  useEffect(() => {
    if (supabaseUrl && supabaseAnonKey) {
      fetchReviews();
    }
  }, [groupName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return alert("책 제목을 입력해주세요!");
    if (!formData.user_name) return alert("작성자 이름을 입력해주세요!");

    setLoading(true);
    const { error } = await supabase.from("books").insert([
      {
        ...formData,
        group_name: groupName,
      },
    ]);

    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      alert(`[${groupName}] 에 기록이 등록되었습니다!`);
      setFormData({
        user_name: formData.user_name,
        title: "",
        author: "",
        review: "",
        genre: "소설",
        rating: "★★★★★",
      });
      fetchReviews();
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#396f7c] p-3 flex flex-col items-center select-none">
      <div className="w-full max-w-sm mb-2 text-right">
        <span className="bg-[#1f4e5b] text-white text-[11px] px-2 py-0.5 border border-white font-bold">
          모임: {groupName}
        </span>
      </div>

      <div className="w-full max-w-sm bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 mb-4 shadow-xl">
        <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
          <span>2026 BOOKS.exe</span>
          <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
        </div>

        <div className="text-center py-1 text-xs italic font-bold text-[#1f4e5b]">
          Let's read some books!
        </div>

        <form onSubmit={handleSubmit} className="p-2 space-y-2.5 bg-[#d4d8dc] border border-[#808080]">
          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-0.5">NAME (내 이름)</label>
            <input
              type="text"
              required
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              className="w-full p-1.5 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
              placeholder="예: 지은"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-0.5">TITLE (책 제목)</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-1.5 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
              placeholder="책 제목 입력"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-0.5">AUTHOR (작가)</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full p-1.5 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
              placeholder="작가 이름"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">GENRE (장르)</label>
              <select
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full p-1 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white"
              >
                <option>소설</option>
                <option>시</option>
                <option>만화</option>
                <option>수필</option>
                <option>사회/과학</option>
                <option>철학</option>
                <option>실용</option>
                <option>에세이</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-800 mb-0.5">평점</label>
              <select
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="w-full p-1 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white"
              >
                <option>★★★★★</option>
                <option>★★★★</option>
                <option>★★★</option>
                <option>★★</option>
                <option>★</option>
                <option>중도하차</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-800 mb-0.5">REVIEW (한줄평)</label>
            <textarea
              rows={2}
              value={formData.review}
              onChange={(e) => setFormData({ ...formData, review: e.target.value })}
              className="w-full p-1.5 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none resize-none"
              placeholder="감상이나 리뷰를 적어주세요"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 mt-1 bg-[#c3c7cb] text-xs font-bold border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff]"
          >
            {loading ? "저장 중..." : "YES (기록 남기기)"}
          </button>
        </form>
      </div>

      <div className="w-full max-w-sm bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
        <div className="bg-[#1f4e5b] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
          <span>📚 {groupName} 독서 기록 ({reviews.length}권)</span>
          <button onClick={fetchReviews} className="text-[10px] underline">새로고침</button>
        </div>

        <div className="mt-1 space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
          {reviews.length === 0 ? (
            <div className="bg-white p-3 text-center text-xs text-gray-500 border border-gray-400">
              아직 등록된 도서가 없습니다.
            </div>
          ) : (
            reviews.map((book) => (
              <div key={book.id} className="bg-white p-2 border border-gray-400 text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-[#1f4e5b] text-[13px]">{book.title}</span>
                  <span className="text-amber-600 font-bold text-[11px] whitespace-nowrap">{book.rating}</span>
                </div>
                <div className="text-gray-500 text-[10px] mb-1">
                  {book.author ? `${book.author} · ` : ""}{book.genre} | {book.user_name}
                </div>
                {book.review && (
                  <p className="text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-200 mt-1 break-all">
                    {book.review}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="text-white text-center p-8">Loading...</div>}>
      <BookClubContent />
    </Suspense>
  );
}
