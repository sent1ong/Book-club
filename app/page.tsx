"use client";

import React, { useState, useEffect, Suspense } from "react";
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

// 🔒 모임방 허용 검사 (기본모임 허용 + nogmbdj26 이상, forgaedus26 이상 허용)
function isValidGroup(name: string | null) {
  if (!name) return false;
  if (name === "기본모임") return true;

  const match = name.match(/^(nogmbdj|forgaedus)(\d+)$/);
  if (!match) return false;
  const num = parseInt(match[2], 10);
  return num >= 26;
}

// 🔊 레트로 윈도우 띠링~ 효과음 (Web Audio API)
const playRetroDing = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    playTone(523.25, 0, 0.2); // C5
    playTone(1046.5, 0.08, 0.4); // C6
  } catch (e) {
    // 오디오 미지원 브라우저 예외 무시
  }
};

// 🎆 목표 달성 폭죽 축하 효과음
const playCelebrationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C - E - G - C - E 상승 팡파레
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
    });
  } catch (e) {
    // 오디오 미지원 브라우저 예외 무시
  }
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<number[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [revealedComments, setRevealedComments] = useState<{ [key: number]: boolean }>({});
  const [selectedGenre, setSelectedGenre] = useState("전체");
  const [sortBy, setSortBy] = useState("최신순");
  const [reactions, setReactions] = useState<{ [bookId: number]: { [emoji: string]: number } }>({});
  const [randomBook, setRandomBook] = useState<BookReview | null>(null);

  // 🔔 읽음 확인한 댓글 ID 목록 (localStorage 연동)
  const [readCommentIds, setReadCommentIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`read_comments_${groupName}`);
      if (saved) {
        setReadCommentIds(JSON.parse(saved));
      }
    } catch (e) {
      // 로컬 스토리지 비활성화 시 무시
    }
  }, [groupName]);

  // 특정 유저 탭 클릭 시 해당 유저 책에 달린 댓글들을 '읽음' 처리
  const handleSelectUser = (user: string) => {
    setSelectedUser(user);
    if (user === "전체") return;

    // 해당 유저가 작성한 책들의 ID 추출
    const targetBookIds = new Set(reviews.filter((r) => r.user_name === user).map((r) => r.id));
    const targetComments = comments.filter((c) => targetBookIds.has(c.book_id));
    const newReadIds = Array.from(new Set([...readCommentIds, ...targetComments.map((c) => c.id)]));

    setReadCommentIds(newReadIds);
    try {
      localStorage.setItem(`read_comments_${groupName}`, JSON.stringify(newReadIds));
    } catch (e) {}
  };

  // 방 주소 생성 제한
  const isAllowedGroup = isValidGroup(groupName);

  if (!isAllowedGroup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-sm w-full text-center border border-gray-200">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-base font-bold text-gray-800 mb-1">접근이 제한된 모임방입니다</h2>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            존재하지 않거나 비공개된 방입니다.
            <br />
            올바른 주소로 접속해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const handleRandomRecommend = () => {
    const fiveStarBooks = reviews.filter((b) => (b.rating || "").includes("★★★★★"));

    if (fiveStarBooks.length === 0) {
      alert("아직 5점 만점 작품이 등록되지 않았어요!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * fiveStarBooks.length);
    setRandomBook(fiveStarBooks[randomIndex]);
  };

  const [openCommentBookId, setOpenCommentBookId] = useState<number | null>(null);

  const [commentForm, setCommentForm] = useState<{
    user_name: string;
    password: string;
    content: string;
    is_spoiler?: boolean;
  }>({ user_name: "", password: "", content: "", is_spoiler: false });

  const [formData, setFormData] = useState({
    user_name: "",
    title: "",
    author: "",
    review: "",
    genre: "소설",
    rating: "★★★★★",
  });

  const handleReactionClick = (bookId: number, emoji: string) => {
    setReactions((prev) => {
      const currentBookReactions = prev[bookId] || {};
      const currentCount = currentBookReactions[emoji] || 0;
      return {
        ...prev,
        [bookId]: {
          ...currentBookReactions,
          [emoji]: currentCount + 1,
        },
      };
    });
  };

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
      .order("id", { ascending: true });

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

  const totalBooks = reviews.length;
  const avgRating = totalBooks > 0
    ? (reviews.reduce((acc, cur) => {
        const stars = (cur.rating || "").match(/★/g);
        return acc + (stars ? stars.length : 5);
      }, 0) / totalBooks).toFixed(1)
    : "0.0";

  const genreCounts = reviews.reduce((acc: any, cur: any) => {
    const g = cur.genre || "기타";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});

  const topRatedBooks = reviews
    .filter(b => (b.rating || "").includes("★★★★★"))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ko"));

  const userList = ["전체", ...Array.from(new Set(reviews.map((r) => r.user_name).filter(Boolean)))];

  // 🔔 유저별 새 댓글(안 읽은 알림) 개수 계산
  const getUnreadCommentCount = (userName: string) => {
    if (userName === "전체") return 0;
    // 이 유저가 등록한 책들의 ID 목록
    const userBookIds = new Set(reviews.filter((r) => r.user_name === userName).map((r) => r.id));
    if (userBookIds.size === 0) return 0;

    // 내 책에 달린 댓글 중, 내가 직접 쓴 게 아니고, 아직 읽음 처리되지 않은 댓글
    const unread = comments.filter(
      (c) => userBookIds.has(c.book_id) && c.user_name !== userName && !readCommentIds.includes(c.id)
    );
    return unread.length;
  };

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

  const filteredReviews = reviews.filter((r) => {
    const matchesUser = selectedUser === "전체" || r.user_name === selectedUser;
    const matchesGenre = selectedGenre === "전체" || r.genre === selectedGenre;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      r.title?.toLowerCase().includes(q) ||
      r.author?.toLowerCase().includes(q);
    return matchesUser && matchesGenre && matchesSearch;
  });

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
    if (!formData.title) return alert("제목을 입력해주세요!");
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
        playRetroDing();
        alert("기록이 수정되었습니다!");
        setEditingId(null);
        resetForm();
        fetchReviews();
      }
    } else {
      const finalReview = isSpoiler ? "(스포일러) " + (formData.review || "") : formData.review;
      const { error } = await supabase.from("books").insert([
        { ...formData, review: finalReview, group_name: groupName },
      ]);

      if (error) {
        alert("저장 실패: " + error.message);
      } else {
        const userGoal = goals.find((g) => g.user_name === formData.user_name);
        const currentCount = reviews.filter((r) => r.user_name === formData.user_name).length + 1;

        if (userGoal && currentCount >= userGoal.target_count) {
          playCelebrationSound();
        } else {
          playRetroDing();
        }

        alert(`[${groupName}] 에 기록이 등록되었습니다!`);
        resetForm();
        setIsSpoiler(false);
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
      playRetroDing();
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
        content: commentForm.is_spoiler ? "(스포일러) " + commentForm.content.trim() : commentForm.content.trim(),
      },
    ]);

    if (error) {
      alert("댓글 저장 실패: " + error.message);
    } else {
      playRetroDing();
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
              <span>{editingId ? "EDITING_BOOK.exe" : "활자먹음이.exe"}</span>
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
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">TITLE (제목)</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-1.5 text-xs bg-white border border-t-gray-600 border-l-gray-600 border-b-white border-r-white outline-none"
                  placeholder="제목 입력"
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
                <label className="flex items-center gap-1.5 mt-1 cursor-pointer text-[11px] text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={isSpoiler}
                    onChange={(e) => setIsSpoiler(e.target.checked)}
                    className="accent-amber-600"
                  />
                  <span> ⚠️ 스포일러 포함 </span>
                </label>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStats(true)}
                  className="bg-[#c0c0c0] text-black px-1.5 py-0.5 border border-t-white border-l-white border-b-black border-r-black text-[10px] font-bold active:border-t-black active:border-l-black"
                >
                  📊 STATS.exe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fetchReviews();
                    fetchComments();
                  }}
                  className="text-xs underline"
                >
                  새로고침
                </button>
              </div>
            </div>

            <div className="mb-2">
              <input
                type="text"
                placeholder="🔍 제목 또는 작가 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs p-1.5 border border-gray-400 bg-white focus:outline-none placeholder-gray-500"
              />
            </div>

            <button
              type="button"
              onClick={handleRandomRecommend}
              className="w-full py-2 px-3 mb-3 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors select-none active:scale-95 shadow-sm"
            >
              <span>🎲</span>
              <span>오늘 뭐 보지?</span>
            </button>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["전체", "소설", "만화", "웹툰", "오디오드라마"].map((genre) => {
                const isSelected = selectedGenre === genre;
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-2.5 py-1 text-xs border rounded-md transition-colors active:scale-95 ${
                      isSelected
                        ? "bg-[#1f4e5b] text-white border-[#1f4e5b] font-bold"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>

            {/* 상단 유저 탭 & 정렬 옵션 */}
            <div className="py-1.5 px-0.5 border-b border-gray-400 flex flex-wrap justify-between items-center gap-1.5">
              <div className="flex gap-1 overflow-x-auto items-center">
                {userList.map((user) => {
                  const unreadCount = getUnreadCommentCount(user);
                  return (
                    <button
                      key={user}
                      onClick={() => handleSelectUser(user)}
                      className={`relative px-2 py-0.5 text-[11px] whitespace-nowrap font-bold border transition-colors ${
                        selectedUser === user
                          ? "bg-[#1f4e5b] text-white border-black"
                          : "bg-[#d4d8dc] text-gray-800 border-white hover:bg-gray-300"
                      }`}
                    >
                      {user}
                      {/* 🔔 새 댓글 숫자 뱃지 */}
                      {unreadCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center bg-red-600 text-white text-[10px] font-extrabold px-1 min-w-[15px] h-[15px] rounded-full shadow border border-white leading-none animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
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
                    <div key={book.id} id={"review-" + book.id} className="bg-white p-2.5 border border-gray-400 text-xs">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <span className="font-bold text-[#1f4e5b] text-sm">
                          {book.genre === "웹툰"
                            ? "📱 "
                            : book.genre === "만화"
                            ? "💭 "
                            : book.genre === "오디오드라마"
                            ? "🎧 "
                            : "📖 "}
                          {book.title}
                        </span>
                        <span className="text-amber-600 font-bold text-xs whitespace-nowrap tracking-wider shrink-0">{book.rating}</span>
                      </div>

                      <div className="text-gray-600 text-xs mb-1.5 leading-relaxed">
                        {book.author ? `${book.author} · ` : ""}{book.genre} | <span className="font-bold text-gray-800">{book.user_name}</span>
                      </div>

                      {book.review && (
                        book.review.includes("(스포일러)") && !revealedSpoilers.includes(book.id) ? (
                          <div
                            onClick={() => setRevealedSpoilers([...revealedSpoilers, book.id])}
                            className="bg-amber-50 border border-dashed border-amber-400 p-2 mt-1 rounded text-xs text-amber-800 cursor-pointer hover:bg-amber-100 flex items-center justify-between select-none"
                          >
                            <span>⚠️ 스포일러가 포함된 감상평입니다.</span>
                            <span className="text-xs underline font-bold text-amber-900 ml-2 shrink-0">클릭하여 보기</span>
                          </div>
                        ) : (
                          <p className="text-gray-800 bg-gray-50 p-2 rounded border border-gray-200 mt-1 break-all text-xs leading-normal">
                            {book.review.replace("(스포일러)", "")}
                          </p>
                        )
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 my-2 pt-2 border-t border-dashed border-gray-200">
                        {["❤️", "📌", "😭", "😡", "👏"].map((emoji) => {
                          const count = (reactions[book.id] && reactions[book.id][emoji]) || 0;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReactionClick(book.id, emoji);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-full transition-colors select-none active:scale-95"
                            >
                              <span>{emoji}</span>
                              {count > 0 && <span className="text-[11px] font-bold text-gray-700">{count}</span>}
                            </button>
                          );
                        })}
                      </div>

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
                                  {(() => {
                                    const isSp = c.content.startsWith("(스포일러)");
                                    const isOpened = revealedComments[c.id];

                                    if (isSp && !isOpened) {
                                      return (
                                        <div
                                          onClick={() => setRevealedComments({ ...revealedComments, [c.id]: true })}
                                          className="bg-red-50 border border-red-200 text-red-600 p-1.5 rounded text-xs cursor-pointer hover:bg-red-100 flex items-center justify-between select-none"
                                        >
                                          <span>⚠️ 스포일러가 포함된 댓글입니다.</span>
                                          <span className="underline text-[10px] font-bold">내용 보기</span>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="text-gray-800 break-all text-xs leading-relaxed">
                                        {isSp ? c.content.replace("(스포일러)", "").trim() : c.content}
                                      </div>
                                    );
                                  })()}
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
                            <label className="flex items-center gap-1 mb-1 text-xs text-gray-700 select-none cursor-pointer">
                              <input
                                type="checkbox"
                                checked={commentForm.is_spoiler || false}
                                onChange={(e) => setCommentForm({ ...commentForm, is_spoiler: e.target.checked })}
                              />
                              <span>⚠️ 스포일러 포함</span>
                            </label>
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

        {/* 오른쪽 영역: 목표 현황판 & 전체 댓글 창 */}
        <div className="space-y-4">
          {/* 목표 현황판 */}
          <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl">
            <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
              <span>🎯 GOALS_TRACKER.exe</span>
              <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
            </div>

            <form onSubmit={handleGoalSubmit} className="p-2 space-y-2 bg-[#d4d8dc] border border-[#808080] mb-3 text-xs">
              <div className="font-bold text-[#1f4e5b] text-[11px] border-b border-gray-400 pb-1">
                내 목표 설정/수정
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

                  const counts = Array.from(
                    new Set(
                      sortedGoals
                        .map((item) => getReadCount(item.user_name))
                        .filter((cnt) => cnt > 0)
                    )
                  ).sort((a, b) => b - a);

                  let medalBadge = null;
                  if (readCount > 0) {
                    if (readCount === counts[0]) medalBadge = "🥇";
                    else if (readCount === counts[1]) medalBadge = "🥈";
                    else if (readCount === counts[2]) medalBadge = "🥉";
                  }

                  return (
                    <div key={g.id} className="bg-white p-2 border border-gray-400 text-xs">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-1.5">
                          {medalBadge && (
                            <span className="text-sm select-none leading-none">
                              {medalBadge}
                            </span>
                          )}
                          <span className="font-bold text-[#1f4e5b] text-[13px]">{g.user_name}</span>
                          {actualPercent >= 100 && (
                            <span className="text-xs bg-yellow-300 text-yellow-900 font-bold px-1 py-0.5 border border-yellow-500 shadow-sm">
                              🏆 달성
                            </span>
                          )}
                          {avgRating && (
                            <span className="text-xs text-amber-700 font-bold bg-amber-50 px-1 py-0.5 border border-amber-200">
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

            {/* 전체 댓글 창 */}
            <div className="bg-[#c3c7cb] border-2 border-t-[#ffffff] border-l-[#ffffff] border-b-[#404040] border-r-[#404040] p-1.5 shadow-xl mt-4">
              <div className="bg-[#1f4e5b] text-white px-2 py-1 flex justify-between items-center text-xs font-bold tracking-wider mb-2">
                <span>💬 COMMENTS.exe</span>
                <span className="bg-[#c3c7cb] text-black px-1 border border-t-white border-l-white border-b-black border-r-black">✕</span>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
                {comments.length === 0 ? (
                  <div className="bg-white p-3 text-center text-xs text-gray-500 border border-gray-400">
                    아직 작성된 댓글이 없습니다.
                  </div>
                ) : (
                  [...comments].reverse().map((c) => {
                    const targetBook = reviews.find((r) => r.id === c.book_id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          const el = document.getElementById("review-" + c.book_id);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                          setOpenCommentBookId(c.book_id);
                        }}
                        className="bg-white p-2 border border-gray-400 text-xs cursor-pointer hover:bg-yellow-50 transition-colors"
                      >
                        <div className="flex justify-between items-baseline mb-1 text-xs text-gray-600">
                          <span className="font-bold text-gray-800">{c.user_name}</span>
                          <span className="text-[#1f4e5b] font-bold truncate max-w-[150px]">
                            {targetBook?.genre === "웹툰"
                              ? "📱 "
                              : targetBook?.genre === "만화"
                              ? "💭 "
                              : targetBook?.genre === "오디오드라마"
                              ? "🎧 "
                              : "📖 "}
                            {targetBook ? targetBook.title : "삭제된 책"}
                          </span>
                        </div>
                        {(() => {
                          const isSp = c.content.startsWith("(스포일러)") || c.content.startsWith("[스포일러]");
                          const isOpened = revealedComments[c.id];

                          if (isSp && !isOpened) {
                            return (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedComments({ ...revealedComments, [c.id]: true });
                                }}
                                className="bg-red-50 border border-red-200 text-red-600 p-1.5 rounded text-xs cursor-pointer hover:bg-red-100 flex items-center justify-between select-none"
                              >
                                <span>⚠️ 스포일러가 포함된 댓글입니다.</span>
                                <span className="underline text-[10px] font-bold">내용 보기</span>
                              </div>
                            );
                          }

                          const cleanText = c.content.replace("(스포일러)", "").replace("[스포일러]", "").trim();

                          return (
                            <p className="text-gray-800 bg-gray-50 p-1.5 rounded border border-gray-200 text-xs leading-relaxed break-all">
                              {cleanText}
                            </p>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3단계: 추천 모달 */}
        {randomBook && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setRandomBook(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-xs w-full p-5 border border-amber-200 text-center select-none animate-in fade-in zoom-in duration-150 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-3xl mb-1 shrink-0">✨</div>
              <div className="shrink-0">
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block">
                  ⭐ 5점 만점 명작 추천
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mt-2.5 break-keep shrink-0">
                {randomBook.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 shrink-0">
                {randomBook.author || "작자 미상"} · {randomBook.genre || "장르 미분류"}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 shrink-0">
                작성자: {(randomBook as any).user_name || (randomBook as any).user || (randomBook as any).userName || "익명"}
              </p>
              <div className="text-amber-500 font-bold text-xs my-2 tracking-wider shrink-0">
                ★★★★★
              </div>

              {randomBook.review && (
                <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 text-left leading-relaxed my-2 overflow-y-auto max-h-48 break-words">
                  "{randomBook.review.replace("(스포일러)", "")}"
                </div>
              )}

              <div className="flex gap-2 mt-3 pt-1 shrink-0">
                <button
                  type="button"
                  onClick={handleRandomRecommend}
                  className="flex-1 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 active:scale-95 rounded-md transition-all"
                >
                  다시 뽑기
                </button>
                <button
                  type="button"
                  onClick={() => setRandomBook(null)}
                  className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-md transition-all"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showStats && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black p-1 shadow-2xl font-mono text-xs text-black">
            <div className="bg-[#000080] text-white px-2 py-1 font-bold flex justify-between items-center select-none">
              <span>STATS.exe</span>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="bg-[#c0c0c0] text-black px-1.5 py-0.5 border border-t-white border-l-white border-b-black border-r-black font-bold text-[10px]"
              >
                X
              </button>
            </div>
            <div className="p-3 space-y-3 bg-white mt-1 border-2 border-t-gray-600 border-l-gray-600 border-b-white border-r-white max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-2 border border-gray-300">
                <div>
                  <div className="text-gray-600 text-xs font-bold">총 등록 작품</div>
                  <div className="text-base font-bold text-blue-900">{totalBooks}권</div>
                </div>
                <div>
                  <div className="text-gray-600 text-xs font-bold">평균 별점</div>
                  <div className="text-amber-600 text-base font-bold">★ {avgRating} / 5.0</div>
                </div>
              </div>
              <div>
                <div className="font-bold border-b border-gray-300 pb-1 mb-1.5 text-gray-700">장르별 분포</div>
                <div className="space-y-1">
                  {Object.entries(genreCounts).map(([genre, count]: [string, any]) => {
                    const percent = Math.round((Number(count) / (totalBooks || 1)) * 100);
                    return (
                      <div key={genre} className="flex justify-between items-center bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        <span>{genre}</span>
                        <span className="font-bold text-gray-600">{count}권 ({percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="font-bold border-b border-gray-300 pb-1 mb-1.5 text-amber-800">5점 만점 작품</div>
                {topRatedBooks.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                    {topRatedBooks.map((b, idx) => (
                      <li key={idx} className="truncate">
                        {b.title}{b.genre ? ` (${b.genre})` : ""} by. {b.user_name || "익명"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-gray-400 italic">아직 만점 작품이 없습니다.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black font-bold"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
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
