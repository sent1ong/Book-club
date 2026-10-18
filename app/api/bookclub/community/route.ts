import { NextRequest } from "next/server";
import { admin, ApiError, authorize, fail, rateLimit, readBody } from "../../../security/server";
import { isRegisteredGroup } from "../../../security/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
const text = (value: unknown, max: number): value is string => typeof value === "string" && !!value.trim() && Array.from(value.trim()).length <= max;
const messages = ["이용할 수 없는 모임입니다.", "모임 운영 연도를 확인해 주세요.", "이 모임의 리뷰를 선택해 주세요.",
  "이 모임의 모임원을 선택해 주세요.", "이의 제기는 1~300자로 입력해 주세요.", "모임원을 선택해 주세요.",
  "같은 제출 번호로 다른 이의 제기를 저장할 수 없습니다.", "이 모임의 공동책장 등록 기간이 아닙니다.",
  "해당 연도에 본인이 등록한 완독 리뷰를 선택해 주세요.", "모임원과 선정 이유(1~200자)를 확인해 주세요.",
  "같은 제출 번호로 다른 선정을 저장할 수 없습니다.", "다른 화면에서 선정이 변경되었습니다. 다시 불러온 뒤 저장해 주세요."];

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (typeof body.group !== "string" || !isRegisteredGroup(body.group)) throw new ApiError("등록되지 않은 모임입니다.", 404);
    const [room] = await Promise.all([authorize(request, body.group), rateLimit(request, body.group, "community", 120)]);
    const group = room.group_name;
    let result;
    if (body.action === "objections-read") {
      if (!(body.book === undefined || id(body.book)) || !Number.isSafeInteger(body.offset) || body.offset < 0) throw new ApiError("조회 범위를 확인해 주세요.");
      result = await admin().rpc("bc_objections_read", { p_group: group, p_book_id: body.book ?? null, p_offset: body.offset, p_limit: 100 });
    } else if (body.action === "objections-create") {
      if (!id(body.book) || !text(body.member, 120) || !text(body.content, 300) || typeof body.submission !== "string" || !uuid.test(body.submission)) throw new ApiError("모임원과 이의 제기(1~300자)를 확인해 주세요.");
      await rateLimit(request, group, "objections-create", 20);
      result = await admin().rpc("bc_objections_create", { p_group: group, p_book_id: body.book, p_user_name: body.member, p_content: body.content.trim(), p_submission_id: body.submission });
    } else if (body.action === "shelf-read") {
      if (!(body.member === undefined || text(body.member, 120)) || !Number.isSafeInteger(body.offset) || body.offset < 0) throw new ApiError("조회 범위를 확인해 주세요.");
      result = await admin().rpc("bc_shared_shelf_read", { p_group: group, p_user_name: body.member ?? null, p_offset: body.offset, p_limit: 200 });
    } else if (body.action === "shelf-save") {
      if (!id(body.book) || !text(body.member, 120) || !text(body.reason, 200) || typeof body.submission !== "string" || !uuid.test(body.submission) || !(body.version === null || id(body.version))) throw new ApiError("선정 도서와 이유(1~200자)를 확인해 주세요.");
      await rateLimit(request, group, "shelf-save", 20);
      result = await admin().rpc("bc_shared_shelf_save", { p_group: group, p_user_name: body.member, p_book_id: body.book, p_reason: body.reason.trim(), p_submission_id: body.submission, p_expected_version: body.version });
    } else throw new ApiError("잘못된 요청입니다.");
    if (result.error) throw new ApiError(messages.includes(result.error.message) ? result.error.message : "처리하지 못했어요. 다시 불러온 뒤 시도해 주세요.", 400);
    return Response.json({ data: result.data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}
