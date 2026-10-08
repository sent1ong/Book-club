"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";

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
  is_favorite?: boolean;
  is_revisit?: boolean;
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

interface AppItem {
  id: string;
  name: string;
  icon: string;
}

const APP_LIST: AppItem[] = [
  { id: "book-add", name: "기록하기", icon: "/icons/book-add.png" },
  { id: "receipt", name: "독서 영수증", icon: "/icons/receipt.png" },
  { id: "stats", name: "통계", icon: "/icons/stats.png" },
  { id: "goals", name: "목표 트래커", icon: "/icons/goals.png" },
  { id: "curation", name: "취향 메이트", icon: "/icons/curation.png" },
  { id: "tags", name: "#태그", icon: "/icons/tags.png" },
  { id: "chart-pie", name: "장르 분석", icon: "/icons/chart-pie.png" },
  { id: "vending", name: "키워드 자판기", icon: "/icons/vending.png" },
  { id: "awards", name: "명예의 전당", icon: "/icons/awards.png" },
  { id: "versus", name: "호불호 배틀", icon: "/icons/versus.png" },
  { id: "pacemaker", name: "페이스메이커", icon: "/icons/pacemaker.png" },
  { id: "graveyard", name: "하차작 묘지", icon: "/icons/graveyard.png" },
  { id: "sales", name: "강제 영업소", icon: "/icons/sales.png" },
  { id: "ticker", name: "실시간 속보", icon: "/icons/ticker.png" },
  { id: "gossip", name: "익명 대나무숲", icon: "/icons/gossip.png" },
  { id: "bingo", name: "덕질 빙고", icon: "/icons/bingo.png" },
  { id: "quiz", name: "리뷰 퀴즈", icon: "/icons/quiz.png" },
  { id: "fever", name: "과몰입 체온계", icon: "/icons/fever.png" },
  { id: "collector", name: "카드 도감", icon: "/icons/collector.png" },
  { id: "motto", name: "덕질 가훈", icon: "/icons/motto.png" },
];

function isValidGroup(name: string | null) {
  if (!name) return false;
  if (name === "기본모임") return true;

  const match = name.match(/^(nogmbdj|forgaedus)(\d+)$/);
  if (!match) return false;
  const num = parseInt(match[2], 10);
  return num >= 26;
}

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

    playTone(523.25, 0, 0.2);
    playTone(1046.5, 0.08, 0.4);
  } catch (e) {}
};

const playCelebrationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
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
  } catch (e) {}
};

