// Public display names only. Invitation secrets are never bundled here.
export const GROUPS = [
  "forgaedus26",
  "nogmbdj26",
  ...[27, 28, 29, 30].flatMap((year) => ["forgaedus" + year, "nogmbdj" + year]),
];
export function isRegisteredGroup(group: string | null): group is string {
  return group !== null && GROUPS.includes(group);
}
