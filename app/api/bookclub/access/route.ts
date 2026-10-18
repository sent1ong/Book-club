import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  authorize,
  cookieName,
  fail,
  rateLimit,
  readBody,
  room,
  signSession,
  validInvite,
} from "../../../security/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const found = await room(body.group);
    await rateLimit(request, found.group_name, "access", 40);
    if (!found.legacy) {
      if (body.invite) {
        if (!validInvite(body.invite, found.invite_hash))
          throw new ApiError("초대 링크를 확인해 주세요.", 403);
      } else await authorize(request, found.group_name);
    }
    const response = NextResponse.json(
      { data: true, error: null },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    if (!found.legacy)
      response.cookies.set(
        cookieName(found.group_name),
        signSession(found.group_name, found.access_version),
        {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 86400 * 180,
        },
      );
    return response;
  } catch (error) {
    return fail(error);
  }
}
