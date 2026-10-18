import { ApiError } from "./server";

// No arbitrary PostgREST expressions, joins, functions or table names.
export const readColumns: Record<string, string[]> = {
  books: [
    "id",
    "group_name",
    "user_name",
    "title",
    "author",
    "review",
    "genre",
    "rating",
    "target_member",
    "is_favorite",
    "is_revisit",
    "created_at",
    "ost_youtube_url",
    "ost_title",
    "ost_artist",
  ],
  book_comments: [
    "id",
    "book_id",
    "group_name",
    "user_name",
    "content",
    "created_at",
    "parent_comment_id",
    "is_deleted",
  ],
  goals: ["id", "group_name", "user_name", "target_count", "message"],
  bingo_states: ["group_name", "user_name", "cell_id", "checked"],
  reading_plans: [
    "id",
    "group_name",
    "user_name",
    "title",
    "author",
    "genre",
    "planned_date",
    "created_at",
  ],
  mailbox_notifications: [
    "id",
    "group_name",
    "recipient",
    "kind",
    "book_id",
    "source_id",
    "sender",
    "book_title",
    "preview",
    "created_at",
    "read_at",
  ],
  pet_diaries: ["id", "group_name", "generation_id", "generation_number", "diary_date", "species", "display_name", "stage", "title", "body", "is_final", "is_first", "template_version", "created_at"],
  pet_generations: [
    "id",
    "group_name",
    "generation_number",
    "species",
    "pet_name",
    "named_by",
    "xp",
    "stage",
    "color_variant",
    "decoration",
    "born_at",
    "adult_at",
    "died_at",
  ],
  pet_care_actions: [
    "id",
    "generation_id",
    "group_name",
    "user_name",
    "action_type",
    "action_date",
    "created_at",
  ],
};
const writable: Record<string, string[]> = {
  books: [
    "group_name",
    "user_name",
    "title",
    "author",
    "review",
    "genre",
    "rating",
    "target_member",
    "is_favorite",
    "is_revisit",
    "ost_youtube_url",
    "ost_title",
    "ost_artist",
  ],
  goals: ["group_name", "user_name", "target_count", "message"],
  bingo_states: ["group_name", "user_name", "cell_id", "checked"],
  reading_plans: [
    "group_name",
    "user_name",
    "title",
    "author",
    "genre",
    "planned_date",
  ],
  mailbox_notifications: ["read_at"],
  book_comments: [
    "book_id",
    "group_name",
    "user_name",
    "password",
    "content",
    "parent_comment_id",
  ],
};
const actions: Record<string, string[]> = {
  books: ["select", "insert", "update", "delete"],
  goals: ["select", "upsert"],
  bingo_states: ["select", "upsert"],
  reading_plans: ["select", "insert", "delete"],
  mailbox_notifications: ["select", "update"],
  book_comments: ["select", "insert"],
  pet_diaries: ["select"],
  pet_generations: ["select"],
  pet_care_actions: ["select"],
};
export const positiveId = (value: unknown) =>
  (typeof value === "number" && Number.isSafeInteger(value) && value > 0) ||
  (typeof value === "string" && /^[1-9][0-9]{0,15}$/.test(value));
