import { NextRequest } from "next/server";
import {
  admin,
  ApiError,
  authorize,
  fail,
  rateLimit,
  readBody,
} from "../../security/server";
import { planQuery, positiveId, text } from "../../security/query-policy";
import { isRegisteredGroup } from "../../security/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ok = (data: unknown, count?: number | null) =>
  Response.json(
    { data, error: null, ...(typeof count === "number" ? { count } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );

async function rowInGroup(table: string, id: unknown, group: string) {
  if (!positiveId(id)) throw new ApiError("잘못된 번호입니다.");
  const result = await admin()
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("group_name", group)
    .maybeSingle();
  if (result.error) throw new ApiError("대상을 확인하지 못했습니다.", 503);
  if (!result.data)
    throw new ApiError("이 모임의 대상을 찾을 수 없습니다.", 404);
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (typeof body.group !== "string" || !isRegisteredGroup(body.group))
      throw new ApiError("등록되지 않은 모임입니다.", 404);
    // Both checks must finish before any application data is queried or changed.
    const [found] = await Promise.all([
      authorize(request, body.group),
      rateLimit(request, body.group, "requests", 240),
    ]);
    const group = found.group_name;
    const db = admin();

    if (body.kind === "comment") {
      if (
        !["edit", "delete"].includes(body.action) ||
        !positiveId(body.id) ||
        typeof body.password !== "string" ||
        !/^\d{4}$/.test(body.password)
      )
        throw new ApiError("비밀번호는 숫자 4자리로 입력해 주세요.");
      if (body.action === "edit") text(body.content, 10000, true);
      await rateLimit(request, group, "comment-password", 15, 900);
      // An additional shared per-comment budget prevents guessing from rotating IPs.
      await rateLimit(request, group, "comment-" + body.id, 10, 900);
      const result = await db.rpc("bc_change_comment", {
        p_group: group,
        p_id: body.id,
        p_password: body.password,
        p_action: body.action,
        p_content: body.action === "edit" ? body.content : null,
      });
      if (result.error) throw new ApiError("댓글을 처리하지 못했습니다.", 503);
      if (!result.data)
        throw new ApiError(
          "비밀번호가 일치하지 않거나 댓글을 찾을 수 없습니다.",
          403,
        );
      return ok(true);
    }

    if (body.kind === "rpc") {
      await rateLimit(request, group, "pet", 60);
      const args = body.args;
      if (!args || typeof args !== "object" || Array.isArray(args))
        throw new ApiError("잘못된 요청입니다.");
      let parameters: Record<string, unknown>;
      if (["pet_check_lifecycle", "pet_adopt_egg"].includes(body.name)) {
        if (
          args.p_group_name !== group ||
          Object.keys(args).some((key) => key !== "p_group_name")
        )
          throw new ApiError("다른 모임에 접근할 수 없습니다.", 403);
        parameters = { p_group_name: group };
      } else if (body.name === "pet_do_care") {
        await rowInGroup("pet_generations", args.p_generation_id, group);
        text(args.p_user_name, 30, true);
        if (!["feed", "pet"].includes(args.p_action_type))
          throw new ApiError("잘못된 돌보기입니다.");
        parameters = {
          p_generation_id: args.p_generation_id,
          p_user_name: args.p_user_name,
          p_action_type: args.p_action_type,
        };
      } else if (body.name === "pet_name_baby") {
        await rowInGroup("pet_generations", args.p_generation_id, group);
        text(args.p_pet_name, 20, true);
        text(args.p_named_by, 30, true);
        parameters = {
          p_generation_id: args.p_generation_id,
          p_pet_name: args.p_pet_name,
          p_named_by: args.p_named_by,
        };
      } else throw new ApiError("허용되지 않은 기능입니다.", 403);
      const result = await db.rpc(body.name, parameters);
      if (result.error)
        throw new ApiError(
          body.name === "pet_do_care"
            ? "돌보기를 완료하지 못했습니다. 오늘 횟수와 펫 상태를 확인해 주세요."
            : "펫 상태를 확인한 뒤 다시 시도해 주세요.",
        );
      return ok(result.data);
    }

    if (body.kind !== "query") throw new ApiError("허용되지 않은 작업입니다.");
    const plan = planQuery(body, group);
    if (plan.action !== "select") await rateLimit(request, group, "writes", 60);
    if (plan.table === "book_comments" && plan.action === "insert") {
      if (plan.rows.length !== 1)
        throw new ApiError("댓글은 하나씩 등록해 주세요.");
      const row = plan.rows[0];
      const result = await db.rpc("bc_create_comment", {
        p_group: group,
        p_book_id: row.book_id,
        p_user_name: row.user_name,
        p_password: row.password,
        p_content: row.content,
        p_parent_id: row.parent_comment_id ?? null,
      });
      if (result.error)
        throw new ApiError(
          "댓글을 저장하지 못했습니다. 모임과 답글 대상을 확인해 주세요.",
        );
      return ok(null);
    }
    let query: any = db.from(plan.table);
    if (plan.action === "select")
      query = query.select(
        plan.columns,
        plan.count ? { count: "exact" } : undefined,
      );
    else if (plan.action === "insert") query = query.insert(plan.rows);
    else if (plan.action === "upsert")
      query = query.upsert(plan.rows, { onConflict: plan.conflict });
    else if (plan.action === "update") query = query.update(plan.rows[0]);
    else query = query.delete();
    // Always inject server-authorized group, including requests that filter only by id.
    if (!["insert", "upsert"].includes(plan.action))
      query = query.eq("group_name", group);
    for (const filter of plan.filters) {
      if (filter.op === "not")
        query = query.not(filter.column, filter.operator, filter.value);
      else query = query[filter.op](filter.column, filter.value);
    }
    if (plan.returning) query = query.select(plan.columns);
    if (plan.action === "select") {
      for (const order of plan.orders)
        query = query.order(order.column, { ascending: order.ascending });
      query = query.range(plan.range[0], plan.range[1]);
    }
    if (plan.single) query = query[plan.single]();
    const result = await query;
    if (result.error)
      throw new ApiError(
        "데이터를 처리하지 못했습니다. 입력 내용을 확인해 주세요.",
        400,
      );
    return ok(result.data, plan.count ? result.count : undefined);
  } catch (error) {
    return fail(error);
  }
}
