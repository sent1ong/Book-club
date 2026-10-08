"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      marquee: any;
    }
  }
}

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
  { id: "goals", name: "목표 트래커", icon: "/icons/goals.png" },
  { id: "genre", name: "장르 분석", icon: "/icons/chart-pie.png" },
  { id: "awards", name: "명예의 전당", icon: "/icons/awards.png" },
  { id: "pacemaker", name: "페이스메이커", icon: "/icons/pacemaker.png" },
  { id: "curation", name: "취향 메이트", icon: "/icons/curation.png" },
  { id: "sales", name: "강제 영업소", icon: "/icons/sales.png" },
  { id: "tags", name: "#키워드", icon: "/icons/tags.png" },
  { id: "vending", name: "#키워드_가챠", icon: "/icons/vending.png" },
  { id: "versus", name: "호불호 배틀", icon: "/icons/versus.png" },
  { id: "graveyard", name: "하차작 묘지", icon: "/icons/graveyard.png" },
  { id: "gossip", name: "익명 대나무숲", icon: "/icons/gossip.png" },
  { id: "bingo", name: "덕질 빙고", icon: "/icons/bingo.png" },
  { id: "quiz", name: "리뷰 퀴즈", icon: "/icons/quiz.png" },
  { id: "collector", name: "카드 도감", icon: "/icons/collector.png" },
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

  // 장르 분석 창 전용 선택 사용자 ("전체" 또는 특정 유저명)
  const [genreUser, setGenreUser] = useState<string>("전체");

  // 키워드 자판기 상태 관리
  const [vendingStatus, setVendingStatus] = useState<"idle" | "inserting" | "spinning" | "result">("idle");
  const [vendingTags, setVendingTags] = useState<string[]>([]);
  const [vendingBook, setVendingBook] = useState<(typeof reviews)[number] | null>(null);

  // 취향 도플갱어 모달 전용 상태
  const [mateTargetUser, setMateTargetUser] = useState<string>("");

  // 모임원 간 5점 만점 / 별점 일치도 기반 취향 도플갱어 분석
  const soulmateData = React.useMemo(() => {
    // 모든 고유 유저 목록
    const allUsers = Array.from(new Set(reviews.map((r) => r.user_name))).filter(Boolean);
    if (allUsers.length < 2) return null;

    // 기준 유저 (선택된 유저가 없으면 첫 번째 유저)
    const currentUser = mateTargetUser || allUsers[0];

    // 기준 유저가 5점(★★★★★)을 준 작품 제목 목록
    const myHighRated = reviews.filter(
      (r) => r.user_name === currentUser && (r.rating === "★★★★★" || r.rating === "5")
    );
    const myTitles = new Set(myHighRated.map((r) => r.title));

    let bestMate = "";
    let maxMatchCount = -1;
    let commonWorks: string[] = [];
    let matchRate = 0;

    // 다른 유저들과의 공통 5점 작품 비교
    allUsers.forEach((otherUser) => {
      if (otherUser === currentUser) return;

      const otherHighRated = reviews.filter(
        (r) => r.user_name === otherUser && (r.rating === "★★★★★" || r.rating === "5")
      );
      
      const shared = otherHighRated
        .map((r) => r.title)
        .filter((title) => myTitles.has(title));

      if (shared.length > maxMatchCount) {
        maxMatchCount = shared.length;
        bestMate = otherUser;
        commonWorks = shared;
      }
    });

    // 일치율 계산 (기준 유저 5점 작품 수 대비)
    if (myHighRated.length > 0 && maxMatchCount > 0) {
      matchRate = Math.min(100, Math.round((maxMatchCount / myHighRated.length) * 100));
    }

    return {
      currentUser,
      bestMate: bestMate || allUsers.find((u) => u !== currentUser) || "없음",
      matchCount: maxMatchCount > 0 ? maxMatchCount : 0,
      matchRate: maxMatchCount > 0 ? matchRate : 0,
      commonWorks,
      myFiveStarCount: myHighRated.length,
      allUsers,
    };
  }, [reviews, mateTargetUser]);

  // ⚔️ 호불호 논쟁작 배틀 데이터 분석 (완전체)
  const battleData = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;

    const localScoreMap: Record<string, number> = {
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

    const bookGroups: { [title: string]: BookReview[] } = {};
    reviews.forEach((r) => {
      if (!r || !r.title) return;
      if (!bookGroups[r.title]) bookGroups[r.title] = [];
      bookGroups[r.title].push(r);
    });

    let topControversial: {
      title: string;
      author: string;
      genre: string;
      reviews: BookReview[];
      variance: number;
      proReviews: BookReview[];
      conReviews: BookReview[];
      neutralReviews: BookReview[];
      avgScore: number;
    } | null = null;

    let maxVariance = -1;

    Object.entries(bookGroups).forEach(([title, bookReviews]) => {
      if (!bookReviews || bookReviews.length < 2) return;

      const scores = bookReviews.map((r) => localScoreMap[r.rating] ?? 2.5);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance =
        scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;

      const pro = bookReviews.filter(
        (r) => (localScoreMap[r.rating] ?? 0) >= 4.0 || r.rating === "★★★★★" || r.is_favorite
      );

      const con = bookReviews.filter(
        (r) => (localScoreMap[r.rating] ?? 0) <= 2.5 || r.rating === "중도하차"
      );

      const neutral = bookReviews.filter((r) => {
        const score = localScoreMap[r.rating] ?? 0;
        return score >= 3.0 && score <= 3.5 && !r.is_favorite && r.rating !== "중도하차";
      });

      if (pro.length > 0 && con.length > 0 && variance > maxVariance) {
        maxVariance = variance;
        topControversial = {
          title,
          author: bookReviews[0]?.author || "미상",
          genre: bookReviews[0]?.genre || "기타",
          reviews: bookReviews,
          variance,
          proReviews: pro,
          conReviews: con,
          neutralReviews: neutral,
          avgScore: Number(mean.toFixed(1)),
        };
      }
    });

    return topControversial;
  }, [reviews]);

  // 🏆 연간/분기 어워즈 부문별 수상자 자동 산출
  const awardsData = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;

    const userStats: {
      [name: string]: {
        total: number;
        dropped: number;
        totalLength: number;
        genreCounts: { [genre: string]: number };
        favoriteCount: number;
      };
    } = {};

    reviews.forEach((r) => {
      if (!r.user_name) return;
      if (!userStats[r.user_name]) {
        userStats[r.user_name] = {
          total: 0,
          dropped: 0,
          totalLength: 0,
          genreCounts: {},
          favoriteCount: 0,
        };
      }

      const s = userStats[r.user_name];
      s.total += 1;
      if (r.rating === "중도하차") s.dropped += 1;
      if (r.is_favorite) s.favoriteCount += 1;
      if (r.review) s.totalLength += r.review.length;

      const g = r.genre || "기타";
      s.genreCounts[g] = (s.genreCounts[g] || 0) + 1;
    });

    const users = Object.entries(userStats);
    if (users.length === 0) return null;

    // 1. 📚 다독왕: 총 완독(등록) 권수가 가장 많은 회원
    const sortedByTotal = [...users].sort((a, b) => b[1].total - a[1].total);
    const readKing = {
      user: sortedByTotal[0][0],
      score: `${sortedByTotal[0][1].total}권 완독`,
      desc: "지치지 않는 학구열과 페이지 넘김으로 서재를 가득 채운 독서 거장",
    };

    // 2. 🪦 하차왕: '중도하차' 기록이 가장 많은 회원
    const sortedByDropped = [...users].sort((a, b) => b[1].dropped - a[1].dropped);
    const dropKing =
      sortedByDropped[0][1].dropped > 0
        ? {
            user: sortedByDropped[0][0],
            score: `${sortedByDropped[0][1].dropped}편 영면`,
            desc: "단호한 결단력과 냉철한 시간 절약으로 단두대를 운영한 결단왕",
          }
        : {
            user: "없음",
            score: "0편",
            desc: "현재 모든 회원이 끝까지 완주 중입니다!",
          };

    // 3. ✍️ 주접상: 리뷰 글자수 총합이 가장 긴 회원
    const sortedByWords = [...users].sort((a, b) => b[1].totalLength - a[1].totalLength);
    const fangirlKing = {
      user: sortedByWords[0][0],
      score: `총 ${sortedByWords[0][1].totalLength.toLocaleString()}자 집필`,
      desc: "한줄평 칸이 모자랄 정도로 심장을 울리는 과몰입 명문을 쏟아낸 작가님",
    };

    // 4. 🧬 편식왕: 한 장르 몰두 비율(최소 3권 이상 기록자 중)이 가장 높은 회원
    let topDietUser = "없음";
    let maxDietPercent = 0;
    let dominantGenre = "기타";

    users.forEach(([name, stat]) => {
      if (stat.total < 2) return;
      Object.entries(stat.genreCounts).forEach(([genre, count]) => {
        const percent = Math.round((count / stat.total) * 100);
        if (percent > maxDietPercent) {
          maxDietPercent = percent;
          topDietUser = name;
          dominantGenre = genre;
        }
      });
    });

    const dietKing =
      topDietUser !== "없음"
        ? {
            user: topDietUser,
            score: `${dominantGenre} 올인 (${maxDietPercent}%)`,
            desc: "한 우물만 끝까지 파는 확고하고 타협 없는 외길 취향의 소유자",
          }
        : {
            user: users[0][0],
            score: "골고루 섭취 중",
            desc: "다양한 장르를 균형 있게 즐기는 잡식형 독서가",
          };

    return [
      { id: "read", title: "명예의 다독왕", icon: "👑", ...readKing, color: "border-amber-400 bg-amber-50" },
      { id: "drop", title: "칼같은 하차왕", icon: "⚰️", ...dropKing, color: "border-gray-500 bg-gray-100" },
      { id: "fangirl", title: "불꽃의 주접상", icon: "🔥", ...fangirlKing, color: "border-rose-400 bg-rose-50" },
      { id: "diet", title: "외길의 편식왕", icon: "🧬", ...dietKing, color: "border-indigo-400 bg-indigo-50" },
    ];
  }, [reviews]);

  // 📢 강제 영업소 (인생작 / 5점 만점 작품 전단지 모음)
  const salesReviews = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return [];

    // 5점 만점(★★★★★)이거나 인생작으로 꼽힌 리뷰 중 감상평이 있는 것만 선별
    const targets = reviews.filter(
      (r) => (r.rating === "★★★★★" || r.rating === "5" || r.is_favorite) && r.review && r.review.trim().length > 0
    );

    // 열 때마다 신선하게 볼 수 있도록 무작위 셔플
    return [...targets].sort(() => 0.5 - Math.random());
  }, [reviews]);

  // 영업소 엽서 넘기기용 인덱스 상태
  const [salesIndex, setSalesIndex] = useState(0);

  // 🏃 페이스메이커 (최근 14일 엄격 집계 버전)
  const paceData = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return [];

    const now = new Date();
    const userGroups: { [name: string]: BookReview[] } = {};

    reviews.forEach((r) => {
      if (!r.user_name) return;
      if (!userGroups[r.user_name]) userGroups[r.user_name] = [];
      userGroups[r.user_name].push(r);
    });

    const userPaces = Object.entries(userGroups).map(([name, uReviews]) => {
      const totalCount = uReviews.length;

      // 14일(2주) 이내에 실제 등록된 책만 집계 (created_at이 없으면 0권)
      const recentCount = uReviews.filter((r) => {
        if (!r.created_at) return false;
        const createdDate = new Date(r.created_at);
        if (isNaN(createdDate.getTime())) return false;
        const diffDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 14;
      }).length;

      // 속도 공식: 14일 이내 완독 1권당 30km/h + 기본 서재 누적 보너스
      const speed = Math.min(180, Math.max(10, recentCount * 30 + Math.min(30, totalCount * 2)));

      let status = "순항 중 🚙";
      let statusColor = "text-blue-800 bg-blue-100 border-blue-300";
      let comment = "안정적인 속도로 서재를 채워나가는 중입니다.";

      if (speed >= 100) {
        status = "초과속 질주 🏎️💨";
        statusColor = "text-red-800 bg-red-100 border-red-300";
        comment = "페이지에 불이 붙었습니다! 페달을 끝까지 밟은 완독 머신.";
      } else if (speed >= 50) {
        status = "고속 주행 🚗💨";
        statusColor = "text-amber-800 bg-amber-100 border-amber-300";
        comment = "거침없는 몰입감으로 페이스메이커 선두권을 달리는 중!";
      } else if (recentCount === 0) {
        status = "엔진 예열 중 🛞";
        statusColor = "text-gray-800 bg-gray-200 border-gray-400";
        comment = "피트인(휴식) 상태입니다. 새 책으로 시동을 걸어보세요!";
      }

      const trackProgress = Math.min(90, Math.max(5, (speed / 180) * 100));

      return {
        name,
        totalCount,
        recentCount,
        speed,
        status,
        statusColor,
        comment,
        trackProgress,
      };
    });

    return userPaces.sort((a, b) => b.speed - a.speed);
  }, [reviews]);

  // 📡 실시간 속보 전광판 데이터 (최신 리뷰 상위 5건)
  const tickerText = React.useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return "속보: 현재 서재가 평화롭습니다. 첫 번째 독서 기록을 등록해 보세요! 📢";
    }
    const recentItems = reviews.slice(0, 5).map((r) => {
      const cleanReview = r.review ? r.review.replace("(스포일러)", "").trim() : "감상 등록 완료";
      const shortReview = cleanReview.length > 25 ? `${cleanReview.slice(0, 25)}...` : cleanReview;
      return `[NEW] ${r.user_name}님이 《${r.title}》에 평점 ${r.rating}을 남겼습니다: "${shortReview}"`;
    });
    return recentItems.join("   ◆   ");
  }, [reviews]);

  // 🎲 덕질 빙고 상태 (3x3 보드)
  const BINGO_CELLS_DEFAULT = [
    { id: 1, title: "새벽 2시 넘어 완독", desc: "다음날 일정 포기하고 달림" },
    { id: 2, title: "인생작 등극", desc: "별점 5.0 만점 부여 완료" },
    { id: 3, title: "강제 영업 성공", desc: "내 리뷰 보고 멤버가 구매함" },
    { id: 4, title: "주접 리뷰 박제", desc: "리뷰 칸에 주접 3줄 이상 남김" },
    { id: 5, title: "과몰입 후유증", desc: "다 읽고 며칠간 현실 적응 불가" },
    { id: 6, title: "중도하차 결단", desc: "과감하게 묘지에 묻어줌" },
    { id: 7, title: "N차 재주행", desc: "이미 아는 맛인데 또 읽음" },
    { id: 8, title: "오디오/웹툰 정복", desc: "소설 외 다른 미디어 감상" },
    { id: 9, title: "스포 방지 배려", desc: "후기에 (스포일러) 태그 준수" },
  ];

  // 현재 선택된 멤버 (기본값: '전체' 제외한 첫 번째 멤버 또는 '얼이')
  const [selectedBingoUser, setSelectedBingoUser] = useState<string>("얼이");

  // 멤버별 체크된 칸 목록 { "얼이": [5, 1, 2], "루프": [5, 3] }
  const [userBingoData, setUserBingoData] = useState<Record<string, number[]>>({
    얼이: [5],
    루프: [5],
    홍시: [5],
    체리: [5],
    뿌리: [5],
  });

  // 현재 선택된 멤버의 체크 배열
  const currentChecked = userBingoData[selectedBingoUser] || [5];

  // 빙고 줄 수 계산 로직 (가로 3, 세로 3, 대각선 2)
  const completedBingoLines = React.useMemo(() => {
    const lines = [
      [1, 2, 3], [4, 5, 6], [7, 8, 9], // 가로
      [1, 4, 7], [2, 5, 8], [3, 6, 9], // 세로
      [1, 5, 9], [3, 5, 7],             // 대각선
    ];
    return lines.filter((line) => line.every((id) => currentChecked.includes(id))).length;
  }, [currentChecked]);

  // 개별 칸 토글 함수
  const toggleBingoCell = (id: number) => {
    setUserBingoData((prev) => {
      const userList = prev[selectedBingoUser] || [5];
      const nextList = userList.includes(id)
        ? userList.filter((x) => x !== id)
        : [...userList, id];
      return { ...prev, [selectedBingoUser]: nextList };
    });
  };

  // 현재 선택된 멤버의 빙고판 초기화
  const resetCurrentBingo = () => {
    setUserBingoData((prev) => ({
      ...prev,
      [selectedBingoUser]: [5],
    }));
  };
  
  // 키워드 자판기 작동 함수
  const runVendingMachine = () => {
    if (vendingStatus === "spinning" || vendingStatus === "inserting") return;

    // 1. 전체 키워드 풀 확보
    const allUniqueTags = tagCounts.map(([tag]) => tag);
    if (allUniqueTags.length < 3) {
      alert("등록된 #키워드가 최소 3개 이상이어야 자판기를 가동할 수 있습니다!");
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
        const matchedBooks = reviews.filter((r) =>
          r.review && pickedTags.some((tag) => r.review.includes(tag))
        );

        if (matchedBooks.length > 0) {
          const randomMatched = matchedBooks[Math.floor(Math.random() * matchedBooks.length)];
          setVendingBook(randomMatched);
        } else {
          // 일치하는 작품이 없다면 전체 중 1권 무작위 매칭
          const randomFallback = reviews[Math.floor(Math.random() * reviews.length)];
          setVendingBook(randomFallback || null);
        }

        setVendingStatus("result");
      }, 1500);
    }, 600);
  };

  // 태그보드에서 선택된 태그 필터 (null이면 전체/태그목록 보기)
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 모든 리뷰의 한줄평에서 #태그 추출 및 빈도 계산
  const tagCounts = React.useMemo(() => {
    const counts: { [tag: string]: number } = {};
    reviews.forEach((r) => {
      if (!r.review) return;
      // #뒤에 공백이나 특수문자가 오기 전까지의 단어 추출
      const matched = r.review.match(/#[^\s#]+/g);
      if (matched) {
        // 한 리뷰 내 중복 태그 제거 후 카운트
        Array.from(new Set(matched)).forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    // 많이 언급된 순서대로 정렬
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [reviews]);

  // 선택된 태그가 포함된 리뷰 목록
  const taggedReviews = React.useMemo(() => {
    if (!selectedTag) return [];
    return reviews.filter((r) => r.review && r.review.includes(selectedTag));
  }, [reviews, selectedTag]);

  // 장르별 소비 비율 및 편식 진단 계산 (전체/개인별 필터링 적용)
  const genreStats = React.useMemo(() => {
    const targetReviews =
      genreUser === "전체"
        ? reviews
        : reviews.filter((r) => r.user_name === genreUser);

    const total = targetReviews.length;
    if (total === 0) return { total: 0, items: [], dominant: null, conicStyle: "" };

    const counts: { [genre: string]: number } = {};
    targetReviews.forEach((r) => {
      const g = r.genre || "기타";
      counts[g] = (counts[g] || 0) + 1;
    });

    const palette: { [genre: string]: string } = {
      소설: "#2563eb",
      웹툰: "#16a34a",
      만화: "#ea580c",
      오디오드라마: "#9333ea",
      기타: "#6b7280",
    };

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const items = sorted.map(([genre, count]) => {
      const percent = Math.round((count / total) * 100);
      return {
        genre,
        count,
        percent,
        color: palette[genre] || "#0284c7",
      };
    });

    let accumulated = 0;
    const gradientStops = items.map((item) => {
      const start = accumulated;
      accumulated += item.percent;
      return `${item.color} ${start}% ${accumulated}%`;
    });

    return {
      total,
      items,
      dominant: items[0],
      conicStyle: `conic-gradient(${gradientStops.join(", ")})`,
    };
  }, [reviews, genreUser]);

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

  // 1. 현재 접속 중인 모임명이나 파라미터를 브라우저(앱)에 실시간 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 주소창의 쿼리스트링(?group=... 등)을 통째로 저장
      if (window.location.search) {
        localStorage.setItem("last_bookclub_search", window.location.search);
      }
    }
  }, [groupName]);

  // 2. 앱 다운로드 후 깡통 주소('/')로 열렸을 때, 마지막 모임 주소로 자동 복원
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedQuery = localStorage.getItem("last_bookclub_search");
      // 현재 주소창에 파라미터가 없고, 이전에 저장된 모임 주소가 있다면 즉시 이동
      if (!window.location.search && savedQuery) {
        window.location.replace(`/${savedQuery}`);
      }
    }
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
          created_at: new Date().toISOString(),
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
        onclone: (clonedDoc) => {
          const element = clonedDoc.querySelector("[data-receipt-box]") as HTMLElement;
          if (element) {
            element.style.maxHeight = "none";
            element.style.height = "auto";
            element.style.overflow = "visible";
          }
          const listScroll = clonedDoc.querySelector("[data-receipt-list]") as HTMLElement;
          if (listScroll) {
            listScroll.style.maxHeight = "none";
            listScroll.style.height = "auto";
            listScroll.style.overflow = "visible";
          }

          const allTexts = clonedDoc.querySelectorAll("*");
          allTexts.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.letterSpacing = "0px";
            htmlEl.style.fontFamily = "Apple SD Gothic Neo, Malgun Gothic, 맑은 고딕, sans-serif";
          });
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
    setOpenWindow(appId);
  };

  return (
    <main className="relative flex flex-col h-[100dvh] w-full bg-[#008080] font-sans select-none overflow-hidden">

      {/* 바탕화면 메인 스크롤 영역 */}
      <div
        className="flex-1 overflow-y-auto p-3 pb-16 space-y-4"
        onClick={() => setStartMenuOpen(false)}
      >
        {/* 20대 기능 아이콘 모바일 4열 / PC 5열 그리드 */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 pt-4 sm:pt-6 max-w-4xl mx-auto">
          {APP_LIST.map((app) => (
            <button
              key={app.id}
              onClick={(e) => {
                e.stopPropagation();
                handleAppClick(app.id);
              }}
              className="flex flex-col items-center justify-center p-1 sm:p-2 rounded hover:bg-[#000080]/30 active:bg-[#000080]/50 transition-colors group"
            >
              <div className="relative w-8 h-8 sm:w-11 sm:h-11 mb-1 drop-shadow">
                <Image
                  src={app.icon}
                  alt={app.name}
                  fill
                  sizes="44px"
                  className="object-contain"
                />
              </div>
              <span className="text-white text-[10px] sm:text-xs px-1 text-center font-bold tracking-tight bg-[#008080] group-hover:bg-[#000080] rounded line-clamp-1 w-full break-keep">
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
           {/* 📟 실시간 속보 LED 전광판 (서재 창 내부 도킹) */}
          <div className="mt-2 bg-black border-2 border-gray-600 rounded px-2.5 py-1.5 flex items-center gap-2 win-inset overflow-hidden shrink-0">
            {/* 좌측 레트로 속보 뱃지 */}
            <div className="flex items-center gap-1 bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded shrink-0 tracking-wider animate-pulse select-none">
              <span>●</span>
              <span>속보</span>
            </div>

            {/* 우측 전광판 롤링 텍스트 (marquee 사용) */}
            <div className="flex-1 overflow-hidden min-w-0">
              <marquee
                behavior="scroll"
                direction="left"
                scrollamount="4"
                className="text-xs font-mono font-bold text-yellow-300 tracking-wide block"
                onMouseOver={(e) => (e.currentTarget as any).stop()}
                onMouseOut={(e) => (e.currentTarget as any).start()}
              >
                {tickerText}
              </marquee>
            </div>
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
      {openWindow && !["book-add", "stats", "goals", "gossip", "graveyard", "tags", "genre", "vending", "curation", "versus", "awards", "sales", "pacemaker"].includes(openWindow) && (
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

      {/* 🪦 단두대 / 하차 묘지 (GRAVEYARD.exe) */}
      {openWindow === "graveyard" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-gray-800 to-gray-600 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>🪦</span>
                <span>GRAVEYARD.exe - 중도하차 묘지 아카이브</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 본문 안내 */}
            <div className="p-3 bg-gray-100 border-b border-gray-300 text-xs text-gray-700 flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">⚰️ 영면한 작품들의 안식처</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  취향에 맞지 않아 중도에 멈춘 작품과 모임원들의 마지막 한마디를 보관합니다.
                </p>
              </div>
              <span className="bg-gray-800 text-white px-2 py-1 rounded text-[11px] font-mono">
                총 {reviews.filter((r) => r.rating === "중도하차").length}작품 안치됨
              </span>
            </div>

            {/* 묘비 그리드 목록 */}
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#2a2a2a]">
              {reviews.filter((r) => r.rating === "중도하차").length === 0 ? (
                <div className="col-span-full py-16 text-center text-gray-400 font-mono text-xs">
                  안치된 작품이 없습니다. (모든 작품 완독 중!)
                </div>
              ) : (
                reviews
                  .filter((r) => r.rating === "중도하차")
                  .map((book) => (
                    <div
                      key={book.id}
                      className="bg-[#3a3a3a] border-2 border-t-gray-500 border-l-gray-500 border-b-black border-r-black p-3 text-gray-200 rounded-t-xl relative flex flex-col justify-between shadow-lg"
                    >
                      {/* 묘비 상단 곡선 장식 */}
                      <div className="text-center pb-2 border-b border-gray-600">
                        <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                          R. I. P.
                        </div>
                        <div className="font-bold text-sm text-amber-200 break-keep mt-0.5">
                          {book.title}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {book.author || "미상"} · {book.genre}
                        </div>
                      </div>

                      {/* 묘비명 (하차 사유) */}
                      <div className="my-3 bg-[#1e1e1e] p-2.5 rounded border border-gray-700 text-xs italic text-gray-300 break-keep leading-relaxed min-h-[48px] flex items-center">
                        "{book.review ? book.review.replace("(스포일러)", "") : "말없이 덮었습니다..."}"
                      </div>

                      {/* 하차자 및 기록일 */}
                      <div className="flex justify-between items-center text-xs text-gray-300 pt-2 border-t border-gray-700 font-mono">
                        <span>하차자: <strong className="text-white font-bold ml-1">{book.user_name}</strong></span>
                        <span className="text-[11px] text-gray-400">{book.created_at?.split("T")[0] || ""}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏷️ #키워드보드 (KEYWORDS.exe) */}
      {openWindow === "tags" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-teal-900 to-teal-700 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>🏷️</span>
                <span>KEYWORDS.exe - 작품 키워드 모음</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenWindow(null);
                  setSelectedTag(null);
                }}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 상단 툴바 / 뒤로가기 네비게이션 */}
            <div className="p-2.5 bg-gray-100 border-b border-gray-300 text-xs flex justify-between items-center">
              <div>
                {selectedTag ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTag(null)}
                      className="win-btn px-2 py-0.5 text-xs font-bold"
                    >
                      ← 전체 키워드로 돌아가기
                    </button>
                    <span className="font-bold text-teal-800">
                      선택된 키워드: {selectedTag} ({taggedReviews.length}편)
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-gray-900">🔖 한줄평 자동 추출 키워드</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      리뷰에 남긴 #키워드를 클릭하면 연관된 작품들만 모아볼 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
              <span className="bg-teal-800 text-white px-2 py-0.5 rounded text-[11px] font-mono shrink-0">
                총 {tagCounts.length}개 키워드
              </span>
            </div>

            {/* 본문 콘텐츠 */}
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              {/* 1. 특정 키워드 클릭 시: 해당 작품 목록 출력 */}
              {selectedTag ? (
                <div className="space-y-2">
                  {taggedReviews.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-xs">해당 키워드의 작품이 없습니다.</div>
                  ) : (
                    taggedReviews.map((book) => (
                      <div
                        key={book.id}
                        className="p-3 border border-gray-300 bg-gray-50 hover:bg-teal-50/40 rounded transition-colors"
                      >
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-bold text-sm text-gray-900">{book.title}</span>
                          <span className="text-xs text-amber-700 font-bold">{book.rating}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mb-2">
                          {book.author || "미상"} · {book.genre} · 작성자: <strong className="text-gray-700">{book.user_name}</strong>
                        </div>
                        <div className="text-xs bg-white p-2 rounded border border-dashed border-gray-300 text-gray-800 break-keep">
                          {book.review || "작성된 감상평이 없습니다."}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* 2. 기본 상태: 키워드 클라우드 */
                <div>
                  {tagCounts.length === 0 ? (
                    <div className="py-16 text-center text-gray-400 text-xs font-mono">
                      한줄평에 작성된 #키워드가 아직 없습니다.<br />
                      (예: #후회공, #구원서사, #재주행필수 등)
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center justify-center p-4">
                      {tagCounts.map(([tag, count]) => {
                        const fontSizeClass =
                          count >= 5 ? "text-base font-black text-teal-900" :
                          count >= 3 ? "text-sm font-bold text-teal-800" :
                          count >= 2 ? "text-xs font-bold text-teal-700" :
                          "text-xs font-medium text-gray-700";

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTag(tag)}
                            className={`win-btn px-2.5 py-1 flex items-center gap-1 active:scale-95 transition-transform ${fontSizeClass}`}
                          >
                            <span>{tag}</span>
                            <span className="text-[10px] bg-teal-100 text-teal-800 px-1 rounded-full font-mono">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpenWindow(null);
                  setSelectedTag(null);
                }}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 장르 분석 / 편식 진단기 (GENRE_DIAG.exe) */}
      {openWindow === "genre" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-lg bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-blue-900 to-indigo-700 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>📊</span>
                <span>GENRE_DIAG.exe - 장르 분석</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 본문 안내 & 개인별 필터 셀렉트바 */}
            <div className="p-2.5 bg-gray-100 border-b border-gray-300 text-xs flex flex-wrap gap-2 justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">🧬 덕질 영양소 & 편식 분석</p>
                <p className="text-[11px] text-gray-500">
                  {genreUser === "전체" ? "모임 전체" : `${genreUser} 님`}의 장르 소비 밸런스입니다.
                </p>
              </div>

              {/* 대상 선택 셀렉트 박스 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-700">분석 대상:</span>
                <select
                  value={genreUser}
                  onChange={(e) => setGenreUser(e.target.value)}
                  className="win-inset bg-white text-xs px-2 py-0.5 font-bold outline-none cursor-pointer"
                >
                  <option value="전체">전체 모임원</option>
                  {Array.from(new Set(reviews.map((r) => r.user_name))).filter(Boolean).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <span className="bg-blue-900 text-white px-2 py-0.5 rounded text-[11px] font-mono">
                  {genreStats.total}편
                </span>
              </div>
            </div>

            {/* 본문 차트 및 진단 */}
            <div className="p-4 overflow-y-auto flex-1 bg-white space-y-4">
              {genreStats.total === 0 ? (
                <div className="py-16 text-center text-gray-400 text-xs font-mono">
                  분석할 감상 기록이 없습니다.
                </div>
              ) : (
                <>
                  {/* 진단 결과 카드 */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                    <p className="font-bold text-blue-900 mb-1">
                      🩺 진단 소견:
                      {genreStats.dominant && genreStats.dominant.percent >= 60 ? (
                        <span className="text-red-600 ml-1">심각한 '{genreStats.dominant.genre}' 편식 상태!</span>
                      ) : genreStats.dominant && genreStats.dominant.percent >= 40 ? (
                        <span className="text-amber-700 ml-1">안정적인 '{genreStats.dominant.genre}' 중심 성향</span>
                      ) : (
                        <span className="text-emerald-700 ml-1">골고루 즐기는 잡식형 독서가</span>
                      )}
                    </p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      {genreUser === "전체" ? "모임에서" : `${genreUser} 님이`} 가장 애호하는 장르는{" "}
                      <strong>{genreStats.dominant?.genre}</strong>({genreStats.dominant?.percent}%)이며, 총{" "}
                      {genreStats.items.length}개의 장르를 즐기고 있습니다.
                    </p>
                  </div>

                  {/* CSS 도넛 차트 영역 */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                    <div
                      className="w-32 h-32 rounded-full relative flex items-center justify-center shadow-inner border border-gray-300"
                      style={{ background: genreStats.conicStyle }}
                    >
                      <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center shadow">
                        <span className="text-[10px] text-gray-400 font-bold">TOTAL</span>
                        <span className="text-xs font-black text-gray-800">{genreStats.total}</span>
                      </div>
                    </div>

                    {/* 범례 리스트 */}
                    <div className="space-y-1.5 text-xs w-full sm:w-auto">
                      {genreStats.items.map((item) => (
                        <div key={item.genre} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm inline-block shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-gray-700 w-24 truncate">{item.genre}</span>
                          <span className="font-bold text-gray-900">{item.count}편</span>
                          <span className="text-gray-400 font-mono text-[11px]">({item.percent}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 장르별 비율 프로그레스 바 목록 */}
                  <div className="space-y-2.5 pt-2 border-t border-gray-200 text-xs">
                    <div className="font-bold text-gray-700 mb-1">상세 점유율</div>
                    {genreStats.items.map((item) => (
                      <div key={item.genre} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-gray-800">{item.genre}</span>
                          <span className="font-mono text-gray-500">
                            {item.count}편 / {item.percent}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 border border-gray-400 h-3 rounded-none overflow-hidden p-[1px]">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${item.percent}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎰 키워드 캡슐 자판기 (VENDING.exe) */}
      {openWindow === "vending" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-md bg-[#c0c0c0] p-1 flex flex-col shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-amber-800 to-amber-600 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>🎰</span>
                <span>VENDING.exe - 키워드 캡슐 자판기</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpenWindow(null);
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
                    <span className="text-2xl animate-spin inline-block">🟡</span>
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
                      {vendingTags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-yellow-400 text-black px-2 py-1 rounded text-xs font-black shadow"
                        >
                          {tag}
                        </span>
                      ))}
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
                      <span className="text-xs text-amber-700 font-bold">{vendingBook.rating}</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-900 truncate">{vendingBook.title}</h4>
                    <p className="text-[11px] text-gray-500 mb-1.5">
                      {vendingBook.author || "미상"} · 추천자: {vendingBook.user_name}
                    </p>
                    <p className="text-xs bg-amber-50 p-1.5 rounded text-gray-700 line-clamp-2 italic">
                      "{vendingBook.review || "키워드와 함께 즐겨보세요!"}"
                    </p>
                  </div>
                )}

                {/* 동전 투입 / 레버 조작 버튼 */}
                <div className="flex w-full justify-end items-center pt-1">
                  <button
                    type="button"
                    onClick={runVendingMachine}
                    disabled={vendingStatus === "spinning" || vendingStatus === "inserting"}
                    className="win-btn px-4 py-2 font-bold text-xs bg-[#c0c0c0] active:translate-y-0.5 flex items-center gap-1.5 shadow"
                  >
                    <span>{vendingStatus === "result" ? "🔄 다시 뽑기" : "🪙 동전 넣고 돌리기"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 하단 창 닫기 버튼 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpenWindow(null);
                  setVendingStatus("idle");
                }}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💖 취향 도플갱어 매칭기 (SOULMATE.exe) */}
      {openWindow === "curation" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-md bg-[#c0c0c0] p-1 flex flex-col shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-pink-900 to-rose-700 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>💘</span>
                <span>SOULMATE.exe - 취향 도플갱어 탐색기</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 본문 제어 패널 */}
            <div className="p-3 bg-gray-100 border-b border-gray-300 text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">🧬 5점 만점 싱크로율 분석</p>
                <p className="text-[11px] text-gray-500">인생작이 겹치는 영혼의 메이트를 찾습니다.</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-gray-600">기준:</span>
                <select
                  value={mateTargetUser || (soulmateData?.currentUser ?? "")}
                  onChange={(e) => setMateTargetUser(e.target.value)}
                  className="win-inset bg-white text-xs px-2 py-0.5 font-bold outline-none cursor-pointer"
                >
                  {soulmateData?.allUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 분석 본문 영역 */}
            <div className="p-4 bg-white flex flex-col items-center gap-4 text-xs">
              {!soulmateData || soulmateData.allUsers.length < 2 ? (
                <div className="py-12 text-center text-gray-400 font-mono">
                  모임원이 2명 이상 등록되어야 매칭할 수 있습니다.
                </div>
              ) : (
                <>
                  {/* 매칭 결과 카드 */}
                  <div className="w-full bg-rose-50 border-2 border-rose-300 p-4 rounded-lg flex flex-col items-center text-center shadow-inner">
                    <span className="text-[11px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-full mb-2">
                      취향 일치도 {soulmateData.matchRate}%
                    </span>

                    <div className="flex items-center justify-center gap-3 my-1">
                      <span className="text-base font-black text-gray-900 bg-white px-3 py-1 rounded border shadow-sm">
                        {soulmateData.currentUser}
                      </span>
                      <span className="text-xl animate-pulse">💞</span>
                      <span className="text-base font-black text-rose-700 bg-white px-3 py-1 rounded border border-rose-300 shadow-sm">
                        {soulmateData.bestMate}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 mt-2 font-medium">
                      <strong>{soulmateData.currentUser}</strong> 님의 최애 인생작을 가장 많이 공유한 메이트는{" "}
                      <strong className="text-rose-700">{soulmateData.bestMate}</strong> 님입니다!
                    </p>
                  </div>

                  {/* 함께 5점을 준 작품 리스트 */}
                  <div className="w-full bg-gray-50 border border-gray-300 p-3 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800">
                        ✨ 함께 5점(★★★★★)을 준 인생작
                      </span>
                      <span className="text-[11px] font-mono text-rose-600 font-bold">
                        {soulmateData.matchCount}편
                      </span>
                    </div>

                    {soulmateData.commonWorks.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-3 text-center">
                        아직 완벽하게 겹치는 5점 만점 작품이 없습니다.<br />
                        (서로 다른 취향의 보완재 관계일 수도 있어요!)
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {soulmateData.commonWorks.map((work) => (
                          <span
                            key={work}
                            className="bg-white border border-rose-300 text-rose-900 px-2 py-1 rounded text-xs font-semibold shadow-sm"
                          >
                            📖 {work}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚔️ 희대의 논쟁작 배틀 (BATTLE.exe) */}
      {openWindow === "versus" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[88vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-red-800 via-purple-900 to-blue-900 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>⚔️</span>
                <span>BATTLE.exe - 희대의 호불호 논쟁작 매치</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 헤더 안내 */}
            <div className="p-2.5 bg-gray-100 border-b border-gray-300 text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-gray-900">🥊 극과 극 취향 대격돌 존</p>
                <p className="text-[11px] text-gray-500">모임원 간 평점 편차가 가장 큰 뜨거운 감자를 소환했습니다.</p>
              </div>
              {battleData && (
                <span className="bg-red-800 text-white px-2 py-0.5 rounded text-[11px] font-mono font-bold animate-pulse">
                  HOT TOPIC
                </span>
              )}
            </div>

            {/* 배틀 본문 */}
            <div className="p-3 bg-white flex-1 overflow-y-auto space-y-3">
              {!battleData ? (
                <div className="py-16 text-center text-gray-400 font-mono text-xs">
                  현재 2명 이상 평가가 엇갈린 논쟁작이 없습니다.<br />
                  (다양한 작품에 호불호 리뷰가 쌓이면 배틀이 열립니다!)
                </div>
              ) : (
                <>
                  {/* 중앙 매치 타이틀 보드 */}
                  <div className="bg-[#1a1a2e] text-white p-3 rounded win-outset text-center relative overflow-hidden">
                    <div className="text-[10px] text-yellow-400 font-mono tracking-widest uppercase">
                      ★ THIS WEEK'S CONTROVERSY ★
                    </div>
                    <h3 className="text-base font-black text-white mt-0.5">
                      {battleData.title}
                    </h3>
                    <div className="text-[11px] text-gray-300 mt-0.5">
                      {battleData.author || "미상"} · {battleData.genre} | 평균 ★ {battleData.avgScore}
                    </div>

                    <div className="mt-2 inline-flex items-center gap-3 bg-black/40 px-3 py-1 rounded-full text-xs font-bold border border-gray-700">
                      <span className="text-rose-400">극호 진영 {battleData.proReviews.length}명</span>
                      <span className="text-yellow-400 font-black">VS</span>
                      <span className="text-sky-400">불호 진영 {battleData.conReviews.length}명</span>
                    </div>
                  </div>

                  {/* 1:1 진영 코멘트 대결 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* 🔴 찬성(극호) 진영 */}
                    <div className="bg-rose-50 border-2 border-rose-300 p-2.5 rounded flex flex-col shadow-sm">
                      <div className="flex justify-between items-center pb-1.5 border-b border-rose-200 mb-2 font-bold text-rose-800">
                        <span>🔥 극호 진영 (인생작/찬양)</span>
                        <span className="text-[11px] font-mono">{battleData.proReviews.length}건</span>
                      </div>
                      
                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                        {battleData.proReviews.length === 0 ? (
                          <p className="text-[11px] text-gray-400 py-4 text-center">찬양파가 침묵 중입니다.</p>
                        ) : (
                          battleData.proReviews.map((r) => (
                            <div key={r.id} className="bg-white p-2 rounded border border-rose-200 shadow-xs">
                              <div className="flex justify-between text-[11px] mb-1 font-bold">
                                <span className="text-rose-900">{r.user_name}</span>
                                <span className="text-amber-600">{r.rating}</span>
                              </div>
                              <p className="text-gray-800 text-[11px] leading-snug break-keep">
                                "{r.review ? r.review.replace("(스포일러)", "") : "말이 필요 없는 명작"}"
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 🔵 반대(불호) 진영 */}
                    <div className="bg-sky-50 border-2 border-sky-300 p-2.5 rounded flex flex-col shadow-sm">
                      <div className="flex justify-between items-center pb-1.5 border-b border-sky-200 mb-2 font-bold text-sky-800">
                        <span>❄️ 불호 진영 (하차/의문)</span>
                        <span className="text-[11px] font-mono">{battleData.conReviews.length}건</span>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                        {battleData.conReviews.length === 0 ? (
                          <p className="text-[11px] text-gray-400 py-4 text-center">불호파가 침묵 중입니다.</p>
                        ) : (
                          battleData.conReviews.map((r) => (
                            <div key={r.id} className="bg-white p-2 rounded border border-sky-200 shadow-xs">
                              <div className="flex justify-between text-[11px] mb-1 font-bold">
                                <span className="text-sky-900">{r.user_name}</span>
                                <span className="text-gray-600">{r.rating}</span>
                              </div>
                              <p className="text-gray-800 text-[11px] leading-snug break-keep">
                                "{r.review ? r.review.replace("(스포일러)", "") : "저와는 맞지 않았습니다..."}"
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 기존 1:1 대결 그리드 바로 아래에 추가 */}
                  {battleData.neutralReviews.length > 0 && (
                    <div className="bg-gray-100 border border-gray-300 p-2.5 rounded text-xs shadow-xs">
                      <div className="flex justify-between items-center mb-1.5 font-bold text-gray-700">
                        <span>⚖️ 팝콘 뜯는 중립 지대 (3.0~3.5점 무난/평타)</span>
                        <span className="text-[11px] font-mono text-gray-500">
                          {battleData.neutralReviews.length}명
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {battleData.neutralReviews.map((r) => (
                          <div key={r.id} className="bg-white p-2 rounded border border-gray-200 flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <span className="font-bold text-gray-800 text-[11px] mr-1.5">{r.user_name}</span>
                              <span className="text-gray-700 text-[11px]">
                                "{r.review ? r.review.replace("(스포일러)", "") : "무난하게 읽었습니다."}"
                              </span>
                            </div>
                            <span className="text-gray-500 font-bold text-[11px] shrink-0">{r.rating}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 하단 전체 평가자 리스트 */}
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600">
                    <span className="font-bold text-gray-800 mr-2">📌 전체 참여자 별점:</span>
                    {battleData.reviews.map((r) => (
                      <span key={r.id} className="inline-block mr-2">
                        {r.user_name}({r.rating})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏆 명예의 전당 / 레트로 어워즈 (AWARDS.exe) */}
      {openWindow === "awards" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[88vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-900 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span>🏆</span>
                <span>AWARDS.exe - 정기 결산 명예의 전당</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0.5 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 헤더 안내문 */}
            <div className="p-2.5 bg-yellow-50 border-b border-yellow-200 text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-amber-950">📜 {groupName} 정기 명예 결산</p>
                <p className="text-[11px] text-amber-800">모임원들의 감상 기록을 자동 통계 처리하여 레트로 상장을 수여합니다.</p>
              </div>
              <span className="bg-amber-700 text-white px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                CLASS OF 98
              </span>
            </div>

            {/* 본문 상장 그리드 */}
            <div className="p-3 bg-white flex-1 overflow-y-auto">
              {!awardsData ? (
                <div className="py-16 text-center text-gray-400 font-mono text-xs">
                  아직 수여할 감상 기록이 충분하지 않습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {awardsData.map((award) => (
                    <div
                      key={award.id}
                      className={`p-3 rounded border-2 ${award.color} relative flex flex-col justify-between shadow-xs win-outset`}
                    >
                      {/* 상장 헤더 */}
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                            CERTIFICATE
                          </span>
                          <span className="text-xl">{award.icon}</span>
                        </div>
                        <h4 className="font-black text-sm text-gray-900 tracking-tight">
                          {award.title}
                        </h4>
                        <div className="my-2 bg-white/80 p-2 rounded border border-dashed border-gray-300">
                          <div className="text-[11px] text-gray-600">수여자:</div>
                          <div className="text-base font-extrabold text-[#000080]">
                            {award.user} 님
                          </div>
                          <div className="text-[11px] font-mono font-bold text-amber-700 mt-0.5">
                            기록: {award.score}
                          </div>
                        </div>
                      </div>

                      {/* 상장 본문 사유 */}
                      <div>
                        <p className="text-[11px] text-gray-700 leading-relaxed break-keep border-t border-gray-200 pt-1.5 italic">
                          "{award.desc}"
                        </p>
                        <div className="mt-2 flex justify-between items-center text-xs text-gray-700 font-mono font-semibold">
                          <span>{groupName} 북클럽</span>
                          <span className="text-red-700 font-bold border border-red-700 px-1 py-0.5 rounded text-[11px] bg-red-50">직인생략 [인]</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-4 py-1 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📢 강제 영업소 (SALES.exe) */}
      {openWindow === "sales" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-xl bg-[#c0c0c0] p-1 flex flex-col max-h-[90vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1.5 bg-gradient-to-r from-orange-800 via-amber-700 to-yellow-800 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span className="text-base">📢</span>
                <span className="text-xs">SALES.exe - 긴급 편성! 강제 영업 확성기</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-2 py-0.5 text-black font-extrabold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 헤더 알림판 */}
            <div className="p-3 bg-amber-100 border-b border-amber-300 text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-sm text-amber-950 flex items-center gap-1">
                  <span>🚨</span> 이건 제발 무조건 봐라!
                </p>
                <p className="text-xs text-amber-900 mt-0.5 font-medium">
                  모임원들이 별점 5점과 영혼을 갈아 넣은 찐 인생작 찌라시입니다.
                </p>
              </div>
              <span className="bg-orange-700 text-white px-2.5 py-1 rounded text-xs font-mono font-bold shrink-0">
                영업작 {salesReviews.length}건 보관
              </span>
            </div>

            {/* 본문: 레트로 엽서/전단지 디자인 */}
            <div className="p-4 bg-gray-200 flex-1 overflow-y-auto flex flex-col items-center justify-center">
              {salesReviews.length === 0 ? (
                <div className="bg-white p-8 win-inset text-center text-xs text-gray-600 w-full space-y-2">
                  <p className="text-2xl">📭</p>
                  <p className="font-bold text-sm text-gray-800">아직 접수된 강제 영업작이 없습니다.</p>
                  <p className="text-xs text-gray-500">
                    인생작(👑)을 체크하거나 5점(★★★★★) 만점 리뷰를 남겨 첫 영업을 시작해보세요!
                  </p>
                </div>
              ) : (
                (() => {
                  const currentSale = salesReviews[salesIndex % salesReviews.length];
                  return (
                    <div className="w-full bg-[#fffef0] border-4 border-dashed border-orange-500 p-5 rounded-lg shadow-xl relative flex flex-col justify-between min-h-[360px] win-outset">
                      {/* 엽서 상단 스탬프 & 번호 */}
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b-2 border-orange-200">
                          <span className="bg-orange-600 text-white text-xs font-black px-2 py-0.5 rounded tracking-wide">
                            🔥 필 독 권 고
                          </span>
                          <span className="font-mono text-xs font-bold text-gray-600">
                            엽서 {((salesIndex % salesReviews.length) + 1)} / {salesReviews.length}
                          </span>
                        </div>

                        {/* 도서 타이틀 및 영업자 정보 */}
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-gray-800 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                              {currentSale.genre}
                            </span>
                            <span className="text-amber-600 text-sm font-black">
                              {currentSale.rating}
                            </span>
                            {currentSale.is_favorite && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-1 rounded">
                                👑 인생작
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-black text-gray-950 break-keep leading-tight">
                            {currentSale.title}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {currentSale.author ? `${currentSale.author} 저` : "작가 미상"} | 영업 사원:{" "}
                            <strong className="text-orange-900 font-bold text-sm">{currentSale.user_name}</strong>
                          </p>
                        </div>

                        {/* 영업 한줄평 엽서 본문 */}
                        <div className="mt-3 bg-white p-3.5 rounded border border-orange-300 win-inset">
                          <div className="text-xs font-bold text-orange-800 mb-1">
                            💬 영업 사원의 절규:
                          </div>
                          <p className="text-sm font-medium text-gray-900 leading-relaxed break-keep">
                            "{currentSale.review.replace("(스포일러)", "")}"
                          </p>
                        </div>
                      </div>

                      {/* 엽서 하단 컨트롤 버튼 */}
                      <div className="mt-4 pt-3 border-t-2 border-dashed border-orange-200 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSalesIndex((prev) => (prev > 0 ? prev - 1 : salesReviews.length - 1))
                          }
                          className="win-btn px-3 py-1.5 font-bold text-xs flex items-center gap-1 active:scale-95"
                        >
                          ◀ 이전 영업작
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesIndex((prev) => prev + 1)}
                          className="win-btn px-4 py-1.5 font-black text-xs text-orange-950 bg-amber-200 flex items-center gap-1 active:scale-95"
                        >
                          다음 영업작 뽑기 📢
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2.5 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-5 py-1.5 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏃 페이스메이커 (PACEMAKER.exe) */}
      {openWindow === "pacemaker" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[90vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="win-title flex justify-between items-center px-2 py-1.5 bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-900 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span className="text-base">🏎️</span>
                <span className="text-xs">PACEMAKER.exe - 실시간 독서 레이싱 경기장</span>
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-2 py-0.5 text-black font-extrabold text-xs"
              >
                ✕
              </button>
            </div>

            {/* 헤더 알림판 */}
            <div className="p-3 bg-teal-50 border-b border-teal-200 text-xs flex justify-between items-center">
              <div>
                <p className="font-bold text-sm text-teal-950 flex items-center gap-1">
                  <span>🏁</span> 모임원 독서 주행 페이스
                </p>
                <p className="text-xs text-teal-800 mt-0.5 font-medium">
                  최근 2주간의 완독 속도와 활동량으로 달리는 실시간 서킷입니다.
                </p>
              </div>
              <span className="bg-teal-800 text-white px-2.5 py-1 rounded text-xs font-mono font-bold shrink-0">
                러너 {paceData.length}명 주행 중
              </span>
            </div>

            {/* 본문 레이싱 트랙 & 러너 카드 */}
            <div className="p-4 bg-gray-100 flex-1 overflow-y-auto space-y-4">
              {paceData.length === 0 ? (
                <div className="bg-white p-8 win-inset text-center text-xs text-gray-600">
                  등록된 완독 기록이 없어 서킷이 대기 중입니다.
                </div>
              ) : (
                <>
                  {/* 🎮 레트로 도트 레이싱 트랙 영역 */}
                  <div className="bg-[#242b35] border-2 border-gray-600 rounded p-3 win-inset space-y-2.5 shadow-inner">
                    <div className="flex justify-between items-center text-xs text-gray-400 font-mono pb-1 border-b border-gray-700">
                      <span>[START LINE]</span>
                      <span className="text-yellow-400 font-bold">★ CIRCUIT PACEMAKER ★</span>
                      <span>[GOAL 🏁]</span>
                    </div>
                                      
                    {paceData.map((runner, idx) => (
                      <div key={runner.name} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-300 font-mono">
                          <span className="font-bold text-white">
                            #{idx + 1} {runner.name}
                          </span>
                          <span className="text-cyan-400 font-bold">
                            {runner.speed} km/h ({runner.recentCount}권/최근 2주)
                          </span>
                        </div>

                        {/* 트랙 아스팔트 레인 */}
                        <div className="w-full bg-[#161a22] h-7 rounded border border-gray-700 relative flex items-center px-1">
                          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none opacity-20">
                            <span className="text-white text-xs">|</span>
                            <span className="text-white text-xs">|</span>
                            <span className="text-white text-xs">|</span>
                            <span className="text-white text-xs">|</span>
                          </div>

                          {/* 달리는 러너 아이콘 (-scale-x-100 추가로 오른쪽 방향 주행) */}
                          <div
                            className="absolute transition-all duration-700 flex items-center"
                            style={{ left: `${runner.trackProgress}%` }}
                          >
                            <span className="text-lg drop-shadow transform -scale-x-100 inline-block">
                              {idx === 0 ? "🏎️" : idx === 1 ? "🚗" : "🚙"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 📋 개별 주행 리포트 카드 그리드 */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-700">📌 러너별 상세 진단서</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {paceData.map((runner) => (
                        <div
                          key={runner.name}
                          className="bg-white p-3 rounded border border-gray-300 win-outset flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-extrabold text-sm text-gray-900">
                                {runner.name} 님
                              </span>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded border ${runner.statusColor}`}
                              >
                                {runner.status}
                              </span>
                            </div>

                            <div className="text-xs text-gray-600 space-y-0.5 font-medium">
                              <div>총 완독 누적: <strong className="text-gray-900">{runner.totalCount}권</strong></div>
                              <div>최근 14일 질주: <strong className="text-teal-900">{runner.recentCount}권</strong></div>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200">
                            <p className="text-xs text-gray-700 italic break-keep leading-relaxed">
                              "{runner.comment}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 하단 닫기 바 */}
            <div className="p-2.5 bg-[#c0c0c0] border-t border-white flex justify-end">
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-5 py-1.5 font-bold text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎲 덕질 빙고 모달 (BINGO.exe) */}
      {openWindow === "bingo" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-[#c0c0c0] win-outset p-1 w-full max-w-md shadow-2xl text-black">
            {/* 타이틀 바 */}
            <div className="bg-[#000080] text-white px-2 py-1 text-xs font-bold flex justify-between items-center select-none">
              <span className="flex items-center gap-1.5">
                <Image
                  src="/icons/bingo.png"
                  alt="bingo"
                  width={16}
                  height={16}
                  className="inline-block pixelated"
                  onError={(e) => ((e.target as any).style.display = "none")}
                />
                BINGO.exe - [{selectedBingoUser}] 님의 덕질 빙고판
              </span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn px-1.5 py-0 text-black font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#d4d8dc] space-y-3">
              {/* 👤 멤버 전환 탭 */}
              <div className="flex flex-wrap items-center gap-1 bg-[#c0c0c0] p-1.5 win-inset">
                <span className="text-xs font-bold text-gray-700 mr-1 select-none">멤버 선택:</span>
                {userList.filter((u) => u !== "전체").map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSelectedBingoUser(u)}
                    className={`px-2 py-0.5 text-xs win-btn font-bold ${
                      selectedBingoUser === u ? "win-inset bg-[#000080] text-white" : ""
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* 스코어 및 상태 표시 */}
              <div className="bg-white win-inset p-2 flex justify-between items-center">
                <div className="text-xs">
                  <span className="font-bold text-gray-800">{selectedBingoUser} 님의 달성: </span>
                  <span className="font-extrabold text-blue-700 text-sm">{completedBingoLines}줄</span> 완성
                </div>
                <div className="flex gap-1 items-center">
                  {completedBingoLines >= 3 ? (
                    <span className="bg-red-600 text-white font-bold text-xs px-2 py-0.5 animate-bounce rounded-xs">
                      🎉 BINGO 달성!
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">3줄 달성 시 빙고</span>
                  )}
                  <button
                    type="button"
                    onClick={resetCurrentBingo}
                    className="win-btn text-xs px-2 py-0.5 ml-1"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* 3x3 빙고 보드 */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#808080] p-1.5 win-inset">
                {BINGO_CELLS_DEFAULT.map((cell) => {
                  const isChecked = currentChecked.includes(cell.id);
                  const isFree = cell.id === 5;

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={() => toggleBingoCell(cell.id)}
                      className={`h-24 p-1.5 flex flex-col justify-between items-center text-center transition-all select-none relative ${
                        isChecked
                          ? "bg-[#e8f0fe] win-inset border-blue-500"
                          : "bg-[#c0c0c0] win-outset hover:bg-[#d0d0d0]"
                      }`}
                    >
                      {/* 스탬프 도장 */}
                      {isChecked && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-85">
                          <span className="border-2 border-red-600 text-red-600 font-black text-sm px-2 py-0.5 rounded-full transform -rotate-12 tracking-wider">
                            {isFree ? "PASS" : "CLEAR"}
                          </span>
                        </div>
                      )}

                      <span className={`text-xs font-bold leading-tight ${isFree ? "text-purple-800" : "text-gray-900"}`}>
                        {cell.title}
                      </span>
                      <span className="text-xs leading-3 text-gray-600 break-keep">
                        {cell.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 안내 가이드 */}
              <div className="text-xs text-gray-600 bg-[#e4e4e4] p-2 win-inset leading-relaxed">
                💡 상단 탭에서 멤버를 전환해 각자의 빙고 상태를 체크할 수 있습니다.
              </div>

              {/* 닫기 버튼 */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpenWindow(null)}
                  className="win-btn px-4 py-1 text-xs font-bold"
                >
                  닫기
                </button>
              </div>
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
              <div className="py-3 space-y-3 text-xs">
                {/* 작품 정보 헤더 */}
                <div className="font-bold border-b border-gray-400 pb-1 text-gray-700">
                  [작품 정보]
                </div>

                {/* 기본 정보 */}
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">제  목:</span>
                    <span className="font-bold break-keep text-gray-900">{receiptData.singleItem.title}</span>
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

                {/* 감상평 */}
                <div className="space-y-1">
                  <div className="font-bold text-gray-700">[감상평]</div>
                  <div className="bg-transparent p-2.5 rounded border border-dashed border-gray-300 text-gray-800 text-xs break-keep leading-relaxed">
                    "{receiptData.singleItem.review ? receiptData.singleItem.review.replace("(스포일러)", "") : "감상평 없음"}"
                  </div>
                </div>

                {/* 원래 상태 줄: 이모지 없이 깔끔한 텍스트 표기 */}
                <div className="pt-2 border-t border-dashed border-gray-400 flex justify-between items-center font-bold text-xs">
                  <span className="tracking-widest">상  태:</span>
                  <span className="text-gray-900">
                    {receiptData.singleItem.rating === "중도하차" ? "중도하차" : "감상 완료"}
                    {(receiptData.singleItem.is_favorite || receiptData.singleItem.is_revisit) && (
                      <span className="text-gray-700 font-normal ml-1">
                        (
                        {[
                          receiptData.singleItem.is_favorite ? "인생작" : null,
                          receiptData.singleItem.is_revisit ? "재주행" : null,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                        )
                      </span>
                    )}
                  </span>
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
                  {receiptData.items.length === 0 ? (
                    <div className="text-center text-gray-400 py-3">등록된 작품이 없습니다.</div>
                  ) : (
                    receiptData.items.map((item, idx) => (
                      <div key={item.id} className="flex justify-between items-baseline gap-1.5 border-b border-gray-100 pb-1 text-xs">
                        <div className="break-keep flex-1 leading-snug">
                          <span className="font-medium text-gray-900">
                            {idx + 1}. {item.title}
                            {item.is_favorite ? "👑" : ""}
                            {item.is_revisit ? "🔁" : ""}
                          </span>{" "}
                          <span className="text-[11px] text-gray-500">({item.genre})</span>
                        </div>
                        <span className="font-bold shrink-0 text-right whitespace-nowrap text-amber-700">{item.rating}</span>
                      </div>
                    ))
                  )}
                </div>

                {(() => {
                  const total = receiptData.items.length;
                  const dropped = receiptData.items.filter((i) => i.rating === "중도하차").length;
                  const completed = total - dropped;
                  const favoriteCount = receiptData.items.filter((i) => i.is_favorite).length;
                  const revisitCount = receiptData.items.filter((i) => i.is_revisit).length;
                  const userAvg = getAverageRating(receiptData.user) || "0.0";

                  return (
                    <div className="mt-3 pt-2 border-t-2 border-dashed border-gray-400 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">총 정산 작품수:</span>
                        <span className="font-bold">{total} 편</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">감상 완료:</span>
                        <span className="font-bold">{completed} 편</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">중도하차:</span>
                        <span className="font-bold text-red-600">{dropped} 편</span>
                      </div>
                      <div className="flex justify-between text-amber-900">
                        <span>👑 인생작 선정:</span>
                        <span className="font-bold">{favoriteCount} 편</span>
                      </div>
                      <div className="flex justify-between text-sky-900">
                        <span>🔁 재주행 작품:</span>
                        <span className="font-bold">{revisitCount} 편</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-200 font-bold text-xs">
                        <span>평균 평점:</span>
                        <span className="text-amber-800">★ {userAvg}</span>
                      </div>
                    </div>
                  );
                })()}
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

        {/* 우측 시스템 트레이 영역 (모임 뱃지 + 시계) */}
        <div className="flex items-center gap-1.5">
          <div className="win-inset bg-[#c0c0c0] px-2 py-0.5 flex items-center gap-1 text-[11px] font-bold text-gray-800 select-none max-w-[130px] truncate">
            <span>🖥️</span>
            <span className="truncate">{groupName}</span>
          </div>
          <div className="win-inset px-2 py-0.5 text-[11px] font-mono bg-[#c0c0c0] min-w-[65px] text-center">
            {time}
          </div>
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
