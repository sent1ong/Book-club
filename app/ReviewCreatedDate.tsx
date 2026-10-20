import React from "react";

const koreanDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul", calendar: "gregory", numberingSystem: "latn",
  year: "2-digit", month: "2-digit", day: "2-digit",
});

// Accept only an explicit timestamp with a timezone, never inferred dates.
export function formatReviewCreatedDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1]
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(4, 6)) > 59
    || (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4, 6)) !== 0))) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  const parts = koreanDate.formatToParts(timestamp);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}.${part("month")}.${part("day")}`;
}

export function ReviewCreatedDate({ value, trusted }: { value: unknown; trusted: boolean }) {
  const formatted = trusted ? formatReviewCreatedDate(value) : null;
  return formatted ? <time dateTime={value as string} className="block text-right text-[10px] leading-4 font-normal tracking-normal text-gray-400 whitespace-nowrap">{formatted}</time> : null;
}
