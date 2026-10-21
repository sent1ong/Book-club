"use client";
import React, { useEffect, useRef, useState } from "react";
import { useDraftClose } from "../DraftClose";
import { PetPopup } from "../pets/PetDiary";
import { community, readShelf, invalidateShelf, type Shelf } from "./client";
import { autoModal } from "./autoModal";
export const SHELF_UI = { button: "📚 공동책장", window: "SHARED_SHELF.exe", heading: "우리 모임이 함께 남기는 올해의 작품들!", item: "대표 작품", choose: "리뷰한 작품 선택" } as const;

export function ShelfRows({ data, final = false }: { data: Shelf; final?: boolean }) {
  return <section className="space-y-3">
    <h2 className="font-bold text-base">📚 {data.operating_year} 공동책장</h2>
    <p>{SHELF_UI.heading}</p>
    <p className="font-bold">{data.picks.length} / {data.members.length}명</p>
    {!data.members.length && <p>아직 리뷰를 등록한 모임원이 없어요.</p>}
    {data.members.map(member => {
      const pick = data.picks.find(row => row.user_name === member);
      return <article key={member} className="win-inset bg-[#fff9e9] p-3 break-words space-y-1">
        <h3 className="font-bold">{member} · {pick ? "선정 완료" : "미등록"}</h3>
        {pick ? <><p className="font-bold">📖 {pick.title}</p><p className="text-gray-600">{pick.author}</p><p className="whitespace-pre-wrap leading-5">{pick.reason}</p></> : <p>{final ? "미선정" : "아직 비어 있어요"}</p>}
      </article>;
    })}
  </section>;
}
export function FinalShelf({ group, year }: { group: string; year: number }) {
  const [data, setData] = useState<Shelf | null>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setData(null); setError("");
    void readShelf(group, undefined, abort.signal).then(next => {
      if (next.operating_year !== year) throw new Error("시상식과 공동책장의 운영 연도가 달라요.");
      if (!abort.signal.aborted) setData(next);
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [group, year, retry]);
  return error ? <p role="alert">{error} <button className="win-btn px-2" onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></p> : data ? <ShelfRows data={data} final /> : <p role="status">공동책장을 불러오는 중…</p>;
}
function ShelfEditor({ group, initialMember, close }: { group: string; initialMember: string; close: () => void }) {
  const [data, setData] = useState<Shelf | null>(null), [member, setMember] = useState(initialMember === "전체" ? "" : initialMember);
  const [book, setBook] = useState(""), [reason, setReason] = useState(""), [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [readError, setReadError] = useState("");
  const locked = useRef(false), submission = useRef<{ payload: string; id: string } | null>(null);
  const initialDraft = useRef("");
  const { requestClose, confirmation } = useDraftClose(!!initialDraft.current && initialDraft.current !== JSON.stringify([book, reason]), saving, close);
  useEffect(() => {
    const abort = new AbortController(); let running = false;
    const refresh = async () => {
      if (running || locked.current || document.visibilityState !== "visible") return;
      running = true;
      try {
        const next = await readShelf(group, undefined, abort.signal);
        if (!abort.signal.aborted) setData(current => current ? { ...current, members: next.members, picks: next.picks, can_edit: next.can_edit, server_now: next.server_now } : current);
      } catch { /* Preserve the draft; the save RPC always enforces the server deadline. */ }
      finally { running = false; }
    };
    const timer = setInterval(() => { void refresh(); }, 30000);
    const focus = () => { void refresh(); }; window.addEventListener("focus", focus);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [group]);
  useEffect(() => {
    const abort = new AbortController(); setBusy(true); setReadError(""); setError(""); setData(current => current ? { ...current, candidates: [], candidate_count: 0 } : current); setBook(""); setReason(""); setVersion(null); submission.current = null;
    void readShelf(group, member || undefined, abort.signal).then(next => {
      if (abort.signal.aborted) return;
      setData(next);
      const pick = next.picks.find(row => row.user_name === member);
      const selected = pick && next.candidates.some(row => row.id === pick.book_id) ? pick.book_id : "";
      setBook(selected); setReason(pick?.reason || ""); setVersion(pick?.version || null);
      initialDraft.current = JSON.stringify([selected, pick?.reason || ""]);
    }).catch(e => { if (!abort.signal.aborted) setReadError(e.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [group, member, retry]);
  const candidateLabels = new Map<string, number>();
  data?.candidates.forEach(row => { const key = JSON.stringify([row.title, row.author]); candidateLabels.set(key, (candidateLabels.get(key) || 0) + 1); });
  const valid = !readError && !busy && !!data?.can_edit && data.members.includes(member) && data.candidates.some(row => row.id === book) && !!reason.trim() && Array.from(reason.trim()).length <= 200;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!valid || locked.current) return;
    locked.current = true; setSaving(true); setError(""); setNotice("");
    const payload = JSON.stringify([member, book, reason.trim(), version]);
    try {
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() };
      await community(group, { action: "shelf-save", member, book, reason: reason.trim(), version, submission: submission.current.id });
      invalidateShelf(group); setNotice("공동책장에 저장했어요! ♡"); setRetry(x => x + 1);
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setSaving(false); }
  };
  return <><PetPopup title={SHELF_UI.window} close={requestClose}>
    <div className="space-y-3">
      {busy && <p role="status">공동책장을 불러오는 중…</p>}
      {readError && <p role="alert" className="text-red-800">작품 목록을 불러오지 못했어요. {readError} <button className="win-btn px-1" disabled={saving || busy} onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></p>}
      {error && <p role="alert" className="text-red-800">{error} <button className="win-btn px-1" disabled={saving || busy} onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></p>}
      {notice && <p role="status">{notice}</p>}
      {data && <><ShelfRows data={data} final={!data.can_edit} />
        {data.can_edit ? <form onSubmit={save} className="win-inset p-3 bg-white space-y-3">
          <label className="block">모임원<select aria-label="공동책장 모임원" className="block win-inset bg-white w-full p-2 mt-1" value={member} disabled={busy || saving} onChange={e => { setMember(e.target.value); setNotice(""); }} required><option value="">본인 이름 선택</option>{data.members.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="block">{SHELF_UI.item}<select aria-label={SHELF_UI.item} className="block win-inset bg-white w-full p-2 mt-1" value={book} disabled={busy || saving || !!readError || !member} onChange={e => setBook(e.target.value)} required><option value="">{SHELF_UI.choose}</option>{data.candidates.map(row => <option key={row.id} value={row.id}>{row.title} · {row.author}{(candidateLabels.get(JSON.stringify([row.title, row.author])) || 0) > 1 ? ` · #${row.id}` : ""}</option>)}</select></label>
          {!busy && !readError && member && !data.candidates.length && <p role="status">선택 가능한 작품이 없습니다. 해당 운영 연도의 리뷰와 중도하차 여부를 확인해 주세요.</p>}
          <label className="block">선정 이유 · {Array.from(reason.trim()).length}/200<textarea className="win-inset bg-white w-full p-2 mt-1 text-base sm:text-xs placeholder:text-gray-400" placeholder="12/30일까지 올해의 대표 작품을 골라 주세요." rows={3} value={reason} disabled={busy || saving} onChange={e => setReason(e.target.value)} required /></label>
          <button className="win-btn px-3 py-2" disabled={!valid || busy || saving}>{saving ? "저장 중…" : version ? "선정 변경하기" : "작품 등록"}</button>
        </form> : <p className="font-bold">이 모임의 공동책장은 열람 전용이에요.</p>}
      </>}
    </div>
  </PetPopup>{confirmation}</>;
}
export function SharedShelfHub({ group, member, ready, blocked }: { group: string; member: string; ready: boolean; blocked: boolean }) {
  const [open, setOpen] = useState(false), [intro, setIntro] = useState<number | null>(null);
  const guard = useRef({ ready, blocked, open, intro }); guard.current = { ready, blocked, open, intro };
  const token = useRef({}), seenInTab = useRef(false);
  useEffect(() => () => autoModal.release(token.current), []);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController(); let meta: Shelf | null = null;
    const tryIntro = () => {
      const state = guard.current;
      if (!meta || seenInTab.current || !state.ready || state.blocked || state.open || state.intro || document.visibilityState !== "visible" || document.querySelector('[role="dialog"],[aria-modal="true"]') || document.activeElement?.closest('input,textarea,select,[contenteditable="true"]')) return;
      try { if (localStorage.getItem(`bookclub98:shelf-intro:${group}:${meta.operating_year}`) === "1") return; } catch { /* Remember this tab below. */ }
      if (autoModal.claim(token.current)) setIntro(meta.operating_year);
    };
    const refresh = () => { if (document.visibilityState === "visible") void readShelf(group, undefined, abort.signal).then(next => { if (!abort.signal.aborted) { meta = next; tryIntro(); } }).catch(() => {}); };
    const invalidated = (event: Event) => { if ((event as CustomEvent).detail === group) refresh(); };
    window.addEventListener("bc98:shelf-invalidated", invalidated);
    refresh(); const timer = setInterval(tryIntro, 5000), metadataTimer = setInterval(refresh, 60000); window.addEventListener("focus", refresh);
    return () => { abort.abort(); window.removeEventListener("bc98:shelf-invalidated", invalidated); clearInterval(timer); clearInterval(metadataTimer); window.removeEventListener("focus", refresh); };
  }, [group, ready]);
  useEffect(() => {
    if (intro === null) return;
    // This effect runs only once the actual dialog has committed.
    seenInTab.current = true;
    try { localStorage.setItem(`bookclub98:shelf-intro:${group}:${intro}`, "1"); } catch { /* This tab remembers. */ }
  }, [intro, group]);
  const dismiss = () => { setIntro(null); autoModal.release(token.current); };
  return <>
    <button type="button" className="win-btn shrink-0 whitespace-nowrap px-2 py-0.5 text-xs" onClick={() => setOpen(true)}>{SHELF_UI.button}</button>
    {intro !== null && <PetPopup title={`📚 ${intro} 공동책장`} close={dismiss}><p className="leading-6">우리 모임이 올해 남기고 싶은 작품을 하나씩 모아요!</p><p className="my-3 leading-6">한 사람당 한 작품만 고를 수 있고, 12월 30일까지 언제든 변경할 수 있어요.</p><div className="flex flex-wrap gap-2"><button className="win-btn px-3 py-2" onClick={() => { dismiss(); setOpen(true); }}>공동책장 구경하기</button><button className="win-btn px-3 py-2" onClick={dismiss}>나중에</button></div></PetPopup>}
    {open && <ShelfEditor group={group} initialMember={member} close={() => setOpen(false)} />}
  </>;
}
