import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { isRegisteredGroup } from "./groups";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

let sharedClient: SupabaseClient<any> | undefined;

export function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError("서버 설정을 확인해 주세요.", 503);
  if (!sharedClient)
    sharedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return sharedClient;
}

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function secret() {
  const value = process.env.BOOKCLUB_SESSION_SECRET;
  if (!value || value.length < 48)
    throw new ApiError("서버 설정을 확인해 주세요.", 503);
  return value;
}
function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookieName(group: string) {
  return "bc98_" + group;
}
export function signSession(group: string, version: number) {
  const payload = Buffer.from(
    JSON.stringify({
      group,
      version,
      exp: Math.floor(Date.now() / 1000) + 86400 * 180,
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
export function validSession(
  value: string | undefined,
  group: string,
  version: number,
) {
  if (!value || value.length > 1000) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  if (
    !equal(
      signature,
      createHmac("sha256", secret()).update(payload).digest("base64url"),
    )
  )
    return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      parsed.group === group &&
      parsed.version === version &&
      Number.isInteger(parsed.exp) &&
      parsed.exp > Date.now() / 1000
    );
  } catch {
    return false;
  }
}

export async function room(group: unknown) {
  if (typeof group !== "string" || !isRegisteredGroup(group))
    throw new ApiError("등록되지 않은 모임입니다.", 404);
  const { data, error } = await admin()
    .from("bookclub_rooms")
    .select("group_name,invite_hash,access_version,legacy,enabled")
    .eq("group_name", group)
    .maybeSingle();
  if (error) throw new ApiError("모임 설정을 확인하지 못했습니다.", 503);
  if (!data?.enabled) throw new ApiError("이용할 수 없는 모임입니다.", 403);
  return data as {
    group_name: string;
    invite_hash: string | null;
    access_version: number;
    legacy: boolean;
    enabled: boolean;
  };
}
export async function authorize(request: NextRequest, group: unknown) {
  const found = await room(group);
  if (
    !found.legacy &&
    !validSession(
      request.cookies.get(cookieName(found.group_name))?.value,
      found.group_name,
      found.access_version,
    )
  ) {
    throw new ApiError("전달받은 비밀 초대 링크로 다시 접속해 주세요.", 403);
  }
  return found;
}
export function validInvite(invite: unknown, hash: string | null) {
  return (
    typeof invite === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(invite) &&
    hash !== null &&
    equal(sha256(invite), hash)
  );
}
export function assertOrigin(request: NextRequest) {
  const configured = process.env.BOOKCLUB_ORIGIN;
  if (!configured) throw new ApiError("서버 설정을 확인해 주세요.", 503);
  const origin = new URL(configured).origin;
  if (request.headers.get("origin") !== origin)
    throw new ApiError("허용되지 않은 요청입니다.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("잘못된 요청 형식입니다.", 415);
}
export async function readBody(request: NextRequest) {
  assertOrigin(request);
  // Limit actual streamed bytes, not only the optional Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("요청 내용이 없습니다.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new ApiError("입력 내용이 너무 깁니다.", 413);
    }
    chunks.push(next.value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw Error();
    return parsed as Record<string, any>;
  } catch {
    throw new ApiError("잘못된 요청 형식입니다.");
  }
}
export async function rateLimit(
  request: NextRequest,
  group: string,
  category: string,
  limit: number,
  seconds = 60,
) {
  // Vercel overwrites this header; do not use client-supplied x-forwarded-for.
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = createHmac("sha256", secret())
    .update([category, group, ip].join(":"))
    .digest("hex");
  const { data, error } = await admin().rpc("bc_take_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new ApiError("접속 상태를 확인해 주세요.", 503);
  if (!data)
    throw new ApiError(
      "요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.",
      429,
    );
}
export function fail(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json(
    {
      data: null,
      error: {
        message: known
          ? error.message
          : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
    },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
