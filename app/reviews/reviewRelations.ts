export type WorkRating = { participants: number; average: number; maximum: number; minimum: number; gap: number };
type Review = { id: number; group_name: string; genre: string; title: string; author: string; user_name: string; rating: string };

// Author matching is the existing predicate, not a new canonicalization rule.
// Cache each exact author view: the predicate need not be transitive across aliases.
export function buildReviewRelations<T extends Review>(
  reviews: readonly T[], normalizeTitle: (value: string) => string,
  sameAuthors: (a: string, b: string) => boolean,
  score: (value: string) => number | undefined,
) {
  const relatedById = new Map<number, T[]>(), ratingsById = new Map<number, WorkRating>();
  const buckets = new Map<string, T[]>();
  for (const row of reviews) {
    const key = JSON.stringify([row.group_name, row.genre, normalizeTitle(row.title)]);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row); else buckets.set(key, [row]);
  }
  buckets.forEach(bucket => {
    const views = new Map<string, { rows: T[]; rating?: WorkRating; related: Map<string, T[]> }>();
    for (const book of bucket) {
      let view = views.get(book.author);
      if (!view) {
        const rows = bucket.filter(row => sameAuthors(row.author, book.author));
        const latest = new Map<string, { id: number; score: number }>();
        for (const row of rows) {
          const value = score(row.rating);
          if (value === undefined || !Number.isFinite(value)) continue;
          const previous = latest.get(row.user_name);
          // Same trustworthy ID ordering already used by newest reviews and gap badges.
          if (!previous || row.id > previous.id) latest.set(row.user_name, { id: row.id, score: value });
        }
        let total = 0, minimum = Infinity, maximum = -Infinity;
        latest.forEach(row => { total += row.score; minimum = Math.min(minimum, row.score); maximum = Math.max(maximum, row.score); });
        const rating = latest.size >= 2 ? { participants: latest.size, average: total / latest.size, maximum, minimum, gap: maximum - minimum } : undefined;
        view = { rows, rating, related: new Map() }; views.set(book.author, view);
      }
      let related = view.related.get(book.user_name);
      if (!related) {
        related = view.rows.filter(row => row.user_name !== book.user_name);
        view.related.set(book.user_name, related);
      }
      relatedById.set(book.id, related);
      if (view.rating) ratingsById.set(book.id, view.rating);
    }
  });
  return { relatedById, ratingsById };
}

export function summarizeWorks<T extends Review>(reviews: readonly T[], normalizeTitle: (value: string) => string, sameAuthors: (a: string, b: string) => boolean) {
  const buckets = new Map<string, { author: string; members: Set<string> }[]>();
  let works = 0, shared = 0;
  for (const row of reviews) {
    if (!row.title?.trim()) continue;
    const key = JSON.stringify([row.group_name, row.genre, normalizeTitle(row.title)]);
    const groups = buckets.get(key) || [];
    let work = groups.find(value => sameAuthors(row.author, value.author));
    if (!work) { work = { author: row.author, members: new Set() }; groups.push(work); buckets.set(key, groups); works++; }
    const previous = work.members.size;
    if (row.user_name?.trim()) work.members.add(row.user_name);
    if (previous < 2 && work.members.size >= 2) shared++;
  }
  return { reviews: reviews.length, works, shared };
}

export type YearSummary = { reviews: number; works: number; shared: number; genres?: { names: string[]; count: number }; divided?: { id: number; title: string; gap: number } };
export function yearHighlights<T extends Review>(reviews: readonly T[], ratings: ReadonlyMap<number, WorkRating>) {
  const counts = new Map<string, number>(); let divided: YearSummary["divided"];
  for (const row of reviews) {
    if (row.genre?.trim()) counts.set(row.genre, (counts.get(row.genre) || 0) + 1);
    const rating = ratings.get(row.id);
    if (rating && rating.gap > 0 && (!divided || rating.gap > divided.gap || rating.gap === divided.gap && row.id < divided.id)) divided = { id: row.id, title: row.title, gap: rating.gap };
  }
  const maximum = Math.max(0, ...Array.from(counts.values()));
  const genres = maximum ? { names: Array.from(counts).filter(([,n]) => n === maximum).map(([name]) => name).sort((a,b) => a.localeCompare(b, "ko")), count: maximum } : undefined;
  return { genres, divided };
}
