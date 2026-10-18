import { isRegisteredGroup } from "../security/groups";

export function readGroup(url: string): string | null {
  const group = new URL(url).searchParams.get("group") || "기본모임";
  return isRegisteredGroup(group) ? group : null;
}

export function groupQuery(group: string) {
  return new URLSearchParams({ group }).toString();
}
