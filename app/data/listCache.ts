// Bounded tab-memory cache. No session cookies, PINs or form drafts.
type Entry = { value?: unknown[]; savedAt: number; pending?: Promise<unknown[]> };
const entries = new Map<string, Entry>();
export const listKey = (group: string, kind: "plans" | "reviews") => JSON.stringify([group, kind]);
export function peekList<T>(key: string): T[] | undefined {
  return entries.get(key)?.value as T[] | undefined;
}
export function clearGroupLists(group: string) {
  for (const key of Array.from(entries.keys())) if (JSON.parse(key)[0] === group) entries.delete(key);
}
export async function readList<T>(key: string, loader: () => Promise<T[]>, force = false): Promise<T[]> {
  const old = entries.get(key);
  if (!force && old?.pending) return old.pending as Promise<T[]>;
  if (!force && old?.value && Date.now() - old.savedAt < 15000) return old.value as T[];
  const entry: Entry = { value: old?.value, savedAt: old?.savedAt || 0 };
  entries.delete(key); entries.set(key, entry);
  for (const [candidate, value] of Array.from(entries)) {
    if (entries.size <= 8) break;
    if (candidate !== key && !value.pending) entries.delete(candidate);
  }
  const promise = Promise.resolve().then(loader);
  entry.pending = promise as Promise<unknown[]>;
  try {
    const rows = await promise;
    if (entries.get(key) === entry) { entry.value = rows; entry.savedAt = Date.now(); }
    return rows;
  } finally {
    if (entries.get(key) === entry) entry.pending = undefined;
    for (const [candidate, value] of Array.from(entries)) {
      if (entries.size <= 8) break;
      if (!value.pending) entries.delete(candidate);
    }
  }
}
