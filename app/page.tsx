"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BookReview {
  id: number;
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
  const [selectedUser, setSelectedUser] = useState<string>("전체");
  const [editingId, setEditingId] = useState<number | null>(null);

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

  // 참여 중인 유저 이름 목록 추출
  const userList = ["전체", ...Array.from(new Set(reviews.map((r) => r.user_name).filter(Boolean)))];

  // 필터링된 리뷰 목록
  const displayedReviews = selectedUser === "전체" 
    ? reviews 
    : reviews.filter((r) => r.user_name === selectedUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return alert("책 제목을 입력해주세요!");
    if (!formData.user_name) return alert("작성자 이름을 입력해주세요!");

    setLoading(true);

    if (editingId) {
      // 수정 모드
      const { error } = await supabase
        .from("books")
        .update({
          ...formData,
        })
        .eq("id", editingId);

      if (error) {
        alert("수정 실패: " + error.message);
      } else {
        alert("기록이 수정되었습니다!");
        setEditingId(null);
        resetForm();
        fetchReviews();
      }
    } else {
      // 신규 등록 모드
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
        resetForm();
        fetchReviews();
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      user_name: formData.user_name,
      title: "",
      author: "",
      review: "",
      genre: "소설",
      rating: "★★★★★",
    });
  };

  const handleEdit = (book: BookReview) => {
    setEditingId(book.id);
    setFormData({
      user_name: book.user_name,
      title: book.title,
      author: book.author || "",
      review: book.review || "",
      genre: book.genre || "소설",
      rating: book.rating || "★★★★★",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`'${title}' 기록을 정말 삭제하시겠습니까?`)) return;

    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("삭제되었습니다.");
      if (editingId === id) cancelEdit();
      fetchReviews();
    }
  };

  return (
    <main className="min-h-screen bg-[#396f7c] p-3 flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-sm mb-2 text-right">
        <span className="bg-[#1f4e5b] text-white text-[11px] px-2 py-0.5 border border-white font-bold">
          모임: {groupName}
        </span>
      </div>

      {/* 입력 / 수정 윈도우 */}
      <div className="w-full max-w-sm bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 mb-4 shadow-xl">
        <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
          <span>{editingId ? "EDITING_BOOK.exe" : "2026 활자먹음이.exe"}</span>
          <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
        </div>

        <div className="text-center py-1 text-xs italic font-bold text-[#1f4e5b]">
          {editingId ? "기존 독서 기록 수정 중..." : "구매비덕질을 타파하자!"}
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
                <option>웹툰</option>
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

          <div className="flex gap-1 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-1.5 bg-[#c3c7cb] text-xs font-bold border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff]"
            >
              {loading ? "처리 중..." : editingId ? "수정 완료" : "입력 완료"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1.5 bg-[#c3c7cb] text-xs font-bold border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040]"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 기록 조회 윈도우 */}
      <div className="w-full max-w-sm bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
        <div className="bg-[#1f4e5b] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
          <span>📚 {groupName} 서재 ({displayedReviews.length}권)</span>
          <button onClick={fetchReviews} className="text-[10px] underline">새로고침</button>
        </div>

        {/* 닉네임별 탭 (스크롤 가능) */}
        <div className="flex gap-1 overflow-x-auto py-1.5 px-0.5 border-b border-gray-400">
          {userList.map((user) => (
            <button
              key={user}
              onClick={() => setSelectedUser(user)}
              className={`px-2 py-0.5 text-[11px] whitespace-nowrap font-bold border ${
                selectedUser === user
                  ? "bg-[#1f4e5b] text-white border-black"
                  : "bg-[#d4d8dc] text-gray-800 border-white hover:bg-gray-300"
              }`}
            >
              {user}
            </button>
          ))}
        </div>

        {/* 기록 목록 */}
        <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
          {displayedReviews.length === 0 ? (
            <div className="bg-white p-3 text-center text-xs text-gray-500 border border-gray-400">
              해당하는 독서 기록이 없습니다.
            </div>
          ) : (
            displayedReviews.map((book) => (
              <div key={book.id} className="bg-white p-2 border border-gray-400 text-xs">
                <div className="flex justify-between items-start gap-1">
                  <span className="font-bold text-[#1f4e5b] text-[13px]">{book.title}</span>
                  <span className="text-amber-600 font-bold text-[11px] whitespace-nowrap">{book.rating}</span>
                </div>
                
                <div className="text-gray-500 text-[10px] mb-1">
                  {book.author ? `${book.author} · ` : ""}{book.genre} | <span className="font-bold text-gray-700">{book.user_name}</span>
                </div>

                {book.review && (
                  <p className="text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-200 mt-1 break-all">
                    {book.review}
                  </p>
                )}

                {/* 수정 / 삭제 버튼 */}
                <div className="flex justify-end gap-2 mt-2 pt-1 border-t border-gray-100 text-[10px]">
                  <button
                    onClick={() => handleEdit(book)}
                    className="text-blue-600 hover:underline font-bold"
                  >
                    수정
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => handleDelete(book.id, book.title)}
                    className="text-red-500 hover:underline font-bold"
                  >
                    삭제
                  </button>
                </div>
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