function BookClubContent() {
  const searchParams = useSearchParams();
  const groupName = searchParams.get("group") || "기본모임";
  const receiptRef = React.useRef<HTMLDivElement>(null);
  
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("전체");
  const [sortOrder, setSortOrder] = useState<string>("최신순");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRevisit, setIsRevisit] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<number[]>([]);
  const [revealedComments, setRevealedComments] = useState<{ [key: number]: boolean }>({});
  const [selectedGenre, setSelectedGenre] = useState("전체");
  const [filterType, setFilterType] = useState<"all" | "dropped" | "favorite" | "revisit">("all");
  const [reactions, setReactions] = useState<{ [bookId: number]: { [emoji: string]: number } }>({});
  const [randomBook, setRandomBook] = useState<BookReview | null>(null);

  // 윈도우 98 쉘 상태
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [openWindow, setOpenWindow] = useState<string | null>(null);
  const [time, setTime] = useState<string>("");

  const [receiptData, setReceiptData] = useState<{
    type: "single" | "list";
    user: string;
    items?: BookReview[];
    singleItem?: BookReview;
  } | null>(null);

  const [readCommentIds, setReadCommentIds] = useState<number[]>([]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`read_comments_${groupName}`);
      if (saved) {
        setReadCommentIds(JSON.parse(saved));
      }
    } catch (e) {}
  }, [groupName]);

  const handleSelectUser = (user: string) => {
    setSelectedUser(user);
    if (user === "전체") return;

    const targetBookIds = new Set(reviews.filter((r) => r.user_name === user).map((r) => r.id));
    const targetComments = comments.filter((c) => targetBookIds.has(c.book_id));
    const newReadIds = Array.from(new Set([...readCommentIds, ...targetComments.map((c) => c.id)]));

    setReadCommentIds(newReadIds);
    try {
      localStorage.setItem(`read_comments_${groupName}`, JSON.stringify(newReadIds));
    } catch (e) {}
  };

  const isAllowedGroup = isValidGroup(groupName);

  if (!isAllowedGroup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#008080] p-4 select-none">
        <div className="bg-[#c0c0c0] win-outset p-4 max-w-sm w-full text-center">
          <div className="bg-[#000080] text-white px-2 py-1 text-xs font-bold text-left mb-3">SYSTEM ERROR</div>
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-sm font-bold text-black mb-1">접근이 제한된 모임방입니다</h2>
          <p className="text-xs text-gray-700 leading-relaxed mb-4">
            존재하지 않거나 비공개된 방입니다.<br />올바른 주소로 접속해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const handleRandomRecommend = () => {
    const validBooks = reviews.filter((b) => b.rating !== "중도하차");
    if (validBooks.length === 0) {
      alert("추천할 수 있는 감상 완료 작품이 아직 없어요!");
      return;
    }
    const randomIndex = Math.floor(Math.random() * validBooks.length);
    setRandomBook(validBooks[randomIndex]);
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
    .filter((b) => (b.rating || "").includes("★★★★★"))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ko"));

  const userList = ["전체", ...Array.from(new Set(reviews.map((r) => r.user_name).filter(Boolean)))];

  const getUnreadCommentCount = (userName: string) => {
    if (userName === "전체") return 0;
    const userBookIds = new Set(reviews.filter((r) => r.user_name === userName).map((r) => r.id));
    if (userBookIds.size === 0) return 0;

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
    중도하차: 0,
  };

  const filteredReviews = reviews.filter((r) => {
    const matchesUser = selectedUser === "전체" || r.user_name === selectedUser;

    let matchesFilter = true;
    if (filterType === "dropped") {
      matchesFilter = r.rating === "중도하차";
    } else if (filterType === "favorite") {
      matchesFilter = !!r.is_favorite;
    } else if (filterType === "revisit") {
      matchesFilter = !!r.is_revisit;
    } else {
      matchesFilter = selectedGenre === "전체" || r.genre === selectedGenre;
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      r.title?.toLowerCase().includes(q) ||
      r.author?.toLowerCase().includes(q);
    return matchesUser && matchesFilter && matchesSearch;
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
        .update({
          ...formData,
          is_favorite: isFavorite,
          is_revisit: isRevisit,
        })
        .eq("id", editingId);

      if (error) {
        alert("수정 실패: " + error.message);
      } else {
        playRetroDing();
        alert("기록이 수정되었습니다!");
        setEditingId(null);
        resetForm();
        setOpenWindow(null);
        fetchReviews();
      }
    } else {
      const finalReview = isSpoiler ? "(스포일러) " + (formData.review || "") : formData.review;
      const { error } = await supabase.from("books").insert([
        {
          ...formData,
          review: finalReview,
          group_name: groupName,
          is_favorite: isFavorite,
          is_revisit: isRevisit,
        },
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
        setIsFavorite(false);
        setIsRevisit(false);
        setOpenWindow(null);
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
    setIsSpoiler(false);
    setIsFavorite(false);
    setIsRevisit(false);
  };

  const handleEdit = (book: BookReview) => {
    setEditingId(book.id);
    setFormData({
      user_name: book.user_name,
      title: book.title,
      author: book.author || "",
      review: book.review ? book.review.replace("(스포일러) ", "") : "",
      genre: book.genre || "소설",
      rating: book.rating || "★★★★★",
    });
    setIsSpoiler(book.review ? book.review.includes("(스포일러)") : false);
    setIsFavorite(!!book.is_favorite);
    setIsRevisit(!!book.is_revisit);
    setOpenWindow("book-add");
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setOpenWindow(null);
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

  const todayStr = new Date().toISOString().split("T")[0];

  const handleSaveReceiptImage = async () => {
    if (!receiptRef.current) return;
    try {
      setDownloadingReceipt(true);

      const target = receiptRef.current;
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        // 스크롤된 전체 내용이 잘리지 않고 온전히 다 찍히도록 설정
        height: target.scrollHeight,
        windowHeight: target.scrollHeight + 100,
        onclone: (clonedDoc) => {
          // 캡처 복제본에서만 스크롤/높이 제한을 풀어 전체를 깔끔하게 펼침
          const element = clonedDoc.querySelector("[data-receipt-box]") as HTMLElement;
          if (element) {
            element.style.maxHeight = "none";
            element.style.overflow = "visible";
          }
          const listScroll = clonedDoc.querySelector("[data-receipt-list]") as HTMLElement;
          if (listScroll) {
            listScroll.style.maxHeight = "none";
            listScroll.style.overflow = "visible";
          }
        },
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `영수증_${receiptData?.user || "기록"}_${todayStr}.png`;
      link.click();
    } catch (err) {
      alert("이미지 저장 중 오류가 발생했습니다.");
    } finally {
      setDownloadingReceipt(false);
    }
  };
  
  const handleAppClick = (appId: string) => {
    setStartMenuOpen(false);
    if (appId === "receipt") {
      setReceiptData({
        type: "list",
        user: selectedUser === "전체" ? (reviews[0]?.user_name || "회원") : selectedUser,
        items: selectedUser === "전체" ? reviews : reviews.filter((r) => r.user_name === selectedUser),
      });
      return;
    }
    if (appId === "curation") {
      handleRandomRecommend();
      return;
    }
    setOpenWindow(appId);
  };

  return (
    <main className="relative flex flex-col h-[100dvh] w-full bg-[#008080] font-sans select-none overflow-hidden">
      {/* 상단 현재 모임 뱃지 */}
      <div className="absolute top-2 right-3 z-20">
        <span className="win-outset bg-[#c0c0c0] text-black text-[11px] px-2 py-0.5 font-bold shadow">
          🖥️ 모임: {groupName}
        </span>
      </div>

      {/* 바탕화면 메인 스크롤 영역 */}
      <div
        className="flex-1 overflow-y-auto p-3 pb-16 space-y-4"
        onClick={() => setStartMenuOpen(false)}
      >
        {/* 20대 기능 아이콘 모바일 2열 / PC 5열 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-6 max-w-4xl mx-auto">
          {APP_LIST.map((app) => (
            <button
              key={app.id}
              onClick={(e) => {
                e.stopPropagation();
                handleAppClick(app.id);
              }}
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#000080]/30 active:bg-[#000080]/50 transition-colors group"
            >
              <div className="relative w-11 h-11 mb-1 drop-shadow">
                <Image
                  src={app.icon}
                  alt={app.name}
                  fill
                  sizes="44px"
                  className="object-contain"
                />
              </div>
              <span className="text-white text-xs px-1 text-center font-bold tracking-tight bg-[#008080] group-hover:bg-[#000080] rounded">
                {app.name}
              </span>
            </button>
          ))}
        </div>

        {/* 📚 서재 목록 (바탕화면 내장 탐색기 창) */}
        <div className="max-w-4xl mx-auto bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black">
          <div className="bg-[#000080] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
            <span>📚 EXPLORER - 서재 목록 ({displayedReviews.length}권)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenWindow("stats")}
                className="win-btn text-black px-1.5 py-0.5 text-[10px] font-bold"
              >
                📊 STATS
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchReviews();
                  fetchComments();
                }}
                className="text-xs underline hover:text-amber-200"
              >
                새로고침
              </button>
            </div>
          </div>

          <div className="p-2 space-y-2 bg-[#d4d8dc]">
            <input
              type="text"
              placeholder="🔍 제목 또는 작가 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs p-1.5 win-inset bg-white focus:outline-none placeholder-gray-500"
            />

            {/* 필터 탭 */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1">
                {["전체", "소설", "만화", "웹툰", "오디오드라마"].map((genre) => {
                  const isSelected = filterType === "all" && selectedGenre === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => {
                        setFilterType("all");
                        setSelectedGenre(genre);
                      }}
                      className={`px-2 py-0.5 text-xs win-btn ${
                        isSelected ? "win-inset bg-[#dfdfdf] font-bold" : ""
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterType(filterType === "favorite" ? "all" : "favorite")}
                  className={`px-2 py-0.5 text-xs win-btn ${
                    filterType === "favorite" ? "win-inset bg-amber-200 font-bold" : ""
                  }`}
                >
                  👑 인생작
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType(filterType === "revisit" ? "all" : "revisit")}
                  className={`px-2 py-0.5 text-xs win-btn ${
                    filterType === "revisit" ? "win-inset bg-sky-200 font-bold" : ""
                  }`}
                >
                  🔁 재주행
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType(filterType === "dropped" ? "all" : "dropped")}
                  className={`px-2 py-0.5 text-xs win-btn ${
                    filterType === "dropped" ? "win-inset bg-red-200 font-bold" : ""
                  }`}
                >
                  💔 중도하차
                </button>
              </div>
            </div>

            {/* 회원 선택 및 영수증 */}
            <div className="py-1 border-t border-gray-400 flex flex-wrap justify-between items-center gap-1">
              <div className="flex gap-1 overflow-x-auto items-center">
                {userList.map((user) => {
                  const unreadCount = getUnreadCommentCount(user);
                  return (
                    <button
                      key={user}
                      onClick={() => handleSelectUser(user)}
                      className={`relative px-2 py-0.5 text-[11px] whitespace-nowrap font-bold win-btn ${
                        selectedUser === user ? "win-inset bg-[#000080] text-white" : ""
                      }`}
                    >
                      {user}
                      {unreadCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center bg-red-600 text-white text-[10px] font-extrabold px-1 min-w-[15px] h-[15px] rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}

                {selectedUser !== "전체" && (
                  <button
                    type="button"
                    onClick={() => {
                      const userItems = reviews.filter((r) => r.user_name === selectedUser);
                      setReceiptData({
                        type: "list",
                        user: selectedUser,
                        items: userItems,
                      });
                    }}
                    className="ml-1 px-2 py-0.5 text-xs font-bold win-btn"
                  >
                    🧾 {selectedUser} 영수증
                  </button>
                )}
              </div>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-white text-[11px] font-bold p-0.5 win-inset outline-none"
              >
                <option value="최신순">최신순</option>
                <option value="오래된순">오래된순</option>
                <option value="높은 평점순">높은 평점순</option>
                <option value="낮은 평점순">낮은 평점순</option>
              </select>
            </div>

            {/* 카드 목록 */}
            <div className="mt-1 space-y-2 max-h-[420px] overflow-y-auto pr-0.5 win-inset p-1 bg-[#808080]">
              {displayedReviews.length === 0 ? (
                <div className="bg-white p-4 text-center text-xs text-gray-500">
                  해당하는 독서 기록이 없습니다.
                </div>
              ) : (
                displayedReviews.map((book) => {
                  const bookComments = comments.filter((c) => c.book_id === book.id);
                  const isOpen = openCommentBookId === book.id;

                  return (
                    <div key={book.id} id={"review-" + book.id} className="bg-white p-2.5 win-outset text-xs">
                      <div className="flex justify-between items-start gap-1 mb-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-bold text-[#000080] text-sm">
                            {book.genre === "웹툰"
                              ? "📱 "
                              : book.genre === "만화"
                              ? "💭 "
                              : book.genre === "오디오드라마"
                              ? "🎧 "
                              : "📖 "}
                            {book.title}
                          </span>
                          {book.is_favorite && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-1 rounded">
                              👑 인생작
                            </span>
                          )}
                          {book.is_revisit && (
                            <span className="bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs px-1 rounded">
                              🔁 재주행
                            </span>
                          )}
                        </div>
                        <span className="text-amber-600 font-bold text-xs whitespace-nowrap tracking-wider shrink-0">
                          {book.rating}
                        </span>
                      </div>

                      <div className="text-gray-600 text-xs mb-1.5 leading-relaxed">
                        {book.author ? `${book.author} · ` : ""}{book.genre} | <span className="font-bold text-gray-800">{book.user_name}</span>
                      </div>

                      {book.review && (
                        book.review.includes("(스포일러)") && !revealedSpoilers.includes(book.id) ? (
                          <div
                            onClick={() => setRevealedSpoilers([...revealedSpoilers, book.id])}
                            className="bg-amber-50 border border-dashed border-amber-400 p-2 mt-1 rounded text-xs text-amber-800 cursor-pointer hover:bg-amber-100 flex items-center justify-between"
                          >
                            <span>⚠️ 스포일러가 포함된 감상평입니다.</span>
                            <span className="text-xs underline font-bold text-amber-900 ml-2 shrink-0">보기</span>
                          </div>
                        ) : (
                          <p className="text-gray-800 bg-gray-50 p-2 rounded win-inset mt-1 break-all text-xs leading-normal">
                            {book.review.replace("(스포일러)", "")}
                          </p>
                        )
                      )}

                      {/* 이모지 반응 */}
                      <div className="flex flex-wrap items-center gap-1.5 my-2 pt-1 border-t border-dashed border-gray-200">
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
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs win-btn"
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
                          💬 댓글 <span className="text-[#000080] underline">({bookComments.length})</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptData({
                                type: "single",
                                user: book.user_name,
                                singleItem: book,
                              })
                            }
                            className="text-gray-700 hover:underline font-bold"
                          >
                            🖨️ 영수증
                          </button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => handleEdit(book)} className="text-blue-600 hover:underline font-bold">
                            수정
                          </button>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => handleDelete(book.id, book.title)} className="text-red-500 hover:underline font-bold">
                            삭제
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-300 bg-[#f4f6f7] p-2 win-inset">
                          <div className="space-y-1.5 mb-2">
                            {bookComments.length === 0 ? (
                              <div className="text-xs text-gray-400 text-center py-1">첫 번째 댓글을 남겨보세요!</div>
                            ) : (
                              bookComments.map((c) => (
                                <div key={c.id} className="bg-white p-2 border border-gray-200 text-xs">
                                  <div className="flex justify-between items-center text-gray-500 text-xs mb-1">
                                    <span className="font-bold text-gray-800">{c.user_name}</span>
                                    <div className="flex gap-1.5">
                                      <button onClick={() => handleEditComment(c.id, c.content)} className="text-blue-600 hover:underline font-bold">수정</button>
                                      <button onClick={() => handleDeleteComment(c.id)} className="text-red-500 hover:underline font-bold">삭제</button>
                                    </div>
                                  </div>
                                  <div className="text-gray-800 break-all text-xs leading-relaxed">
                                    {c.content.replace("(스포일러)", "").trim()}
                                  </div>
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
                                className="p-1 text-xs bg-white win-inset outline-none"
                              />
                              <input
                                type="password"
                                maxLength={4}
                                required
                                placeholder="숫자 4자리"
                                value={commentForm.password}
                                onChange={(e) => setCommentForm({ ...commentForm, password: e.target.value })}
                                className="p-1 text-xs bg-white win-inset outline-none"
                              />
                            </div>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                required
                                placeholder="댓글을 입력하세요..."
                                value={commentForm.content}
                                onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })}
                                className="flex-1 p-1 text-xs bg-white win-inset outline-none"
                              />
                              <button type="submit" className="win-btn px-2.5 py-1 text-xs font-bold">
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
      </div>

      {/* --- 모달 창들 --- */}

      {/* 1. 도서 등록 모달 (book-add) */}
      {openWindow === "book-add" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>{editingId ? "EDITING_BOOK.exe" : "ADD_BOOK.exe"}</span>
              <button onClick={() => setOpenWindow(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-3 space-y-2.5 bg-[#d4d8dc] win-inset overflow-y-auto m-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">NAME (내 이름)</label>
                <input
                  type="text"
                  required
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
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
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                  placeholder="제목 입력"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">AUTHOR (작가)</label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                  placeholder="작가 이름"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">GENRE (장르)</label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="w-full p-1 text-xs bg-white win-inset"
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
                    className="w-full p-1 text-xs bg-white win-inset"
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
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none resize-none"
                  placeholder="감상이나 리뷰를 적어주세요"
                />
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-700">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} />
                    <span>⚠️ 스포일러</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={isFavorite} onChange={(e) => setIsFavorite(e.target.checked)} />
                    <span>👑 인생작</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={isRevisit} onChange={(e) => setIsRevisit(e.target.checked)} />
                    <span>🔁 재주행</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-1 pt-2">
                <button type="submit" disabled={loading} className="flex-1 py-1.5 win-btn font-bold text-xs">
                  {loading ? "처리 중..." : editingId ? "수정 완료" : "입력 완료"}
                </button>
                <button type="button" onClick={cancelEdit} className="px-3 py-1.5 win-btn text-xs font-bold">
                  닫기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 통계 창 (stats) */}
      {openWindow === "stats" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl font-mono text-xs text-black">
            <div className="bg-[#000080] text-white px-2 py-1 font-bold flex justify-between items-center">
              <span>STATS.exe</span>
              <button onClick={() => setOpenWindow(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <div className="p-3 space-y-3 bg-white mt-1 win-inset max-h-[70vh] overflow-y-auto">
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
              <button onClick={() => setOpenWindow(null)} className="win-btn px-4 py-1 text-xs font-bold">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 목표 트래커 (goals) */}
      {openWindow === "goals" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>🎯 GOALS_TRACKER.exe</span>
              <button onClick={() => setOpenWindow(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <div className="p-3 bg-[#d4d8dc] win-inset m-1 overflow-y-auto space-y-3">
              <form onSubmit={handleGoalSubmit} className="space-y-2 text-xs bg-white p-2 win-inset">
                <div className="font-bold text-[#000080] border-b pb-1">내 목표 설정/수정</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="닉네임"
                    value={goalForm.user_name}
                    onChange={(e) => setGoalForm({ ...goalForm, user_name: e.target.value })}
                    className="p-1 win-inset text-xs outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="목표 권수"
                    value={goalForm.target_count}
                    onChange={(e) => setGoalForm({ ...goalForm, target_count: e.target.value })}
                    className="p-1 win-inset text-xs outline-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="목표 한마디 (예: 완독왕!)"
                  value={goalForm.message}
                  onChange={(e) => setGoalForm({ ...goalForm, message: e.target.value })}
                  className="w-full p-1 win-inset text-xs outline-none"
                />
                <button type="submit" className="w-full py-1 win-btn text-xs font-bold">목표 저장</button>
              </form>

              <div className="space-y-1.5">
                {sortedGoals.map((g) => {
                  const readCount = getReadCount(g.user_name);
                  const actualPercent = Math.round((readCount / g.target_count) * 100);
                  const barPercent = Math.min(100, actualPercent);
                  return (
                    <div key={g.id} className="bg-white p-2 win-outset text-xs">
                      <div className="flex justify-between font-bold mb-1">
                        <span>{g.user_name}</span>
                        <span>{readCount} / {g.target_count}권 ({actualPercent}%)</span>
                      </div>
                      <div className="w-full bg-gray-300 win-inset h-3 p-0.5">
                        <div className="bg-[#000080] h-full" style={{ width: `${barPercent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. 익명 대나무숲 & 전체 댓글 (gossip) */}
      {openWindow === "gossip" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>💬 COMMENTS_BOARD.exe</span>
              <button onClick={() => setOpenWindow(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <div className="p-2 bg-white win-inset m-1 overflow-y-auto space-y-1.5">
              {comments.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-4">아직 작성된 댓글이 없습니다.</div>
              ) : (
                [...comments].reverse().map((c) => {
                  const targetBook = reviews.find((r) => r.id === c.book_id);
                  return (
                    <div key={c.id} className="bg-gray-50 p-2 border border-gray-200 text-xs">
                      <div className="flex justify-between font-bold text-gray-800 mb-0.5">
                        <span>{c.user_name}</span>
                        <span className="text-[#000080] truncate max-w-[150px]">{targetBook ? targetBook.title : "삭제된 도서"}</span>
                      </div>
                      <p className="text-gray-700">{c.content.replace("(스포일러)", "").trim()}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. 나머지 신규 기능 플레이스홀더 창 */}
      {openWindow && !["book-add", "stats", "goals", "gossip"].includes(openWindow) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-sm bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col">
            <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>{APP_LIST.find((a) => a.id === openWindow)?.name}.exe</span>
              <button onClick={() => setOpenWindow(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <div className="bg-white win-inset p-6 my-2 text-xs flex flex-col items-center justify-center text-center space-y-2">
              <div className="relative w-12 h-12">
                <Image
                  src={APP_LIST.find((a) => a.id === openWindow)?.icon || "/icons/start-logo.png"}
                  alt=""
                  fill
                  className="object-contain"
                />
              </div>
              <p className="font-bold text-sm">{APP_LIST.find((a) => a.id === openWindow)?.name}</p>
              <p className="text-gray-600">이 기능의 세부 모듈 화면을 준비 중입니다!</p>
            </div>
            <div className="flex justify-end p-1">
              <button onClick={() => setOpenWindow(null)} className="win-btn px-4 py-1 text-xs font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 영수증 모달 */}
      {receiptData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setReceiptData(null)}
        >
          <div
            ref={receiptRef}
            data-receipt-box="true"
            className="w-full max-w-[360px] bg-white text-black p-5 font-sans text-xs shadow-2xl relative select-text border-t-8 border-b-8 border-dashed border-gray-300 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-html2canvas-ignore="true"
              onClick={() => setReceiptData(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-black font-bold text-sm select-none"
            >
              ✕
            </button>
            <div className="text-center pb-2 border-b-2 border-dashed border-gray-400">
              <div className="text-base font-extrabold tracking-widest">RECEIPT_PRINT.exe</div>
              <div className="text-[10px] text-gray-500 mt-0.5">================================</div>
              <div className="flex justify-between text-[11px] text-gray-600 mt-1">
                <span>발급일자: {todayStr}</span>
                <span>모임: {groupName}</span>
              </div>
              <div className="text-left text-xs font-bold mt-1">
                고객명: {receiptData.user} 님
              </div>
            </div>

            {receiptData.type === "single" && receiptData.singleItem && (
              <div className="py-3 space-y-2 text-xs">
                <div className="font-bold border-b border-gray-300 pb-1 text-gray-700">[작품 정보]</div>
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">제  목:</span>
                    <span className="font-bold break-keep">{receiptData.singleItem.title}</span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">작  가:</span>
                    <span>{receiptData.singleItem.author || "미상"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">장  르:</span>
                    <span>{receiptData.singleItem.genre}</span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">평  점:</span>
                    <span className="font-bold text-gray-900">{receiptData.singleItem.rating}</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-2.5 rounded border border-dashed border-gray-300 text-gray-800 text-xs">
                  "{receiptData.singleItem.review ? receiptData.singleItem.review.replace("(스포일러)", "") : "감상평 없음"}"
                </div>
              </div>
            )}

            {receiptData.type === "list" && receiptData.items && (
              <div className="py-3 text-xs">
                <div className="flex justify-between font-bold border-b border-gray-400 pb-1 text-gray-700 mb-2">
                  <span>[품목 / 장르]</span>
                  <span>[평점]</span>
                </div>
                <div data-receipt-list="true" className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {receiptData.items.map((item, idx) => (
                    <div key={item.id} className="flex justify-between items-baseline border-b border-gray-100 pb-1 text-xs">
                      <span className="truncate flex-1">{idx + 1}. {item.title}</span>
                      <span className="font-bold shrink-0 text-amber-700">{item.rating}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center pt-3 border-t-2 border-dashed border-gray-400">
              <div className="text-lg tracking-[2px] font-serif select-none text-gray-800 whitespace-nowrap overflow-hidden">
                |||| || ||||| ||| ||||||| || ||||
              </div>
              <div className="text-xs font-black tracking-tight mt-1 text-black">
                *** 구매비덕질을 타파하자! ***
              </div>

              {/* 저장 버튼 */}
              <div data-html2canvas-ignore="true" className="mt-3 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSaveReceiptImage}
                  disabled={downloadingReceipt}
                  className="w-full py-1.5 win-btn font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>💾</span>
                  <span>{downloadingReceipt ? "저장 중..." : "영수증 이미지로 저장"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 랜덤 추천 팝업 (curation) */}
      {randomBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRandomBook(null)}
        >
          <div
            className="bg-[#c0c0c0] win-outset max-w-xs w-full p-1 text-center select-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-xs font-bold mb-2">
              <span>RANDOM_PICK.exe</span>
              <button onClick={() => setRandomBook(null)} className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
            </div>
            <div className="bg-white win-inset p-3 m-1 text-xs space-y-2">
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                🎲 오늘의 추천작
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-1">{randomBook.title}</h3>
              <p className="text-xs text-gray-600">{randomBook.author || "작자 미상"} · {randomBook.genre}</p>
              <div className="text-amber-500 font-bold">{randomBook.rating}</div>
              {randomBook.review && (
                <div className="bg-gray-50 p-2 text-xs text-gray-700 win-inset break-words">
                  "{randomBook.review.replace("(스포일러)", "")}"
                </div>
              )}
            </div>
            <div className="flex gap-1 p-2">
              <button onClick={handleRandomRecommend} className="flex-1 py-1 win-btn text-xs font-bold">다시 뽑기</button>
              <button onClick={() => setRandomBook(null)} className="flex-1 py-1 win-btn text-xs font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 시작 메뉴 팝업 */}
      {startMenuOpen && (
        <div
          className="absolute bottom-10 left-0 z-50 w-60 bg-[#c0c0c0] win-outset flex shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 좌측 사이드바 */}
          <div className="w-8 bg-gradient-to-t from-[#000080] via-[#1084d0] to-[#000080] flex items-center justify-center relative overflow-hidden select-none">
            <span className="text-white font-extrabold text-xs -rotate-90 whitespace-nowrap tracking-widest drop-shadow">
              BOOK CLUB 98
            </span>
            </div>
          <div className="flex-1 p-1 flex flex-col space-y-0.5 text-xs max-h-[350px] overflow-y-auto">
            {APP_LIST.map((app) => (
              <button
                key={app.id}
                onClick={() => handleAppClick(app.id)}
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-[#000080] hover:text-white rounded text-left transition-colors"
              >
                <div className="relative w-5 h-5 flex-shrink-0">
                  <Image
                    src={app.icon}
                    alt=""
                    fill
                    sizes="20px"
                    className="object-contain"
                  />
                </div>
                <span className="truncate">{app.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 하단 윈도우 98 작업표시줄 */}
      <footer className="h-10 bg-[#c0c0c0] win-outset z-40 flex items-center justify-between px-1 absolute bottom-0 inset-x-0">
        <button
          onClick={() => setStartMenuOpen(!startMenuOpen)}
          className={`flex items-center space-x-1.5 px-2 py-1 win-btn text-xs font-bold ${
            startMenuOpen ? "win-inset bg-[#dfdfdf]" : ""
          }`}
        >
          <div className="relative w-4 h-4">
            <Image
              src="/icons/start-logo.png"
              alt="Start"
              fill
              sizes="16px"
              className="object-contain"
            />
          </div>
          <span>시작</span>
        </button>

        <div className="win-inset px-2 py-0.5 text-[11px] font-mono bg-[#c0c0c0] min-w-[65px] text-center">
          {time}
        </div>
      </footer>
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