export function text(value: unknown, maximum: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (required && !value.trim())
  )
    throw new ApiError("입력 내용을 확인해 주세요.");
}
export function planQuery(body: Record<string, any>, group: string) {
  const { table, action } = body;
  if (
    typeof table !== "string" ||
    !Object.hasOwn(actions, table) ||
    !actions[table].includes(action)
  )
    throw new ApiError("허용되지 않은 작업입니다.", 403);
  const available = readColumns[table];
  if (
    body.count !== undefined &&
    (action !== "select" || body.count !== "exact")
  )
    throw new ApiError("잘못된 개수 조회입니다.");
  const requested = body.columns ?? "*";
  if (typeof requested !== "string") throw new ApiError("잘못된 조회입니다.");
  const columns =
    requested === "*"
      ? available
      : requested.split(",").map((column: string) => column.trim());
  if (
    !columns.length ||
    columns.some((column: string) => !available.includes(column))
  )
    throw new ApiError("허용되지 않은 조회 항목입니다.", 403);
  const filters = body.filters ?? [];
  if (!Array.isArray(filters) || filters.length > 12)
    throw new ApiError("잘못된 조건입니다.");
  for (const filter of filters) {
    if (
      !filter ||
      !available.includes(filter.column) ||
      !["eq", "is", "not", "lte"].includes(filter.op)
    )
      throw new ApiError("잘못된 조건입니다.");
    if (
      filter.op === "lte" &&
      (filter.column !== "id" || !positiveId(filter.value))
    )
      throw new ApiError("잘못된 번호 조건입니다.");
    if (
      filter.column === "group_name" &&
      (filter.op !== "eq" || filter.value !== group)
    )
      throw new ApiError("다른 모임에 접근할 수 없습니다.", 403);
    if (
      filter.op === "eq" &&
      !["string", "number", "boolean"].includes(typeof filter.value)
    )
      throw new ApiError("잘못된 조건입니다.");
    if (typeof filter.value === "string" && filter.value.length > 300)
      throw new ApiError("잘못된 조건입니다.");
    if ((filter.op === "is" || filter.op === "not") && filter.value !== null)
      throw new ApiError("잘못된 조건입니다.");
    if (filter.op === "not" && filter.operator !== "is")
      throw new ApiError("잘못된 조건입니다.");
  }
  const orders = body.orders ?? [];
  if (
    !Array.isArray(orders) ||
    orders.length > 3 ||
    orders.some(
      (order) =>
        !order ||
        !available.includes(order.column) ||
        typeof order.ascending !== "boolean",
    )
  )
    throw new ApiError("잘못된 정렬입니다.");
  const range = body.range ?? [0, (body.limit ?? 1000) - 1];
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every(Number.isSafeInteger) ||
    range[0] < 0 ||
    range[1] < range[0] ||
    range[1] - range[0] >= 1000 ||
    range[1] > 100000
  )
    throw new ApiError("조회 범위를 확인해 주세요.");
  if (
    body.single !== undefined &&
    !["single", "maybeSingle"].includes(body.single)
  )
    throw new ApiError("잘못된 조회입니다.");
  if (["update", "delete"].includes(action)) {
    const hasId = filters.some(
      (f: any) => f.op === "eq" && f.column === "id" && positiveId(f.value),
    );
    const hasRecipient = filters.some(
      (f: any) =>
        f.op === "eq" &&
        f.column === "recipient" &&
        typeof f.value === "string" &&
        f.value.trim(),
    );
    if (!hasId && !(table === "mailbox_notifications" && hasRecipient))
      throw new ApiError("수정할 대상을 선택해 주세요.");
  }
  const rows =
    body.rows === undefined
      ? []
      : Array.isArray(body.rows)
        ? body.rows
        : [body.rows];
  if (!["select", "delete"].includes(action)) {
    if (
      rows.length < 1 ||
      rows.length > 9 ||
      (action === "update" && rows.length !== 1)
    )
      throw new ApiError("입력 개수를 확인해 주세요.");
    for (const row of rows) {
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        !Object.keys(row).length ||
        Object.keys(row).some((key) => !writable[table]?.includes(key))
      )
        throw new ApiError("허용되지 않은 입력 항목입니다.");
      if (row.group_name !== undefined && row.group_name !== group)
        throw new ApiError("다른 모임에 저장할 수 없습니다.", 403);
      for (const [key, value] of Object.entries(row)) {
        if (
          value === null &&
          [
            "target_member",
            "ost_youtube_url",
            "ost_title",
            "ost_artist",
            "parent_comment_id",
          ].includes(key)
        )
          continue;
        if (["is_favorite", "is_revisit", "checked"].includes(key)) {
          if (typeof value !== "boolean")
            throw new ApiError("잘못된 값입니다.");
        } else if (["book_id", "parent_comment_id"].includes(key)) {
          if (!positiveId(value)) throw new ApiError("잘못된 번호입니다.");
        } else if (key === "cell_id") {
          if (
            !Number.isInteger(value) ||
            (value as number) < 1 ||
            (value as number) > 9
          )
            throw new ApiError("빙고 칸을 확인해 주세요.");
        } else if (key === "target_count") {
          if (
            !Number.isInteger(value) ||
            (value as number) < 1 ||
            (value as number) > 100000
          )
            throw new ApiError("목표 권수를 확인해 주세요.");
        } else
          text(
            value,
            ["review", "content", "message"].includes(key)
              ? 10000
              : key === "target_member"
                ? 1000
                : key === "password"
                  ? 4
                  : ["user_name", "group_name"].includes(key)
                    ? 120
                    : 1000,
            ["user_name", "title", "content"].includes(key),
          );
      }
      if (
        table === "book_comments" &&
        (!positiveId(row.book_id) ||
          !/^\d{4}$/.test(row.password) ||
          typeof row.content !== "string" ||
          typeof row.user_name !== "string")
      )
        throw new ApiError("댓글 입력 내용을 확인해 주세요.");
      if (
        table === "mailbox_notifications" &&
        (typeof row.read_at !== "string" ||
          !Number.isFinite(Date.parse(row.read_at)))
      )
        throw new ApiError("읽음 시간을 확인해 주세요.");
      if (table !== "mailbox_notifications" && action !== "update")
        row.group_name = group;
    }
  }
  const conflicts: Record<string, string> = {
    goals: "group_name,user_name",
    bingo_states: "group_name,user_name,cell_id",
  };
  if (action === "upsert" && body.conflict !== conflicts[table])
    throw new ApiError("잘못된 저장 방식입니다.");
  return {
    count: body.count === "exact",
    table,
    action,
    columns: columns.join(","),
    filters,
    orders,
    range,
    rows,
    conflict: conflicts[table],
    single: body.single,
    returning: body.columns !== undefined && action !== "select",
  };
}
