import { NextRequest } from "next/server";
import { admin, ApiError, authorize, fail, rateLimit, readBody } from "../../../security/server";
import { isRegisteredGroup } from "../../../security/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (typeof body.group !== "string" || !isRegisteredGroup(body.group)) throw new ApiError("등록되지 않은 모임입니다.", 404);
    const [room] = await Promise.all([authorize(request, body.group), rateLimit(request, body.group, "awards", 120)]);
    const group = room.group_name;
    let result;
    if (body.action === "read") {
      if (!Number.isSafeInteger(body.offset) || body.offset < 0 ||
        !(body.before === undefined || (typeof body.before === "string" && /^\d{1,19}$/.test(body.before)))) throw new ApiError("조회 범위를 확인해 주세요.");
      result = await admin().rpc("bc_awards_read", { p_group: group, p_offset: body.offset, p_limit: 200,
        p_before_id: body.before ?? null });
    } else if (body.action === "give") {
      await rateLimit(request, group, "awards-give", 20);
      for (const [key, max] of [["recipient", 120], ["giver", 120], ["title", 30], ["reason", 150]] as const) {
        if (typeof body[key] !== "string" || !body[key].trim() || Array.from(body[key].trim()).length > max) throw new ApiError("이름과 상장 내용을 확인해 주세요.");
      }
      if (body.recipient === body.giver) throw new ApiError("본인에게는 상장을 줄 수 없어요!");
      if (typeof body.submission !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.submission)) throw new ApiError("제출 번호를 확인해 주세요.");
      result = await admin().rpc("bc_awards_give", { p_group: group, p_recipient: body.recipient, p_giver: body.giver,
        p_title: body.title.trim(), p_reason: body.reason.trim(), p_submission_id: body.submission });
    } else throw new ApiError("잘못된 요청입니다.");
    if (result.error) {
      // Only show intentional validation messages, never internal DB details.
      const known = ["본인에게는", "상장 수여 기간", "수여 기간", "수여가 중단", "모임원", "제출 번호", "이미 사용", "같은 제출"];
      const message = result.error.message;
      throw new ApiError(known.some(prefix => message.includes(prefix)) ? message : "상장을 처리하지 못했어요. 기간과 모임원을 확인하고 다시 시도해 주세요.", 400);
    }
    return Response.json({ data: result.data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}
