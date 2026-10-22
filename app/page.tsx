"use client";
import { useCareTimes } from "./pets/useCareTimes";
import { PetSprite, PET_COLOR_ORDER, type PetGeneration } from "./pets/PetSprite";
import { useSupabaseBingo } from "./bingo/useSupabaseBingo";
import { DuplicateReviewNotice } from "./reviews/DuplicateReviewNotice";
import { plainReview, reviewTags } from "./reviews/reviewMarkup";
import { StartMenuKeys } from "./desktop/StartMenuKeys";


import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { renderReviewText, SpoilerReviewText } from "./reviews/ReviewFormatting";
const ReviewEditor = dynamic(() => import("./reviews/ReviewEditor"), { loading: () => <div className="h-[66px] text-xs" role="status">한줄평 입력창을 준비하는 중…</div> });
const ReviewQuizWindow = dynamic(() => import("./games/ReviewQuiz"));
const VendingWindow = dynamic(() => import("./games/Vending"));
import AndroidGroupInstall from "./AndroidGroupInstall";
import { reuseRows } from "./data/reuseRows";
import { listKey, peekList, readList, clearGroupLists } from "./data/listCache";
import { useDraftClose } from "./ui/DraftClose";
import { useWindowEscape } from "./ui/windowEscape";
import { SaveNotice, savedNotice } from "./ui/SaveNotice";
import { buildReviewRelations, summarizeWorks, yearHighlights } from "./reviews/reviewRelations";
import { RelatedReviews, RelatedReviewsProvider } from "./reviews/RelatedReviews";
import { getJukeboxVideoId } from "./jukeboxVideo";
import { ReviewText, Highlight } from "./reviews/ReviewText";
import { ReviewCreatedDate } from "./reviews/ReviewCreatedDate";
import { useSearchParams } from "next/navigation";
import { secureClient as supabase } from "./security/client";
import AccessGate from "./security/AccessGate";
import { isRegisteredGroup } from "./security/groups";
import { StartMenuBand } from "./desktop/StartMenuBand";
import { usePetSnacks } from "./pets/snack";
import { useExplorerTitle } from "./explorerTitle";
import { usePetFarewells } from "./pets/farewell";
import { DesktopThemeWindow } from "./desktop/DesktopTheme";
import { usePetPersonalities } from "./pets/personality";
import { AwardsHub } from "./awards/Awards";
import { ObjectionCounts, ReviewObjections } from "./community/Objections";
import { ShelfBadge, useShelfPicks } from "./community/ShelfBadge";
import { SharedShelfHub } from "./community/SharedShelf";
import { systemSound } from "./desktop/sounds";
import { PetNameplate } from "./pets/Nameplate";
import { PetDiary, PetPopup } from "./pets/PetDiary";
import { useSecretNote } from "./pets/useSecretNote";
import { isPetNight, NIGHT_LINES } from "./pets/secrets";
import { petMemory } from "./pets/memoryCache";
import { cachedPet, loadPetSnapshot, loadPetGenerations, type PetSnapshot } from "./pets/petData";
import { PetIdCard, PetIdPopup, PetIdGallery, usePetMementos, canShowPetId } from "./pets/PetIdCard";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      marquee: any;
    }
  }
}

interface BookReview {
  source_plan_id?: string | number | null;
  id: number;
  user_name: string;
  title: string;
  author: string;
  review: string;
  genre: string;
  rating: string;
  group_name: string;
  target_member?: string | null;
  is_favorite?: boolean;
  is_revisit?: boolean;
  created_at?: string;
  ost_youtube_url?: string | null;
  ost_title?: string | null;
  ost_artist?: string | null;
}

