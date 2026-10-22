// Only toolbar-created reviews opt into syntax. Legacy punctuation stays literal.
export const FORMAT_MARKER = "\u2063bc98fmt1\u2063";
export type ReviewRun = { text: string; style: number };
const cache = new Map<string, ReviewRun[]>();
export function editReviewText(text: string) { return text.replace(FORMAT_MARKER, ""); }
export function reviewRuns(source: string): ReviewRun[] {
  const hit = cache.get(source); if (hit) return hit;
  if (!source.includes(FORMAT_MARKER)) return [{ text: source, style: 0 }];
  const text = editReviewText(source), runs: ReviewRun[] = [], stack: { token: string; bit: number; start: number }[] = [];
  let style = 0;
  const push = (value: string) => { const last = runs[runs.length - 1]; if (last?.style === style) last.text += value; else runs.push({ text: value, style }); };
  for (let i = 0; i < text.length;) {
    if (text[i] === "\\" && /[*~=\\]/.test(text[i + 1] || "")) { push(text[i + 1]); i += 2; continue; }
    const top = stack[stack.length - 1];
    if (top && text.startsWith(top.token, i)) { stack.pop(); style &= ~top.bit; i += top.token.length; continue; }
    const token = ["**", "~~", "==", "*"].find(t => text.startsWith(t, i));
    if (token && text[i + token.length]) {
      const bit = token === "**" ? 1 : token === "*" ? 2 : token === "~~" ? 4 : 8;
      if (!(style & bit) && text.indexOf(token, i + token.length) > i + token.length) {
        stack.push({ token, bit, start: runs.length }); style |= bit; i += token.length; continue;
      }
    }
    push(text[i++]);
  }
  // Incomplete editing syntax stays readable rather than swallowing text.
  if (stack.length) return [{ text, style: 0 }];
  cache.set(source, runs); if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return runs;
}
export function plainReview(text: string) { return reviewRuns(text || "").map(run => run.text).join(""); }
export function reviewTags(text: string) { return plainReview(text).match(/#[^\s#]+/g) || []; }
export function toggleSelection(text: string, start: number, end: number, token: string) {
  if (start === end) return null;
  const selected = text.slice(start, end), before = text.slice(0, start), after = text.slice(end);
  if (before.endsWith(token) && after.startsWith(token)) return { text: before.slice(0, -token.length) + selected + after.slice(token.length), start: start - token.length, end: end - token.length };
  if (selected.startsWith(token) && selected.endsWith(token) && selected.length > token.length * 2) return { text: before + selected.slice(token.length, -token.length) + after, start, end: end - token.length * 2 };
  return { text: before + token + selected + token + after, start: start + token.length, end: end + token.length };
}
