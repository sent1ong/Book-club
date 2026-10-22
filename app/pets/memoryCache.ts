// Per-tab memory only: never persist room data or cache authenticated HTTP responses.
export class PetMemoryCache {
  private entries = new Map<string, { value: unknown; savedAt: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private versions = new Map<string, number>();
  private key(group: string, resource: string) { return JSON.stringify([group, resource]); }
  peek<T>(group: string, resource: string, maxAge = 300000) {
    const entry = this.entries.get(this.key(group, resource));
    return entry && Date.now() - entry.savedAt <= maxAge ? entry as { value: T; savedAt: number } : undefined;
  }
  invalidate(group: string) {
    this.versions.set(group, (this.versions.get(group) || 0) + 1);
    for (const key of Array.from(this.entries.keys())) if (JSON.parse(key)[0] === group) this.entries.delete(key);
    for (const key of Array.from(this.pending.keys())) if (JSON.parse(key)[0] === group) this.pending.delete(key);
  }
  async load<T>(group: string, resource: string, fetcher: () => Promise<T>, ttl: number, force = false): Promise<T> {
    const key = this.key(group, resource);
    const cached = this.peek<T>(group, resource, ttl);
    if (!force && cached) return cached.value;
    const inflight = this.pending.get(key);
    if (inflight) return inflight as Promise<T>;
    const version = this.versions.get(group) || 0;
    const promise = Promise.resolve().then(fetcher).then(value => {
      // A mutation or access denial must not resurrect the old request's snapshot.
      if ((this.versions.get(group) || 0) !== version) return this.load(group, resource, fetcher, ttl, true);
      this.entries.delete(key);
      this.entries.set(key, { value, savedAt: Date.now() });
      if (this.entries.size > 128) this.entries.delete(this.entries.keys().next().value!);
      return value;
    });
    this.pending.set(key, promise);
    try { return await promise; }
    finally { if (this.pending.get(key) === promise) this.pending.delete(key); }
  }
}
export const petMemory = new PetMemoryCache();
