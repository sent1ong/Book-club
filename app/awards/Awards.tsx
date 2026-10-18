"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Award = { id: string; recipient: string; giver: string; title: string; reason: string; given_at: string };
type Snapshot = { group_name: string; operating_year: number; server_now: string; can_issue: boolean;
  ceremony_available: boolean; auto_ceremony_day: boolean; members: string[]; awards: Award[]; total_count: number; before_id: string };
const length = (s: string) => Array.from(s.trim()).length;
async function request(group: string, body: object, signal?: AbortSignal) {
  const response = await fetch("/api/bookclub/awards", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, group }) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || "상장을 불러오지 못했어요.");
  return result.data;
}
export async function readAwards(group: string, signal?: AbortSignal): Promise<Snapshot> {
  const first: Snapshot = await request(group, { action: "read", offset: 0 }, signal);
  const rows = [...first.awards];
  while (rows.length < first.total_count) {
    const page: Snapshot = await request(group, { action: "read", offset: rows.length, before: first.before_id }, signal);
    if (!page.awards.length || page.before_id !== first.before_id) throw new Error("목록을 모두 불러오지 못했어요. 다시 시도해 주세요.");
    rows.push(...page.awards);
  }
  if (rows.length !== first.total_count || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("목록을 다시 확인해 주세요.");
  return { ...first, awards: rows };
}

export function Certificate({ award }: { award: Award }) {
  return <article className="bg-[#fff9e9] border-2 border-[#b79952] p-4 sm:p-6 text-center text-black break-words" style={{ overflowWrap: "anywhere" }}>
    <div className="text-[11px] tracking-widest text-[#80652c]">BOOK CLUB 98</div>
    <div className="text-2xl mt-2">🏆</div><h3 className="text-xl font-bold my-2">표 창 장</h3>
    <p className="text-lg font-bold text-[#72541a] whitespace-pre-wrap">{award.title}</p>
    <p className="mt-4 font-bold">수상자 · {award.recipient}</p>
    <p className="my-4 leading-relaxed whitespace-pre-wrap text-sm">{award.reason}</p>
    <p>수여자 · {award.giver}</p>
    <p className="mt-2 text-[11px] text-[#80652c]">{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(award.given_at))}</p>
  </article>;
}

function AwardsWindow({ title, close, children, onShown }: { title: string; close: () => void; children: React.ReactNode; onShown?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus(); onShown?.();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []); // Opening, rather than a successful fetch, marks automatic display.
  return createPortal(<div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-3">
    <div ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
      className="win-outset bg-[#c0c0c0] p-1 w-full max-w-lg max-h-[88dvh] flex flex-col text-black outline-none"
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); close(); }
        if (event.key === "Tab") {
          const items = box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']");
          if (!items?.length) return;
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box.current)) { event.preventDefault(); first.focus(); }
        }
      }}>
      <div className="desktop-titlebar bg-[#000080] text-white text-xs font-bold flex justify-between items-center px-2 py-1 gap-2">
        <span className="min-w-0 break-words">{title}</span><button className="win-btn text-black px-1 shrink-0" type="button" aria-label="상장 창 닫기" onClick={close}>✕</button>
      </div><div className="p-3 min-h-0 overflow-y-auto text-xs space-y-3">{children}</div>
    </div>
  </div>, document.body);
}

function Schedule({ data }: { data: Snapshot }) {
  return <p className="leading-relaxed text-[#000080]">{data.can_issue ? <>🏆 연말 상장 수여 기간이에요!<br />12월 30일까지 모임원에게 특별한 상을 선물해 보세요. ♡</> : data.auto_ceremony_day ? <>🎉 오늘은 BOOK CLUB 98 연말 시상식 날이에요!<br />상장 수여는 마감되었어요.</> : <>🏆 상장은 {data.operating_year}년 12월 1일~30일에만 수여할 수 있어요.<br />받은 상장은 언제든 다시 볼 수 있답니다. ♡</>}</p>;
}

