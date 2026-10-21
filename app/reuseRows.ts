// Retain row/array identities after a read when scalar database fields did not change.
export function reuseRows<T extends { id: number }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map(row => [row.id, row]));
  let identical = current.length === incoming.length;
  const next = incoming.map((row, index) => {
    const previous = byId.get(row.id);
    const keys = Object.keys(row) as (keyof T)[];
    const same = previous && Object.keys(previous).length === keys.length && keys.every(key => previous[key] === row[key]);
    const retained = same ? previous : row;
    if (current[index] !== retained) identical = false;
    return retained;
  });
  return identical ? current : next;
}
