import { NextRequest } from "next/server";
import {
  admin,
  ApiError,
  authorize,
  fail,
  rateLimit,
  readBody,
} from "../../../security/server";
import { isRegisteredGroup } from "../../../security/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (data: unknown) =>
  Response.json({ data, error: null }, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (typeof body.group !== "string" || !isRegisteredGroup(body.group)) {
      throw new ApiError("등록되지 않은 모임입니다.", 404);
    }

    const [found] = await Promise.all([
      authorize(request, body.group),
      rateLimit(request, body.group, "push", 30),
    ]);
    const group = found.group_name;
    const db = admin();

    if (body.action === "unsubscribe") {
      if (typeof body.endpoint !== "string" || !body.endpoint) {
        throw new ApiError("구독 정보를 확인해 주세요.");
      }
      const { error } = await db
        .from("push_subscriptions")
        .delete()
        .eq("group_name", group)
        .eq("endpoint", body.endpoint);
      if (error) throw new ApiError("알림 해제를 처리하지 못했습니다.", 503);
      return ok(true);
    }

    if (body.action === "subscribe") {
      const ua = request.headers.get("user-agent") || "";
      if (/Windows NT|X11; Linux/i.test(ua)) {
        throw new ApiError("모바일 기기에서만 알림을 설정할 수 있어요.", 400);
      }

      const sub = body.subscription;
      const endpoint = sub?.endpoint;
      const p256dh = sub?.keys?.p256dh;
      const auth = sub?.keys?.auth;

      if (
        typeof endpoint !== "string" ||
        !endpoint.startsWith("https://") ||
        endpoint.length > 1000 ||
        typeof p256dh !== "string" ||
        !p256dh ||
        typeof auth !== "string" ||
        !auth
      ) {
        throw new ApiError("올바른 알림 구독 정보가 아닙니다.");
      }

      const userName =
        typeof body.userName === "string" && body.userName.trim()
          ? body.userName.trim().slice(0, 60)
          : null;

      const { error } = await db.from("push_subscriptions").upsert(
        {
          group_name: group,
          endpoint,
          p256dh,
          auth,
          user_name: userName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "group_name,endpoint" },
      );

      if (error) throw new ApiError("알림 설정을 저장하지 못했습니다.", 503);
      return ok(true);
    }

    throw new ApiError("허용되지 않은 요청입니다.");
  } catch (error) {
    return fail(error);
  }
}
