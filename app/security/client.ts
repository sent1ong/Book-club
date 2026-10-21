"use client";

import { petMemory } from "../pets/memoryCache";

type Result = {
  data: any;
  error: { message: string; unconfirmed?: boolean } | null;
  count?: number | null;
};

async function send(body: Record<string, unknown>): Promise<Result> {
  try {
    const response = await fetch("/api/bookclub", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await response.json();
    const group = typeof body.group === "string" ? body.group : "";
    if (group && (response.status === 401 || response.status === 403)) {
      petMemory.invalidate(group);
      window.dispatchEvent(new CustomEvent("bc98:pet-access-denied", { detail: group }));
    }
    const petMutation = body.kind === "rpc" &&
      ["pet_do_care", "pet_adopt_egg", "pet_name_baby"].includes(String(body.name));
    const activityMutation = body.kind === "query" && body.action !== "select" &&
      ["books", "book_comments", "reading_plans"].includes(String(body.table));
    if (group && !result.error && (petMutation || activityMutation || body.kind === "plan-review")) petMemory.invalidate(group);
    return result;
  } catch {
    return {
      data: null,
      error: { message: "연결을 확인하고 다시 시도해 주세요.", ...(body.kind === "plan-review" ? { unconfirmed: true } : {}) },
    };
  }
}

function currentGroup() {
  return typeof window === "undefined"
    ? ""
    : new URL(window.location.href).searchParams.get("group") || "기본모임";
}

class Query implements PromiseLike<Result> {
  private body: Record<string, any>;
  constructor(table: string) {
    this.body = {
      kind: "query",
      group: currentGroup(),
      table,
      action: "select",
      filters: [],
      orders: [],
    };
  }
  select(columns = "*", options?: { count?: "exact" }) {
    this.body.columns = columns;
    if (options?.count) this.body.count = options.count;
    return this;
  }
  insert(rows: any) {
    this.body.action = "insert";
    this.body.rows = rows;
    return this;
  }
  upsert(rows: any, options?: { onConflict?: string }) {
    this.body.action = "upsert";
    this.body.rows = rows;
    this.body.conflict = options?.onConflict;
    return this;
  }
  update(rows: any) {
    this.body.action = "update";
    this.body.rows = rows;
    return this;
  }
  delete() {
    this.body.action = "delete";
    return this;
  }
  eq(column: string, value: any) {
    this.body.filters.push({ op: "eq", column, value });
    return this;
  }
  is(column: string, value: any) {
    this.body.filters.push({ op: "is", column, value });
    return this;
  }
  lte(column: string, value: any) {
    this.body.filters.push({ op: "lte", column, value });
    return this;
  }
  not(column: string, operator: string, value: any) {
    this.body.filters.push({ op: "not", column, operator, value });
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.body.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.body.range = [from, to];
    return this;
  }
  limit(count: number) {
    this.body.limit = count;
    return this;
  }
  single() {
    this.body.single = "single";
    return this;
  }
  maybeSingle() {
    this.body.single = "maybeSingle";
    return this;
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return send(this.body).then(onfulfilled, onrejected);
  }
}

export const secureClient = {
  planReview: (args: { group: string; plan_id: string; submission: string; review: Record<string, unknown> }) => send({ ...args, kind: "plan-review" }),
  from: (table: string) => new Query(table),
  rpc: (name: string, args: Record<string, unknown>) =>
    send({ kind: "rpc", group: currentGroup(), name, args }),
  comment: (args: Record<string, unknown>) =>
    send({ ...args, kind: "comment" }),
};