export function AwardsHub({ group, member, author, ready, blocked }: { group: string; member: string; author: string; ready: boolean; blocked: boolean }) {
  const [meta, setMeta] = useState<Snapshot | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [mode, setMode] = useState<"member" | "ceremony" | null>(null);
  const [recipient, setRecipient] = useState("");
  const [stage, setStage] = useState<"list" | "edit" | "preview">("list");
  const [giver, setGiver] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [automatic, setAutomatic] = useState(false);
  const [tick, setTick] = useState(0);
  const locked = useRef(false);
  const submission = useRef<{ payload: string; id: string } | null>(null);
  const automaticInTab = useRef(false);
  const autoRequest = useRef<AbortController | null>(null);
  useEffect(() => () => autoRequest.current?.abort(), []);
  const guard = useRef({ blocked, mode, ready }); guard.current = { blocked, mode, ready };
  const isTyping = () => !!document.activeElement?.closest("input,textarea,select,[contenteditable='true']");
  const canAuto = () => guard.current.ready && !guard.current.blocked && !guard.current.mode && !isTyping() &&
    document.visibilityState === "visible" && !document.querySelector('[role="dialog"], [aria-modal="true"]');
  const seen = (year: number) => {
    try { return localStorage.getItem(`awards_year_end_seen:${group}:${year}`) === "1"; } catch { return false; }
  };
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const next: Snapshot = await request(group, { action: "read", offset: 0 }, abort.signal);
        if (!abort.signal.aborted) {
          setMeta(next);
          setData(current => current ? { ...current, server_now: next.server_now, can_issue: next.can_issue,
            auto_ceremony_day: next.auto_ceremony_day, ceremony_available: next.ceremony_available, members: next.members } : current);
        }
      } catch { /* Retry on the next interval/focus; never mark a failed read as seen. */ }
      finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [group, ready]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!meta?.auto_ceremony_day || !meta.total_count || automaticInTab.current || seen(meta.operating_year) || !canAuto() || locked.current) return;
    const abort = new AbortController();
    autoRequest.current = abort;
    locked.current = true;
    void readAwards(group, abort.signal).then(next => {
      if (abort.signal.aborted || !canAuto() || !next.auto_ceremony_day || !next.total_count || seen(next.operating_year)) return;
      setData(next); setMeta(next); setAutomatic(true); setMode("ceremony");
    }).catch(() => {}).finally(() => { locked.current = false; });
  }, [meta, tick, blocked, ready, mode, group]);
  const close = () => { if (!locked.current) { setMode(null); setError(""); setNotice(""); setAutomatic(false); } };
  const load = async () => {
    setBusy(true); setError("");
    try { const next = await readAwards(group); setData(next); setMeta(next); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const open = (next: "member" | "ceremony") => {
    if (locked.current) return;
    setAutomatic(false); setRecipient(member); setStage("list"); setIndex(0); setNotice(""); setData(null); setMode(next); void load();
  };
  const rows = data?.awards.filter(row => row.recipient === recipient) ?? [];
  const self = giver === recipient;
  const valid = !!data?.can_issue && data.members.includes(giver) && data.members.includes(recipient) && !self && length(title) > 0 && length(title) <= 30 && length(reason) > 0 && length(reason) <= 150;
  const draft: Award = { id: "preview", recipient, giver, title: title.trim(), reason: reason.trim(), given_at: data?.server_now ?? new Date(0).toISOString() };
  const save = async () => {
    if (!valid || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const payload = JSON.stringify([recipient, giver, title.trim(), reason.trim()]);
    try {
      if (submission.current?.payload !== payload) submission.current = { payload, id: crypto.randomUUID() };
      await request(group, { action: "give", recipient, giver, title: title.trim(), reason: reason.trim(), submission: submission.current.id });
      setStage("list"); setNotice("상장을 수여했어요! ♡"); setIndex(0);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  };
  return <>
    <div className="contents">
      {member !== "전체" && <button type="button" className="win-btn px-2 py-0.5 text-xs font-bold whitespace-nowrap" onClick={() => open("member")}>🏆 {member}의 상장</button>}
      {meta?.ceremony_available && <button type="button" className="win-btn px-2 py-0.5 text-xs font-bold" onClick={() => open("ceremony")}>🏆 연말 시상식 보기</button>}
    </div>
    {mode && <AwardsWindow title={mode === "ceremony" ? "🏆 YEAR_END_AWARDS.exe" : `🏆 AWARDS_98.exe — ${recipient}의 상장`} close={close}
      onShown={automatic && data ? () => {
        automaticInTab.current = true;
        try { localStorage.setItem(`awards_year_end_seen:${group}:${data.operating_year}`, "1"); } catch { /* This tab still remembers the display. */ }
      } : undefined}>
      {busy && <p role="status">상장을 불러오는 중이에요…</p>}
      {error && <div role="alert" className="text-red-800">{error} <button className="win-btn px-2" onClick={() => void load()} disabled={busy}>다시 불러오기</button></div>}
      {notice && <p role="status">{notice}</p>}
      {data && <>
        {mode === "ceremony" ? <>
          <h2 className="text-center text-lg font-bold">🏆 {data.operating_year} 연말 시상식 🏆</h2>
          <p className="text-center">BOOK CLUB 98 · 총 {data.total_count}장 · 수상자 {new Set(data.awards.map(row => row.recipient)).size}명</p>
          {!data.total_count && <p>아직 수여된 상장이 없어요.</p>}
          {data.awards.map((award, i) => <section key={award.id} className="space-y-2">
            {(i === 0 || data.awards[i - 1].recipient !== award.recipient) && <h3 className="font-bold pt-2">🏆 {award.recipient}의 상장</h3>}
            <Certificate award={award} />
          </section>)}
        </> : <>
          <h2 className="font-bold">{recipient} · 받은 상장 {rows.length}장</h2><Schedule data={data} />
          {stage === "list" ? <>
            {rows.length ? <><Certificate award={rows[Math.min(index, rows.length - 1)]} /><div className="flex items-center justify-center gap-3">
              <button className="win-btn px-2 py-1" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>← 이전</button>
              <span>{Math.min(index + 1, rows.length)} / {rows.length}</span>
              <button className="win-btn px-2 py-1" disabled={index >= rows.length - 1} onClick={() => setIndex(i => i + 1)}>다음 →</button>
            </div></> : <p className="win-inset bg-white p-4 text-center">아직 받은 상장이 없어요.</p>}
            <button className="win-btn px-3 py-2" disabled={!data.can_issue || busy} onClick={() => {
              setGiver(data.members.includes(author) ? author : ""); setTitle(""); setReason(""); submission.current = null; setStage("edit"); setError(""); setNotice("");
            }}>＋ 상장 수여하기</button>
          </> : stage === "edit" ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (valid) setStage("preview"); }}>
            <p>받는 사람 · <strong>{recipient}</strong></p>
            <label className="block">수여하는 사람<select className="win-inset bg-white block w-full p-2 mt-1" value={giver} onChange={e => setGiver(e.target.value)}><option value="">모임원을 선택해 주세요</option>{data.members.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            {self && <p role="alert" className="text-red-800">본인에게는 상장을 줄 수 없어요!</p>}
            <label className="block">상 이름 · {length(title)}/30<input className="win-inset bg-white block w-full p-2 mt-1" value={title} onChange={e => setTitle(e.target.value)} required /></label>
            <label className="block">수여 이유 · {length(reason)}/150<textarea className="win-inset bg-white block w-full p-2 mt-1" rows={4} value={reason} onChange={e => setReason(e.target.value)} required /></label>
            {(length(title) > 30 || length(reason) > 150) && <p role="alert" className="text-red-800">상 이름은 30자, 이유는 150자까지 입력해 주세요.</p>}
            <div className="flex gap-2"><button type="button" className="win-btn px-3 py-2" onClick={() => setStage("list")}>← 목록</button><button className="win-btn px-3 py-2" disabled={!valid || busy}>상장 미리보기</button></div>
          </form> : <><p className="font-bold">미리보기 · 아직 저장되지 않았어요.</p><Certificate award={draft} /><div className="flex gap-2 flex-wrap">
            <button className="win-btn px-3 py-2" disabled={busy} onClick={() => setStage("edit")}>← 수정하기</button><button className="win-btn px-3 py-2" disabled={!valid || busy} onClick={() => void save()}>상장 수여하기 ♡</button>
          </div></>}
        </>}
      </>}
    </AwardsWindow>}
  </>;
}
