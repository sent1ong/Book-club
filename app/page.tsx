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

  const [reviews, setReviews] = useState([]);
  const [goals, setGoals] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("전체");
  const [sortOrder, setSortOrder] = useState("최신순");
  const [editingId, setEditingId] = useState(null);

  // 열려있는 댓글창 관리 (bookId 단위)
  const [openCommentBookId, setOpenCommentBookId] = useState(null);

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

  // 등록된 순서대로(과거순 -> 최신순이 아래로) 불러옴
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

  const userList = ["전체", ...Array.from(new Set(reviews.map((r) => r.user_name).filter(Boolean)))];

  // 0.5점 단위 별점 점수 매핑
  const scoreMap: Record = {
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

  return (
