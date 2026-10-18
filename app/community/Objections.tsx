"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { community, type Objection, type Objections } from "./client";
import { PetPopup } from "../pets/PetDiary";

const Counts = createContext<{ counts: Record<string, number>; refresh: () => void; update: (counts: Record<string, number>) => void }>({ counts: {}, refresh: () => {}, update: () => {} });
export function ObjectionCounts({ group, ready, children }: { group: string; ready: boolean; children: React.ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    const refresh = () => { if (document.visibilityState === "visible") void community<Objections>(group, { action: "objections-read", offset: 0 }, abort.signal).then(data => { if (!abort.signal.aborted) setCounts(data.counts); }).catch(() => {}); };
    refresh(); const timer = setInterval(refresh, 60000); window.addEventListener("focus", refresh);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [group, ready, revision]);
  return <Counts.Provider value={{ counts, refresh: () => setRevision(x => x + 1), update: setCounts }}>{children}</Counts.Provider>;
}
function ObjectionWindow({ anchor, close, children, focusKey }: { anchor: React.RefObject<HTMLButtonElement>; close: () => void; children: React.ReactNode; focusKey: string }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.closest<HTMLElement>('[role="dialog"]')?.focus(); }, [focusKey]);
  useEffect(() => {
    // Freeze only this review's scrolling ancestors, retaining their positions.
    const locked: { element: HTMLElement; value: string; priority: string; top: number }[] = [];
    for (let element = anchor.current?.parentElement; element; element = element.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight) {
        locked.push({ element, value: element.style.getPropertyValue("overflow-y"), priority: element.style.getPropertyPriority("overflow-y"), top: element.scrollTop });
        element.style.setProperty("overflow-y", "hidden");
      }
    }
    if (!locked.some(item => item.element === document.body)) {
      const element = document.body;
      locked.push({ element, value: element.style.getPropertyValue("overflow-y"), priority: element.style.getPropertyPriority("overflow-y"), top: element.scrollTop });
      element.style.setProperty("overflow-y", "hidden");
    }
    const scroller = content.current?.parentElement;
    if (scroller) scroller.style.overscrollBehavior = "contain";
    return () => locked.forEach(({ element, value, priority, top }) => {
      if (value) element.style.setProperty("overflow-y", value, priority); else element.style.removeProperty("overflow-y");
      element.scrollTop = top;
    });
  }, [anchor]);
  return <PetPopup title="OBJECTION.exe" close={close}>
    <div ref={content} className="space-y-3" onWheel={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}>{children}</div>
  </PetPopup>;
}
export function ReviewObjections({ group, book, title, reviewAuthor, members, author }: { group: string; book: string; title: string; reviewAuthor: string; members: string[]; author: string }) {
  const { counts, refresh, update } = useContext(Counts);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Objection[]>([]);
  const [total, setTotal] = useState(0), [member, setMember] = useState(members.includes(author) ? author : "");
  const [content, setContent] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<{ row: Objection; type: "edit" | "delete" } | null>(null);
  const [actionContent, setActionContent] = useState(""), [actionPassword, setActionPassword] = useState("");
  const [notice, setNotice] = useState("");
  const locked = useRef(false), submission = useRef<{ payload: string; id: string } | null>(null);
  const load = async (offset: number, signal?: AbortSignal) => {
    const data = await community<Objections>(group, { action: "objections-read", book, offset }, signal);
    if (!signal?.aborted) { setRows(old => offset ? [...old, ...data.items.filter(row => !old.some(item => item.id === row.id))] : data.items); setTotal(data.total_count); update(data.counts); }
  };
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); setBusy(true); setError("");
    void load(0, abort.signal).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [open, group, book, revision]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (locked.current || !members.includes(member) || !content.trim() || Array.from(content.trim()).length > 300 || !/^[0-9]{4}$/.test(password)) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    const payload = JSON.stringify([book, member, content.trim(), password]);
    try {
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() };
      await community(group, { action: "objections-create", book, member, content: content.trim(), password, submission: submission.current.id });
      setContent(""); setPassword(""); setNotice("이의 제기가 접수됐어요!"); submission.current = null; window.dispatchEvent(new CustomEvent("bc98:mail-updated", { detail: { group } })); refresh(); setRevision(x => x + 1);
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  const change = async (event: React.FormEvent) => {
    event.preventDefault();
    if (locked.current || !action || !/^[0-9]{4}$/.test(actionPassword) || (action.type === "edit" && (!actionContent.trim() || Array.from(actionContent.trim()).length > 300))) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await community(group, { action: "objections-change", book, id: action.row.id, password: actionPassword, change: action.type, content: action.type === "edit" ? actionContent.trim() : undefined });
      setNotice(action.type === "edit" ? "이의 제기를 수정했어요." : "이의 제기를 삭제했어요.");
      setAction(null); setActionPassword(""); setActionContent(""); window.dispatchEvent(new CustomEvent("bc98:mail-updated", { detail: { group } })); refresh(); setRevision(x => x + 1);
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  const close = () => { setOpen(false); setPassword(""); setActionPassword(""); setAction(null); setError(""); setNotice(""); submission.current = null; };
  return <section className="my-2 border-t border-dashed border-gray-200 pt-1" onClick={e => e.stopPropagation()}>
    <button ref={trigger} data-objection-open type="button" className="win-btn px-2 py-0.5 text-xs" aria-haspopup="dialog" onClick={() => setOpen(true)}>⚖️ 이의 있음!</button>
    {!!(counts[book] ?? total) && <span className="ml-2 text-[11px]">이의 제기 {counts[book] ?? total}건</span>}
    {open && <ObjectionWindow anchor={trigger} close={close} focusKey={`${revision}:${action?.row.id || ""}:${action?.type || ""}`}>
      <header className="win-inset bg-[#fff9e9] p-3 break-words space-y-1"><h2 className="font-bold">{title || "제목 없는 책"}</h2><p>대상 리뷰 작성자 · <strong>{reviewAuthor}</strong></p></header>
      <h3 className="font-bold">⚖️ 이의 제기 목록 · {total}건</h3>
      {busy && <p role="status">처리 중…</p>}
      <div className="win-inset bg-white p-3 space-y-3" aria-label="이의 제기 목록">{rows.map(row => <article key={row.id} className="border-b border-gray-200 pb-2 last:border-0">
        <p className="break-words whitespace-pre-wrap"><strong>{row.user_name}</strong>: {row.content}{row.updated_at && <span className="ml-1 text-gray-500">(수정됨)</span>}</p>
        {row.can_manage ? <div className="flex gap-2 mt-1">{(["edit", "delete"] as const).map(type => <button key={type} type="button" className="win-btn px-2 py-1" disabled={busy} aria-label={`${row.user_name}의 이의 제기 ${type === "edit" ? "수정" : "삭제"}`} onClick={() => { setAction({ row, type }); setActionContent(row.content); setActionPassword(""); setError(""); setNotice(""); }}>{type === "edit" ? "수정" : "삭제"}</button>)}</div> : null}
      </article>)}{!busy && !rows.length && <p>아직 이의 제기가 없어요.</p>}</div>
      {rows.length < total && <button type="button" disabled={busy} className="win-btn px-2" onClick={() => { setBusy(true); void load(rows.length).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>더 보기</button>}
      {error && <p role="alert" className="text-red-800">{error} <button type="button" className="win-btn px-1" disabled={busy} onClick={() => setRevision(x => x + 1)}>다시 불러오기</button></p>}
      {notice && <p role="status">{notice}</p>}
      {action ? <form onSubmit={change} className="space-y-3 border-t border-gray-400 pt-3">
        <h3 className="font-bold">{action.type === "edit" ? "이의 제기 수정" : "이의 제기 삭제"} · {action.row.user_name}</h3>
        {action.type === "edit" ? <label className="block">수정 내용 · {Array.from(actionContent.trim()).length}/300<textarea className="win-inset bg-white w-full p-2 mt-1 text-base sm:text-xs" rows={3} value={actionContent} disabled={busy} onChange={event => setActionContent(event.target.value)} required /></label> : <p className="break-words whitespace-pre-wrap">이 이의 제기를 삭제할까요?<br />{action.row.content}</p>}
        <label className="block">작성할 때 정한 비밀번호<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" aria-label="수정·삭제 비밀번호" className="win-inset bg-white p-2 mt-1 block w-full text-base sm:text-xs" value={actionPassword} onChange={event => setActionPassword(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} disabled={busy} required /></label>
        <div className="flex gap-2"><button className="win-btn px-3 py-2" disabled={busy || !/^[0-9]{4}$/.test(actionPassword) || (action.type === "edit" && (!actionContent.trim() || Array.from(actionContent.trim()).length > 300))}>{action.type === "edit" ? "수정 저장" : "삭제하기"}</button><button type="button" className="win-btn px-3 py-2" disabled={busy} onClick={() => { setAction(null); setActionPassword(""); setError(""); }}>취소</button></div>
      </form> : <form className="space-y-2 border-t border-gray-400 pt-3" onSubmit={save}>
        <label className="block">작성자<select aria-label="이의 제기 작성자" className="win-inset bg-white p-1 ml-2 max-w-full" value={member} onChange={e => setMember(e.target.value)} disabled={busy} required><option value="">모임원 선택</option>{members.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="block">짧은 이의 제기 · {Array.from(content.trim()).length}/300<textarea className="win-inset bg-white p-2 w-full mt-1 text-base sm:text-xs" rows={3} value={content} onChange={e => setContent(e.target.value)} disabled={busy} required /></label>
        <label className="block">비밀번호 · 숫자 4자리<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" aria-label="새 이의 제기 비밀번호" className="win-inset bg-white p-2 mt-1 block w-full text-base sm:text-xs" value={password} onChange={event => setPassword(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))} disabled={busy} required /></label>
        <button className="win-btn px-3 py-2" disabled={busy || !members.includes(member) || !content.trim() || Array.from(content.trim()).length > 300 || !/^[0-9]{4}$/.test(password)}>{busy ? "처리 중…" : "이의 제기 접수!"}</button>
      </form>}
      <div className="text-right"><button type="button" className="win-btn px-3 py-2" onClick={close}>닫기</button></div>
    </ObjectionWindow>}
  </section>;
}
