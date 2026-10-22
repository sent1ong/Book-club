"use client";
import React, { useEffect, useRef, useState } from "react";
import { PetPopup } from "../pets/PetDiary";
import { useDraftClose } from "../ui/DraftClose";
import { community, type Objection } from "./client";
type Defense = { objection_id: string; user_name: string; content: string; created_at: string };
const cache = new Map<string, { rows: Defense[]; at: number }>();
const pending = new Map<string, Promise<Defense[]>>();
function read(group: string, book: string, force = false) {
  const key = JSON.stringify([group, book]), entry = cache.get(key);
  if (!force && entry && Date.now() - entry.at < 30000) return Promise.resolve(entry.rows);
  if (pending.has(key)) return pending.get(key)!;
  const request = community<Defense[]>(group, { action: "defenses-read", book }).then(rows => {
    cache.set(key, { rows, at: Date.now() });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return rows;
  }).finally(() => pending.delete(key));
  pending.set(key, request); return request;
}
export default function DefenseWindow({ group, book, objection, reviewer, title, close, mode = "defense", members = [], onSaved }: { group: string; book: string; objection: Objection; reviewer: string; title: string; close: () => void; mode?: "defense" | "witness"; members?: string[]; onSaved?: (row?: Objection) => void }) {
  const [rows, setRows] = useState<Defense[] | null>(null), [content, setContent] = useState("");
  const [member, setMember] = useState("");
  const [witness, setWitness] = useState(objection.witness);
  const witnessMode = mode === "witness";
  const candidates = members.filter(name => name !== reviewer && name !== objection.user_name);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false), submission = useRef<{ text: string; id: string } | null>(null);
  const saved = rows?.find(row => row.objection_id === objection.id);
  const { requestClose, confirmation } = useDraftClose(!!content, busy, close);
  useEffect(() => { let active = true; void read(group, book).then(next => { if (active) setRows(next); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [group, book]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (locked.current || !rows || (witnessMode ? !!saved || !!witness || !candidates.includes(member) : !!saved) || !content.trim()) return;
    locked.current = true; setBusy(true); setError("");
    try {
      if (witnessMode) {
        const payload = JSON.stringify([member, content.trim()]);
        if (submission.current?.text !== payload) submission.current = { text: payload, id: crypto.randomUUID() };
        const result = await community<Objection>(group, { action: "witnesses-create", book, id: objection.id, member, content: content.trim(), submission: submission.current.id });
        setWitness(result.witness); setContent(""); onSaved?.(result); return;
      }
      if (submission.current?.text !== content.trim()) submission.current = { text: content.trim(), id: crypto.randomUUID() };
      const result = await community<Defense>(group, { action: "defenses-create", book, id: objection.id, member: reviewer, content: content.trim(), submission: submission.current.id });
      const next = [...rows.filter(row => row.objection_id !== result.objection_id), result];
      cache.set(JSON.stringify([group, book]), { rows: next, at: Date.now() }); setRows(next); setContent(""); onSaved?.({ ...objection, closed: true });
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  return <><PetPopup title={witnessMode ? "OBJECTION.exe — 증인 소환" : "OBJECTION.exe — 최종 변론"} close={requestClose}>
    <p className="font-bold break-words">사건: {reviewer}의 「{title}」 리뷰</p>
    <div className="win-inset bg-white p-2 my-3"><b>⚖️ {objection.user_name}의 이의 제기</b>{saved && <span className="ml-2 inline-block border-2 border-[#9f3038] px-1 text-[11px] font-bold text-[#9f3038] -rotate-3">심리 종결</span>}<p className="whitespace-pre-wrap break-words mt-1">{objection.content}</p></div>
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {!rows && !error && <p role="status">변론을 불러오는 중…</p>}
    {witnessMode ? witness ? <><b>📜 증인 — {witness.user_name}</b><p className="whitespace-pre-wrap break-words my-2">{witness.content}</p></> : saved ? <p>심리 종결 후에는 증인을 소환할 수 없어요.</p> : rows && <form onSubmit={save} className="space-y-2">
      <label className="block">증인<select className="win-inset bg-white ml-2" value={member} disabled={busy} onChange={e => setMember(e.target.value)} required><option value="">모임원 선택</option>{candidates.map(name => <option key={name}>{name}</option>)}</select></label>
      {!candidates.length && <p>선택할 수 있는 다른 모임원이 없어요.</p>}
      <textarea aria-label="증언 내용" className="win-inset w-full bg-white p-2 text-base sm:text-xs" rows={4} maxLength={300} value={content} disabled={busy} onChange={e => setContent(e.target.value)} required />
      <p>{Array.from(content).length}/300 · 모임원 선택은 본인 인증을 의미하지 않아요.</p><button className="win-btn px-3 py-2" disabled={busy || !member || !content.trim()}>{busy ? "접수 중…" : "증언 접수!"}</button>
    </form> : saved ? <><b>🗣️ {saved.user_name}의 최종 변론</b><p className="whitespace-pre-wrap break-words my-2">{saved.content}</p></> : rows && <form onSubmit={save} className="space-y-2">
      <label className="block">작성자<select value={reviewer} disabled className="win-inset bg-white ml-2"><option>{reviewer}</option></select></label>
      <textarea aria-label="최종 변론 내용" className="win-inset w-full bg-white p-2 text-base sm:text-xs" rows={4} maxLength={300} value={content} disabled={busy} onChange={e => setContent(e.target.value)} required />
      <p>{Array.from(content).length}/300 · 원본 리뷰 작성자 이름으로 한 번만 답할 수 있어요.</p><button className="win-btn px-3 py-2" disabled={busy || !content.trim()}>{busy ? "접수 중…" : "최종 변론 접수!"}</button>
    </form>}
  </PetPopup>{confirmation}</>;
}
