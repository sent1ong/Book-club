"use client";
import React, { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { community, type Objection, type Objections } from "./client";

const Counts = createContext<{ counts: Record<string, number>; refresh: () => void }>({ counts: {}, refresh: () => {} });
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
  return <Counts.Provider value={{ counts, refresh: () => setRevision(x => x + 1) }}>{children}</Counts.Provider>;
}
export function ReviewObjections({ group, book, members, author }: { group: string; book: string; members: string[]; author: string }) {
  const { counts, refresh } = useContext(Counts);
  const panel = useId();
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Objection[]>([]);
  const [total, setTotal] = useState(0), [member, setMember] = useState(members.includes(author) ? author : "");
  const [content, setContent] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const locked = useRef(false), submission = useRef<{ payload: string; id: string } | null>(null);
  const load = async (offset: number, signal?: AbortSignal) => {
    const data = await community<Objections>(group, { action: "objections-read", book, offset }, signal);
    if (!signal?.aborted) { setRows(old => offset ? [...old, ...data.items.filter(row => !old.some(item => item.id === row.id))] : data.items); setTotal(data.total_count); }
  };
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); setBusy(true); setError("");
    void load(0, abort.signal).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [open, group, book, revision]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (locked.current || !members.includes(member) || !content.trim() || Array.from(content.trim()).length > 300) return;
    locked.current = true; setBusy(true); setError("");
    const payload = JSON.stringify([book, member, content.trim()]);
    try {
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() };
      await community(group, { action: "objections-create", book, member, content: content.trim(), submission: submission.current.id });
      setContent(""); submission.current = null; refresh(); setRevision(x => x + 1);
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  return <section className="my-2 border-t border-dashed border-gray-200 pt-1" onClick={e => e.stopPropagation()}>
    <button type="button" className="win-btn px-2 py-0.5 text-xs" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(value => !value)}>⚖️ 이의 있음!</button>
    {!!(counts[book] || total) && <span className="ml-2 text-[11px]">이의 제기 {counts[book] ?? total}건</span>}
    {open && <div id={panel} className="win-inset bg-[#fff9e9] mt-2 p-2 space-y-2 text-xs">
      <div className="max-h-40 overflow-y-auto space-y-2" aria-label="이의 제기 목록">{rows.map(row => <p key={row.id} className="break-words whitespace-pre-wrap"><strong>{row.user_name}</strong>: {row.content}</p>)}{!busy && !rows.length && <p>아직 이의 제기가 없어요.</p>}</div>
      {rows.length < total && <button type="button" disabled={busy} className="win-btn px-2" onClick={() => { setBusy(true); void load(rows.length).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>더 보기</button>}
      {error && <p role="alert" className="text-red-800">{error} <button type="button" className="win-btn px-1" disabled={busy} onClick={() => setRevision(x => x + 1)}>다시 불러오기</button></p>}
      <form className="space-y-2" onSubmit={save}>
        <label className="block">작성자<select aria-label="이의 제기 작성자" className="win-inset bg-white p-1 ml-2 max-w-full" value={member} onChange={e => setMember(e.target.value)} disabled={busy} required><option value="">모임원 선택</option>{members.map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="block">짧은 이의 제기 · {Array.from(content.trim()).length}/300<textarea className="win-inset bg-white p-2 w-full mt-1 text-base sm:text-xs" rows={2} value={content} onChange={e => setContent(e.target.value)} disabled={busy} required /></label>
        <button className="win-btn px-2 py-1" disabled={busy || !members.includes(member) || !content.trim() || Array.from(content.trim()).length > 300}>{busy ? "처리 중…" : "이의 제기 남기기"}</button>
      </form>
    </div>}
  </section>;
}