// Mini dialogue uses the existing PNG; timestamps must come from persisted rows.
const MINI_DIALOGUE = {
  idle: ["헤헤", "히히", "룰루", "냐옹", "심심..", "놀자~", "뭐해?", "책 봐?"],
  pet: ["좋아", "꺄!", "히힛", "(행복)", "헤헷", "♡"],
  feed: ["냠냠", "얌얌", "꿀꺽", "쩝쩝", "맛나!", "와앙"],
  sleepy: ["졸려", "하암", "흐암", "(졸림)", "zZ"],
  wake: ["응?", "어라", "(하품)", "안녕?", "헤헤"],
  hungry: ["배고파", "밥 줘", "ㅠㅠ"],
};
const seoulDate = (now: number) =>
  new Date(now).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const planCountdown = (date: string, now: number | null) => {
  if (now === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const days = Math.round(
    (Date.parse(date + "T00:00:00Z") -
      Date.parse(seoulDate(now) + "T00:00:00Z")) /
      86400000,
  );
  return Number.isFinite(days)
    ? days === 0
      ? "D-DAY"
      : days > 0
        ? `D-${days}`
        : `D+${-days}`
    : "";
};
const careAgo = (timestamp: string | null, now: number | null) => {
  if (!timestamp || now === null) return "";
  const elapsed = now - Date.parse(timestamp);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "";
  const minutes = Math.floor(elapsed / 60000);
  return minutes === 0
    ? "방금"
    : minutes < 60
      ? `${minutes}분 전`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}시간 전`
        : `${Math.floor(minutes / 1440)}일 전`;
};

const PET_SPECIES_NAMES: Record<string, string> = {
  bogli: "보글이",
  bosongi: "보송이",
  byeolkongi: "별콩이",
  hornkong: "뿔콩이",
  dungdungi: "둥둥이",
  kongmongi: "콩몽이",
};

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

  content: string;
  created_at: string;
  parent_comment_id?: number | null;
  is_deleted?: boolean; // 🗑️ 댓글 삭제 여부
}

interface MailNotification {
  id: number;
  recipient: string;
  kind: "comment" | "mention" | "objection";
  book_id: number;
  sender: string;
  book_title: string;
  preview: string;
  created_at: string;
  read_at: string | null;
}

interface AppItem {
  id: string;
  name: string;
  icon: string;
}

const RATING_SCORES: Record<string, number> = {
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

function ratingScore(value: string): number | undefined {
  if (value === "중도하차") return undefined;
  if (RATING_SCORES[value] !== undefined) return RATING_SCORES[value];
  if (/^(?:[1-4](?:\.[05])?|0\.5|5(?:\.0)?)$/.test(value)) return Number(value);
  return undefined;
}

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

const BOOK_GENRES = [
  "소설",
  "만화",
  "웹툰",
  "오디오드라마",
  "팬픽",
  "사회/과학",
  "수필",
  "실용",
  "시",
  "에세이",
  "철학",
];

const APP_LIST: AppItem[] = [
  { id: "book-add", name: "기록하기", icon: "/icons/book-add.png" },
  { id: "comments", name: "댓글", icon: "/icons/comments.png" },
  { id: "goals", name: "목표 트래커", icon: "/icons/goals.png" },
  { id: "pets", name: "펫 돌보기", icon: "/icons/pets.png" },
  { id: "jukebox", name: "주크박스", icon: "/icons/music.png" },
  { id: "genre", name: "장르 분석", icon: "/icons/chart-pie.png" },
  { id: "awards", name: "명예의 전당", icon: "/icons/awards.png" },
  { id: "curation", name: "취향 메이트", icon: "/icons/curation.png" },
  { id: "sales", name: "강제 영업소", icon: "/icons/sales.png" },
  { id: "tags", name: "#키워드", icon: "/icons/tags.png" },
  { id: "vending", name: "#키워드_가챠", icon: "/icons/vending.png" },
  { id: "versus", name: "호불호 배틀", icon: "/icons/versus.png" },
  { id: "graveyard", name: "하차작 묘지", icon: "/icons/graveyard.png" },
  { id: "bingo", name: "덕질 빙고", icon: "/icons/bingo.png" },
  { id: "quiz", name: "리뷰 퀴즈", icon: "/icons/quiz.png" },
];

// 🎵 JUKEBOX.exe: 유튜브 주소에서 영상 ID 추출
function serializeReview(text: string, spoiler: boolean): string {
  const clean = text.replace(/^\s*(?:\(스포일러\)\s*)+/, "");
  return spoiler ? "(스포일러) " + clean : clean;
}

function normalizeBookTitle(value: string) {
  return value.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

// ✍️ 공동 작가 비교: 역할, 구분자, 순서 차이 허용
function isSameAuthors(a: string, b: string) {
  const compact = (value: string) =>
    value
      .normalize("NFC")
      .toLowerCase()
      .replace(/(?:원작|그림|글|작화|일러스트|저자)\s*[:：]?\s*/g, "")
      .replace(/[\s,，、/&·ㆍ;；]+/g, "");

  if (compact(a) === compact(b)) return true;

  const split = (value: string) =>
    value
      .normalize("NFC")
      .toLowerCase()
      .replace(/(?:원작|그림|글|작화|일러스트|각색|저자)\s*[:：]?\s*/g, ",")
      .split(/[\s,，、/&·ㆍ;；]+/)
      .filter(Boolean)
      .sort();

  const left = split(a);
  const right = split(b);

  return (
    left.length > 1 &&
    right.length > 1 &&
    JSON.stringify(left) === JSON.stringify(right)
  );
}

function isValidGroup(name: string | null) {
  return isRegisteredGroup(name);
}

const playRetroDing = () => { systemSound("notice"); };

const playCelebrationSound = () => { systemSound("celebrate"); };

function BookClubContent() {
  const searchParams = useSearchParams();
  const groupName = searchParams.get("group") || "기본모임";
  const explorerTitle = useExplorerTitle(groupName);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  // 화면과 입력 상태
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  type ReadingPlan = {
    id: number;
    group_name: string;
    user_name: string;
    title: string;
    author: string;
    genre: string;
    planned_date: string | null;
    created_at: string;
  };
  const [readingPlans, setReadingPlans] = useState<ReadingPlan[]>([]);
  const [sourcePlan, setSourcePlan] = useState<{ plan: ReadingPlan; submission: string } | null>(null);
  const reviewInsert = React.useRef<{ payload: string; id: string } | null>(null);
  const planInsert = React.useRef<{ payload: string; id: string } | null>(null);
  const planWriteBusy = React.useRef(false);
  const [planWriteUnconfirmed, setPlanWriteUnconfirmed] = useState(false);
  const [planUnconfirmed, setPlanUnconfirmed] = useState(false);
  const planOpenLock = React.useRef(false);
  useEffect(() => { setSourcePlan(null); setPlanUnconfirmed(false); planOpenLock.current = false; }, [groupName]);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [plansFetching, setPlansFetching] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [reviewsFetching, setReviewsFetching] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [plansReadyGroup, setPlansReadyGroup] = useState<string | null>(null);
  const [reviewsReadyGroup, setReviewsReadyGroup] = useState<string | null>(null);
  const plansCanRender = plansReadyGroup === groupName && reviewsReadyGroup === groupName;
  useEffect(() => {
    const denied = (event: Event) => {
      if ((event as CustomEvent).detail !== groupName) return;
      ++plansRequest.current; ++reviewsRequest.current;
      clearGroupLists(groupName); setReadingPlans([]); setReviews([]);
      setPlansReadyGroup(null); setReviewsReadyGroup(null);
    };
    window.addEventListener("bc98:pet-access-denied", denied);
    return () => window.removeEventListener("bc98:pet-access-denied", denied);
  }, [groupName]);
  const plansRequest = React.useRef(0);
  const reviewsRequest = React.useRef(0);
  const [planTitle, setPlanTitle] = useState("");
  const [planAuthor, setPlanAuthor] = useState("");
  const [planGenre, setPlanGenre] = useState("소설");
  const [planDate, setPlanDate] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("전체");
  const [sortOrder, setSortOrder] = useState<string>("최신순");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 📚 NEW 표시용 현재 시간 (1분마다 갱신)
  const [newBadgeNow, setNewBadgeNow] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => { if (document.visibilityState === "visible") setNewBadgeNow(Date.now()); };

    updateTime();

    const timer = window.setInterval(updateTime, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") updateTime();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRevisit, setIsRevisit] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<number[]>([]);
  // 📚 같은 작품 리뷰 펼쳐보기
  const [selectedGenre, setSelectedGenre] = useState("전체");
  const [filterType, setFilterType] = useState<
    "all" | "dropped" | "favorite" | "revisit"
  >("all");
  const [reactions, setReactions] = useState<{
    [bookId: number]: { [emoji: string]: number };
  }>({});
  const [randomBook, setRandomBook] = useState<BookReview | null>(null);
  const [genreUser, setGenreUser] = useState<string>("전체");
  const [vendingVisited, setVendingVisited] = useState(false);
  const [mateTargetUser, setMateTargetUser] = useState<string>("");
  const [salesIndex, setSalesIndex] = useState(0);
  const [selectedBingoUser, setSelectedBingoUser] = useState<string>("얼이");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [openWindow, setOpenWindow] = useState<string | null>(null);
  // 🎵 JUKEBOX.exe 상태
  const [jukeboxActiveId, setJukeboxActiveId] = useState<number | null>(null);
  const [jukeboxPlaying, setJukeboxPlaying] = useState(false);
  // 🎵 작업표시줄 곡명 넘침 감지
  const jukeboxTickerBoxRef = React.useRef<HTMLSpanElement>(null);
  const jukeboxTickerTextRef = React.useRef<HTMLSpanElement>(null);
  const [jukeboxOverflow, setJukeboxOverflow] = useState(0);

  const [jukeboxReady, setJukeboxReady] = useState(false);
  const [jukeboxError, setJukeboxError] = useState("");
  const [jukeboxSearch, setJukeboxSearch] = useState("");
  const [jukeboxSort, setJukeboxSort] = useState<"newest" | "oldest" | "title">(
    "title",
  );

  // 유튜브 플레이어와 현재 곡 정보 보관
  const jukeboxPlayerRef = React.useRef<any>(null);
  const jukeboxPendingRef = React.useRef<string | null>(null);
  const jukeboxLoadedVideoRef = React.useRef<string | null>(null);
  const jukeboxActiveIdRef = React.useRef<number | null>(null);
  const jukeboxSongsRef = React.useRef<BookReview[]>([]);
  const jukeboxActionRef = React.useRef<(direction: number) => void>(() => {});
  // 🎵 현재 모임의 리뷰에서 OST가 등록된 곡만 수집
  const jukeboxSongs = React.useMemo(() => {
    const available = reviews.filter(
      (review) =>
        review.group_name === groupName &&
        !!getJukeboxVideoId(review.ost_youtube_url) &&
        !!review.ost_title?.trim() &&
        !!review.ost_artist?.trim(),
    );

    return available.sort((a, b) =>
      jukeboxSort === "oldest"
        ? a.id - b.id
        : jukeboxSort === "title"
          ? (a.ost_title || "").localeCompare(b.ost_title || "", "ko")
          : b.id - a.id,
    );
  }, [reviews, groupName, jukeboxSort]);

  jukeboxSongsRef.current = jukeboxSongs;
  jukeboxActiveIdRef.current = jukeboxActiveId;

  // 현재 선택된 곡
  const jukeboxActive =
    jukeboxSongs.find((review) => review.id === jukeboxActiveId) || null;

  // 주크박스 검색
  const jukeboxSearchText = jukeboxSearch.trim().toLocaleLowerCase();

  const jukeboxVisibleSongs = jukeboxSongs.filter((review) =>
    [review.ost_title, review.ost_artist, review.title, review.user_name].some(
      (value) => (value || "").toLocaleLowerCase().includes(jukeboxSearchText),
    ),
  );

  // 🎵 JUKEBOX.exe — 곡 선택
  const jukeboxPlaySong = (review: BookReview) => {
    const videoId = getJukeboxVideoId(review.ost_youtube_url);
    if (!videoId) return;

    jukeboxPendingRef.current = videoId;
    setJukeboxActiveId(review.id);
    setJukeboxError("");

    const player = jukeboxPlayerRef.current;

    if (player && jukeboxReady) {
      jukeboxLoadedVideoRef.current = videoId;
      player.loadVideoById(videoId);
    }
  };

  // 🎵 이전 곡 / 다음 곡
  const jukeboxSkip = (direction: number) => {
    const songs = jukeboxSongsRef.current;
    if (songs.length === 0) return;

    const currentIndex = songs.findIndex(
      (song) => song.id === jukeboxActiveIdRef.current,
    );

    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + songs.length) % songs.length;

    jukeboxPlaySong(songs[nextIndex]);
  };

  jukeboxActionRef.current = jukeboxSkip;

  // 🎵 재생 / 일시정지
  const jukeboxTogglePlayback = () => {
    const player = jukeboxPlayerRef.current;

    if (!jukeboxActive) {
      if (jukeboxSongs.length > 0) {
        jukeboxPlaySong(jukeboxSongs[0]);
      }
      return;
    }

    if (!player || !jukeboxReady) return;

    if (jukeboxPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  // 🎵 YouTube IFrame API — 플레이어는 한 번만 생성
  useEffect(() => {
    let cancelled = false;
    let player: any = null;

    const ytWindow = window as typeof window & {
      YT?: any;
      onYouTubeIframeAPIReady?: () => void;
    };

    const createPlayer = () => {
      if (cancelled || !ytWindow.YT?.Player) return;

      const mount = document.getElementById("jukebox-youtube-player");
      if (!mount) return;

      player = new ytWindow.YT.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (cancelled) return;

            jukeboxPlayerRef.current = event.target;
            setJukeboxReady(true);

            const pendingVideoId = jukeboxPendingRef.current;

            if (pendingVideoId) {
              jukeboxLoadedVideoRef.current = pendingVideoId;
              event.target.loadVideoById(pendingVideoId);
            }
          },

          onStateChange: (event: any) => {
            if (cancelled) return;

            const state = event.data;

            setJukeboxPlaying(state === ytWindow.YT.PlayerState.PLAYING);

            // 영상이 끝나면 다음 곡으로 이동
            if (state === ytWindow.YT.PlayerState.ENDED) {
              jukeboxActionRef.current(1);
            }
          },

          onError: () => {
            if (cancelled) return;

            setJukeboxPlaying(false);
            setJukeboxError(
              "이 영상은 재생할 수 없어요. 다른 곡을 선택해 주세요.",
            );
          },
        },
      });
    };

    if (ytWindow.YT?.Player) {
      createPlayer();
    } else {
      const previousCallback = ytWindow.onYouTubeIframeAPIReady;

      ytWindow.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        createPlayer();
      };

      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;

      if (player && typeof player.destroy === "function") {
        player.destroy();
      }

      jukeboxPlayerRef.current = null;
    };
  }, []);

  // 🎵 작업표시줄 곡명 길이 측정
  useEffect(() => {
    const box = jukeboxTickerBoxRef.current;
    const text = jukeboxTickerTextRef.current;
    if (!box || !text) return;

    const measure = () => {
      const overflow = Math.max(
        0,
        Math.ceil(text.scrollWidth - box.clientWidth),
      );

      setJukeboxOverflow(overflow);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(text);

    document.fonts?.ready.then(measure);

    return () => observer.disconnect();
  }, [jukeboxActiveId, jukeboxSongs.length]);

  // 🐾 PET.exe 상태
  const [currentPet, setCurrentPet] = useState<PetGeneration | null>(null);
  // 🪦 역대 펫 기록
  const [petHistory, setPetHistory] = useState<PetGeneration[]>([]);
  const [petHistoryLoading, setPetHistoryLoading] = useState(false);
  const [petHistoryError, setPetHistoryError] = useState("");

  const [petLoading, setPetLoading] = useState(true);
  const [petError, setPetError] = useState("");
  const [petAdopting, setPetAdopting] = useState(false);
  const [petReload, setPetReload] = useState(0);
  const [petCaretaker, setPetCaretaker] = useState("");
  // 🐣 아기 펫 이름 짓기
  const [petNameInput, setPetNameInput] = useState("");
  const [petNamingBusy, setPetNamingBusy] = useState(false);
  const [petNamingError, setPetNamingError] = useState("");
  // 🐾 작업표시줄 위 미니 펫
  const [miniPet, setMiniPet] = useState<PetGeneration | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const farewells = usePetFarewells(groupName, openWindow === "pets" && archiveOpen, currentPet, petReload);
  useEffect(() => { if (openWindow !== "pets") setArchiveOpen(false); }, [openWindow]);
  useEffect(() => { setArchiveOpen(false); }, [groupName]);
  const [idOpenFor, setIdOpenFor] = useState<number | null>(null);
  const snacks = usePetSnacks(groupName, openWindow === "pets", currentPet, petReload);
  const personalities = usePetPersonalities(groupName, openWindow === "pets", currentPet, petReload);
  const mementos = usePetMementos(groupName, openWindow === "pets", currentPet, petReload);
  useEffect(() => { setIdOpenFor(null); }, [groupName]);
  const secretNote = useSecretNote(groupName, miniPet);
  useEffect(() => { setDiaryOpen(false); }, [groupName]);
  const miniPetPreview = false; // 테스트할 때만 true
  const petNamingPreview = false; // 🧪 이름 짓기 화면 테스트
  // ✨ 펫 성장 반짝임 연출
  const [petGrowthEffect, setPetGrowthEffect] = useState(false);
  const previousPetStage = React.useRef<{
    id: number;
    stage: string;
  } | null>(null);

  // 실제 성장 단계가 바뀌면 반짝임 표시
  useEffect(() => {
    if (!miniPet) return;

    const previous = previousPetStage.current;

    if (
      previous &&
      previous.id === miniPet.id &&
      previous.stage !== miniPet.stage &&
      miniPet.stage !== "dead"
    ) {
      setPetGrowthEffect(true);
    }

    previousPetStage.current = {
      id: miniPet.id,
      stage: miniPet.stage,
    };
  }, [miniPet?.id, miniPet?.stage]);

  // 반짝임은 1.8초 후 자동 종료
  useEffect(() => {
    if (!petGrowthEffect) return;

    const timer = window.setTimeout(() => {
      setPetGrowthEffect(false);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [petGrowthEffect]);
  // 🐾 회원별 돌보기 횟수
  const [petCareCounts, setPetCareCounts] = useState({
    feed: 0,
    pet: 0,
  });
  const [petCareLoading, setPetCareLoading] = useState(false);
  const [petCareBusy, setPetCareBusy] = useState(false);
  const [petCareAction, setPetCareAction] = useState<"feed" | "pet" | null>(
    null,
  );
  const [petCareError, setPetCareError] = useState("");

  const [happyPetId, setHappyPetId] = useState<number | null>(null);
  const happyTimer = React.useRef<number | null>(null);
  const [miniPetSleeping, setMiniPetSleeping] = useState(false);
  const [wakeSequence, setWakeSequence] = useState(0);
  const [miniChat, setMiniChat] = useState<{ id: number; text: string; automatic: boolean; night: boolean } | null>(
    null,
  );
  const miniChatTimer = React.useRef<number | null>(null);
  const miniChatPriorityUntil = React.useRef(0);
  const { times: careTimes, error: careTimesError } = useCareTimes(
    groupName, miniPet?.id, currentPet?.group_name === groupName ? currentPet.id : undefined, petReload,
  );
  const careTimesRef = React.useRef(careTimes);
  careTimesRef.current = careTimes;
  const [planCelebration, setPlanCelebration] = useState<{
    group: string;
    user: string;
    title: string;
  } | null>(null);
  const submitBusy = React.useRef(false);
  const showMiniChat = React.useCallback(
    (id: number, kind: keyof typeof MINI_DIALOGUE) => {
      if (
        (kind === "idle" || kind === "hungry" || kind === "sleepy") &&
        Date.now() < miniChatPriorityUntil.current
      )
        return;
      if (kind === "feed" || kind === "pet" || kind === "wake")
        miniChatPriorityUntil.current = Date.now() + 2500;
      if (miniChatTimer.current !== null)
        window.clearTimeout(miniChatTimer.current);
      const automatic = kind === "idle" || kind === "hungry" || kind === "sleepy";
      const night = isPetNight();
      const lines = automatic && night ? NIGHT_LINES : MINI_DIALOGUE[kind];
      setMiniChat({
        id,
        text: lines[Math.floor(Math.random() * lines.length)],
        automatic, night,
      });
      miniChatTimer.current = window.setTimeout(() => {
        setMiniChat(null);
        miniChatTimer.current = null;
      }, 2500);
    },
    [],
  );
  useEffect(() => {
    setMiniChat(null);
    miniChatPriorityUntil.current = 0;
    return () => {
      if (miniChatTimer.current !== null)
        window.clearTimeout(miniChatTimer.current);
    };
  }, [groupName, miniPet?.id]);
  useEffect(() => {
    if (!planCelebration) return;
    const timer = window.setTimeout(() => setPlanCelebration(null), 3000);
    return () => window.clearTimeout(timer);
  }, [planCelebration]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setMiniChat(previous => previous?.automatic && previous.night !== isPetNight() ? null : previous);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const miniPetIsHappy = miniPet != null && happyPetId === miniPet.id;
  const miniPetIsEating =
    miniPet != null &&
    petCareAction === "feed" &&
    openWindow === "pets" &&
    currentPet?.id === miniPet.id;
  const miniPetIsAsleep =
    miniPetSleeping &&
    !miniPetIsEating &&
    !miniPetIsHappy &&
    miniPet != null &&
    miniPet.stage !== "egg" &&
    miniPet.stage !== "dead";

  useEffect(() => {
    setHappyPetId(null);
    return () => {
      if (happyTimer.current !== null) window.clearTimeout(happyTimer.current);
    };
  }, [groupName]);

  // 미니펫만 25~50초 배회한 뒤 4~7초 쉬고, 돌보기 중에는 깨어납니다.
  useEffect(() => {
    setMiniPetSleeping(false);
    if (
      !miniPet ||
      miniPet.stage === "egg" ||
      miniPet.stage === "dead" ||
      miniPetIsHappy ||
      miniPetIsEating
    )
      return;
    let timer: number;
    const walk = () => {
      timer = window.setTimeout(
        () => {
          if (document.visibilityState === "hidden") {
            walk();
            return;
          }
          showMiniChat(miniPet.id, "sleepy");
          timer = window.setTimeout(() => {
            setMiniPetSleeping(true);
            timer = window.setTimeout(
              () => {
                setMiniPetSleeping(false);
                showMiniChat(miniPet.id, "wake");
                walk();
              },
              4000 + Math.random() * 3000,
            );
          }, 2500);
        },
        25000 + Math.random() * 25000,
      );
    };
    walk();
    return () => window.clearTimeout(timer);
  }, [
    miniPet?.id,
    miniPet?.stage,
    miniPetIsHappy,
    miniPetIsEating,
    wakeSequence,
    showMiniChat,
  ]);
  useEffect(() => {
    if (
      !miniPet ||
      miniPet.stage === "egg" ||
      miniPet.stage === "dead" ||
      miniPetIsAsleep ||
      miniPetIsEating ||
      miniPetIsHappy
    )
      return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (document.visibilityState !== "hidden") {
            const fed = careTimesRef.current[miniPet.id]?.feed;
            // Hunger is only inferred from a verified last meal, after 6 hours.
            const hungry = fed && Date.now() - Date.parse(fed) >= 6 * 3600000;
            showMiniChat(miniPet.id, hungry ? "hungry" : "idle");
          }
          schedule();
        },
        20000 + Math.random() * 20000,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [
    miniPet?.id,
    miniPet?.stage,
    miniPetIsAsleep,
    miniPetIsEating,
    miniPetIsHappy,
    showMiniChat,
  ]);
  const openMiniPet = () => {
    secretNote.discover(miniPet);
    if (miniPetIsAsleep && miniPet) {
      setMiniPetSleeping(false);
      setWakeSequence((value) => value + 1);
      if (happyTimer.current !== null) window.clearTimeout(happyTimer.current);
      setHappyPetId(miniPet.id);
      happyTimer.current = window.setTimeout(() => {
        setHappyPetId(null);
        happyTimer.current = null;
      }, 1500);
      showMiniChat(miniPet.id, "wake");
    }
    setOpenWindow("pets");
  };

  // Shared per-room snapshot: a window opening joins the mini-pet request.
  useEffect(() => {
    const cached = cachedPet(groupName);
    setCurrentPet(cached?.value || null);
    setMiniPet(cached?.value || null);
    setPetHistory([]);
    setPetError("");
    setPetLoading(!cached);
    const denied = (event: Event) => {
      if ((event as CustomEvent).detail !== groupName) return;
      setCurrentPet(null); setMiniPet(null); setPetHistory([]);
      setPetLoading(false); setPetError("모임 접속 권한을 다시 확인해 주세요.");
      setDiaryOpen(false);
    };
    window.addEventListener("bc98:pet-access-denied", denied);
    return () => window.removeEventListener("bc98:pet-access-denied", denied);
  }, [groupName]);

  useEffect(() => {
    if (!isValidGroup(groupName)) { setMiniPet(null); return; }
    let cancelled = false;
    let reading = false;
    const cached = cachedPet(groupName);
    if (cached) setMiniPet(cached.value);
    const loadMiniPet = async (force = false) => {
      if (document.visibilityState === "hidden" || reading) return;
      reading = true;
      try {
        const pet = await loadPetSnapshot(groupName, force);
        if (!cancelled) { setMiniPet(previous => JSON.stringify(previous) === JSON.stringify(pet) ? previous : pet); setCurrentPet(previous => JSON.stringify(previous) === JSON.stringify(pet) ? previous : pet); setPetError(""); setPetLoading(false); }
      } catch { /* Keep a previously authorized snapshot while the network recovers. */ }
      finally { reading = false; }
    };
    void loadMiniPet(petReload > 0);
    const timer = window.setInterval(() => { void loadMiniPet(true); }, 12000);
    const focus = () => { if (document.visibilityState !== "hidden") void loadMiniPet(true); };
    document.addEventListener("visibilitychange", focus);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", focus); };
  }, [groupName, petReload]);

  // The history request also warms the diary generation list; do not request both separately.
  useEffect(() => {
    if (openWindow !== "pets" || !archiveOpen) return;
    let cancelled = false;
    const cached = petMemory.peek<PetSnapshot[]>(groupName, "generations");
    setPetHistory(cached ? cached.value.filter(pet => pet.stage === "dead" || pet.died_at !== null) : []);
    setPetHistoryLoading(!cached);
    setPetHistoryError("");
    void loadPetGenerations(groupName).then(rows => {
      if (!cancelled) setPetHistory(rows.filter(pet => pet.stage === "dead" || pet.died_at !== null));
    }).catch(() => {
      if (!cancelled && !cached) setPetHistoryError("역대 펫 기록을 불러오지 못했어요.");
    }).finally(() => { if (!cancelled) setPetHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [openWindow, archiveOpen, groupName, petReload]);

  useEffect(() => {
    if (openWindow !== "pets") return;
    let cancelled = false;
    const cached = cachedPet(groupName);
    if (cached) setCurrentPet(cached.value);
    setPetLoading(!cached);
    setPetError("");
    void loadPetSnapshot(groupName).then(pet => {
      if (!cancelled) { setCurrentPet(pet); setMiniPet(pet); }
    }).catch(error => {
      if (!cancelled && !cached) setPetError(error instanceof Error ? error.message : "펫 정보를 불러오지 못했어요.");
    }).finally(() => { if (!cancelled) setPetLoading(false); });
    return () => { cancelled = true; };
  }, [openWindow, groupName, petReload]);

  // 돌보는 사람 닉네임 기억하기
  useEffect(() => {
    setPetCaretaker(localStorage.getItem(`pet_caretaker_${groupName}`) || "");
  }, [groupName]);

  // 새 알 입양
  const adoptPetEgg = async () => {
    if (petAdopting || petLoading) return;

    setPetAdopting(true);
    setPetError("");

    const { error } = await supabase.rpc("pet_adopt_egg", {
      p_group_name: groupName,
    });

    setPetAdopting(false);

    if (error) {
      setPetError(error.message);
      return;
    }
    petMemory.invalidate(groupName);
    setPetReload(value => value + 1);
  };
  // 🐾 한국 날짜 기준 돌보기 횟수 조회
  useEffect(() => {
    if (openWindow !== "pets" || !currentPet || !petCaretaker) {
      setPetCareCounts({ feed: 0, pet: 0 });
      return;
    }

    let cancelled = false;

    const loadCareCounts = async () => {
      setPetCareLoading(true);
      setPetCareError("");

      const today = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Seoul",
      });

      const { data, error } = await supabase
        .from("pet_care_actions")
        .select("action_type")
        .eq("generation_id", currentPet.id)
        .eq("user_name", petCaretaker)
        .eq("action_date", today);

      if (cancelled) return;

      if (error) {
        setPetCareError("남은 돌보기 횟수를 불러오지 못했어요.");
        setPetCareLoading(false);
        return;
      }

      setPetCareCounts({
        feed: (data || []).filter((item) => item.action_type === "feed").length,
        pet: (data || []).filter((item) => item.action_type === "pet").length,
      });
      setPetCareLoading(false);
    };

    void loadCareCounts();

    return () => {
      cancelled = true;
    };
  }, [openWindow, currentPet?.id, petCaretaker, petReload]);

  // 🐾 실제 돌보기 실행
  const doPetCare = async (actionType: "feed" | "pet") => {
    if (
      !currentPet ||
      currentPet.stage === "dead" ||
      !petCaretaker ||
      !userList.includes(petCaretaker) ||
      petCareBusy ||
      petCareLoading ||
      petCareError
    ) {
      return;
    }

    const used = actionType === "feed" ? petCareCounts.feed : petCareCounts.pet;
    const limit = actionType === "feed" ? 3 : 5;

    if (used >= limit) return;

    setPetCareBusy(true);
    setPetCareAction(actionType);
    setMiniPetSleeping(false);
    if (currentPet.stage !== "egg" && miniPet?.id === currentPet.id)
      showMiniChat(currentPet.id, actionType);
    if (actionType === "pet" && currentPet.stage !== "egg") {
      if (happyTimer.current !== null) window.clearTimeout(happyTimer.current);
      setHappyPetId(currentPet.id);
      happyTimer.current = window.setTimeout(() => {
        setHappyPetId(null);
        happyTimer.current = null;
      }, 2000);
    }
    setPetCareError("");

    const careStartedAt = Date.now();

    try {
      const { error } = await supabase.rpc("pet_do_care", {
        p_generation_id: currentPet.id,
        p_user_name: petCaretaker,
        p_action_type: actionType,
      });

      if (error) throw error;
    } catch (error) {
      setPetCareError(
        error instanceof Error
          ? error.message
          : "돌보기에 실패했어요. 다시 시도해 주세요.",
      );
    } finally {
      const elapsed = Date.now() - careStartedAt;
      const remaining = Math.max(
        0,
        (actionType === "pet" ? 2000 : 1500) - elapsed,
      );

      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remaining);
        });
      }

      setPetCareBusy(false);
      setPetCareAction(null);

      // 돌보기 연출이 끝난 뒤 XP와 남은 횟수 갱신
      petMemory.invalidate(groupName);
      setPetReload((value) => value + 1);
    }
  };

  // 🐣 아기 이름 확정
  const nameBabyPet = async () => {
    const name = petNameInput.trim();

    if (
      !currentPet ||
      currentPet.stage === "egg" ||
      currentPet.stage === "dead" ||
      currentPet.pet_name ||
      !name ||
      !userList.includes(petCaretaker) ||
      petNamingBusy
    ) {
      return;
    }

    setPetNamingBusy(true);
    setPetNamingError("");

    try {
      const { data, error } = await supabase.rpc("pet_name_baby", {
        p_generation_id: currentPet.id,
        p_pet_name: name,
        p_named_by: petCaretaker,
      });

      if (error) throw error;

      if (data !== true) {
        throw new Error(
          "이미 다른 회원이 이름을 지었을 수 있어요. 다시 확인해 주세요.",
        );
      }

      setPetNameInput("");
      petMemory.invalidate(groupName);
      setPetReload((value) => value + 1);
    } catch (error) {
      setPetNamingError(
        error instanceof Error ? error.message : "이름을 저장하지 못했어요.",
      );
      petMemory.invalidate(groupName);
      setPetReload((value) => value + 1);
    } finally {
      setPetNamingBusy(false);
    }
  };

  const [time, setTime] = useState<string>("");
  const [receiptData, setReceiptData] = useState<{
    type: "single" | "list";
    user: string;
    items?: BookReview[];
    singleItem?: BookReview;
  } | null>(null);
  const [mail, setMail] = useState<MailNotification[]>([]);
  const [mailStatus, setMailStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mailFilter, setMailFilter] = useState<"all" | "comment" | "mention" | "objection">(
    "all",
  );
  const [mailSort, setMailSort] = useState<"newest" | "oldest">("newest");
  const [mailBusy, setMailBusy] = useState<number | null>(null);
  const [mailReload, setMailReload] = useState(0);
  // 🔔 모임원별 읽지 않은 우편함 알림
  const [unreadMailByUser, setUnreadMailByUser] = useState<
    Record<string, boolean>
  >({});

  // 🔔 종 알림 새로고침
  const [mailBellReload, setMailBellReload] = useState(0);

  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail?.group !== groupName) return;
      setMailReload(value => value + 1); setMailBellReload(value => value + 1);
    };
    window.addEventListener("bc98:mail-updated", refresh);
    return () => window.removeEventListener("bc98:mail-updated", refresh);
  }, [groupName]);

  // 🔔 모든 기기에서 공유하는 우편함 알림 상태
  useEffect(() => {
    if (!isValidGroup(groupName)) {
      setUnreadMailByUser({});
      return;
    }

    let cancelled = false;
    let loading = false;

    setUnreadMailByUser({});

    const loadUnreadMail = async () => {
      if (loading || document.visibilityState === "hidden") return;

      loading = true;

      try {
        const unread: Record<string, boolean> = {};

        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase
            .from("mailbox_notifications")
            .select("recipient")
            .eq("group_name", groupName)
            .is("read_at", null)
            .order("id", { ascending: true })
            .range(offset, offset + 199);

          if (error) throw error;
          if (cancelled) return;

          for (const item of data || []) {
            unread[item.recipient] = true;
          }

          if (!data || data.length < 200) break;
        }

        if (!cancelled) {
          setUnreadMailByUser(unread);
        }
      } catch (error) {
        console.error("우편함 종 알림 조회 실패:", error);
      } finally {
        loading = false;
      }
    };

    void loadUnreadMail();

    const refresh = () => {
      void loadUnreadMail();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    // 다른 기기에서 읽은 상태도 주기적으로 확인
    const timer = window.setInterval(refresh, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [groupName, mailBellReload]);
  const [targetMember, setTargetMember] = useState<string[]>([]);
  const [openCommentBookId, setOpenCommentBookId] = useState<number | null>(
    null,
  );
  // 📬 현재 답글을 작성 중인 대상 댓글
  const [replyTarget, setReplyTarget] = useState<{
    bookId: number;
    commentId: number;
    userName: string;
  } | null>(null);
  const [revealedCommentSpoilers, setRevealedCommentSpoilers] = useState<
    number[]
  >([]);
  const commentWriteLock = React.useRef(false), goalWriteLock = React.useRef(false);
  const [commentSaving, setCommentSaving] = useState(false), [goalSaving, setGoalSaving] = useState(false);
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
    ost_youtube_url: "",
    ost_title: "",
    ost_artist: "",
  });
  const [goalForm, setGoalForm] = useState({
    user_name: "",
    target_count: "10",
    message: "",
  });

  // 모임원 간 5점 만점 / 별점 일치도 기반 취향 도플갱어 분석
  const soulmateData = React.useMemo(() => {
    // 모든 고유 유저 목록
    const allUsers = Array.from(
      new Set(reviews.map((r) => r.user_name)),
    ).filter(Boolean);
    if (allUsers.length < 2) return null;

    // 기준 유저 (선택된 유저가 없으면 첫 번째 유저)
    const currentUser = mateTargetUser || allUsers[0];

    // 기준 유저가 5점(★★★★★)을 준 작품 제목 목록
    const myHighRated = reviews.filter(
      (r) =>
        r.user_name === currentUser &&
        (r.rating === "★★★★★" || r.rating === "5"),
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
        (r) =>
          r.user_name === otherUser &&
          (r.rating === "★★★★★" || r.rating === "5"),
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
      matchRate = Math.min(
        100,
        Math.round((maxMatchCount / myHighRated.length) * 100),
      );
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

      const scores = bookReviews.map((r) => RATING_SCORES[r.rating] ?? 2.5);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance =
        scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
        scores.length;

      const pro = bookReviews.filter(
        (r) =>
          (RATING_SCORES[r.rating] ?? 0) >= 4.0 ||
          r.rating === "★★★★★" ||
          r.is_favorite,
      );

      const con = bookReviews.filter(
        (r) => (RATING_SCORES[r.rating] ?? 0) <= 2.5 || r.rating === "중도하차",
      );

      const neutral = bookReviews.filter((r) => {
        const score = RATING_SCORES[r.rating] ?? 0;
        return (
          score >= 3.0 &&
          score <= 3.5 &&
          !r.is_favorite &&
          r.rating !== "중도하차"
        );
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
      if (r.review) s.totalLength += plainReview(r.review).length;

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
    const sortedByDropped = [...users].sort(
      (a, b) => b[1].dropped - a[1].dropped,
    );
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
    const sortedByWords = [...users].sort(
      (a, b) => b[1].totalLength - a[1].totalLength,
    );
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
      {
        id: "read",
        title: "명예의 다독왕",
        icon: "👑",
        ...readKing,
        color: "border-amber-400 bg-amber-50",
      },
      {
        id: "drop",
        title: "칼같은 하차왕",
        icon: "⚰️",
        ...dropKing,
        color: "border-gray-500 bg-gray-100",
      },
      {
        id: "fangirl",
        title: "불꽃의 주접상",
        icon: "🔥",
        ...fangirlKing,
        color: "border-rose-400 bg-rose-50",
      },
      {
        id: "diet",
        title: "외길의 편식왕",
        icon: "🧬",
        ...dietKing,
        color: "border-indigo-400 bg-indigo-50",
      },
    ];
  }, [reviews]);

  // 📢 강제 영업소 (인생작 / 5점 만점 작품 전단지 모음)
  const salesReviews = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return [];

    // 5점 만점(★★★★★)이거나 인생작으로 꼽힌 리뷰 중 감상평이 있는 것만 선별
    const targets = reviews.filter(
      (r) =>
        (r.rating === "★★★★★" || r.rating === "5" || r.is_favorite) &&
        r.review &&
        r.review.trim().length > 0,
    );

    // 열 때마다 신선하게 볼 수 있도록 무작위 셔플
    return [...targets].sort(() => 0.5 - Math.random());
  }, [reviews]);

  // 📡 실시간 속보 전광판 데이터 (최신 리뷰 상위 5건)
  const tickerText = React.useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return "속보: 현재 서재가 평화롭습니다. 첫 번째 독서 기록을 등록해 보세요! 📢";
    }
    const recentItems = reviews.slice(0, 5).map((r) => {
      const cleanReview = r.review?.includes("(스포일러)")
        ? "스포일러 포함 리뷰 (본문 숨김)"
        : plainReview(r.review || "").trim() || "감상 등록 완료";
      const shortReview =
        cleanReview.length > 25
          ? `${cleanReview.slice(0, 25)}...`
          : cleanReview;
      return `[NEW] ${r.user_name}님이 《${r.title}》에 평점 ${r.rating}을 남겼습니다: "${shortReview}"`;
    });
    return recentItems.join("   ◆   ");
  }, [reviews]);

  // 🎲 덕질 빙고 상태 (3x3 보드)

  // 멤버별 체크된 칸 목록 { "얼이": [5, 1, 2], "루프": [5, 3] }
  const bingo = useSupabaseBingo(groupName);
  const userBingoData = bingo.data;

  // 현재 선택된 멤버의 체크 배열
  const currentChecked = userBingoData[selectedBingoUser] || [];

  // 빙고 줄 수 계산 로직 (가로 3, 세로 3, 대각선 2)
  const completedBingoLines = React.useMemo(() => {
    const lines = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9], // 가로
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9], // 세로
      [1, 5, 9],
      [3, 5, 7], // 대각선
    ];
    return lines.filter((line) =>
      line.every((id) => currentChecked.includes(id)),
    ).length;
  }, [currentChecked]);

  // 서버 저장이 완료된 후 체크 상태를 반영합니다.
  const toggleBingoCell = (id: number) => bingo.toggle(selectedBingoUser, id);
  const resetCurrentBingo = () => bingo.reset(selectedBingoUser);

  // 키워드 자판기 작동 함수
  const tagCounts = React.useMemo(() => {
    const counts: { [tag: string]: number } = {};
    reviews.forEach((r) => {
      if (!r.review) return;
      // #뒤에 공백이나 특수문자가 오기 전까지의 단어 추출
      const matched = reviewTags(r.review);
      if (matched) {
        // 한 리뷰 내 중복 태그 제거 후 카운트
        Array.from(new Set(matched)).forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    // 많이 언급된 순서대로 정렬
    return Object.entries(counts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"),
    );
  }, [reviews]);

  // 선택된 태그가 포함된 리뷰 목록
  const taggedReviews = React.useMemo(() => {
    if (!selectedTag) return [];
    return reviews.filter((r) => r.review && plainReview(r.review).includes(selectedTag));
  }, [reviews, selectedTag]);

  // 장르별 소비 비율 및 편식 진단 계산 (전체/개인별 필터링 적용)
  const genreStats = React.useMemo(() => {
    const targetReviews =
      genreUser === "전체"
        ? reviews
        : reviews.filter((r) => r.user_name === genreUser);

    const total = targetReviews.length;
    if (total === 0)
      return { total: 0, items: [], dominant: null, conicStyle: "" };

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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const updateClock = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      const now = new Date();
      setTime(now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }));
      timer = setTimeout(updateClock, 60000 - Date.now() % 60000 + 5);
    };
    updateClock();
    document.addEventListener("visibilitychange", updateClock);
    return () => { if (timer !== undefined) clearTimeout(timer); document.removeEventListener("visibilitychange", updateClock); };
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

  const handleSelectUser = (user: string) => setSelectedUser(user);

  // 📌 독서 예고장 목록 불러오기
  const fetchReadingPlans = React.useCallback(async (force = true) => {
    const request = ++plansRequest.current;
    setPlansError("");
    if (!isValidGroup(groupName)) {
      setReadingPlans([]);
      setPlansFetching(false);
      return;
    }
    setPlansFetching(true);
    const cached = peekList<ReadingPlan>(listKey(groupName, "plans"));
    if (cached) { setReadingPlans(cached); setPlansReadyGroup(groupName); }
    try {
      const rows = await readList<ReadingPlan>(listKey(groupName, "plans"), async () => {
      const rows: ReadingPlan[] = [];
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await supabase
          .from("reading_plans")
          .select("*")
          .eq("group_name", groupName)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 199);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 200) break;
      }
      return rows;
      }, force);
      if (request !== plansRequest.current) return;
      setReadingPlans(rows); setPlansReadyGroup(groupName);
    } catch {
      if (request === plansRequest.current) {
        setPlansError(
          "예고장을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.",
        );
      }
    } finally {
      if (request === plansRequest.current) setPlansFetching(false);
    }
  }, [groupName]);

  useEffect(() => {
    setReadingPlans([]);
    void fetchReadingPlans(false);
    return () => {
      ++plansRequest.current;
    };
  }, [fetchReadingPlans]);

  // 완독 리뷰가 등록된 예고장은 숨깁니다. 중도하차는 제외합니다.
  const matchesReadingPlan = (plan: ReadingPlan, review: BookReview) =>
    plan.group_name === groupName &&
    review.group_name === groupName &&
    review.rating !== "중도하차" &&
    review.user_name === plan.user_name &&
    (review.source_plan_id != null
      ? String(review.source_plan_id) === String(plan.id)
      : normalizeBookTitle(review.title) === normalizeBookTitle(plan.title) &&
        isSameAuthors(review.author || "", plan.author || ""));

  const activeReadingPlans = React.useMemo(() => readingPlans.filter(
    (plan) =>
      plan.group_name === groupName &&
      !reviews.some((review) => matchesReadingPlan(plan, review)),
  ), [readingPlans, reviews, groupName]);

  // 📌 독서 예고장 등록
  const addReadingPlan = async () => {
    if (planLoading || planWriteBusy.current) return;
    if (!planTitle.trim() || !planAuthor.trim()) {
      alert("작품 제목과 작가를 입력해주세요!");
      return;
    }

    if (selectedUser === "전체" || !isValidGroup(groupName)) return;

    planWriteBusy.current = true;
    setPlanLoading(true);
    try {
      const row = { group_name: groupName, user_name: selectedUser, title: planTitle.trim(), author: planAuthor.trim(), genre: planGenre, planned_date: planDate || null };
      const payload = JSON.stringify(row);
      if (planInsert.current?.payload !== payload) planInsert.current = { payload, id: crypto.randomUUID() };
      const { error } = await supabase.from("reading_plans").insert(row, { submission: planInsert.current.id });

      if (error) {
        setPlanWriteUnconfirmed(!!error.unconfirmed);
        alert("예고장 등록 실패: " + error.message);
        return;
      }

      planInsert.current = null; setPlanWriteUnconfirmed(false);
      setPlanTitle("");
      setPlanAuthor("");
      setPlanGenre("소설");
      setPlanDate("");
      planBaseline.current = JSON.stringify(["", "", "소설", ""]);
      savedNotice("예고장이 등록되었습니다.");
      await fetchReadingPlans();
    } catch {
      alert(
        "예고장 등록 중 오류가 발생했습니다. 목록을 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      planWriteBusy.current = false; setPlanLoading(false);
    }
  };

  // 📌 독서 예고장 삭제
  const deleteReadingPlan = async (id: number) => {
    if (!confirm("이 독서 예고장을 삭제할까요?")) return;

    const { error } = await supabase
      .from("reading_plans")
      .delete()
      .eq("id", id)
      .eq("group_name", groupName)
      .eq("user_name", selectedUser);

    if (error) {
      alert("예고장 삭제 실패: " + error.message);
      return;
    }

    await fetchReadingPlans();
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setMail([]);
      setMailStatus("loading");
      if (selectedUser === "전체" || !isValidGroup(groupName)) return;
      try {
        const rows: MailNotification[] = [];
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase
            .from("mailbox_notifications")
            .select("*")
            .eq("group_name", groupName)
            .eq("recipient", selectedUser)
            .order("id", { ascending: true })
            .range(offset, offset + 199);
          if (error) throw error;
          if (cancelled) return;
          rows.push(...(data || []));
          if (!data || data.length < 200) break;
        }
        setMail(rows);
        setMailStatus("ready");
      } catch {
        if (!cancelled) setMailStatus("error");
      }
    };
    void load();
    const refresh = () => setMailReload((value) => value + 1);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [groupName, selectedUser, mailReload]);

  const openMail = async (item: MailNotification) => {
    if (mailBusy !== null) return;
    if (!item.read_at) {
      setMailBusy(item.id);
      const readAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("mailbox_notifications")
        .update({ read_at: readAt })
        .eq("id", item.id)
        .eq("group_name", groupName)
        .eq("recipient", selectedUser)
        .select("id,read_at")
        .single();
      setMailBusy(null);
      if (error || !data) {
        alert("읽음 저장에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      setMail((previous) =>
        previous.map((row) =>
          row.id === item.id ? { ...row, read_at: data.read_at } : row,
        ),
      );
      setMailBellReload((value) => value + 1);
    }
    jumpToReview(item.book_id, item.kind === "objection" ? "objection" : "comment");
  };

  const markAllMailRead = async () => {
    if (mailBusy !== null || mailStatus !== "ready" || selectedUser === "전체")
      return;
    if (!mail.some((item) => !item.read_at)) return;

    const lastId = mail.reduce((max, item) => Math.max(max, item.id), 0);
    const readAt = new Date().toISOString();
    setMailBusy(-1);

    try {
      const { error } = await supabase
        .from("mailbox_notifications")
        .update({ read_at: readAt })
        .eq("group_name", groupName)
        .eq("recipient", selectedUser)
        .is("read_at", null)
        .lte("id", lastId);

      if (error) throw error;

      setMail((previous) =>
        previous.map((item) =>
          !item.read_at && item.id <= lastId
            ? { ...item, read_at: readAt }
            : item,
        ),
      );
    } catch {
      alert("전체 읽음 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setMailBusy(null);
      setMailReload((value) => value + 1);
      setMailBellReload((value) => value + 1);
    }
  };

  const handleRandomRecommend = () => {
    const validBooks = reviews.filter((b) => b.rating !== "중도하차");
    if (validBooks.length === 0) {
      alert("추천할 수 있는 감상 완료 작품이 아직 없어요!");
      return;
    }
    const randomIndex = Math.floor(Math.random() * validBooks.length);
    setRandomBook(validBooks[randomIndex]);
  };

  const toggleCommentSpoiler = (commentId: number) => {
    setRevealedCommentSpoilers((prev) =>
      prev.includes(commentId)
        ? prev.filter((id) => id !== commentId)
        : [...prev, commentId],
    );
  };

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

  const fetchReviews = React.useCallback(async (force = true) => {
    const request = ++reviewsRequest.current;
    setReviewsError("");
    if (!isValidGroup(groupName)) {
      setReviews([]);
      setReviewsFetching(false);
      return;
    }
    setReviewsFetching(true);
    const cached = peekList<BookReview>(listKey(groupName, "reviews"));
    if (cached) { setReviews(previous => reuseRows(previous, cached)); setReviewsReadyGroup(groupName); }
    try {
      const rows = await readList<BookReview>(listKey(groupName, "reviews"), async () => {
      const rows: BookReview[] = [];
      for (let offset = 0; ; ) {
        const { data, error, count } = await supabase
          .from("books")
          .select("*", { count: "exact" })
          .eq("group_name", groupName)
          .order("id", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        offset += data.length;
        // Respect a lower Supabase row cap without mistaking it for the last page.
        if (typeof count === "number" && offset >= count) break;
      }
      return rows;
      }, force);
      if (request !== reviewsRequest.current) return;
      setReviews(previous => reuseRows(previous, rows)); setReviewsReadyGroup(groupName);
      try {
        localStorage.setItem(
          'bookclub:reviews:v1:' + encodeURIComponent(groupName),
          JSON.stringify({ savedAt: Date.now(), rows }),
        );
      } catch {
        // Storage may be unavailable or full; the live list still works.
      }
    } catch {
      if (request === reviewsRequest.current) {
        setReviewsError("리뷰를 불러오지 못해 완독 여부를 확인할 수 없습니다.");
        alert("리뷰를 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (request === reviewsRequest.current) setReviewsFetching(false);
    }
  }, [groupName]);

  useEffect(() => {
    if (showAllPlans || openWindow === "reading-plan") {
      void fetchReadingPlans(false);
      void fetchReviews(false);
    }
  }, [showAllPlans, openWindow, fetchReadingPlans, fetchReviews]);

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
    const rows: Comment[] = [];
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await supabase
        .from("book_comments")
        .select("*")
        .eq("group_name", groupName)
        .order("id", { ascending: true })
        .range(offset, offset + 199);
      if (error) {
        alert("댓글을 불러오지 못했습니다: " + error.message);
        return;
      }
      rows.push(...(data || []));
      if (!data || data.length < 200) break;
    }
    setComments(rows);
  };

  useEffect(() => {
    // AccessGate mounts this component only after the group access check.
    let cachedRows: BookReview[] = [];
    if (isValidGroup(groupName)) {
      try {
        const cached = JSON.parse(localStorage.getItem(
          'bookclub:reviews:v1:' + encodeURIComponent(groupName),
        ) || 'null');
        if (
          cached && Number.isFinite(cached.savedAt) &&
          Date.now() - cached.savedAt < 7 * 24 * 60 * 60 * 1000 &&
          Array.isArray(cached.rows) &&
          cached.rows.every((row: BookReview) => row && row.group_name === groupName && typeof row.id === 'number')
        ) cachedRows = cached.rows;
      } catch {
        // Ignore invalid or unavailable browser storage.
      }
    }
    setReviews(cachedRows);
    setReviewsReadyGroup(cachedRows.length ? groupName : null);
    if (isValidGroup(groupName)) {
      void fetchReviews(false);
      fetchGoals();
      fetchComments();
      setMailReload((value) => value + 1);
    }
    return () => {
      ++reviewsRequest.current;
    };
  }, [groupName, fetchReviews]);

  const userList = React.useMemo(() => ["전체", ...Array.from(new Set(reviews.map(r => r.user_name).filter(Boolean)))], [reviews]);
  const objectionMembers = React.useMemo(() => userList.filter(name => name !== "전체"), [userList]);

  const unreadMailCount = mail.filter((item) => !item.read_at).length;
  const visibleMail = mail
    .filter((item) => mailFilter === "all" || item.kind === mailFilter)
    .slice()
    .sort((a, b) => {
      const delta =
        Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
      return mailSort === "oldest" ? delta : -delta;
    });

  const reviewPlainIndex = React.useMemo(() => new Map(reviews.map(row => [row.id, plainReview(row.review || "")])), [reviews]);
  const filteredReviews = React.useMemo(() => reviews.filter((r) => {
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

    // 🔍 제목 + 작가 + 리뷰 본문 통합 검색
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (r.title ?? "").toLowerCase().includes(q) ||
      (r.author ?? "").toLowerCase().includes(q) ||
      (reviewPlainIndex.get(r.id) || "").toLowerCase().includes(q);
    return matchesUser && matchesFilter && matchesSearch;
  }), [reviews, reviewPlainIndex, selectedUser, filterType, selectedGenre, searchQuery]);

  const displayedReviews = React.useMemo(() => [...filteredReviews].sort((a, b) => {
    if (sortOrder === "최신순") return b.id - a.id;
    if (sortOrder === "오래된순") return a.id - b.id;
    if (sortOrder === "높은 평점순") {
      const scoreA = RATING_SCORES[a.rating] ?? 0;
      const scoreB = RATING_SCORES[b.rating] ?? 0;
      return scoreB - scoreA || b.id - a.id;
    }
    if (sortOrder === "낮은 평점순") {
      const scoreA = RATING_SCORES[a.rating] ?? 0;
      const scoreB = RATING_SCORES[b.rating] ?? 0;
      return scoreA - scoreB || b.id - a.id;
    }
    return 0;
  }), [filteredReviews, sortOrder]);

  const { relatedById: sameBookIndex, ratingsById: workRatingIndex } = React.useMemo(
    () => buildReviewRelations(reviews, normalizeBookTitle, isSameAuthors, ratingScore), [reviews],
  );
  const relatedPlay = React.useRef((row: BookReview) => {});
  relatedPlay.current = row => { jukeboxPlaySong(row); setOpenWindow("jukebox"); };
  const playRelated = React.useCallback((row: BookReview) => relatedPlay.current(row), []);
  const reviewJump = React.useRef((id: number) => {});
  reviewJump.current = id => jumpToReview(id, "review");
  const viewRelated = React.useCallback((id: number) => reviewJump.current(id), []);
  const fulfilledReviewIds = React.useMemo(() => {
    const plansById = new Map(readingPlans.map(plan => [String(plan.id), plan]));
    const legacy = new Map<string, ReadingPlan[]>();
    const key = (row: { group_name: string; user_name: string; title: string }) => JSON.stringify([row.group_name, row.user_name, normalizeBookTitle(row.title)]);
    for (const plan of readingPlans) { const bucket = legacy.get(key(plan)) || []; bucket.push(plan); legacy.set(key(plan), bucket); }
    const ids = new Set<number>();
    for (const review of reviews) {
      const selected = review.source_plan_id == null ? undefined : plansById.get(String(review.source_plan_id));
      const candidates = review.source_plan_id == null ? legacy.get(key(review)) || [] : selected ? [selected] : [];
      if (candidates.some(plan => matchesReadingPlan(plan, review))) ids.add(review.id);
    }
    return ids;
  }, [reviews, readingPlans, groupName]);
  const shelfPicks = useShelfPicks(groupName);
  const workShelfPicks = React.useMemo(() => {
    const source = new Map(reviews.map(row => [String(row.id), row]));
    const picks = Array.from(shelfPicks.values()).flat();
    const mapping = new Map<string, typeof picks>();
    for (const row of reviews) {
      const members = new Map<string, typeof picks[number]>();
      for (const pick of picks) {
        const chosen = source.get(pick.book_id);
        if (String(row.id) === pick.book_id || chosen && row.group_name === chosen.group_name && row.genre === chosen.genre && normalizeBookTitle(row.title) === normalizeBookTitle(chosen.title) && isSameAuthors(row.author, chosen.author)) members.set(pick.user_name, pick);
      }
      if (members.size) mapping.set(String(row.id), Array.from(members.values()));
    }
    return mapping;
  }, [reviews, shelfPicks]);
  const yearRecords = React.useCallback(() => reviewsReadyGroup === groupName && !reviewsError ? { ...summarizeWorks(reviews.filter(row => row.group_name === groupName), normalizeBookTitle, isSameAuthors), ...yearHighlights(reviews.filter(row => row.group_name === groupName), workRatingIndex) } : null, [reviews, groupName, reviewsReadyGroup, reviewsError, workRatingIndex]);
  const commentIndex = React.useMemo(() => {
    const index = new Map<number, typeof comments>();
    for (const comment of comments) {
      const rows = index.get(comment.book_id) || [];
      rows.push(comment); index.set(comment.book_id, rows);
    }
    return index;
  }, [comments]);

  const duplicateReview = React.useMemo(() => {
    if (editingId || !formData.user_name.trim() || !formData.title.trim()) return undefined;
    return reviews.find(row => row.group_name === groupName && row.user_name === formData.user_name.trim()
      && normalizeBookTitle(row.title) === normalizeBookTitle(formData.title)
      && row.genre === formData.genre && isSameAuthors(row.author || "", formData.author));
  }, [reviews, groupName, editingId, formData.user_name, formData.title, formData.author, formData.genre]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitBusy.current || loading) return;
    if (!formData.title) return alert("제목을 입력해주세요!");
    if (!formData.user_name) return alert("작성자 이름을 입력해주세요!");

    // 🎵 JUKEBOX.exe — OST 입력값 검사
    const ostUrl = formData.ost_youtube_url.trim();
    const ostTitle = formData.ost_title.trim();
    const ostArtist = formData.ost_artist.trim();

    const hasAnyOstField = !!(ostUrl || ostTitle || ostArtist);

    if (hasAnyOstField && (!ostUrl || !ostTitle || !ostArtist)) {
      return alert(
        "OST를 등록하려면 유튜브 링크, 곡 제목, 아티스트를 모두 입력해주세요!",
      );
    }

    if (ostUrl) {
      let validYoutubeUrl = false;

      try {
        const url = new URL(ostUrl);
        const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

        const videoId =
          hostname === "youtu.be"
            ? url.pathname.split("/").filter(Boolean)[0]
            : hostname === "youtube.com" || hostname === "m.youtube.com"
              ? url.pathname === "/watch"
                ? url.searchParams.get("v")
                : url.pathname.startsWith("/shorts/") ||
                    url.pathname.startsWith("/live/") ||
                    url.pathname.startsWith("/embed/")
                  ? url.pathname.split("/")[2]
                  : null
              : null;

        validYoutubeUrl =
          url.protocol === "https:" &&
          /^[a-zA-Z0-9_-]{11}$/.test(videoId || "");
      } catch {
        validYoutubeUrl = false;
      }

      if (!validYoutubeUrl) {
        return alert("올바른 유튜브 영상 링크를 입력해주세요!");
      }
    }

    if (targetMember.some((name) => !userList.includes(name))) {
      return alert("기존 멤버를 선택해주세요!");
    }
    submitBusy.current = true;
    setLoading(true);
    try {
      const finalReview = serializeReview(formData.review || "", isSpoiler);

      if (editingId) {
        const { error } = await supabase
          .from("books")
          .update({
            ...formData,
            review: finalReview,
            target_member:
              targetMember.length > 0 ? targetMember.join(",") : null,
            is_favorite: isFavorite,
            is_revisit: isRevisit,
          })
          .eq("id", editingId);

        if (error) {
          alert("수정 실패: " + error.message);
        } else {
          playRetroDing();
          savedNotice("기록이 수정되었습니다.");
          setRevealedSpoilers((previous) =>
            previous.filter((id) => id !== editingId),
          );
          setEditingId(null);
          resetForm();
          setOpenWindow(null);
          fetchReviews();
          setMailReload((value) => value + 1);
        }
      } else {
        // Refresh before saving so an already fulfilled plan does not celebrate again.
        const loadCompletionSnapshot = async (
          table: "reading_plans" | "books",
        ) => {
          const rows: any[] = [];
          try {
            for (let offset = 0; ; offset += 200) {
              const { data, error } = await supabase
                .from(table)
                .select("*")
                .eq("group_name", groupName)
                .eq("user_name", formData.user_name)
                .order("id", { ascending: true })
                .range(offset, offset + 199);
              if (error) return { data: [], error: true };
              rows.push(...(data || []));
              if (!data || data.length < 200)
                return { data: rows, error: false };
            }
          } catch {
            return { data: [], error: true };
          }
        };
        const [planSnapshot, reviewSnapshot] = sourcePlan
          ? [{ data: [sourcePlan.plan], error: false }, { data: [], error: false }]
          : await Promise.all([
              loadCompletionSnapshot("reading_plans"),
              loadCompletionSnapshot("books"),
            ]);
        const candidate = { ...formData, group_name: groupName, ...(sourcePlan ? { source_plan_id: sourcePlan.plan.id } : {}) } as BookReview;
        const fulfilledPlan =
          !planSnapshot.error &&
          !reviewSnapshot.error &&
          (planSnapshot.data || []).find(
            (plan: ReadingPlan) =>
              matchesReadingPlan(plan, candidate) &&
              !(reviewSnapshot.data || []).some((review: BookReview) =>
                matchesReadingPlan(plan, review),
              ),
          );
        const linkedReview = { ...formData, review: finalReview,
          target_member: targetMember.length > 0 ? targetMember.join(",") : null,
          is_favorite: isFavorite, is_revisit: isRevisit };
        const insertPayload = JSON.stringify(linkedReview);
        if (!sourcePlan && reviewInsert.current?.payload !== insertPayload) reviewInsert.current = { payload: insertPayload, id: crypto.randomUUID() };
        const { error } = sourcePlan
          ? await supabase.planReview({ group: groupName, plan_id: String(sourcePlan.plan.id), submission: sourcePlan.submission, review: linkedReview })
          : await supabase.from("books").insert([
          {
            ...formData,
            review: finalReview,
            target_member:
              targetMember.length > 0 ? targetMember.join(",") : null,
            group_name: groupName,
            is_favorite: isFavorite,
            is_revisit: isRevisit,
          },
        ], { submission: reviewInsert.current!.id });

        if (error) {
          setPlanUnconfirmed(!!error.unconfirmed);
          alert("저장 실패: " + error.message);
        } else {
          const userGoal = goals.find(
            (g) => g.user_name === formData.user_name,
          );
          const currentCount =
            reviews.filter((r) => r.user_name === formData.user_name).length +
            1;

          if (userGoal && currentCount >= userGoal.target_count) {
            playCelebrationSound();
          } else {
            playRetroDing();
          }

          if (fulfilledPlan) {
            setPlanCelebration({
              group: groupName,
              user: formData.user_name,
              title: formData.title,
            });
          } else {
            savedNotice("기록이 저장되었습니다.");
          }
          resetForm();
          setIsSpoiler(false);
          setIsFavorite(false);
          setIsRevisit(false);
          setOpenWindow(null);
          fetchReviews();
          setMailReload((value) => value + 1);
        }
      }
    } catch {
      alert(
        "저장 결과를 확인하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      submitBusy.current = false;
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goalWriteLock.current) return;
    if (!goalForm.user_name) return alert("닉네임을 입력해주세요!");
    const count = parseInt(goalForm.target_count, 10);
    if (isNaN(count) || count <= 0)
      return alert("올바른 목표 권수를 입력해주세요!");

    goalWriteLock.current = true; setGoalSaving(true);
    try {
    const { error } = await supabase.from("goals").upsert(
      {
        group_name: groupName,
        user_name: goalForm.user_name.trim(),
        target_count: count,
        message: goalForm.message.trim(),
      },
      { onConflict: "group_name,user_name" },
    );

    if (error) {
      alert("목표 저장 실패: " + error.message);
    } else {
      playRetroDing();
      alert(`${goalForm.user_name}님의 목표가 설정되었습니다!`);
      setGoalForm({ user_name: "", target_count: "10", message: "" });
      fetchGoals();
    }
    } finally { goalWriteLock.current = false; setGoalSaving(false); }
  };

  const handleCommentSubmit = async (e: React.FormEvent, bookId: number) => {
    e.preventDefault();
    if (commentWriteLock.current) return;
    if (!commentForm.user_name.trim()) return alert("작성자를 입력해주세요!");
    if (!commentForm.content.trim()) return alert("댓글 내용을 입력해주세요!");
    if (!/^\d{4}$/.test(commentForm.password))
      return alert("비밀번호는 숫자 4자리로 입력해주세요!");

    // 📬 답글 작성 중이라면 해당 댓글의 ID를 함께 저장
    commentWriteLock.current = true; setCommentSaving(true);
    try {
    const parentCommentId =
      replyTarget?.bookId === bookId ? replyTarget.commentId : null;

    const { error } = await supabase.from("book_comments").insert([
      {
        book_id: bookId,
        group_name: groupName,
        user_name: commentForm.user_name.trim(),
        password: commentForm.password,
        content: commentForm.is_spoiler
          ? "(스포일러) " + commentForm.content.trim()
          : commentForm.content.trim(),
        parent_comment_id: parentCommentId,
      },
    ]);

    if (error) {
      alert("댓글 저장 실패: " + error.message);
    } else {
      playRetroDing();
      setReplyTarget(null); // 📬 답글 대상 초기화
      setCommentForm({
        user_name: commentForm.user_name,
        password: "",
        content: "",
        is_spoiler: false,
      });
      fetchComments();
      setMailReload((value) => value + 1);
    }
    } finally { commentWriteLock.current = false; setCommentSaving(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    const password = prompt(
      "댓글 작성 시 입력한 비밀번호(숫자 4자리)를 입력하세요:",
    );
    if (password === null) return;
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const { error } = await supabase.comment({
      group: groupName,
      action: "delete",
      id: commentId,
      password,
    });
    if (error) return alert(error.message);
    fetchComments();
    setMailReload((value) => value + 1);
  };

  const handleEditComment = async (commentId: number, oldContent: string) => {
    const password = prompt(
      "댓글 작성 시 입력한 비밀번호(숫자 4자리)를 입력하세요:",
    );
    if (password === null) return;
    const content = prompt("수정할 댓글 내용을 입력하세요:", oldContent);
    if (!content || !content.trim()) return;
    const { error } = await supabase.comment({
      group: groupName,
      action: "edit",
      id: commentId,
      password,
      content: content.trim(),
    });
    if (error) return alert(error.message);
    alert("댓글이 수정되었습니다.");
    fetchComments();
  };

  const resetForm = () => {
    reviewInsert.current = null;
    bookBaseline.current = null;
    setSourcePlan(null); setPlanUnconfirmed(false); planOpenLock.current = false;
    setTargetMember([]);
    setFormData({
      user_name: formData.user_name,
      title: "",
      author: "",
      review: "",
      genre: "소설",
      rating: "★★★★★",
      ost_youtube_url: "",
      ost_title: "",
      ost_artist: "",
    });
    setIsSpoiler(false);
    setIsFavorite(false);
    setIsRevisit(false);
  };

  const fulfillReadingPlan = (plan: ReadingPlan) => {
    if (planUnconfirmed) { setOpenWindow("book-add"); return; }
    if (submitBusy.current || loading || plan.group_name !== groupName) return;
    if (planOpenLock.current) {
      if (sourcePlan && String(sourcePlan.plan.id) === String(plan.id)) setOpenWindow("book-add");
      else if (sourcePlan) alert("다른 예고에서 기록 중입니다. 기존 기록하기를 닫은 후 선택해 주세요.");
      return;
    }
    planOpenLock.current = true;
    setEditingId(null); setTargetMember([]); setIsSpoiler(false); setIsFavorite(false); setIsRevisit(false);
    setFormData({ user_name: plan.user_name, title: plan.title, author: plan.author, genre: plan.genre,
      rating: "★★★★★", review: "", ost_youtube_url: "", ost_title: "", ost_artist: "" });
    setPlanUnconfirmed(false);
    setSourcePlan({ plan: { ...plan }, submission: crypto.randomUUID() });
    setOpenWindow("book-add");
  };

  const handleEdit = (book: BookReview) => {
    if (planUnconfirmed) { setOpenWindow("book-add"); return; }
    setSourcePlan(null); setPlanUnconfirmed(false); planOpenLock.current = false;
    setEditingId(book.id);
    setTargetMember(
      (book.target_member || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );

    setFormData({
      user_name: book.user_name,
      title: book.title,
      author: book.author || "",
      review: serializeReview(book.review || "", false),
      genre: book.genre || "소설",
      rating: book.rating || "★★★★★",
      ost_youtube_url: book.ost_youtube_url || "",
      ost_title: book.ost_title || "",
      ost_artist: book.ost_artist || "",
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
      setMailReload((value) => value + 1);
    }
  };

  const getReadCount = (name: string) => {
    return reviews.filter((r) => r.user_name === name).length;
  };

  const getAverageRating = (name: string) => {
    const userReviews = reviews.filter((r) => r.user_name === name);
    const validScores = userReviews
      .map((r) => RATING_SCORES[r.rating])
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

  const todayStr = seoulDate(Date.now());

  const handleSaveReceiptImage = async () => {
    if (!receiptRef.current) return;
    try {
      setDownloadingReceipt(true);

      const target = receiptRef.current;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        onclone: (clonedDoc) => {
          const element = clonedDoc.querySelector(
            "[data-receipt-box]",
          ) as HTMLElement;
          if (element) {
            element.style.maxHeight = "none";
            element.style.height = "auto";
            element.style.overflow = "visible";
          }
          const listScroll = clonedDoc.querySelector(
            "[data-receipt-list]",
          ) as HTMLElement;
          if (listScroll) {
            listScroll.style.maxHeight = "none";
            listScroll.style.height = "auto";
            listScroll.style.overflow = "visible";
          }

          const allTexts = clonedDoc.querySelectorAll("*");
          allTexts.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.letterSpacing = "0px";
            htmlEl.style.fontFamily =
              "Apple SD Gothic Neo, Malgun Gothic, 맑은 고딕, sans-serif";
          });
        },
      });

      const fileName = `영수증_${receiptData?.user || "기록"}_${todayStr}.png`;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("PNG 이미지 생성 실패"));
        }, "image/png");
      });

      const file = new File([blob], fileName, {
        type: "image/png",
      });

      // 아이폰 및 아이패드 확인
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      if (isIOS) {
        // iOS에서 이미지 공유 기능 사용
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "BOOK CLUB 98 영수증",
            });
            return;
          } catch (shareError) {
            if (
              shareError instanceof DOMException &&
              shareError.name === "AbortError"
            ) {
              return;
            }
          }
        }

        // 공유 기능이 동작하지 않을 때 이미지 미리보기
        const imageUrl = URL.createObjectURL(blob);
        const previewWindow = window.open("", "_blank");

        if (previewWindow) {
          previewWindow.document.title = fileName;

          const image = previewWindow.document.createElement("img");
          image.src = imageUrl;
          image.alt = "BOOK CLUB 98 영수증";
          image.style.maxWidth = "100%";
          image.style.height = "auto";

          previewWindow.document.body.style.margin = "0";
          previewWindow.document.body.style.padding = "16px";
          previewWindow.document.body.style.background = "#eeeeee";
          previewWindow.document.body.appendChild(image);
        } else {
          alert(
            "이미지 미리보기를 열 수 없습니다. Safari에서 다시 시도해 주세요.",
          );
          URL.revokeObjectURL(imageUrl);
        }

        return;
      }

      // PC 및 안드로이드 기존 다운로드 유지
      const imageUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(imageUrl);
      }, 60000);
    } catch (err) {
      alert("이미지 저장 중 오류가 발생했습니다.");
    } finally {
      setDownloadingReceipt(false);
    }
  };

  // 💬 댓글 클릭 시 해당 리뷰로 이동
  const jumpToReview = (bookId: number, destination: "comment" | "objection" | "review" = "comment") => {
    const targetBook = reviews.find((r) => r.id === bookId);

    if (!targetBook) {
      alert("해당 리뷰를 찾을 수 없습니다.");
      return;
    }

    // 댓글창 닫기
    setOpenWindow(null);

    // 리뷰 검색 및 필터 초기화
    setSelectedUser("전체");
    setSelectedGenre("전체");
    setFilterType("all");
    setSearchQuery("");

    // 해당 리뷰의 댓글창 열기
    setOpenCommentBookId(destination === "comment" ? bookId : null);

    // 화면이 갱신된 뒤 해당 리뷰로 스크롤
    setTimeout(() => {
      const target = document.getElementById(`review-${bookId}`);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        if (destination === "objection") target.querySelector<HTMLButtonElement>("[data-objection-open]")?.click();
      }
    }, 100);
  };

  const handleAppClick = (appId: string) => {
    if (appId === "vending") setVendingVisited(true);
    setStartMenuOpen(false);
    if (appId === "receipt") {
      setReceiptData({
        type: "list",
        user:
          selectedUser === "전체"
            ? reviews[0]?.user_name || "회원"
            : selectedUser,
        items:
          selectedUser === "전체"
            ? reviews
            : reviews.filter((r) => r.user_name === selectedUser),
      });
      return;
    }
    setOpenWindow(appId);
  };

  const isAllowedGroup = isValidGroup(groupName);

  if (!isAllowedGroup) {
    return (
      <div className="desktop-surface min-h-screen flex items-center justify-center bg-[#008080] p-4 select-none">
        <div className="bg-[#c0c0c0] win-outset p-4 max-w-sm w-full text-center">
          <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 text-xs font-bold text-left mb-3">
            SYSTEM ERROR
          </div>
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-sm font-bold text-black mb-1">
            접근이 제한된 모임방입니다
          </h2>
          <p className="text-xs text-gray-700 leading-relaxed mb-4">
            존재하지 않거나 비공개된 방입니다.
            <br />
            올바른 주소로 접속해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const bookDraft = JSON.stringify([formData, isSpoiler, isFavorite, isRevisit, targetMember]);
  const planDraft = JSON.stringify([planTitle, planAuthor, planGenre, planDate]);
  const bookBaseline = React.useRef<string | null>(null), planBaseline = React.useRef<string | null>(null);
  const bookBaselineIdentity = React.useRef("");
  useEffect(() => {
    const identity = JSON.stringify([groupName, editingId, sourcePlan?.submission]);
    if (openWindow === "book-add" && (bookBaseline.current === null || bookBaselineIdentity.current !== identity)) {
      bookBaseline.current = bookDraft; bookBaselineIdentity.current = identity;
    }
  }, [openWindow, groupName, editingId, sourcePlan?.submission]);
  useEffect(() => {
    if (openWindow === "reading-plan") planBaseline.current = planDraft;
    else planBaseline.current = null;
  }, [openWindow, selectedUser]);
  const bookClose = useDraftClose(bookBaseline.current !== null && bookBaseline.current !== bookDraft, loading, () => { if (planUnconfirmed) { setOpenWindow(null); return; } bookBaseline.current = null; cancelEdit(); });
  const planClose = useDraftClose(planBaseline.current !== null && planBaseline.current !== planDraft, planLoading, () => {
    if (planWriteUnconfirmed) { setOpenWindow(null); return; }
    setPlanTitle(""); setPlanAuthor(""); setPlanGenre("소설"); setPlanDate(""); setOpenWindow(null);
  });
  useWindowEscape(() => {
    if (openWindow === "book-add") bookClose.requestClose();
    else if (openWindow === "reading-plan") planClose.requestClose();
    else if (!loading && !planLoading && !goalSaving) setOpenWindow(null);
  }, !!openWindow, 50, () => document.querySelector<HTMLElement>(`[data-bc-window="${openWindow}"]`), openWindow || undefined);
  useWindowEscape(() => { if (!downloadingReceipt) setReceiptData(null); }, !!receiptData, 50, () => document.querySelector<HTMLElement>('[data-bc-window="receipt"]'));
  useWindowEscape(() => setRandomBook(null), !!randomBook, 50, () => document.querySelector<HTMLElement>('[data-bc-window="recommendation"]'));
  useWindowEscape(() => setShowAllPlans(false), showAllPlans, 100, () => document.querySelector<HTMLElement>('[data-bc-window="all-plans"]'));
  useWindowEscape(() => setPlanCelebration(null), !!planCelebration, 50);

  return (
    <ObjectionCounts key={groupName} group={groupName} ready={reviewsReadyGroup === groupName}>
    <RelatedReviewsProvider key={groupName}>
    <main className="desktop-surface relative flex flex-col h-[100dvh] w-full bg-[#008080] font-sans select-none overflow-hidden">
      <style jsx global>{`
        @keyframes petEggBounce {
          0%,
          100% {
            transform: translateY(0);
          }
          22% {
            transform: translateY(-17px);
          }
          46% {
            transform: translateY(0);
          }
          55% {
            transform: translateY(-4px);
          }
          68%,
          100% {
            transform: translateY(0);
          }
        }

        .pet-egg-bounce {
          animation: petEggBounce 0.7s linear infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .pet-egg-bounce {
            animation: none;
          }
        }
        /* 🐾 미니 펫: 정해진 구역 안에서 좌우 배회 */
        @keyframes miniPetWalk {
          0%,
          5% {
            transform: translateX(0);
          }
          45%,
          55% {
            transform: translateX(90px);
          }
          95%,
          100% {
            transform: translateX(0);
          }
        }

        /* 🐾 미니 펫: 걷는 동안 통통 뛰기 */
        @keyframes miniPetHop {
          0%,
          100% {
            transform: translateY(0);
          }
          45% {
            transform: translateY(-12px);
          }
        }

        .mini-pet-walk {
          animation: miniPetWalk 4s linear infinite;
        }

        .mini-pet-hop {
          animation: miniPetHop 0.6s ease-in-out infinite;
        }

        @media (min-width: 768px) {
          .mini-pet-chat {
            --mini-chat-size: 88px;
            --mini-chat-left: -68px;
            --mini-chat-top: -63px;
            --mini-chat-short: 14px;
            --mini-chat-medium: 13px;
            --mini-chat-long: 11px;
          }
        }

        /* 🐾 PET.exe 방 안에서 좌우로 돌아다니기 */
        @keyframes petRoomWalk {
          0%,
          5% {
            transform: translate3d(0, 0, 0);
          }

          45%,
          55% {
            transform: translate3d(calc(100% - 150px), 0, 0);
          }

          95%,
          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        .pet-room-walk {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          will-change: transform;
          animation: petRoomWalk 5s linear infinite;
        }

        .pet-room-walk > div { width: 150px; }

        @media (prefers-reduced-motion: reduce) {
          .mini-pet-walk,
          .mini-pet-hop {
            animation: none;
          }
        }
        /* 🥚 알 보살피기: 평소보다 빠른 통통 */
        .pet-egg-excited {
          animation: petEggBounce 0.38s linear infinite;
          will-change: transform;
        }

        /* 💗 쓰다듬기: 하트가 위로 떠오름 */
        @keyframes petHeartFloat {
          0% {
            transform: translateY(8px) scale(0.7);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-35px) scale(1.15);
            opacity: 0;
          }
        }

        .pet-heart-float {
          animation: petHeartFloat 0.9s ease-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .pet-egg-excited,
          .pet-heart-float {
            animation: none;
          }
        }
        /* ✨ 성장 반짝임 */
        @keyframes petGrowthSparkle {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-15deg);
          }
          30% {
            opacity: 1;
            transform: scale(1.1) rotate(5deg);
          }
          70% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: scale(1.3) rotate(15deg);
          }
        }

        .pet-growth-sparkle {
          animation: petGrowthSparkle 1.8s ease-in-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .pet-growth-sparkle {
            animation: none;
            opacity: 0;
          }
        }

        /* 🎵 실제 넘치는 제목만 이동 */
        @keyframes jukeboxTickerMove {
          0%,
          12% {
            transform: translateX(0);
          }

          45%,
          55% {
            transform: translateX(calc(-1 * var(--jukebox-overflow)));
          }

          88%,
          100% {
            transform: translateX(0);
          }
        }

        .jukebox-ticker-moving {
          animation: jukeboxTickerMove var(--jukebox-duration) ease-in-out
            infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .jukebox-ticker-moving {
            animation: none;
          }
        }
      `}</style>

      {/* 바탕화면 메인 스크롤 영역 */}
      <div
        className="flex-1 overflow-y-auto p-3 pb-16 space-y-4 lg:pt-10"
        onClick={() => setStartMenuOpen(false)}
      >
        {/* 📚 서재 목록 (바탕화면 내장 탐색기 창) */}
        <div className="max-w-4xl mx-auto bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black lg:max-w-[1100px] lg:h-[calc(100dvh-104px)] lg:flex lg:flex-col">
          <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 text-xs font-bold flex justify-between items-center">
            <span className="flex min-w-0 flex-1 items-center gap-1 mr-2">
              <span className="truncate min-w-0" title={explorerTitle.text}>📚 {explorerTitle.text}</span>
              <span className="shrink-0">({displayedReviews.length}권)</span>
            </span>

            <div className="flex shrink-0 items-center gap-[2px]">
              {["─", "□", "×"].map((symbol) => (
                <span
                  key={symbol}
                  className="win-btn w-5 h-5 p-0 inline-flex items-center justify-center text-black font-bold select-none"
                >
                  <span className="flex items-center justify-center w-full h-full">
                    {symbol === "─" ? (
                      <span className="block w-[11px] h-[2px] bg-black self-end mb-[4px]" />
                    ) : symbol === "□" ? (
                      <span className="block w-[12px] h-[11px] border-2 border-black" />
                    ) : (
                      <span className="text-[18px] font-bold leading-none">
                        ×
                      </span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="p-2 space-y-2 bg-[#d4d8dc] lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
            {/* 🔍 검색창 + 🎲 랜덤 추천 버튼 */}
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="🔍 제목, 작가, 리뷰 내용 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-w-0 text-xs p-1.5 pr-7 win-inset bg-white focus:outline-none placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="검색어 지우기"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 text-sm text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleRandomRecommend}
                className="win-btn shrink-0 whitespace-nowrap px-2 py-1.5 text-xs font-bold"
              >
                🎲 랜덤 추천
              </button>
            </div>

            {/* 필터 탭 */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1 w-full min-w-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:font-bold" aria-label="장르 필터">
                {[
                  "전체",
                  ...BOOK_GENRES.filter((genre) =>
                    reviews.some(
                      (r) => r.group_name === groupName && r.genre === genre,
                    ),
                  ),
                ].map((genre) => {
                  const isSelected =
                    filterType === "all" && selectedGenre === genre;

                  return (
                    <button
                      key={genre}
                      aria-pressed={isSelected}
                      type="button"
                      onClick={() => {
                        setFilterType("all");
                        setSelectedGenre(genre);
                      }}
                      className={`px-2 py-0.5 text-xs win-btn ${
                        isSelected ? "win-inset bc-selected" : ""
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-nowrap overflow-x-auto items-center gap-1 w-full min-w-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:font-bold pb-1" aria-label="독서 필터 및 공동책장">
                <button
                  type="button"
                  onClick={() =>
                    setFilterType(
                      filterType === "favorite" ? "all" : "favorite",
                    )
                  }
                  aria-pressed={filterType === "favorite"}
                  className={`px-2 py-0.5 text-xs win-btn ${
                    filterType === "favorite"
                      ? "win-inset bc-selected"
                      : ""
                  }`}
                >
                  👑 인생작
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterType(filterType === "revisit" ? "all" : "revisit")
                  }
                  aria-pressed={filterType === "revisit"}
                  className={`px-2 py-0.5 text-xs win-btn ${
                    filterType === "revisit"
                      ? "win-inset bc-selected"
                      : ""
                  }`}
                >
                  🔁 재주행
                </button>
                {/* ✉️ 전체 회원의 독서 예고장 */}
                <button
                  type="button"
                  onClick={() => setShowAllPlans(true)}
                  className="px-2 py-0.5 text-xs win-btn"
                >
                  ✉️ 예고장
                </button>
                <SharedShelfHub key={`shelf:${groupName}`} group={groupName} member={selectedUser}
                  ready={reviewsRequest.current > 0 && !reviewsFetching && !reviewsError}
                  blocked={!!openWindow || !!receiptData || !!randomBook || !!planCelebration || diaryOpen || idOpenFor !== null || showAllPlans || startMenuOpen || loading || editingId !== null || !!commentForm.content.trim() || !!formData.title.trim() || !!formData.review.trim()} />
              </div>
            </div>

            {/* 회원 선택 및 모임원 기능 */}
            <div className="py-1 border-t border-gray-400 flex flex-col gap-2 w-full min-w-0">
              {/* 첫 번째 줄: 회원 선택 */}
              <div className="flex flex-wrap gap-1 items-center w-full min-w-0">
                {userList.map((user) => (
                  <button
                    key={user}
                    type="button"
                    aria-pressed={selectedUser === user}
                    onClick={() => handleSelectUser(user)}
                    className={`relative ${
                      user !== "전체" && unreadMailByUser[user] ? "z-10" : "z-0"
                    } px-2 py-0.5 text-[11px] whitespace-nowrap font-bold win-btn shrink-0 ${
                      selectedUser === user
                        ? "win-inset bc-selected"
                        : ""
                    }`}
                  >
                    {user}

                    {user !== "전체" && unreadMailByUser[user] && (
                      <span
                        aria-label="읽지 않은 우편함 알림 있음"
                        className="absolute -top-2 -right-2 z-20 text-[13px] leading-none pointer-events-none drop-shadow-sm origin-top"
                      >
                        <span className="inline-block mailbox-bell-ring">
                          🔔
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 두 번째 줄: 우편함·예고장·상장 */}
              <div className="flex flex-nowrap overflow-x-auto items-center gap-2 w-full min-w-0 pb-1" aria-label="모임원 기능">
                {selectedUser !== "전체" && <>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenWindow("mailbox");
                      setMailReload((value) => value + 1);
                    }}
                    className="win-btn !w-max !min-w-max !shrink-0 !whitespace-nowrap px-2 py-0.5 text-xs font-bold"
                  >
                    ✉️ {selectedUser}의 우편함
                    {mailStatus === "ready" && unreadMailCount > 0 && (
                      <span className="ml-1 bg-red-600 text-white px-1 rounded-full">
                        {unreadMailCount}
                      </span>
                    )}
                  </button>

                  {/* 독서 예고장 */}
                  <button
                    type="button"
                    onClick={() => setOpenWindow("reading-plan")}
                    className="win-btn px-2 py-0.5 text-xs font-bold whitespace-nowrap shrink-0"
                  >
                    📌 {selectedUser}의 예고장
                  </button>
                </>}
                <AwardsHub key={groupName} group={groupName} member={selectedUser} records={yearRecords} onReview={id => jumpToReview(Number(id), "review")}
                  author={userList.includes(commentForm.user_name) ? commentForm.user_name : formData.user_name}
                  ready={reviewsRequest.current > 0 && !reviewsFetching && !reviewsError}
                  blocked={!!openWindow || !!receiptData || !!randomBook || !!planCelebration || diaryOpen || idOpenFor !== null || showAllPlans || startMenuOpen || loading || editingId !== null || !!commentForm.content.trim() || !!formData.title.trim() || !!formData.review.trim()} />
              </div>

              {/* 세 번째 줄: 정렬 */}
              <div className="flex justify-end w-full">
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
            </div>

            {/* 카드 목록 */}
            <div className="mt-1 space-y-2 max-h-[420px] overflow-y-auto pr-0.5 win-inset p-1 bg-[#808080] lg:max-h-none lg:flex-1 lg:min-h-0">
              {displayedReviews.length === 0 ? (
                <div className="bg-white p-4 text-center text-xs text-gray-500">
                  {reviewsFetching
                    ? "독서 기록을 불러오는 중입니다."
                    : reviewsError
                      ? reviewsError
                      : reviews.length === 0
                        ? "아직 등록된 독서 기록이 없습니다."
                        : "🔎 검색 결과가 없습니다. 검색어 또는 선택한 필터를 확인해 주세요."}
                  {!reviewsFetching && !reviewsError && reviews.length > 0 && (
                    <button
                      type="button"
                      className="win-btn block mx-auto mt-2 px-3 py-1 text-xs text-black"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedUser("전체");
                        setSelectedGenre("전체");
                        setFilterType("all");
                      }}
                    >
                      필터 초기화
                    </button>
                  )}
                </div>
              ) : (
                displayedReviews.map((book) => {
                  const bookComments = commentIndex.get(book.id) || [];
                  const isOpen = openCommentBookId === book.id;

                  // 📚 같은 작품에 다른 모임원이 남긴 리뷰
                  const sameBookReviews = sameBookIndex.get(book.id) || [];


                  return (
                    <div
                      key={book.id}
                      id={"review-" + book.id}
                      className="bg-white p-2.5 win-outset text-xs"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1 gap-y-1 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1 min-w-0 break-words [overflow-wrap:anywhere]">
                          <span className="font-bold text-[#000080] text-sm">
                            {book.genre === "웹툰"
                              ? "📱 "
                              : book.genre === "만화"
                                ? "💭 "
                                : book.genre === "오디오드라마"
                                  ? "🎧 "
                                  : "📖 "}
                            {<Highlight text={book.title} query={searchQuery} />}
                          </span>
                          {newBadgeNow !== null &&
                            book.created_at &&
                            Number.isFinite(Date.parse(book.created_at)) &&
                            newBadgeNow >= Date.parse(book.created_at) &&
                            newBadgeNow - Date.parse(book.created_at) <
                              24 * 60 * 60 * 1000 && (
                              <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none rounded-sm">
                                NEW
                              </span>
                            )}
                          <ShelfBadge picks={workShelfPicks.get(String(book.id))} />
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
                          {fulfilledReviewIds.has(book.id) && (
                            <span className="bg-green-100 text-green-800 border border-green-400 font-bold text-xs px-1 rounded">
                              📌 예고 이행!
                            </span>
                          )}
                        </div>
                        <span className="text-amber-600 font-bold text-xs whitespace-nowrap tracking-wider shrink-0">
                          {book.rating}
                        </span>
                        <div className="text-gray-600 text-xs leading-relaxed min-w-0 break-words [overflow-wrap:anywhere]">
                        {book.author ? <><Highlight text={book.author} query={searchQuery} /> · </> : ""}
                        {book.genre} |{" "}
                        <span className="font-bold text-gray-800">
                          {book.user_name}
                        </span>
                        </div>
                        <ReviewCreatedDate value={book.created_at} trusted />
                      </div>

                      {book.target_member && (
                        <div className="mt-1 mb-1.5 flex flex-wrap gap-1">
                          {book.target_member
                            .split(",")
                            .map((name) => name.trim())
                            .filter(Boolean)
                            .map((name) => (
                              <span
                                key={name}
                                className="bc-member px-2 py-0.5"
                              >
                                @{name}
                              </span>
                            ))}
                        </div>
                      )}
                      {book.review &&
                        (book.review.includes("(스포일러)") &&
                        !revealedSpoilers.includes(book.id) ? (
                          <div
                            onClick={() =>
                              setRevealedSpoilers([
                                ...revealedSpoilers,
                                book.id,
                              ])
                            }
                            className="bg-amber-50 border border-dashed border-amber-400 p-2 mt-1 rounded text-xs text-amber-800 cursor-pointer hover:bg-amber-100 flex items-center justify-between"
                          >
                            <span>⚠️ 스포일러가 포함된 감상평입니다.</span>
                            <span className="text-xs underline font-bold text-amber-900 ml-2 shrink-0">
                              보기
                            </span>
                          </div>
                        ) : (
                          <ReviewText text={book.review.replace("(스포일러)", "")} query={searchQuery} />
                        ))}

                      {/* 🎵 JUKEBOX.exe — 이 작품의 OST */}

                      {book.ost_youtube_url && (
                        <div className="w-full mt-2 flex items-center gap-2 bc-ost border px-2 py-2 text-xs">
                          <Image
                            src="/icons/music.png"
                            alt=""
                            aria-hidden="true"
                            width={22}
                            height={22}
                            unoptimized
                            className="object-contain shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold bc-accent">
                              🎵 이 작품의 OST
                            </p>

                            <p className="font-bold text-gray-800 break-words">
                              {book.ost_title || "제목 없음"}
                              {" — "}
                              {book.ost_artist || "아티스트 미상"}
                            </p>
                          </div>

                          {/* 🎵 OST 재생 버튼 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              jukeboxPlaySong(book);
                              setOpenWindow("jukebox");
                            }}
                            className="win-btn shrink-0 w-7 h-7 flex items-center justify-center text-black text-sm"
                            aria-label={`${book.ost_title || "OST"} 재생`}
                            title="OST 재생"
                          >
                            ▶
                          </button>
                        </div>
                      )}

                      {/* 📚 같은 작품 리뷰 펼쳐보기 */}
                      {sameBookReviews.length > 0 && <RelatedReviews bookId={book.id} sameBookReviews={sameBookReviews} rating={workRatingIndex.get(book.id)} onPlay={playRelated} onReview={viewRelated} />}

                      <ReviewObjections group={groupName} book={String(book.id)} title={book.title} reviewAuthor={book.user_name}
                        members={objectionMembers}
                        author={userList.includes(commentForm.user_name) ? commentForm.user_name : formData.user_name} />

                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100 text-[11px]">
                        <button
                          disabled={commentSaving}
                          onClick={() =>
                            setOpenCommentBookId(isOpen ? null : book.id)
                          }
                          className="font-bold text-gray-700 hover:text-black flex items-center gap-1"
                        >
                          💬 댓글{" "}
                          <span className="text-[#000080] underline">
                            ({bookComments.length})
                          </span>
                        </button>
                        <div className="review-actions flex items-center gap-2">
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
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-300 bg-[#f4f6f7] p-2 win-inset">
                          <div className="space-y-1.5 mb-2">
                            {bookComments.length === 0 ? (
                              <div className="text-xs text-gray-400 text-center py-1">
                                첫 번째 댓글을 남겨보세요!
                              </div>
                            ) : (
                              (() => {
                                // 📬 댓글을 부모 → 답글 순서로 정렬
                                const commentIds = new Set(
                                  bookComments.map((c) => c.id),
                                );
                                const visited = new Set<number>();

                                const orderedComments: {
                                  comment: (typeof bookComments)[number];
                                  depth: number;
                                }[] = [];

                                const appendComment = (
                                  comment: (typeof bookComments)[number],
                                  depth: number,
                                ) => {
                                  if (visited.has(comment.id)) return;

                                  visited.add(comment.id);
                                  orderedComments.push({ comment, depth });

                                  bookComments
                                    .filter(
                                      (child) =>
                                        child.parent_comment_id === comment.id,
                                    )
                                    .forEach((child) =>
                                      appendComment(child, depth + 1),
                                    );
                                };

                                // 일반 댓글과 부모가 삭제된 답글을 먼저 표시
                                bookComments
                                  .filter(
                                    (c) =>
                                      c.parent_comment_id == null ||
                                      !commentIds.has(c.parent_comment_id),
                                  )
                                  .forEach((c) => appendComment(c, 0));

                                // 비정상적인 연결 데이터가 있어도 댓글은 빠뜨리지 않기
                                bookComments.forEach((c) => {
                                  if (!visited.has(c.id)) appendComment(c, 0);
                                });

                                return orderedComments.map(
                                  ({ comment: c, depth }) => {
                                    const parentComment = bookComments.find(
                                      (parent) =>
                                        parent.id === c.parent_comment_id,
                                    );

                                    return (
                                      <div
                                        key={c.id}
                                        className={`p-2 border text-xs ${
                                          depth > 0
                                            ? "bg-[#f5f0fc] border-[#d1c4e0] border-l-[3px] border-l-[#800080]"
                                            : "bg-white border-gray-200"
                                        }`}
                                        style={{
                                          marginLeft:
                                            depth > 0
                                              ? `${Math.min(depth, 3) * 12}px`
                                              : "0px",
                                        }}
                                      >
                                        <div className="flex justify-between items-center gap-1 text-gray-500 text-xs mb-1">
                                          <div className="min-w-0">
                                            <span className="font-bold text-gray-800">
                                              {depth > 0 ? "↳ " : ""}
                                              {c.is_deleted
                                                ? "삭제된 댓글"
                                                : c.user_name}
                                            </span>
                                            {parentComment && (
                                              <span className="ml-1 text-[10px] text-[#800080]">
                                                → {parentComment.user_name}에게
                                                답글
                                              </span>
                                            )}
                                          </div>

                                          {!c.is_deleted && (
                                            <div className="flex gap-1.5 shrink-0">
                                              {/* 📬 답글 달기 */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setReplyTarget({
                                                    bookId: book.id,
                                                    commentId: c.id,
                                                    userName: c.user_name,
                                                  });
                                                  setOpenCommentBookId(book.id);
                                                }}
                                                className="text-[#800080] hover:underline font-bold"
                                              >
                                                ↳ 답글
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleEditComment(
                                                    c.id,
                                                    c.content,
                                                  )
                                                }
                                                className="text-blue-600 hover:underline font-bold"
                                              >
                                                수정
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleDeleteComment(c.id)
                                                }
                                                className="text-red-500 hover:underline font-bold"
                                              >
                                                삭제
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        <div className="text-gray-800 break-all text-xs leading-relaxed">
                                          {c.is_deleted ? (
                                            <span className="text-gray-400 italic">
                                              삭제된 댓글입니다.
                                            </span>
                                          ) : c.content.startsWith(
                                              "(스포일러)",
                                            ) &&
                                            !revealedCommentSpoilers.includes(
                                              c.id,
                                            ) ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                toggleCommentSpoiler(c.id)
                                              }
                                              className="w-full text-left bg-gray-200 border border-dashed border-gray-400 px-2 py-1.5 text-gray-600 hover:bg-gray-300 cursor-pointer"
                                            >
                                              🔒 스포일러가 포함된 댓글입니다.
                                              클릭하여 보기
                                            </button>
                                          ) : (
                                            <div>
                                              {c.content
                                                .replace(/^\(스포일러\)\s*/, "")
                                                .trim()}

                                              {c.content.startsWith(
                                                "(스포일러)",
                                              ) && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    toggleCommentSpoiler(c.id)
                                                  }
                                                  className="block mt-1 text-[10px] text-blue-700 hover:underline"
                                                >
                                                  🔒 다시 가리기
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  },
                                );
                              })()
                            )}
                          </div>

                          <form
                            onSubmit={(e) => handleCommentSubmit(e, book.id)}
                            className="space-y-1"
                          ><fieldset className="min-w-0 space-y-1" disabled={commentSaving}>
                            {/* 📬 누구에게 답글을 작성 중인지 표시 */}
                            {replyTarget?.bookId === book.id && (
                              <div className="flex items-center justify-between gap-2 bc-ost border px-2 py-1.5 text-xs">
                                <span className="font-bold bc-accent truncate">
                                  ↳ {replyTarget.userName} 님에게 답글 작성 중
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setReplyTarget(null)}
                                  className="win-btn px-2 py-0.5 text-[11px] shrink-0"
                                >
                                  취소
                                </button>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="text"
                                required
                                placeholder="닉네임"
                                value={commentForm.user_name}
                                onChange={(e) =>
                                  setCommentForm({
                                    ...commentForm,
                                    user_name: e.target.value,
                                  })
                                }
                                className="p-1 text-xs bg-white win-inset outline-none"
                              />
                              <input
                                type="password"
                                maxLength={4}
                                required
                                placeholder="숫자 4자리"
                                value={commentForm.password}
                                onChange={(e) =>
                                  setCommentForm({
                                    ...commentForm,
                                    password: e.target.value,
                                  })
                                }
                                className="p-1 text-xs bg-white win-inset outline-none"
                              />
                            </div>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                required
                                placeholder="댓글을 입력하세요..."
                                value={commentForm.content}
                                onChange={(e) =>
                                  setCommentForm({
                                    ...commentForm,
                                    content: e.target.value,
                                  })
                                }
                                className="flex-1 p-1 text-xs bg-white win-inset outline-none"
                              />
                              <button
                                type="submit"
                                className="win-btn px-2.5 py-1 text-xs font-bold"
                              >
                                {commentSaving ? "저장 중..." : "등록"}
                              </button>
                            </div>

                            {/* 스포일러 체크박스 */}
                            <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer mt-1">
                              <input
                                type="checkbox"
                                checked={commentForm.is_spoiler || false}
                                onChange={(e) =>
                                  setCommentForm({
                                    ...commentForm,
                                    is_spoiler: e.target.checked,
                                  })
                                }
                                className="accent-[#000080]"
                              />
                              <span>⚠️ 스포일러 포함</span>
                            </label>
                          </fieldset></form>
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

      {/* 🎵 JUKEBOX.exe — 창을 닫아도 유지되는 플레이어 */}
      <div
        className={
          openWindow === "jukebox"
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
            : jukeboxActiveId !== null
              ? "fixed bottom-12 left-2 z-30"
              : "fixed bottom-12 left-2 z-30 invisible pointer-events-none"
        }
      >
        <div
          className={
            openWindow === "jukebox"
              ? "w-full max-w-lg h-[72dvh] max-h-[calc(100dvh-24px)] sm:h-auto sm:max-h-[85dvh] min-h-0 flex flex-col bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black"
              : "w-[140px] max-w-[45vw] sm:w-[200px] sm:max-w-[55vw] bg-[#c0c0c0] win-outset p-1 shadow-xl text-black"
          }
        >
          {/* 제목 표시줄 */}
          <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between gap-2 text-xs font-bold">
            <span className="flex items-center gap-1 min-w-0">
              <Image
                src="/icons/music.png"
                alt=""
                width={16}
                height={16}
                unoptimized
                className="object-contain"
              />
              <span className="truncate">
                {openWindow === "jukebox" ? "JUKEBOX.exe" : "🎵 재생 중"}
              </span>
            </span>
            {/* Windows 98 창 제어 버튼 */}

            <div className="flex items-center gap-1 shrink-0">
              {/* 최소화 / 복원 */}
              {openWindow === "jukebox" ? (
                <button
                  type="button"
                  onClick={() => setOpenWindow(null)}
                  className="win-btn text-black w-5 h-5 flex items-center justify-center text-xs"
                  aria-label="주크박스 최소화"
                  title="최소화"
                >
                  ─
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenWindow("jukebox")}
                  className="win-btn text-black w-5 h-5 flex items-center justify-center text-xs"
                  aria-label="주크박스 복원"
                  title="복원"
                >
                  □
                </button>
              )}

              {/* 닫기: 음악 정지 */}
              <button
                type="button"
                onClick={() => {
                  const player = jukeboxPlayerRef.current;

                  if (player && typeof player.stopVideo === "function") {
                    player.stopVideo();
                  }

                  jukeboxPendingRef.current = null;
                  jukeboxLoadedVideoRef.current = null;
                  jukeboxActiveIdRef.current = null;

                  setJukeboxActiveId(null);
                  setJukeboxPlaying(false);
                  setJukeboxError("");
                  setOpenWindow(null);
                }}
                className="win-btn text-black w-5 h-5 flex items-center justify-center text-xs font-bold"
                aria-label="주크박스 닫기"
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 유튜브 플레이어: 항상 같은 요소 유지 */}
          <div className="relative w-full aspect-video shrink-0 bg-black win-inset overflow-hidden">
            <div
              id="jukebox-youtube-player"
              className="absolute inset-0 w-full h-full"
            />

            {!jukeboxActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#171525] text-white text-xs text-center p-3 pointer-events-none">
                🎵 재생할 노래를 선택해 주세요.
              </div>
            )}
          </div>

          {/* 현재 재생 정보 */}
          {jukeboxActive && (
            <div className="px-2 py-1 text-[11px] bc-ost min-w-0">
              <p className="font-bold truncate">
                {jukeboxActive.ost_title} — {jukeboxActive.ost_artist}
              </p>
              {openWindow === "jukebox" && (
                <p className="text-gray-600 truncate">
                  📚 {jukeboxActive.title} · {jukeboxActive.user_name}
                </p>
              )}
            </div>
          )}

          {/* 주크박스 전체 창에서만 표시 */}
          {openWindow === "jukebox" && (
            <div data-bc-window="jukebox" role="dialog" aria-modal="true" tabIndex={-1} className="p-3 flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
              {jukeboxError && (
                <p
                  role="alert"
                  className="bg-white win-inset p-2 text-xs text-red-700"
                >
                  {jukeboxError}
                </p>
              )}

              {/* 이전 / 재생 / 다음 */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => jukeboxSkip(-1)}
                  disabled={jukeboxSongs.length === 0}
                  className="win-btn px-4 py-1.5 text-sm disabled:opacity-50"
                  aria-label="이전 곡"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  onClick={jukeboxTogglePlayback}
                  disabled={jukeboxSongs.length === 0}
                  className="win-btn px-5 py-1.5 text-sm disabled:opacity-50"
                  aria-label={jukeboxPlaying ? "일시정지" : "재생"}
                >
                  {jukeboxPlaying ? "⏸" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => jukeboxSkip(1)}
                  disabled={jukeboxSongs.length === 0}
                  className="win-btn px-4 py-1.5 text-sm disabled:opacity-50"
                  aria-label="다음 곡"
                >
                  ⏭
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="search"
                  value={jukeboxSearch}
                  onChange={(e) => setJukeboxSearch(e.target.value)}
                  placeholder="곡명 · 아티스트 · 책 · 작성자"
                  aria-label="OST 검색"
                  className="min-w-0 flex-1 bg-white win-inset px-2 py-1.5 text-xs outline-none"
                />

                <select
                  value={jukeboxSort}
                  onChange={(e) =>
                    setJukeboxSort(
                      e.target.value as "newest" | "oldest" | "title",
                    )
                  }
                  aria-label="OST 정렬"
                  className="win-inset bg-white px-1 text-xs"
                >
                  <option value="title">곡 제목순</option>
                  <option value="newest">최신순</option>
                  <option value="oldest">오래된순</option>
                </select>
              </div>

              <div className="text-xs font-bold">
                🎶 우리 모임 OST ({jukeboxSongs.length}곡)
              </div>

              <div className="bg-white win-inset flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                {jukeboxVisibleSongs.length === 0 ? (
                  <p className="text-center text-gray-500 text-xs py-6">
                    {jukeboxSongs.length === 0
                      ? "아직 등록된 OST가 없어요."
                      : "검색 결과가 없어요."}
                  </p>
                ) : (
                  jukeboxVisibleSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => jukeboxPlaySong(song)}
                      className={`w-full text-left p-2 border text-xs ${
                        jukeboxActiveId === song.id
                          ? "bc-ost-active"
                          : "bc-ost-row bg-[#f7f7f7] border-gray-300"
                      }`}
                    >
                      <p className="font-bold break-words">
                        {jukeboxActiveId === song.id ? "♫ " : "♪ "}
                        {song.ost_title} — {song.ost_artist}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-600 break-words">
                        📚 {song.title} · {song.user_name}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveNotice />
      {bookClose.confirmation}{planClose.confirmation}
      {/* --- 모달 창들 --- */}

      {/* 1. 도서 등록 모달 (book-add) */}
      {openWindow === "book-add" && (
        <div data-bc-window="book-add" role="dialog" aria-modal="true" tabIndex={-1} className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>{editingId ? "EDITING_BOOK.exe" : "ADD_BOOK.exe"}</span>
              <button
                onClick={bookClose.requestClose}
                className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-3 space-y-2.5 bg-[#d4d8dc] win-inset overflow-y-auto m-1"
            >
              {sourcePlan && <p className="text-xs text-[#000080] break-words" role="status">📌 예고에서 기록하기 · {sourcePlan.plan.title}<br />저장이 성공하면 예고 이행이 반영됩니다.</p>}
              {planUnconfirmed && <p role="alert" className="text-xs text-red-800">저장 응답을 확인하지 못했어요. 입력 내용을 유지했습니다. ‘저장 결과 확인’을 누르면 같은 제출을 확인하며 중복 등록하지 않습니다.</p>}
              {duplicateReview && <DuplicateReviewNotice key={duplicateReview.id} title={duplicateReview.title} author={duplicateReview.author} view={() => {
                jumpToReview(duplicateReview.id, "review");
              }} />}
              <fieldset className="min-w-0 space-y-2.5" disabled={loading || planUnconfirmed}>
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  NAME (내 이름)
                </label>
                <input
                  type="text"
                  required
                  value={formData.user_name}
                  onChange={(e) =>
                    setFormData({ ...formData, user_name: e.target.value })
                  }
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                  placeholder="예: 지은"
                />
              </div>
              <div className="grid grid-cols-[minmax(0,7fr)_minmax(76px,3fr)] gap-2">
              <div className="min-w-0">
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  TITLE (제목)
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                  placeholder="제목 입력"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  AUTHOR (작가)
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                  placeholder="작가 이름"
                />
              </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    GENRE (장르)
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) =>
                      setFormData({ ...formData, genre: e.target.value })
                    }
                    className="w-full p-1 text-xs bg-white win-inset"
                  >
                    <option>소설</option>
                    <option>만화</option>
                    <option>웹툰</option>
                    <option>오디오드라마</option>
                    <option>팬픽</option>
                    <option>사회/과학</option>
                    <option>수필</option>
                    <option>실용</option>
                    <option>시</option>
                    <option>에세이</option>
                    <option>철학</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    평점
                  </label>
                  <select
                    value={formData.rating}
                    onChange={(e) =>
                      setFormData({ ...formData, rating: e.target.value })
                    }
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
                <ReviewEditor value={formData.review} onChange={review => setFormData({ ...formData, review })} />
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-700">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSpoiler}
                      onChange={(e) => setIsSpoiler(e.target.checked)}
                    />
                    <span>⚠️ 스포일러</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFavorite}
                      onChange={(e) => setIsFavorite(e.target.checked)}
                    />
                    <span>👑 인생작</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRevisit}
                      onChange={(e) => setIsRevisit(e.target.checked)}
                    />
                    <span>🔁 재주행</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">
                  📣 영업하기 (여러 명 선택 가능)
                </label>

                <div className="win-inset bg-white p-2 flex flex-wrap gap-x-3 gap-y-2">
                  {userList
                    .filter((user) => user !== "전체")
                    .map((user) => (
                      <label
                        key={user}
                        className="flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={targetMember.includes(user)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetMember((previous) => [
                                ...previous,
                                user,
                              ]);
                            } else {
                              setTargetMember((previous) =>
                                previous.filter((name) => name !== user),
                              );
                            }
                          }}
                        />
                        {user}
                      </label>
                    ))}
                </div>
              </div>
              {/* 🎵 JUKEBOX.exe — 리뷰 OST 등록 */}
              <div className="border-t border-gray-400 pt-3 space-y-2">
                <div className="text-[11px] font-bold bc-accent">
                  🎵 JUKEBOX OST (선택 사항)
                </div>

                <p className="text-[10px] text-gray-600 leading-relaxed">
                  이 책과 어울리는 노래를 등록해 주세요. 등록된 곡은 우리 모임
                  주크박스에 모여요!
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                    YOUTUBE URL (유튜브 링크)
                  </label>
                  <input
                    type="url"
                    value={formData.ost_youtube_url}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ost_youtube_url: e.target.value,
                      })
                    }
                    className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                      SONG (곡 제목)
                    </label>
                    <input
                      type="text"
                      value={formData.ost_title}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ost_title: e.target.value,
                        })
                      }
                      className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                      placeholder="노래 제목"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                      ARTIST (아티스트)
                    </label>
                    <input
                      type="text"
                      value={formData.ost_artist}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ost_artist: e.target.value,
                        })
                      }
                      className="w-full p-1.5 text-xs bg-white win-inset outline-none"
                      placeholder="가수 / 아티스트"
                    />
                  </div>
                </div>
              </div>
              </fieldset>
              <div className="flex gap-1 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-1.5 win-btn font-bold text-xs"
                >
                  {loading
                    ? "처리 중..."
                    : planUnconfirmed
                      ? "저장 결과 확인"
                      : editingId
                      ? "수정 완료"
                      : "입력 완료"}
                </button>
                <button
                  type="button"
                  onClick={bookClose.requestClose}
                  className="px-3 py-1.5 win-btn text-xs font-bold"
                >
                  닫기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 목표 트래커 (goals) */}
      {openWindow === "goals" && (
        <div data-bc-window="goals" role="dialog" aria-modal="true" tabIndex={-1} className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>🎯 GOALS_TRACKER.exe</span>
              <button
                onClick={() => { if (!goalSaving) setOpenWindow(null); }}
                className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-[#d4d8dc] win-inset m-1 overflow-y-auto space-y-3">
              <form
                onSubmit={handleGoalSubmit}
                className="space-y-2 text-xs bg-white p-2 win-inset"
              ><fieldset className="min-w-0 space-y-2" disabled={goalSaving}>
                <div className="font-bold text-[#000080] border-b pb-1">
                  내 목표 설정/수정
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="닉네임"
                    value={goalForm.user_name}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, user_name: e.target.value })
                    }
                    className="p-1 win-inset text-xs outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="목표 권수"
                    value={goalForm.target_count}
                    onChange={(e) =>
                      setGoalForm({ ...goalForm, target_count: e.target.value })
                    }
                    className="p-1 win-inset text-xs outline-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="목표 한마디 (예: 완독왕!)"
                  value={goalForm.message}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, message: e.target.value })
                  }
                  className="w-full p-1 win-inset text-xs outline-none"
                />
                <button
                  type="submit"
                  className="w-full py-1 win-btn text-xs font-bold"
                >
                  {goalSaving ? "저장 중..." : "목표 저장"}
                </button>
              </fieldset></form>

              <div className="space-y-1.5">
                {sortedGoals.map((g) => {
                  const readCount = getReadCount(g.user_name);
                  const actualPercent = Math.round(
                    (readCount / g.target_count) * 100,
                  );
                  const barPercent = Math.min(100, actualPercent);
                  return (
                    <div key={g.id} className="bg-white p-2 win-outset text-xs">
                      <div className="flex justify-between font-bold mb-1">
                        <span>{g.user_name}</span>
                        <span>
                          {readCount} / {g.target_count}권 ({actualPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 win-inset h-3 p-0.5">
                        <div
                          className="bg-[#000080] h-full"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                      {g.message && (
                        <div className="mt-2 text-[11px] text-gray-600 italic break-words">
                          💬 {g.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {openWindow === "mailbox" && selectedUser !== "전체" && (
        <div data-bc-window="mailbox" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mailbox-title"
            className="w-full max-w-lg bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[85dvh] text-black"
          >
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-xs font-bold">
              <span id="mailbox-title">BOOK CLUB 98 MAILBOX.exe</span>
              <button
                type="button"
                aria-label="우편함 닫기"
                onClick={() => setOpenWindow(null)}
                className="win-btn text-black px-1"
              >
                ✕
              </button>
            </div>
            <div className="p-2 text-xs flex flex-wrap gap-2 items-center">
              <strong>
                {selectedUser}의 우편함{" "}
                {mailStatus === "ready" && `(안 읽음 ${unreadMailCount})`}
              </strong>
              <select
                aria-label="알림 종류"
                value={mailFilter}
                onChange={(e) =>
                  setMailFilter(e.target.value as typeof mailFilter)
                }
                className="bg-white win-inset p-1"
              >
                <option value="all">전체</option>
                <option value="comment">댓글</option>
                <option value="mention">멘션</option>
                <option value="objection">이의 제기</option>
              </select>
              <select
                aria-label="알림 정렬"
                value={mailSort}
                onChange={(e) => setMailSort(e.target.value as typeof mailSort)}
                className="bg-white win-inset p-1"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
              <button
                type="button"
                onClick={() => void markAllMailRead()}
                disabled={
                  mailStatus !== "ready" ||
                  mailBusy !== null ||
                  unreadMailCount === 0
                }
                className="ml-auto win-btn px-2 py-1 whitespace-nowrap disabled:opacity-50"
              >
                {mailBusy === -1 ? "처리 중..." : "알림 전부 읽기"}
              </button>
            </div>
            <div
              className="bg-white win-inset m-1 p-2 overflow-y-auto min-h-0 space-y-2 text-xs"
              aria-live="polite"
            >
              {mailStatus === "loading" ? (
                <p>우편함을 불러오는 중...</p>
              ) : mailStatus === "error" ? (
                <div>
                  <p role="alert">우편함을 불러오지 못했습니다.</p>
                  <button
                    className="win-btn px-2 py-1 mt-2"
                    onClick={() => setMailReload((value) => value + 1)}
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : visibleMail.length === 0 ? (
                <p className="py-4 text-center text-gray-600">
                  알림이 없습니다.
                </p>
              ) : (
                visibleMail.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={mailBusy !== null}
                    onClick={() => void openMail(item)}
                    className={`w-full text-left p-2 win-inset break-words disabled:opacity-50 ${item.read_at ? "bg-gray-100 text-gray-700" : "bg-[#ffffe1] text-black"}`}
                  >
                    <div className="flex justify-between gap-2">
                      <strong>
                        {item.kind === "comment" ? "💬 댓글" : item.kind === "objection" ? "⚖️ 이의 제기" : "✉️ 영업 멘션"} ·{" "}
                        {item.sender}
                      </strong>
                      <span>{item.read_at ? "읽음" : "안 읽음"}</span>
                    </div>
                    <p className="font-bold text-[#000080] mt-1">
                      {item.book_title}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {item.preview.includes("(스포일러)")
                        ? "🔒 스포일러가 포함되어 있습니다. 원본에서 확인하세요."
                        : plainReview(item.preview)}
                    </p>
                    <time className="block mt-1 text-gray-600">
                      {new Date(item.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </time>
                  </button>
                ))
              )}
            </div>
            <div className="p-2 text-[11px] text-gray-700">
              알림을 누르면 읽음 처리되고 원본 리뷰가 열립니다. 읽은 알림도
              보관됩니다.
            </div>
          </div>
        </div>
      )}

      {/* 📌 독서 예고장 */}
      {openWindow === "reading-plan" && selectedUser !== "전체" && (
        <div data-bc-window="reading-plan" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-lg max-h-[85dvh] bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col text-black">
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-xs font-bold">
              <span>📌 COMING_SOON.exe - {selectedUser}의 예고장</span>
              <button
                type="button"
                onClick={planClose.requestClose}
                className="win-btn text-black px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 flex flex-col gap-2 overflow-y-auto min-h-0">
              <div className="text-xs font-bold">
                📢 다음에 읽을 작품 예고하기
              </div>

              <input disabled={planLoading || planWriteUnconfirmed}
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="작품 제목"
                className="w-full bg-white win-inset p-2 text-xs"
              />

              <input disabled={planLoading || planWriteUnconfirmed}
                value={planAuthor}
                onChange={(e) => setPlanAuthor(e.target.value)}
                placeholder="작가 이름"
                className="w-full bg-white win-inset p-2 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <select disabled={planLoading || planWriteUnconfirmed}
                  value={planGenre}
                  onChange={(e) => setPlanGenre(e.target.value)}
                  className="bg-white win-inset p-2 text-xs flex-1"
                >
                  {BOOK_GENRES.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[150px]">
                  {!planDate && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 z-10"
                    >
                      예정일 입력
                    </span>
                  )}

                  <input disabled={planLoading || planWriteUnconfirmed}
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    aria-label="읽을 예정일 입력"
                    className={`w-full bg-white win-inset p-2 text-xs text-black [color-scheme:light] ${
                      !planDate ? "[&::-webkit-datetime-edit]:opacity-0" : ""
                    }`}
                  />
                </div>
              </div>

              {/* 📅 날짜 선택사항 안내 */}
              <p className="mt-1 text-[10px] text-gray-600">
                💡 날짜는 선택하지 않아도 예고장을 등록할 수 있어요.
              </p>

              <button
                type="button"
                disabled={planLoading}
                onClick={() => void addReadingPlan()}
                className="win-btn px-3 py-2 text-xs font-bold disabled:opacity-50"
              >
                {planLoading ? "등록 중..." : planWriteUnconfirmed ? "저장 결과 확인" : "📌 예고장 등록"}
              </button>

              {planWriteUnconfirmed && <p role="alert" className="text-xs text-red-800">응답을 확인하지 못했어요. 입력은 유지했습니다. 저장 결과 확인을 누르면 같은 제출을 확인하며 중복 등록하지 않습니다.</p>}
              <div className="border-t border-gray-400 my-1" />

              <strong className="text-xs">
                📋 {selectedUser}의 독서 예고 목록
              </strong>

              {(plansFetching || reviewsFetching) && (
                <p className="text-xs text-gray-600" role="status">
                  예고장과 완독 여부를 확인하는 중...
                </p>
              )}
              {(plansError || reviewsError) && (
                <p className="text-xs text-red-700" role="alert">
                  {plansError || reviewsError}
                </p>
              )}
              {plansCanRender &&
                activeReadingPlans
                  .filter((plan) => plan.user_name === selectedUser)
                  .map((plan) => {
                    return (
                      <div
                        key={plan.id}
                        className="bg-white win-inset p-3 text-xs"
                      >
                        <div className="font-bold text-[#000080] break-words">
                          📖 {plan.title}
                        </div>

                        <div className="text-gray-600 mt-1">
                          {plan.author} · {plan.genre}
                        </div>

                        {plan.planned_date && (
                          <div className="mt-1">
                            📅 예정일: {plan.planned_date}{" "}
                            {planCountdown(plan.planned_date, newBadgeNow)}
                          </div>
                        )}

                        <div className="mt-2 font-bold text-orange-700">
                          ⏳ 예고 중
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                          <button type="button" onClick={() => void deleteReadingPlan(plan.id)} className="win-btn px-2 py-1 text-xs">삭제</button>
                          <button type="button" disabled={loading} onClick={() => fulfillReadingPlan(plan)} className="win-btn px-2 py-1 text-xs ml-auto">✅ 예고 이행하기</button>
                        </div>
                      </div>
                    );
                  })}

              {plansCanRender && !plansFetching &&
                !reviewsFetching &&
                !plansError &&
                !reviewsError &&
                activeReadingPlans.filter(
                  (plan) => plan.user_name === selectedUser,
                ).length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-4">
                    아직 등록된 독서 예고가 없습니다.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}

      {/* 4. 전체 댓글 (comments) */}
      {openWindow === "comments" && (
        <div data-bc-window="comments" role="dialog" aria-modal="true" tabIndex={-1} className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
          <div className="w-full max-w-md bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>💬 COMMENTS_BOARD.exe</span>
              <button
                onClick={() => setOpenWindow(null)}
                className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="p-2 bg-white win-inset m-1 overflow-y-auto space-y-1.5">
              {comments.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-4">
                  아직 작성된 댓글이 없습니다.
                </div>
              ) : (
                [...comments].reverse().map((c) => {
                  const targetBook = reviews.find((r) => r.id === c.book_id);
                  return (
                    <div
                      key={c.id}
                      className="w-full bg-gray-50 p-2 border border-gray-200 text-xs"
                    >
                      {/* 댓글 작성자 및 도서 제목 */}
                      <button
                        type="button"
                        onClick={() => jumpToReview(c.book_id)}
                        disabled={!targetBook}
                        className="w-full text-left flex justify-between font-bold text-gray-800 mb-1 hover:bg-blue-50 cursor-pointer disabled:cursor-default"
                      >
                        <span>{c.user_name}</span>
                        <span className="text-[#000080] truncate max-w-[150px] underline">
                          {targetBook ? targetBook.title : "삭제된 도서"}
                        </span>
                      </button>

                      {/* 스포일러 댓글 표시 */}
                      {c.content.startsWith("(스포일러)") &&
                      !revealedCommentSpoilers.includes(c.id) ? (
                        <button
                          type="button"
                          onClick={() => toggleCommentSpoiler(c.id)}
                          className="w-full text-left bg-gray-200 border border-dashed border-gray-400 px-2 py-1.5 text-gray-600 hover:bg-gray-300"
                        >
                          🔒 스포일러가 포함된 댓글입니다. 클릭하여 보기
                        </button>
                      ) : (
                        <div>
                          <p className="text-gray-700 break-all">
                            {c.content.replace(/^\(스포일러\)\s*/, "").trim()}
                          </p>

                          {c.content.startsWith("(스포일러)") && (
                            <button
                              type="button"
                              onClick={() => toggleCommentSpoiler(c.id)}
                              className="mt-1 text-[10px] text-blue-700 hover:underline"
                            >
                              🔒 다시 가리기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {openWindow === "quiz" && (
        <Suspense fallback={<PetPopup title="리뷰 퀴즈.exe" close={() => setOpenWindow(null)}><p role="status">퀴즈를 준비하는 중…</p></PetPopup>}>
        <ReviewQuizWindow
          key={groupName}
          groupName={groupName}
          rows={reviewsReadyGroup === groupName ? reviews : []}
          status={reviewsError ? "error" : reviewsReadyGroup === groupName ? "ready" : "loading"}
          onRetry={() => { void fetchReviews(); }}
          onClose={() => setOpenWindow(null)}
        />
        </Suspense>
      )}
      {diaryOpen && <PetDiary key={groupName} group={groupName} close={() => setDiaryOpen(false)} />}
      {secretNote.popup}
      {openWindow === "pets" && currentPet && idOpenFor === currentPet.id && canShowPetId(currentPet) && (
        <PetIdPopup pet={currentPet} close={() => setIdOpenFor(null)}
          sprite={<PetSprite pet={currentPet} size={76} />}
          colorVariant={PET_COLOR_ORDER[(currentPet.generation_number - 1) % PET_COLOR_ORDER.length] || currentPet.color_variant || "original"}
          snack={snacks.byId[String(currentPet.id)]} snackLoading={snacks.loading} snackError={snacks.error} snackRetry={snacks.retry}
          personality={personalities.byId[String(currentPet.id)]} personalityLoading={personalities.loading} personalityError={personalities.error} personalityRetry={personalities.retry}
          memento={mementos.byId[String(currentPet.id)]} loading={mementos.loading} error={mementos.error} retry={mementos.retry} />
      )}
      {openWindow === "pets" && archiveOpen && <PetPopup title="PET_ARCHIVE.exe — 역대 펫 기록" close={() => setArchiveOpen(false)} front>
                {petHistoryLoading ? <p className="mt-3 text-gray-600">기록을 불러오는 중...</p>
                  : petHistoryError ? <p className="mt-3 text-red-700">{petHistoryError}</p>
                  : <PetIdGallery pets={petHistory} renderCard={pet => (
                    <PetIdCard pet={pet} sprite={<PetSprite pet={pet} stage="adult" size={76} />}
                      colorVariant={PET_COLOR_ORDER[(pet.generation_number - 1) % PET_COLOR_ORDER.length] || pet.color_variant || "original"}
                      snack={snacks.byId[String(pet.id)]} snackLoading={snacks.loading} snackError={snacks.error}
                      farewell={farewells.byId[String(pet.id)]} farewellLoading={farewells.loading} farewellError={farewells.error}
                      personality={personalities.byId[String(pet.id)]} personalityLoading={personalities.loading} personalityError={personalities.error}
                      memento={mementos.byId[String(pet.id)]} loading={mementos.loading} error={mementos.error} />
                  )} />}
                {personalities.error && <button type="button" className="win-btn mt-2 px-2 py-1" onClick={personalities.retry}>성격 다시 확인</button>}
                {mementos.error && <button type="button" className="win-btn mt-2 px-2 py-1" onClick={mementos.retry}>애장품 다시 확인</button>}

                {snacks.error && <button type="button" className="win-btn mt-2 px-2 py-1" onClick={snacks.retry}>간식 다시 확인</button>}
                {farewells.error && <button type="button" className="win-btn mt-2 px-2 py-1" onClick={farewells.retry}>마지막 한마디 다시 확인</button>}
      </PetPopup>}
      {/* 🐾 PET.exe — 공동 펫 기본 화면 */}
      {openWindow === "pets" && (
        <div data-bc-window="pets" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md max-h-[85dvh] bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col text-black">
            {/* 제목 표시줄 */}
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
              <span>🐾 PET.exe</span>
              <button
                type="button"
                onClick={() => setOpenWindow(null)}
                className="win-btn text-black w-5 h-5 flex items-center justify-center"
                aria-label="펫 창 닫기"
              >
                ✕
              </button>
            </div>

            <div className="p-2 space-y-2 md:p-3 md:space-y-3 overflow-y-auto min-h-0">
              {/* 펫이 생활하는 방 */}
              <div className="relative bg-[#f5f0ff] win-inset h-[176px] md:h-56 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-x-0 bottom-0 h-12 bg-[#e3d9ef] border-t border-[#b8a7cd]" />
                <button type="button" onClick={() => setDiaryOpen(true)}
                  title="비밀 일기장" aria-label="PET_DIARY.exe 열기"
                  className="absolute bottom-0 right-1 z-10 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#000080]">
                  <Image src="/pets/deco/diary.png" alt="비밀 일기장" width={54} height={54} unoptimized />
                </button>
                {/* ✨ 성장 반짝임 */}
                {petGrowthEffect && currentPet && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                    <Image
                      src="/pets/deco/sparkle.png"
                      alt=""
                      width={180}
                      height={180}
                      unoptimized
                      className="pet-growth-sparkle"
                    />
                  </div>
                )}
                {petLoading && !currentPet ? (
                  <span className="text-xs">🐾 펫을 불러오는 중...</span>
                ) : petError ? (
                  <span className="text-xs text-red-700">
                    펫을 불러오지 못했어요.
                  </span>
                ) : !currentPet ? (
                  <div className="text-center space-y-3">
                    <p className="text-3xl">🥚</p>
                    <p className="text-xs font-bold">
                      아직 우리 모임의 펫이 없어요!
                    </p>
                    <button
                      type="button"
                      onClick={() => void adoptPetEgg()}
                      disabled={petAdopting}
                      className="win-btn px-4 py-2 text-xs font-bold"
                    >
                      {petAdopting ? "입양 중..." : "🥚 첫 알 입양하기"}
                    </button>
                  </div>
                ) : currentPet.stage === "dead" ? (
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                      <Image
                        src="/pets/deco/grave.png"
                        alt="펫의 묘비"
                        width={150}
                        height={150}
                        unoptimized
                        className="block object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      currentPet.stage === "egg"
                        ? "relative z-20 flex flex-col items-center gap-2"
                        : "absolute inset-x-0 bottom-5 z-20 h-[170px] pointer-events-none"
                    }
                  >
                    {currentPet.stage === "egg" ? (
                      <div className="scale-[0.7333] md:scale-100">
                        <PetSprite
                          pet={currentPet}
                          size={150}
                          className={
                            petCareAction === "feed"
                              ? "pet-egg-excited"
                              : "pet-egg-bounce"
                          }
                        />
                      </div>
                    ) : (
                      <div
                        className={
                          petCareAction ||
                          (miniPetSleeping && miniPet?.id === currentPet.id)
                            ? "absolute bottom-0 left-1/2 -translate-x-1/2"
                            : "pet-room-walk"
                        }
                      >
                        <div className="relative scale-[0.7333] md:scale-100 origin-bottom">
                          <PetSprite
                            pet={currentPet}
                            size={150}
                            eating={petCareAction === "feed"}
                            happy={happyPetId === currentPet.id}
                            sleeping={
                              miniPetSleeping &&
                              miniPet?.id === currentPet.id &&
                              !petCareAction &&
                              happyPetId !== currentPet.id
                            }
                            className={
                              petCareAction ||
                              (miniPetSleeping && miniPet?.id === currentPet.id)
                                ? ""
                                : "mini-pet-hop"
                            }
                          />

                          {/* 😴 큰 펫 수면 효과 */}
                          {miniPetSleeping &&
                            miniPet?.id === currentPet.id &&
                            !petCareAction &&
                            happyPetId !== currentPet.id && (
                              <Image
                                src="/pets/deco/zzz.png"
                                alt=""
                                aria-hidden="true"
                                width={45}
                                height={45}
                                unoptimized
                                className="absolute -top-3 right-0 pointer-events-none"
                              />
                            )}
                        </div>
                      </div>
                    )}

                    {petCareAction === "pet" && (
                      <Image
                        src="/pets/deco/heart.png"
                        alt=""
                        aria-hidden="true"
                        width={38}
                        height={38}
                        unoptimized
                        className="pointer-events-none absolute top-0 right-2 z-20 pet-heart-float"
                      />
                    )}
                    {petCareAction && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="absolute bottom-2 left-2 right-2 z-30 bg-white border-2 border-[#9b477e] px-2 py-2 text-center text-xs font-bold text-[#9b477e] shadow-md"
                      >
                        {petCareAction === "feed"
                          ? currentPet.stage === "egg"
                            ? "🥚 알을 보살피는 중..."
                            : "🍪 먹이를 주는 중..."
                          : "💗 쓰다듬는 중..."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 🥚 사망 후 다음 세대 입양 */}
              {currentPet?.stage === "dead" && (
                <button
                  type="button"
                  onClick={() => void adoptPetEgg()}
                  disabled={petAdopting}
                  className="win-btn w-full px-3 py-2 text-xs font-bold"
                >
                  {petAdopting ? "입양 중..." : "🥚 새로운 알 입양하기"}
                </button>
              )}

              {/* 🐾 성인 일차 계산: 성인이 된 순간부터 24시간 단위 */}
              {/* 상태 정보 */}
              {currentPet && (
                <div className="bg-white win-inset p-2 text-xs space-y-1.5 md:p-3 md:space-y-2">
                  <div className="flex justify-between items-start font-bold">
                    <div className="min-w-0">
                      <div>
                        {currentPet.generation_number}세대 ·{" "}
                        {PET_SPECIES_NAMES[currentPet.species] ||
                          currentPet.species}
                      </div>

                      {currentPet.pet_name && (
                        <div
                          className="mt-1 text-sm text-[#800080] whitespace-nowrap overflow-x-auto max-w-full"
                          title={
                            careTimesError || "기록된 돌봄 시각만 표시합니다."
                          }
                        >
                          <PetNameplate name={currentPet.pet_name} />
                          {(() => {
                            const times = careTimes[currentPet.id];
                            const labels = [
                              times?.feed && careAgo(times.feed, newBadgeNow)
                                ? `🍪 ${careAgo(times.feed, newBadgeNow)}`
                                : "",
                              times?.pet && careAgo(times.pet, newBadgeNow)
                                ? `💗 ${careAgo(times.pet, newBadgeNow)}`
                                : "",
                            ].filter(Boolean);
                            return labels.length ? (
                              <span
                                className="ml-1 text-[9px] whitespace-nowrap"
                                title="모임 전체 회원의 마지막 돌봄"
                              >
                                ({labels.join(" · ")})
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 ml-2 flex flex-col items-end gap-0.5">
                    <span>
                      {currentPet.stage === "adult" && currentPet.adult_at
                        ? `✨ 성인 ${Math.max(
                            1,
                            Math.floor(
                              (Date.now() -
                                new Date(currentPet.adult_at).getTime()) /
                                (24 * 60 * 60 * 1000),
                            ) + 1,
                          )}일차`
                        : {
                            egg: "🥚 알",
                            baby: "🐣 아기",
                            teen: "🌱 청소년",
                            adult: "✨ 성인",
                            dead: "🪦 무지개다리",
                          }[currentPet.stage]}
                    </span>
                    {canShowPetId(currentPet) && <button type="button" onClick={() => setIdOpenFor(currentPet.id)}
                      className="win-btn h-[22px] px-2 text-xs leading-none font-bold text-black whitespace-nowrap" aria-label="현재 펫 신분증 열기">신분증</button>}
                    </div>
                  </div>

                  {currentPet.stage !== "dead" ? (
                    <>
                      <div className="flex justify-between text-gray-700">
                        <span>성장 경험치</span>
                        <span>
                          {currentPet.xp} /{" "}
                          {currentPet.stage === "egg"
                            ? 50
                            : currentPet.stage === "baby"
                              ? 150
                              : currentPet.stage === "teen"
                                ? 350
                                : "MAX"}{" "}
                          XP
                        </span>
                      </div>

                      <div className="w-full h-4 bg-gray-200 win-inset p-0.5">
                        <div
                          className="h-full bg-[#000080]"
                          style={{
                            width: `${
                              currentPet.stage === "adult"
                                ? 100
                                : currentPet.stage === "egg"
                                  ? Math.min(100, (currentPet.xp / 50) * 100)
                                  : currentPet.stage === "baby"
                                    ? Math.min(
                                        100,
                                        ((currentPet.xp - 50) / 100) * 100,
                                      )
                                    : Math.min(
                                        100,
                                        ((currentPet.xp - 150) / 200) * 100,
                                      )
                            }%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600">
                      최종 경험치: {currentPet.xp} XP
                    </p>
                  )}
                </div>
              )}

              {/* 🐣 이름이 없는 펫의 작명 요청 */}
              {currentPet &&
                (petNamingPreview ||
                  (currentPet.stage !== "egg" &&
                    currentPet.stage !== "dead" &&
                    !currentPet.pet_name)) && (
                  <div className="bg-[#fff4d9] win-inset p-3 text-xs space-y-2">
                    <p className="font-bold text-[#7a4200]">
                      🔔 아기가 태어났어요! 이름을 지어주세요.
                    </p>

                    <p className="text-gray-700">
                      이름을 먼저 등록한 회원이 작명자가 돼요.
                    </p>

                    <input
                      type="text"
                      value={petNameInput}
                      onChange={(e) => setPetNameInput(e.target.value)}
                      maxLength={20}
                      placeholder="아기 이름을 입력해 주세요"
                      className="w-full bg-white win-inset p-2 text-xs"
                    />

                    <p className="text-gray-600">
                      작명자:{" "}
                      {userList.includes(petCaretaker)
                        ? petCaretaker
                        : "아래에서 돌보는 사람을 선택해 주세요"}
                    </p>

                    <button
                      type="button"
                      onClick={() => void nameBabyPet()}
                      disabled={
                        petNamingBusy ||
                        !petNameInput.trim() ||
                        !userList.includes(petCaretaker)
                      }
                      className="win-btn w-full py-2 font-bold disabled:opacity-50"
                    >
                      {petNamingBusy
                        ? "이름 등록 중..."
                        : "💗 이 이름으로 정하기"}
                    </button>

                    {petNamingError && (
                      <p role="alert" className="text-red-700">
                        {petNamingError}
                      </p>
                    )}
                  </div>
                )}

              {/* 🐾 돌보는 사람 선택 */}
              <div className="bg-white win-inset p-2 text-xs space-y-1 md:space-y-2">
                <label
                  htmlFor="pet-caretaker"
                  className="block font-bold text-[#000080]"
                >
                  🐾 돌보는 사람
                </label>

                {/* 📱 아이폰·안드로이드·PC 공통 Win98 드롭다운 */}
                <div className="relative w-full min-w-0">
                  <select
                    id="pet-caretaker"
                    value={userList.includes(petCaretaker) ? petCaretaker : ""}
                    onChange={(e) => {
                      setPetCaretaker(e.target.value);
                      localStorage.setItem(
                        `pet_caretaker_${groupName}`,
                        e.target.value,
                      );
                    }}
                    className="block w-full min-w-0 appearance-none rounded-none bg-white win-inset pl-2 pr-9 py-2 text-xs text-black outline-none"
                  >
                    <option value="">닉네임을 선택해 주세요</option>

                    {userList
                      .filter((user) => user !== "전체")
                      .map((user) => (
                        <option key={user} value={user}>
                          {user}
                        </option>
                      ))}
                  </select>

                  {/* ▼ 윈도우 98 스타일 화살표 */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none win-btn w-6 h-6 flex items-center justify-center text-black">
                    <span className="text-[11px] leading-none">▼</span>
                  </div>
                </div>
              </div>

              {/* 🐾 실제 돌보기 버튼 */}
              <div className="space-y-1 md:space-y-2">
                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                  <button
                    type="button"
                    onClick={() => void doPetCare("feed")}
                    disabled={
                      !currentPet ||
                      currentPet.stage === "dead" ||
                      !userList.includes(petCaretaker) ||
                      petCareLoading ||
                      petCareBusy ||
                      !!petCareError ||
                      petCareCounts.feed >= 3
                    }
                    className="win-btn py-1 px-1 md:py-2 text-xs font-bold disabled:opacity-50"
                  >
                    <div>
                      {currentPet?.stage === "egg"
                        ? "🥚 알 보살피기"
                        : "🍪 먹이 주기"}
                    </div>
                    <div className="mt-1 font-normal">
                      {petCareLoading
                        ? "확인 중..."
                        : `남은 횟수 ${Math.max(0, 3 - petCareCounts.feed)}/3`}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void doPetCare("pet")}
                    disabled={
                      !currentPet ||
                      currentPet.stage === "dead" ||
                      !userList.includes(petCaretaker) ||
                      petCareLoading ||
                      petCareBusy ||
                      !!petCareError ||
                      petCareCounts.pet >= 5
                    }
                    className="win-btn py-2 px-1 text-xs font-bold disabled:opacity-50"
                  >
                    <div>💗 쓰다듬기</div>
                    <div className="mt-1 font-normal">
                      {petCareLoading
                        ? "확인 중..."
                        : `남은 횟수 ${Math.max(0, 5 - petCareCounts.pet)}/5`}
                    </div>
                  </button>
                </div>

                {!petCaretaker && (
                  <p className="text-center text-xs text-gray-600">
                    돌보는 사람의 닉네임을 먼저 선택해 주세요.
                  </p>
                )}

                {petCareError && (
                  <div className="space-y-1 text-center">
                    <p className="text-xs text-red-700">{petCareError}</p>
                    <button
                      type="button"
                      className="win-btn px-3 py-1 text-xs"
                      onClick={() => {
                        setPetCareError("");
                        petMemory.invalidate(groupName);
                        setPetReload((value) => value + 1);
                      }}
                    >
                      다시 불러오기
                    </button>
                  </div>
                )}
              </div>

              {/* 도움말 */}
              <details className="bg-white win-inset p-2 text-xs">
                <summary className="cursor-pointer font-bold">
                  📖 PET.exe 도움말
                </summary>
                <div className="mt-2 space-y-1 text-gray-700">
                  <p>리뷰 작성 +10 XP</p>
                  <p>댓글 작성 +3 XP</p>
                  <p>영업 멘션 +5 XP</p>
                  <p>독서 예고장 +3 XP</p>
                  <p>예고 이행 +15 XP</p>
                  <p>먹이 주기 +2 XP (하루 3회)</p>
                  <p>쓰다듬기 +1 XP (하루 5회)</p>
                  <p className="pt-1 border-t">
                    50 XP 아기 · 150 XP 청소년 · 350 XP 성인
                  </p>
                  <p>성인이 된 뒤 14일간 함께 생활해요.</p>
                </div>
              </details>

              {/* 🪦 역대 펫 기록 — 별도 창으로 열기 */}
              <button type="button" className="w-full text-left bg-white win-inset p-2 text-xs font-bold" onClick={() => setArchiveOpen(true)}>
                🪦 역대 펫 기록{petHistory.length > 0 && ` (${petHistory.length}마리)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✉️ 전체 회원 독서 예고장 모아보기 */}
      {showAllPlans && (
        <div data-bc-window="all-plans" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md max-h-[80dvh] flex flex-col bg-[#c0c0c0] win-outset p-1 shadow-2xl text-black">
            {/* 제목 표시줄 */}
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold shrink-0">
              <span>✉️ NOTICE.exe — 독서 예고장</span>

              <button
                type="button"
                onClick={() => setShowAllPlans(false)}
                className="win-btn text-black w-5 h-5 flex items-center justify-center"
                aria-label="예고장 닫기"
              >
                ✕
              </button>
            </div>

            <p className="text-xs px-2 pt-3 pb-2 shrink-0">
              📬 우리 모임의 독서 예고장을 모아봤어요!
            </p>

            {/* 예고장 목록만 스크롤 */}
            <div className="bg-white win-inset mx-2 mb-2 p-2 flex-1 min-h-0 overflow-y-auto space-y-2">
              {(plansFetching || reviewsFetching) && (
                <p className="text-xs text-gray-600" role="status">
                  예고장과 완독 여부를 확인하는 중...
                </p>
              )}
              {(plansError || reviewsError) && (
                <p className="text-xs text-red-700" role="alert">
                  {plansError || reviewsError}
                </p>
              )}
              {plansCanRender &&
                (activeReadingPlans.length > 0 || (!plansFetching && !reviewsFetching && !plansError && !reviewsError)) &&
                (activeReadingPlans.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 py-8">
                    아직 등록된 예고장이 없어요.
                  </p>
                ) : (
                  Array.from(
                    new Set(activeReadingPlans.map((plan) => plan.user_name)),
                  ).map((userName) => (
                    <div key={userName} className="space-y-2">
                      {/* 회원별 제목 */}
                      <div className="bc-ost border-b px-2 py-1.5 text-xs font-bold text-[#000080]">
                        ✉️ {userName}의 예고
                      </div>

                      {/* 해당 회원이 등록한 예고장 */}
                      {activeReadingPlans
                        .filter((plan) => plan.user_name === userName)
                        .map((plan) => (
                          <div
                            key={plan.id}
                            className="border border-gray-300 bg-[#f8f6fc] p-3 text-xs"
                          >
                            <p className="font-bold">📖 {plan.title}</p>

                            <p className="mt-1 text-gray-700">
                              ✍️ {plan.author}
                            </p>

                            <p className="mt-1 text-gray-600">
                              🏷️ {plan.genre}
                            </p>

                            {plan.planned_date && (
                              <p className="mt-1 text-gray-600">
                                📅 {plan.planned_date}{" "}
                                {planCountdown(plan.planned_date, newBadgeNow)}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ))
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. 나머지 신규 기능 플레이스홀더 창 */}
      {openWindow &&
        ![
          "mailbox",
          "reading-plan",
          "book-add",
          "stats",
          "goals",
          "comments",
          "graveyard",
          "tags",
          "genre",
          "vending",
          "curation",
          "versus",
          "awards",
          "sales",
          "quiz",
          "bingo",
          "pets",
          "jukebox",
        ].includes(openWindow) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/50">
            <div className="w-full max-w-sm bg-[#c0c0c0] win-outset p-1 shadow-2xl flex flex-col">
              <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex items-center justify-between text-xs font-bold">
                <span>
                  {APP_LIST.find((a) => a.id === openWindow)?.name}.exe
                </span>
                <button
                  onClick={() => setOpenWindow(null)}
                  className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]"
                >
                  ✕
                </button>
              </div>
              <div className="bg-white win-inset p-6 my-2 text-xs flex flex-col items-center justify-center text-center space-y-2">
                <div className="relative w-12 h-12">
                  <Image
                    src={
                      APP_LIST.find((a) => a.id === openWindow)?.icon ||
                      "/icons/start-logo.png"
                    }
                    alt=""
                    fill
                    className="object-contain"
                  />
                </div>
                <p className="font-bold text-sm">
                  {APP_LIST.find((a) => a.id === openWindow)?.name}
                </p>
                <p className="text-gray-600">
                  이 기능의 세부 모듈 화면을 준비 중입니다!
                </p>
              </div>
              <div className="flex justify-end p-1">
                <button
                  onClick={() => setOpenWindow(null)}
                  className="win-btn px-4 py-1 text-xs font-bold"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

      {/* 🪦 단두대 / 하차 묘지 (GRAVEYARD.exe) */}
      {openWindow === "graveyard" && (
        <div data-bc-window="graveyard" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-gray-800 to-gray-600 text-white font-bold text-xs select-none">
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
                <p className="font-bold text-gray-900">
                  ⚰️ 영면한 작품들의 안식처
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  취향에 맞지 않아 중도에 멈춘 작품과 모임원들의 마지막 한마디를
                  보관합니다.
                </p>
              </div>
              <span className="bg-gray-800 text-white px-2 py-1 rounded text-[11px] font-mono">
                총 {reviews.filter((r) => r.rating === "중도하차").length}작품
                안치됨
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
                        "
                        <SpoilerReviewText
                          text={book.review || "말없이 덮었습니다..."}
                        />
                        "
                      </div>

                      {/* 하차자 및 기록일 */}
                      <div className="flex justify-between items-center text-xs text-gray-300 pt-2 border-t border-gray-700 font-mono">
                        <span>
                          하차자:{" "}
                          <strong className="text-white font-bold ml-1">
                            {book.user_name}
                          </strong>
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {book.created_at?.split("T")[0] || ""}
                        </span>
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
        <div data-bc-window="tags" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-teal-900 to-teal-700 text-white font-bold text-xs select-none">
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
                    <p className="font-bold text-gray-900">
                      🔖 한줄평 자동 추출 키워드
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      리뷰에 남긴 #키워드를 클릭하면 연관된 작품들만 모아볼 수
                      있습니다.
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
                    <div className="py-12 text-center text-gray-400 text-xs">
                      해당 키워드의 작품이 없습니다.
                    </div>
                  ) : (
                    taggedReviews.map((book) => (
                      <div
                        key={book.id}
                        className="p-3 border border-gray-300 bg-gray-50 hover:bg-teal-50/40 rounded transition-colors"
                      >
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-bold text-sm text-gray-900">
                            {book.title}
                          </span>
                          <span className="text-xs text-amber-700 font-bold">
                            {book.rating}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mb-2">
                          {book.author || "미상"} · {book.genre} · 작성자:{" "}
                          <strong className="text-gray-700">
                            {book.user_name}
                          </strong>
                        </div>
                        <div className="text-xs bg-white p-2 rounded border border-dashed border-gray-300 text-gray-800 break-keep">
                          <SpoilerReviewText
                            text={book.review || "작성된 감상평이 없습니다."}
                          />
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
                      한줄평에 작성된 #키워드가 아직 없습니다.
                      <br />
                      (예: #후회공, #구원서사, #재주행필수 등)
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center justify-center p-4">
                      {tagCounts.map(([tag, count]) => {
                        const fontSizeClass =
                          count >= 5
                            ? "text-base font-black text-teal-900"
                            : count >= 3
                              ? "text-sm font-bold text-teal-800"
                              : count >= 2
                                ? "text-xs font-bold text-teal-700"
                                : "text-xs font-medium text-gray-700";

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTag(tag)}
                            className={`win-btn px-2.5 py-1 flex items-center gap-1 shrink-0 whitespace-nowrap ${fontSizeClass}`}
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
        <div data-bc-window="genre" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-lg bg-[#c0c0c0] p-1 flex flex-col max-h-[85vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-blue-900 to-indigo-700 text-white font-bold text-xs select-none">
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
                <p className="font-bold text-gray-900">
                  🧬 덕질 영양소 & 편식 분석
                </p>
                <p className="text-[11px] text-gray-500">
                  {genreUser === "전체" ? "모임 전체" : `${genreUser} 님`}의
                  장르 소비 밸런스입니다.
                </p>
              </div>

              {/* 대상 선택 셀렉트 박스 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-700">
                  분석 대상:
                </span>
                <select
                  value={genreUser}
                  onChange={(e) => setGenreUser(e.target.value)}
                  className="win-inset bg-white text-xs px-2 py-0.5 font-bold outline-none cursor-pointer"
                >
                  <option value="전체">전체 모임원</option>
                  {Array.from(new Set(reviews.map((r) => r.user_name)))
                    .filter(Boolean)
                    .map((name) => (
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
                      {genreStats.dominant &&
                      genreStats.dominant.percent >= 60 ? (
                        <span className="text-red-600 ml-1">
                          심각한 '{genreStats.dominant.genre}' 편식 상태!
                        </span>
                      ) : genreStats.dominant &&
                        genreStats.dominant.percent >= 40 ? (
                        <span className="text-amber-700 ml-1">
                          안정적인 '{genreStats.dominant.genre}' 중심 성향
                        </span>
                      ) : (
                        <span className="text-emerald-700 ml-1">
                          골고루 즐기는 잡식형 독서가
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      {genreUser === "전체" ? "모임에서" : `${genreUser} 님이`}{" "}
                      가장 애호하는 장르는{" "}
                      <strong>{genreStats.dominant?.genre}</strong>(
                      {genreStats.dominant?.percent}%)이며, 총{" "}
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
                        <span className="text-[10px] text-gray-400 font-bold">
                          TOTAL
                        </span>
                        <span className="text-xs font-black text-gray-800">
                          {genreStats.total}
                        </span>
                      </div>
                    </div>

                    {/* 범례 리스트 */}
                    <div className="space-y-1.5 text-xs w-full sm:w-auto">
                      {genreStats.items.map((item) => (
                        <div
                          key={item.genre}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-sm inline-block shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-gray-700 w-24 truncate">
                            {item.genre}
                          </span>
                          <span className="font-bold text-gray-900">
                            {item.count}편
                          </span>
                          <span className="text-gray-400 font-mono text-[11px]">
                            ({item.percent}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 장르별 비율 프로그레스 바 목록 */}
                  <div className="space-y-2.5 pt-2 border-t border-gray-200 text-xs">
                    <div className="font-bold text-gray-700 mb-1">
                      상세 점유율
                    </div>
                    {genreStats.items.map((item) => (
                      <div key={item.genre} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-gray-800">
                            {item.genre}
                          </span>
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
      {vendingVisited && <Suspense fallback={openWindow === "vending" ? <PetPopup title="VENDING.exe" close={() => setOpenWindow(null)}><p role="status">자판기를 준비하는 중…</p></PetPopup> : null}><VendingWindow key={groupName} active={openWindow === "vending"} reviews={reviews} tagCounts={tagCounts} onClose={() => setOpenWindow(null)} /></Suspense>}


      {/* 💖 취향 도플갱어 매칭기 (SOULMATE.exe) */}
      {openWindow === "curation" && (
        <div data-bc-window="curation" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-md bg-[#c0c0c0] p-1 flex flex-col shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-pink-900 to-rose-700 text-white font-bold text-xs select-none">
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
                <p className="font-bold text-gray-900">
                  🧬 5점 만점 싱크로율 분석
                </p>
                <p className="text-[11px] text-gray-500">
                  인생작이 겹치는 영혼의 메이트를 찾습니다.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-gray-600">
                  기준:
                </span>
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
                      <strong>{soulmateData.currentUser}</strong> 님의 최애
                      인생작을 가장 많이 공유한 메이트는{" "}
                      <strong className="text-rose-700">
                        {soulmateData.bestMate}
                      </strong>{" "}
                      님입니다!
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
                        아직 완벽하게 겹치는 5점 만점 작품이 없습니다.
                        <br />
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
        <div data-bc-window="versus" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[88vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-red-800 via-purple-900 to-blue-900 text-white font-bold text-xs select-none">
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
                <p className="font-bold text-gray-900">
                  🥊 극과 극 취향 대격돌 존
                </p>
                <p className="text-[11px] text-gray-500">
                  모임원 간 평점 편차가 가장 큰 뜨거운 감자를 소환했습니다.
                </p>
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
                  현재 2명 이상 평가가 엇갈린 논쟁작이 없습니다.
                  <br />
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
                      {battleData.author || "미상"} · {battleData.genre} | 평균
                      ★ {battleData.avgScore}
                    </div>

                    <div className="mt-2 inline-flex items-center gap-3 bg-black/40 px-3 py-1 rounded-full text-xs font-bold border border-gray-700">
                      <span className="text-rose-400">
                        극호 진영 {battleData.proReviews.length}명
                      </span>
                      <span className="text-yellow-400 font-black">VS</span>
                      <span className="text-sky-400">
                        불호 진영 {battleData.conReviews.length}명
                      </span>
                    </div>
                  </div>

                  {/* 1:1 진영 코멘트 대결 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* 🔴 찬성(극호) 진영 */}
                    <div className="bg-rose-50 border-2 border-rose-300 p-2.5 rounded flex flex-col shadow-sm">
                      <div className="flex justify-between items-center pb-1.5 border-b border-rose-200 mb-2 font-bold text-rose-800">
                        <span>🔥 극호 진영 (인생작/찬양)</span>
                        <span className="text-[11px] font-mono">
                          {battleData.proReviews.length}건
                        </span>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                        {battleData.proReviews.length === 0 ? (
                          <p className="text-[11px] text-gray-400 py-4 text-center">
                            찬양파가 침묵 중입니다.
                          </p>
                        ) : (
                          battleData.proReviews.map((r) => (
                            <div
                              key={r.id}
                              className="bg-white p-2 rounded border border-rose-200 shadow-xs"
                            >
                              <div className="flex justify-between text-[11px] mb-1 font-bold">
                                <span className="text-rose-900">
                                  {r.user_name}
                                </span>
                                <span className="text-amber-600">
                                  {r.rating}
                                </span>
                              </div>
                              <p className="text-gray-800 text-[11px] leading-snug break-keep">
                                "
                                <SpoilerReviewText
                                  text={r.review || "말이 필요 없는 명작"}
                                />
                                "
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
                        <span className="text-[11px] font-mono">
                          {battleData.conReviews.length}건
                        </span>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                        {battleData.conReviews.length === 0 ? (
                          <p className="text-[11px] text-gray-400 py-4 text-center">
                            불호파가 침묵 중입니다.
                          </p>
                        ) : (
                          battleData.conReviews.map((r) => (
                            <div
                              key={r.id}
                              className="bg-white p-2 rounded border border-sky-200 shadow-xs"
                            >
                              <div className="flex justify-between text-[11px] mb-1 font-bold">
                                <span className="text-sky-900">
                                  {r.user_name}
                                </span>
                                <span className="text-gray-600">
                                  {r.rating}
                                </span>
                              </div>
                              <p className="text-gray-800 text-[11px] leading-snug break-keep">
                                "
                                <SpoilerReviewText
                                  text={r.review || "저와는 맞지 않았습니다..."}
                                />
                                "
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
                        <span>
                          ⚖️ 팝콘 뜯는 중립 지대 (3.0~3.5점 무난/평타)
                        </span>
                        <span className="text-[11px] font-mono text-gray-500">
                          {battleData.neutralReviews.length}명
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {battleData.neutralReviews.map((r) => (
                          <div
                            key={r.id}
                            className="bg-white p-2 rounded border border-gray-200 flex justify-between items-start gap-2"
                          >
                            <div className="flex-1">
                              <span className="font-bold text-gray-800 text-[11px] mr-1.5">
                                {r.user_name}
                              </span>
                              <span className="text-gray-700 text-[11px]">
                                "
                                <SpoilerReviewText
                                  text={r.review || "무난하게 읽었습니다."}
                                />
                                "
                              </span>
                            </div>
                            <span className="text-gray-500 font-bold text-[11px] shrink-0">
                              {r.rating}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 하단 전체 평가자 리스트 */}
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600">
                    <span className="font-bold text-gray-800 mr-2">
                      📌 전체 참여자 별점:
                    </span>
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
        <div data-bc-window="awards" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full max-w-2xl bg-[#c0c0c0] p-1 flex flex-col max-h-[88vh] shadow-2xl">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1 bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-900 text-white font-bold text-xs select-none">
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
                <p className="font-bold text-amber-950">
                  📜 {groupName} 정기 명예 결산
                </p>
                <p className="text-[11px] text-amber-800">
                  모임원들의 감상 기록을 자동 통계 처리하여 레트로 상장을
                  수여합니다.
                </p>
              </div>
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
                          <div className="text-[11px] text-gray-600">
                            수여자:
                          </div>
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
                          <span className="text-red-700 font-bold border border-red-700 px-1 py-0.5 rounded text-[11px] bg-red-50">
                            직인생략 [인]
                          </span>
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
        <div data-bc-window="sales" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="win-box w-full min-w-0 max-w-xl bg-[#c0c0c0] p-1 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar win-title flex justify-between items-center px-2 py-1.5 bg-gradient-to-r from-orange-800 via-amber-700 to-yellow-800 text-white font-bold text-xs select-none">
              <span className="flex items-center gap-1.5">
                <span className="text-base">📢</span>
                <span className="text-xs">
                  SALES.exe - 긴급 편성! 강제 영업 확성기
                </span>
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
            <div className="p-4 bg-gray-200 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start">
              {salesReviews.length === 0 ? (
                <div className="bg-white p-8 win-inset text-center text-xs text-gray-600 w-full space-y-2">
                  <p className="text-2xl">📭</p>
                  <p className="font-bold text-sm text-gray-800">
                    아직 접수된 강제 영업작이 없습니다.
                  </p>
                  <p className="text-xs text-gray-500">
                    인생작(👑)을 체크하거나 5점(★★★★★) 만점 리뷰를 남겨 첫
                    영업을 시작해보세요!
                  </p>
                </div>
              ) : (
                (() => {
                  const currentSale =
                    salesReviews[salesIndex % salesReviews.length];
                  return (
                    <div className="w-full min-w-0 max-w-full shrink-0 bg-[#fffef0] border-4 border-dashed border-orange-500 p-3 sm:p-5 rounded-lg shadow-xl relative flex flex-col justify-between min-h-[360px] win-outset">
                      {/* 엽서 상단 스탬프 & 번호 */}
                      <div>
                        <div className="flex justify-between items-center pb-2 border-b-2 border-orange-200">
                          <span className="bg-orange-600 text-white text-xs font-black px-2 py-0.5 rounded tracking-wide">
                            🔥 필 독 권 고
                          </span>
                          <span className="font-mono text-xs font-bold text-gray-600">
                            엽서 {(salesIndex % salesReviews.length) + 1} /{" "}
                            {salesReviews.length}
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
                            {currentSale.author
                              ? `${currentSale.author} 저`
                              : "작가 미상"}{" "}
                            | 영업 사원:{" "}
                            <strong className="text-orange-900 font-bold text-sm">
                              {currentSale.user_name}
                            </strong>
                          </p>
                        </div>

                        {/* 영업 한줄평 엽서 본문 */}
                        <div className="mt-3 min-w-0 max-w-full bg-white p-3.5 rounded border border-orange-300 win-inset">
                          <div className="text-xs font-bold text-orange-800 mb-1">
                            💬 영업 사원의 절규:
                          </div>
                          <p className="text-sm font-medium text-gray-900 leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                            "<SpoilerReviewText text={currentSale.review} />"
                          </p>
                        </div>
                      </div>

                      {/* 엽서 하단 컨트롤 버튼 */}
                      <div className="mt-4 pt-3 border-t-2 border-dashed border-orange-200 flex flex-wrap justify-between items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSalesIndex((prev) =>
                              prev > 0 ? prev - 1 : salesReviews.length - 1,
                            )
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

      {/* 🎲 덕질 빙고 모달 (BINGO.exe) */}
      {openWindow === "bingo" && (
        <div data-bc-window="bingo" role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-[#c0c0c0] win-outset p-1 w-full max-w-md shadow-2xl text-black">
            {/* 타이틀 바 */}
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 text-xs font-bold flex justify-between items-center select-none">
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
                <span className="text-xs font-bold text-gray-700 mr-1 select-none">
                  멤버 선택:
                </span>
                {userList
                  .filter((u) => u !== "전체")
                  .map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setSelectedBingoUser(u)}
                      className={`px-2 py-0.5 text-xs win-btn font-bold ${
                        selectedBingoUser === u
                          ? "win-inset bc-selected"
                          : ""
                      }`}
                    >
                      {u}
                    </button>
                  ))}
              </div>

              {bingo.errorMessage && (
                <p
                  role="alert"
                  className="bg-white win-inset p-2 text-xs text-red-700"
                >
                  {bingo.errorMessage}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 text-xs text-gray-700">
                <span role="status">
                  {bingo.saving
                    ? "Supabase에 저장 중..."
                    : bingo.loading
                      ? "빙고 불러오는 중..."
                      : bingo.ready
                        ? "모임 공유 저장 · 5초마다 동기화"
                        : "빙고 연결을 확인해 주세요."}
                </span>
                <button
                  type="button"
                  onClick={bingo.retry}
                  disabled={bingo.saving || bingo.loading}
                  className="win-btn px-2 py-0.5"
                >
                  다시 불러오기
                </button>
              </div>
              {/* 스코어 및 상태 표시 */}
              <div className="bg-white win-inset p-2 flex justify-between items-center">
                <div className="text-xs">
                  <span className="font-bold text-gray-800">
                    {selectedBingoUser} 님의 달성:{" "}
                  </span>
                  <span className="font-extrabold text-blue-700 text-sm">
                    {completedBingoLines}줄
                  </span>{" "}
                  완성
                </div>
                <div className="flex gap-1 items-center">
                  {completedBingoLines >= 3 ? (
                    <span className="bg-red-600 text-white font-bold text-xs px-2 py-0.5 animate-bounce rounded-xs">
                      🎉 BINGO 달성!
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      3줄 달성 시 빙고
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={resetCurrentBingo}
                    disabled={!bingo.ready || bingo.saving}
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

                  return (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={() => toggleBingoCell(cell.id)}
                      disabled={!bingo.ready || bingo.saving}
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
                            CLEAR
                          </span>
                        </div>
                      )}

                      <span className="text-xs font-bold leading-tight text-gray-900">
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
                💡 상단 탭에서 멤버를 전환해 각자의 빙고 상태를 체크할 수
                있습니다.
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
        <div data-bc-window="receipt" role="dialog" aria-modal="true" tabIndex={-1}
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
              <div className="text-base font-extrabold tracking-widest">
                RECEIPT_PRINT.exe
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                ================================
              </div>
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
                    <span className="w-14 text-gray-500 shrink-0">
                      {"제  목:"}
                    </span>
                    <span className="font-bold break-keep text-gray-900">
                      {receiptData.singleItem.title}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">
                      {"작  가:"}
                    </span>
                    <span>{receiptData.singleItem.author || "미상"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">
                      {"장  르:"}
                    </span>
                    <span>{receiptData.singleItem.genre}</span>
                  </div>
                  <div className="flex">
                    <span className="w-14 text-gray-500 shrink-0">
                      {"평  점:"}
                    </span>
                    <span className="font-bold text-gray-900">
                      {receiptData.singleItem.rating}
                    </span>
                  </div>
                </div>

                {/* 감상평 */}
                <div className="space-y-1">
                  <div className="font-bold text-gray-700">[감상평]</div>
                  <div className="bg-transparent p-2.5 rounded border border-dashed border-gray-300 text-gray-800 text-xs break-keep leading-relaxed">
                    "
                    <SpoilerReviewText
                      text={receiptData.singleItem.review || "감상평 없음"}
                    />
                    "
                  </div>
                </div>

                {/* 원래 상태 줄: 이모지 없이 깔끔한 텍스트 표기 */}
                <div className="pt-2 border-t border-dashed border-gray-400 flex justify-between items-center font-bold text-xs">
                  <span className="tracking-widest">{"상  태:"}</span>
                  <span className="text-gray-900">
                    {receiptData.singleItem.rating === "중도하차"
                      ? "중도하차"
                      : "감상 완료"}
                    {(receiptData.singleItem.is_favorite ||
                      receiptData.singleItem.is_revisit) && (
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

                <div
                  data-receipt-list="true"
                  className="space-y-1.5 max-h-60 overflow-y-auto pr-1"
                >
                  {receiptData.items.length === 0 ? (
                    <div className="text-center text-gray-400 py-3">
                      등록된 작품이 없습니다.
                    </div>
                  ) : (
                    receiptData.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-baseline gap-1.5 border-b border-gray-100 pb-1 text-xs"
                      >
                        <div className="break-keep flex-1 leading-snug">
                          <span className="font-medium text-gray-900">
                            {idx + 1}. {item.title}
                            {item.is_favorite ? "👑" : ""}
                            {item.is_revisit ? "🔁" : ""}
                          </span>{" "}
                          <span className="text-[11px] text-gray-500">
                            ({item.genre})
                          </span>
                        </div>
                        <span className="font-bold shrink-0 text-right whitespace-nowrap text-amber-700">
                          {item.rating}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {(() => {
                  const total = receiptData.items.length;
                  const dropped = receiptData.items.filter(
                    (i) => i.rating === "중도하차",
                  ).length;
                  const completed = total - dropped;
                  const favoriteCount = receiptData.items.filter(
                    (i) => i.is_favorite,
                  ).length;
                  const revisitCount = receiptData.items.filter(
                    (i) => i.is_revisit,
                  ).length;
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
                        <span className="font-bold text-red-600">
                          {dropped} 편
                        </span>
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
              <div
                data-html2canvas-ignore="true"
                className="mt-3 pt-2 border-t border-gray-200"
              >
                <button
                  type="button"
                  onClick={handleSaveReceiptImage}
                  disabled={downloadingReceipt}
                  className="w-full py-1.5 win-btn font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>💾</span>
                  <span>
                    {downloadingReceipt ? "저장 중..." : "영수증 이미지로 저장"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 랜덤 추천 팝업 (curation) */}
      {randomBook && (
        <div data-bc-window="recommendation" role="dialog" aria-modal="true" tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRandomBook(null)}
        >
          <div
            className="bg-[#c0c0c0] win-outset max-w-xs w-full p-1 text-center select-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="desktop-titlebar bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-xs font-bold mb-2">
              <span>RANDOM_PICK.exe</span>
              <button
                onClick={() => setRandomBook(null)}
                className="win-btn text-black font-extrabold w-4 h-4 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="bg-white win-inset p-3 m-1 text-xs space-y-2">
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                🎲 오늘의 추천작
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-1">
                {randomBook.title}
              </h3>
              <p className="text-xs text-gray-600">
                {randomBook.author || "작자 미상"} · {randomBook.genre}
              </p>
              <div className="text-amber-500 font-bold">
                {randomBook.rating}
              </div>
              <div className="text-xs text-gray-500">
                ✍️ {randomBook.user_name}의 리뷰
              </div>
              {randomBook.review && (
                <div className="bg-gray-50 p-2 text-xs text-gray-700 win-inset break-words text-left">
                  <SpoilerReviewText text={randomBook.review} />
                </div>
              )}
            </div>
            <div className="flex gap-1 p-2">
              <button
                onClick={handleRandomRecommend}
                className="flex-1 py-1 win-btn text-xs font-bold"
              >
                다시 뽑기
              </button>
              <button
                onClick={() => setRandomBook(null)}
                className="flex-1 py-1 win-btn text-xs font-bold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {openWindow === "desktop-theme" && <DesktopThemeWindow close={() => setOpenWindow(null)} explorerTitle={explorerTitle} bookCount={displayedReviews.length} />}
      {/* 시작 메뉴 팝업 */}
      {startMenuOpen && (
        <StartMenuKeys close={() => setStartMenuOpen(false)}>
          {/* 좌측 사이드바: 실제 모임 이름과 기존 표시줄 테마 */}
          <StartMenuBand group={groupName} />
          <div className="flex-1 min-w-0 p-1 flex flex-col space-y-0.5 text-xs max-h-[calc(100dvh-48px)] overflow-y-auto overscroll-contain">
            {APP_LIST.map((app) => (
              <button
                key={app.id}
                onClick={() => handleAppClick(app.id)}
                className="bc-start-item flex items-center space-x-2 px-2 py-1.5 hover:bg-[#000080] hover:text-white rounded text-left transition-colors"
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
            <button type="button" onClick={() => { setStartMenuOpen(false); setOpenWindow("desktop-theme"); }}
              className="bc-start-item flex items-center space-x-2 px-2 py-1.5 hover:bg-[#000080] hover:text-white rounded text-left transition-colors">
              <div className="relative w-5 h-5 flex-shrink-0"><Image src="/icons/theme.png" alt="" fill sizes="20px" className="object-contain" /></div>
              <span className="truncate">화면 꾸미기</span>
            </button>
            <AndroidGroupInstall groupName={groupName} />
          </div>
        </StartMenuKeys>
      )}

      {planCelebration?.group === groupName && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100%_-_16px)] w-max pointer-events-none bg-[#c0c0c0] win-outset p-1 text-xs text-black shadow-[2px_2px_0_#000]"
        >
          <div className="desktop-titlebar bg-[#000080] text-white font-bold px-2 py-1">
            🎉 독서 예고 달성!
          </div>
          <div className="px-2 py-2 break-words">
            {planCelebration.user}님이 『{planCelebration.title}』을 완독했어요!
          </div>
        </div>
      )}
      {/* 🐾 작업표시줄 위 상주 미니 펫 */}
      {miniPet && (
        <div className="absolute bottom-10 right-2 z-30 w-[160px] h-[90px] pointer-events-none">
          {secretNote.icon}
          {/* ✨ 미니 펫 성장 반짝임 */}
          {petGrowthEffect && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <Image
                src="/pets/deco/sparkle.png"
                alt=""
                width={100}
                height={100}
                unoptimized
                className="pet-growth-sparkle"
              />
            </div>
          )}

          {/* 🐣 이름 없는 아기일 때만 표시되는 알림 */}
          {(petNamingPreview ||
            (miniPet.stage !== "egg" &&
              miniPet.stage !== "dead" &&
              !miniPet.pet_name)) && (
            <button
              type="button"
              onClick={() => setOpenWindow("pets")}
              title="아기 이름을 지어주세요!"
              aria-label="이름 없는 아기 펫 알림"
              className="absolute -top-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto group"
            >
              <span className="relative block whitespace-nowrap rounded-md border-2 border-black bg-[#fff9d7] px-3 py-2 text-xs font-bold text-black shadow-[2px_2px_0_#777]">
                🔔 이름 지어주세요!
                {/* 말풍선 꼬리 — 테두리가 자연스럽게 연결되도록 */}
                <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[11px] border-t-black" />
                <span className="absolute -bottom-[8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#fff9d7]" />
                {/* 꼬리 위쪽의 가로 테두리를 가리는 부분 */}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[18px] h-[3px] bg-[#fff9d7]" />
              </span>
            </button>
          )}

          {miniPet.stage === "egg" && !miniPetPreview ? (
            <button
              type="button"
              onClick={() => setOpenWindow("pets")}
              title="PET.exe 열기"
              aria-label="펫 돌보기 열기"
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto"
            >
              <Image
                src={`/pets/${miniPet.species}/egg.png`}
                alt="우리 모임의 알"
                width={76}
                height={76}
                className="object-contain pet-egg-bounce"
                unoptimized
              />
            </button>
          ) : miniPet.stage === "dead" ? (
            <button
              type="button"
              onClick={() => setOpenWindow("pets")}
              title="PET.exe 열기"
              aria-label="펫의 묘비 보기"
              className="absolute -bottom-5 right-3 z-40 pointer-events-auto"
            >
              <Image
                src="/pets/deco/grave.png"
                alt="펫의 묘비"
                width={76}
                height={76}
                className="object-contain"
                unoptimized
              />
            </button>
          ) : (
            <div
              style={{
                animationPlayState:
                  miniPetIsAsleep ||
                  (petCareAction === "feed" &&
                    openWindow === "pets" &&
                    currentPet?.id === miniPet.id)
                    ? "paused"
                    : "running",
              }}
              className={`absolute left-0 mini-pet-walk ${
                miniPet.species === "bogli" &&
                miniPet.stage === "teen" &&
                !miniPetPreview
                  ? "-bottom-[14px]"
                  : miniPet.species === "bogli" && miniPet.stage === "adult" && !miniPetPreview
                    ? "-bottom-[8px]"
                    : "-bottom-4"
              }`}
            >
              <button
                type="button"
                onClick={openMiniPet}
                title={`${miniPet.pet_name || "우리 펫"} · PET.exe 열기`}
                aria-label="펫 돌보기 열기"
                className={`relative block pointer-events-auto ${
                  miniPetIsAsleep || miniPetIsEating ? "" : "mini-pet-hop"
                }`}
              >
                <PetSprite
                  pet={miniPet}
                  stage={miniPetPreview ? "baby" : undefined}
                  size={70}
                  eating={miniPetIsEating}
                  happy={miniPetIsHappy}
                  sleeping={miniPetIsAsleep}
                />
                {miniChat?.id === miniPet.id && !miniPetIsAsleep && (
                  <span
                    aria-hidden="true"
                    className="mini-pet-chat pointer-events-none absolute"
                    style={{
                      left: "max(var(--mini-chat-left, -50px), calc(168px - 100vw))",
                      top: "var(--mini-chat-top, -46px)",
                      width: "var(--mini-chat-size, 68px)",
                      height: "var(--mini-chat-size, 68px)",
                      backgroundImage: "url('/pets/deco/chat.png')",
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <span
                      className="absolute left-[18%] top-[37%] w-[64%] h-[28%] flex items-center justify-center whitespace-nowrap font-bold"
                      style={{
                        color: "#2b0b45",
                        fontSize:
                          miniChat.text.length >= 4
                            ? "var(--mini-chat-long, 8px)"
                            : miniChat.text.length >= 3
                              ? "var(--mini-chat-medium, 9px)"
                              : "var(--mini-chat-short, 10px)",
                        lineHeight: 1,
                      }}
                    >
                      {miniChat.text}
                    </span>
                  </span>
                )}
                {miniPetIsAsleep && (
                  <Image
                    src="/pets/deco/zzz.png"
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                    unoptimized
                    className="pointer-events-none absolute -top-2 right-0"
                  />
                )}
                {miniPetIsHappy && (
                  <Image
                    src="/pets/deco/heart.png"
                    alt=""
                    aria-hidden="true"
                    width={25}
                    height={25}
                    unoptimized
                    className="pointer-events-none absolute -top-2 right-0 pet-heart-float"
                  />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 하단 윈도우 98 작업표시줄 */}
      <footer className="h-10 bg-[#c0c0c0] win-outset z-40 flex items-center justify-between px-1 absolute bottom-0 inset-x-0">
        <button
          data-bc-start
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

        {/* 🎵 JUKEBOX.exe — 작업표시줄 한 줄 플레이어 */}
        {jukeboxSongs.length > 0 && (
          <div className="flex-1 min-w-0 mx-1 h-[30px] flex items-center gap-1 px-1">
            {/* 곡 제목 — 클릭하면 주크박스 열기 */}
            <button
              type="button"
              onClick={() => setOpenWindow("jukebox")}
              className="min-w-0 flex-1 h-full text-left overflow-hidden flex items-center gap-1"
              title={
                jukeboxActive
                  ? `${jukeboxActive.ost_title} — ${jukeboxActive.ost_artist}`
                  : "주크박스 열기"
              }
            >
              {/* 🎵 재생 중 이퀄라이저 */}
              <span
                aria-hidden="true"
                className={`jukebox-equalizer shrink-0 ${
                  jukeboxPlaying ? "is-playing" : ""
                }`}
              >
                <span />
                <span />
                <span />
                <span />
              </span>

              <span
                ref={jukeboxTickerBoxRef}
                className="block w-full overflow-hidden whitespace-nowrap text-[10px] sm:text-xs text-black"
              >
                <span
                  ref={jukeboxTickerTextRef}
                  className={`inline-block whitespace-nowrap ${
                    jukeboxOverflow > 0 ? "jukebox-ticker-moving" : ""
                  }`}
                  style={
                    {
                      "--jukebox-overflow": `${jukeboxOverflow}px`,
                      "--jukebox-duration": `${Math.max(6, jukeboxOverflow / 22 + 4)}s`,
                    } as React.CSSProperties
                  }
                >
                  {jukeboxActive
                    ? `${jukeboxActive.ost_title} — ${jukeboxActive.ost_artist}`
                    : "재생 중인 곡이 없습니다"}
                </span>
              </span>
            </button>

            {/* 재생 컨트롤 — 항상 오른쪽에 고정 */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => jukeboxSkip(-1)}
                className="win-btn w-6 h-6 flex items-center justify-center text-xs"
                title="이전 곡"
                aria-label="이전 곡"
              >
                ⏮
              </button>

              <button
                type="button"
                onClick={jukeboxTogglePlayback}
                className="win-btn w-6 h-6 flex items-center justify-center text-xs"
                title={jukeboxPlaying ? "일시정지" : "재생"}
                aria-label={jukeboxPlaying ? "일시정지" : "재생"}
              >
                {jukeboxPlaying ? "⏸" : "▶"}
              </button>

              <button
                type="button"
                onClick={() => jukeboxSkip(1)}
                className="win-btn w-6 h-6 flex items-center justify-center text-xs"
                title="다음 곡"
                aria-label="다음 곡"
              >
                ⏭
              </button>
            </div>
          </div>
        )}

        {/* 우측 시스템 트레이 영역 (모임 뱃지 + 시계) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="win-inset px-2 py-0.5 text-[11px] font-mono bg-[#c0c0c0] min-w-[65px] text-center">
            {time}
          </div>
        </div>
      </footer>
    </main>
    </RelatedReviewsProvider>
    </ObjectionCounts>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={<div className="text-white text-center p-8">Loading...</div>}
    >
      <AccessGate>
        <BookClubContent />
      </AccessGate>
    </Suspense>
  );
}
