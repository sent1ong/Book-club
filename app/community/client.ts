export type Objection = { id: string; book_id: string; user_name: string; content: string; created_at: string; closed?: boolean; witness?: { user_name: string; content: string; created_at: string } | null; can_manage: boolean; updated_at: string | null };
export type Objections = { counts: Record<string, number>; items: Objection[]; total_count: number };
export type ShelfPick = { user_name: string; book_id: string; title: string; author: string; reason: string; version: string; created_at: string; updated_at: string };
export type Shelf = { group_name: string; operating_year: number; server_now: string; can_edit: boolean; members: string[]; picks: ShelfPick[]; candidates: { id: string; title: string; author: string; created_at: string | null }[]; candidate_count: number };

export async function community<T>(group: string, body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/bookclub/community", { method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, group }) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  return result.data;
}
async function fetchShelf(group: string, member?: string, signal?: AbortSignal): Promise<Shelf> {
  const first = await community<Shelf>(group, { action: "shelf-read", member, offset: 0 }, signal);
  const rows = [...first.candidates];
  while (rows.length < first.candidate_count) {
    const page = await community<Shelf>(group, { action: "shelf-read", member, offset: rows.length }, signal);
    if (!page.candidates.length || page.candidate_count !== first.candidate_count) throw new Error("리뷰 목록이 바뀌었어요. 다시 불러와 주세요.");
    rows.push(...page.candidates);
  }
  if (rows.length !== first.candidate_count || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("리뷰 목록을 다시 불러와 주세요.");
  // Sort the complete candidate set, never individual pagination slices.
  const korean = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
  rows.sort((a, b) => korean.compare(a.title || "", b.title || "")
    || korean.compare(a.author || "", b.author || "") || korean.compare(a.id, b.id));
  return { ...first, candidates: rows };
}

const shelfCache = new Map<string, { value?: Shelf; at: number; pending?: Promise<Shelf> }>();
export function forgetShelf(group: string) { shelfCache.delete(group); }
export function peekShelf(group: string) { return shelfCache.get(group)?.value; }
export function invalidateShelf(group: string) {
  shelfCache.delete(group);
  window.dispatchEvent(new CustomEvent("bc98:shelf-invalidated", { detail: group }));
}
export function readShelf(group: string, member?: string, signal?: AbortSignal): Promise<Shelf> {
  if (member !== undefined) return fetchShelf(group, member, signal);
  const current = shelfCache.get(group);
  if (current?.pending) return current.pending;
  if (current?.value && Date.now() - current.at < 30000) return Promise.resolve(current.value);
  const entry: { value?: Shelf; at: number; pending?: Promise<Shelf> } = { value: current?.value, at: 0 };
  const pending = fetchShelf(group).then(value => {
    if (shelfCache.get(group) === entry) {
      entry.value = value; entry.at = Date.now();
      window.dispatchEvent(new CustomEvent("bc98:shelf-updated", { detail: group }));
    }
    return value;
  }).catch(error => {
    if (shelfCache.get(group) === entry) {
      entry.value = undefined;
      window.dispatchEvent(new CustomEvent("bc98:shelf-updated", { detail: group }));
    }
    throw error;
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
  entry.pending = pending; shelfCache.set(group, entry);
  if (shelfCache.size > 10) shelfCache.delete(shelfCache.keys().next().value!);
  return pending;
}
