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

interface UserGoal {
  id?: number;
  group_name: string;
  user_name: string;
  target_count: number;
  message: string;
}

interface Comment {
  id: number;
  book_id: number;
  group_name: string;
  user_name: string;
  password?: string;
  content: string;
  created_at: string;
}

function BookClubContent() {
  const searchParams = useSearchParams();
  const groupName = searchParams.get("group") || "기본모임";

  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("전체");
  const [sortOrder, setSortOrder] = useState<string>("최신순");
  const [editingId, setEditingId] = useState<number | null>(null);

  // 열려있는 댓글창 관리 (bookId 단위)
  const [openCommentBookId, setOpenCommentBookId] = useState<number | null>(null);

  // 댓글 등록 폼
  const [commentForm, setCommentForm] = useState({
    user_name: "",
    password: "",
    content: "",
  });

  // 독서 기록 입력 폼
  const [formData, setFormData] = useState({
    user_name: "",
    title: "",
    author: "",
    review: "",
    genre: "소설",
    rating: "★★★★★",
  });

  // 목표 설정 입력 폼
  const [goalForm, setGoalForm] = useState({
    user_name: "",
    target_count: "10",
    message: "",
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

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("group_name", groupName);

    if (!error && data) {
      setGoals(data);
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("book_comments")
      .select("*")
      .eq("group_name", groupName)
      .order("id", { ascending: false });

    if (!error && data) {
      setComments(data);
    }
  };

  useEffect(() => {
    if (supabaseUrl && supabaseAnonKey) {
      fetchReviews();
      fetchGoals();
      fetchComments();
    }
  }, [groupName]);

  const userList = ["전체", ...Array.from(new Set(reviews.map((r) => r.user_name).filter(Boolean)))];

  // 0.5점 단위 별점 점수 매핑
  const scoreMap: Record<string, number> = {
    "★★★★★": 5.0,
    "★★★★☆": 4.5,
    "★★★★": 4.0,
    "★★★☆": 3.5,
    "★★★": 3.0,
    "★★☆": 2.5,
    "★★": 2.0,
    "★☆": 1.5,
    "★": 1.0,
    "☆": 0.5,
    "중도하차": 0,
  };

  const filteredReviews = selectedUser === "전체" 
    ? reviews 
    : reviews.filter((r) => r.user_name === selectedUser);

  const displayedReviews = [...filteredReviews].sort((a, b) => {
    if (sortOrder === "최신순") return b.id - a.id;
    if (sortOrder === "오래된순") return a.id - b.id;
    if (sortOrder === "높은 평점순") {
      const scoreA = scoreMap[a.rating] ?? 0;
      const scoreB = scoreMap[b.rating] ?? 0;
      return scoreB - scoreA || b.id - a.id;
    }
    if (sortOrder === "낮은 평점순") {
      const scoreA = scoreMap[a.rating] ?? 0;
      const scoreB = scoreMap[b.rating] ?? 0;
      return scoreA - scoreB || b.id - a.id;
    }
    return 0;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return alert("책 제목을 입력해주세요!");
    if (!formData.user_name) return alert("작성자 이름을 입력해주세요!");

    setLoading(true);

    if (editingId) {
      const { error } = await supabase
        .from("books")
        .update({ ...formData })
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
      const { error } = await supabase.from("books").insert([
        { ...formData, group_name: groupName },
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

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.user_name) return alert("닉네임을 입력해주세요!");
    const count = parseInt(goalForm.target_count, 10);
    if (isNaN(count) || count <= 0) return alert("올바른 목표 권수를 입력해주세요!");

    const { error } = await supabase
      .from("goals")
      .upsert(
        {
          group_name: groupName,
          user_name: goalForm.user_name.trim(),
          target_count: count,
          message: goalForm.message.trim(),
        },
        { onConflict: "group_name,user_name" }
      );

    if (error) {
      alert("목표 저장 실패: " + error.message);
    } else {
      alert(`${goalForm.user_name}님의 목표가 설정되었습니다!`);
      setGoalForm({ user_name: "", target_count: "10", message: "" });
      fetchGoals();
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent, bookId: number) => {
    e.preventDefault();
    if (!commentForm.user_name.trim()) return alert("작성자를 입력해주세요!");
    if (!commentForm.content.trim()) return alert("댓글 내용을 입력해주세요!");
    if (!/^\d{4}$/.test(commentForm.password)) return alert("비밀번호는 숫자 4자리로 입력해주세요!");

    const { error } = await supabase.from("book_comments").insert([
      {
        book_id: bookId,
        group_name: groupName,
        user_name: commentForm.user_name.trim(),
        password: commentForm.password,
        content: commentForm.content.trim(),
      },
    ]);

    if (error) {
      alert("댓글 저장 실패: " + error.message);
    } else {
      setCommentForm({ user_name: commentForm.user_name, password: "", content: "" });
      fetchComments();
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const inputPw = prompt("댓글 작성 시 입력한 비밀번호(숫자 4자리)를 입력하세요:");
    if (!inputPw) return;

    const { data: targetComment, error: findError } = await supabase
      .from("book_comments")
      .select("password")
      .eq("id", commentId)
      .single();

    if (findError || !targetComment) {
      return alert("댓글 정보를 불러올 수 없습니다.");
    }

    if (targetComment.password !== inputPw) {
      return alert("비밀번호가 일치하지 않습니다!");
    }

    const { error } = await supabase.from("book_comments").delete().eq("id", commentId);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("댓글이 삭제되었습니다.");
      fetchComments();
    }
  };

  const handleEditComment = async (commentId: number, oldContent: string) => {
    const inputPw = prompt("댓글 작성 시 입력한 비밀번호(숫자 4자리)를 입력하세요:");
    if (!inputPw) return;

    const { data: targetComment, error: findError } = await supabase
      .from("book_comments")
      .select("password")
      .eq("id", commentId)
      .single();

    if (findError || !targetComment) {
      return alert("댓글 정보를 불러올 수 없습니다.");
    }

    if (targetComment.password !== inputPw) {
      return alert("비밀번호가 일치하지 않습니다!");
    }

    const newContent = prompt("수정할 댓글 내용을 입력하세요:", oldContent);
    if (!newContent || !newContent.trim()) return;

    const { error } = await supabase
      .from("book_comments")
      .update({ content: newContent.trim() })
      .eq("id", commentId);

    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      alert("댓글이 수정되었습니다.");
      fetchComments();
    }
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
      fetchComments();
    }
  };

  const getReadCount = (name: string) => {
    return reviews.filter((r) => r.user_name === name).length;
  };

  const getAverageRating = (name: string) => {
    const userReviews = reviews.filter((r) => r.user_name === name);
    const validScores = userReviews
      .map((r) => scoreMap[r.rating])
      .filter((score): score is number => score !== undefined && score > 0);

    if (validScores.length === 0) return null;

    const sum = validScores.reduce((acc, cur) => acc + cur, 0);
    return (sum / validScores.length).toFixed(1);
  };

  const sortedGoals = [...goals].sort((a, b) => {
    const rateA = (getReadCount(a.user_name) / a.target_count) * 100;
    const rateB = (getReadCount(b.user_name) / b.target_count) * 100;
    return rateB - rateA;
  });

  const recentComments = comments.slice(0, 5);

  return (
    <main className="min-h-screen bg-[#396f7c] p-3 md:p-6 flex flex-col items-center select-none pb-12">
      <div className="w-full max-w-4xl mb-2 text-right">
        <span className="bg-[#1f4e5b] text-white text-xs px-2.5 py-1 border border-white font-bold shadow">
          모임: {groupName}
        </span>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        
        {/* 왼쪽 영역: 독서 기록창 & 서재 목록 창 */}
        <div className="space-y-4">
          
          {/* 독서 기록 입력 창 */}
          <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
            <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
              <span>{editingId ? "EDITING_BOOK.exe" : "2026 활자먹음이.exe"}</span>
              <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
            </div>

            <div className="text-center py-1 text-xs font-bold text-[#1f4e5b]">
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
                    <option>오디오드라마</option>
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
                    <option value="★★★★★">★★★★★ (5.0)</option>
                    <option value="★★★★☆">★★★★☆ (4.5)</option>
                    <option value="★★★★">★★★★ (4.0)</option>
                    <option value="★★★☆">★★★☆ (3.5)</option>
                    <option value="★★★">★★★ (3.0)</option>
                    <option value="★★☆">★★☆ (2.5)</option>
                    <option value="★★">★★ (2.0)</option>
                    <option value="★☆">★☆ (1.5)</option>
                    <option value="★">★ (1.0)</option>
                    <option value="☆">☆ (0.5)</option>
                    <option value="중도하차">중도하차</option>
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

          {/* 서재 목록 창 */}
          <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
            <div className="bg-[#1f4e5b] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
              <span>📚 서재 목록 ({displayedReviews.length}권)</span>
              <button onClick={() => { fetchReviews(); fetchComments(); }} className="text-[10px] underline">새로고침</button>
            </div>

            {/* 상단 컨트롤러: 닉네임 탭 & 정렬 옵션 */}
            <div className="py-1.5 px-0.5 border-b border-gray-400 flex flex-wrap justify-between items-center gap-1.5">
              <div className="flex gap-1 overflow-x-auto">
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

              <div className="flex items-center gap-1 ml-auto">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-white text-[11px] font-bold p-0.5 border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none cursor-pointer"
                >
                  <option value="최신순">최신순</option>
                  <option value="오래된순">오래된순</option>
                  <option value="높은 평점순">높은 평점순</option>
                  <option value="낮은 평점순">낮은 평점순</option>
                </select>
              </div>
            </div>

            {/* 책 목록 리스트 */}
            <div className="mt-2 space-y-2 max-h-96 overflow-y-auto pr-0.5">
              {displayedReviews.length === 0 ? (
                <div className="bg-white p-3 text-center text-xs text-gray-500 border border-gray-400">
                  해당하는 독서 기록이 없습니다.
                </div>
              ) : (
                displayedReviews.map((book) => {
                  const bookComments = comments.filter((c) => c.book_id === book.id);
                  const isOpen = openCommentBookId === book.id;

                  return (
                    <div key={book.id} className="bg-white p-2.5 border border-gray-400 text-xs">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <span className="font-bold text-[#1f4e5b] text-sm">{book.title}</span>
                        <span className="text-amber-600 font-bold text-xs whitespace-nowrap tracking-wider">{book.rating}</span>
                      </div>
                      
                      <div className="text-gray-600 text-xs mb-1.5 leading-relaxed">
                        {book.author ? `${book.author} · ` : ""}{book.genre} | <span className="font-bold text-gray-800">{book.user_name}</span>
                      </div>

                      {book.review && (
                        <p className="text-gray-800 bg-gray-50 p-2 rounded border border-gray-200 mt-1 break-all text-xs leading-normal">
                          {book.review}
                        </p>
                      )}

                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100 text-[11px]">
                        <button
                          onClick={() => setOpenCommentBookId(isOpen ? null : book.id)}
                          className="font-bold text-gray-700 hover:text-black flex items-center gap-1"
                        >
                          💬 댓글 <span className="text-[#1f4e5b] underline">({bookComments.length})</span>
                        </button>
                        <div className="flex gap-2">
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

                      {isOpen && (
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-300 bg-[#f4f6f7] p-2">
                          <div className="space-y-1.5 mb-2">
                            {bookComments.length === 0 ? (
                              <div className="text-xs text-gray-400 text-center py-1">첫 번째 댓글을 남겨보세요!</div>
                            ) : (
                              bookComments.map((c) => (
                                <div key={c.id} className="bg-white p-2 border border-gray-200 text-xs">
                                  <div className="flex justify-between items-center text-gray-500 text-xs mb-1">
                                    <span className="font-bold text-gray-800">{c.user_name}</span>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => handleEditComment(c.id, c.content)}
                                        className="text-blue-600 hover:underline font-bold"
                                      >
                                        수정
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(c.id)}
                                        className="text-red-500 hover:underline font-bold"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-gray-800 break-all text-xs leading-relaxed">{c.content}</div>
                                </div>
                              ))
                            )}
                          </div>

                          <form onSubmit={(e) => handleCommentSubmit(e, book.id)} className="space-y-1">
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="text"
                                required
                                placeholder="닉네임"
                                value={commentForm.user_name}
                                onChange={(e) => setCommentForm({ ...commentForm, user_name: e.target.value })}
                                className="p-1 text-xs bg-white border border-gray-400 outline-none"
                              />
                              <input
                                type="password"
                                maxLength={4}
                                required
                                placeholder="숫자 4자리"
                                value={commentForm.password}
                                onChange={(e) => setCommentForm({ ...commentForm, password: e.target.value })}
                                className="p-1 text-xs bg-white border border-gray-400 outline-none"
                              />
                            </div>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                required
                                placeholder="댓글을 입력하세요..."
                                value={commentForm.content}
                                onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })}
                                className="flex-1 p-1 text-xs bg-white border border-gray-400 outline-none"
                              />
                              <button
                                type="submit"
                                className="px-2.5 py-1 bg-[#c3c7cb] text-xs font-bold border border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black"
                              >
                                등록
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 영역: 목표 현황판 & 최근 댓글 5개 창 */}
        <div className="space-y-4">
          
          {/* 목표 현황판 */}
          <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
            <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
              <span>🎯 GOALS_TRACKER.exe</span>
              <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
            </div>

            <form onSubmit={handleGoalSubmit} className="p-2 space-y-2 bg-[#d4d8dc] border border-[#808080] mb-3 text-xs">
              <div className="font-bold text-[#1f4e5b] text-[11px] border-b border-gray-400 pb-1">
                내 독서 목표 설정/수정
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">닉네임</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 지은"
                    value={goalForm.user_name}
                    onChange={(e) => setGoalForm({ ...goalForm, user_name: e.target.value })}
                    className="w-full p-1 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-0.5">목표 권수</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="권수 입력"
                    value={goalForm.target_count}
                    onChange={(e) => setGoalForm({ ...goalForm, target_count: e.target.value })}
                    className="w-full p-1 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-700 mb-0.5">목표 한마디</label>
                <input
                  type="text"
                  placeholder="예: 올해는 완독왕!"
                  value={goalForm.message}
                  onChange={(e) => setGoalForm({ ...goalForm, message: e.target.value })}
                  className="w-full p-1 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1 bg-[#c3c7cb] text-xs font-bold border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-t-[#404040] active:border-l-[#404040]"
              >
                목표 저장
              </button>
            </form>

            <div className="space-y-2">
              {sortedGoals.length === 0 ? (
                <div className="bg-white p-4 text-center text-xs text-gray-500 border border-gray-400">
                  등록된 목표가 없습니다. 위에서 목표를 먼저 세워보세요!
                </div>
              ) : (
                sortedGoals.map((g) => {
                  const readCount = getReadCount(g.user_name);
                  const actualPercent = Math.round((readCount / g.target_count) * 100);
                  const barPercent = Math.min(100, actualPercent);
                  const avgRating = getAverageRating(g.user_name);

                  return (
                    <div key={g.id} className="bg-white p-2 border border-gray-400 text-xs">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#1f4e5b] text-[13px]">{g.user_name}</span>
                          {avgRating && (
                            <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-1 py-0.5 border border-amber-200">
                              ★ {avgRating}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-xs text-gray-700">
                          {readCount} / {g.target_count}권 ({actualPercent}%)
                        </span>
                      </div>

                      <div className="w-full bg-[#808080] p-[2px] border border-t-[#404040] border-l-[#404040] border-b-[#ffffff] border-r-[#ffffff] mb-1">
                        <div
                          className="bg-[#1f4e5b] h-2.5 transition-all duration-300"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>

                      {g.message && (
                        <div className="text-[11px] text-gray-600 bg-gray-50 p-1 border border-gray-200">
                          💬 "{g.message}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 최근 댓글 5개 창 */}
          <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
            <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
              <span>💬 RECENT_COMMENTS.exe</span>
              <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
            </div>

            <div className="space-y-1.5">
              {recentComments.length === 0 ? (
                <div className="bg-white p-3 text-center text-xs text-gray-500 border border-gray-400">
                  아직 작성된 댓글이 없습니다.
                </div>
              ) : (
                recentComments.map((c) => {
                  const targetBook = reviews.find((r) => r.id === c.book_id);
                  return (
                    <div key={c.id} className="bg-white p-2 border border-gray-400 text-xs">
                      <div className="flex justify-between items-baseline mb-1 text-xs text-gray-600">
                        <span className="font-bold text-gray-800">{c.user_name}</span>
                        <span className="text-[#1f4e5b] font-bold truncate max-w-[150px]">
                          📖 {targetBook ? targetBook.title : "삭제된 책"}
                        </span>
                      </div>
                      <p className="text-gray-800 bg-gray-50 p-1.5 rounded border border-gray-200 text-xs leading-relaxed break-all">
                        {c.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
