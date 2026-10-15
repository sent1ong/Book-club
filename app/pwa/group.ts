// Keep the existing page.tsx group rules and exact group spelling.
export function readGroup(url: string): string | null {
  const group = new URL(url).searchParams.get("group") || "기본모임";
  if (group === "기본모임") return group;
  const match = group.match(/^(nogmbdj|forgaedus)(\d+)$/);
  return match && parseInt(match[2], 10) >= 26 ? group : null;
}

export function groupQuery(group: string): string {
  return new URLSearchParams({ group }).toString();
}
