import "server-only";
import webpush from "web-push";
import { admin } from "./server";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:bookclub98@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendNewReviewPush(
  group: string,
  info: {
    title: string;
    author?: string | null;
    userName?: string | null;
    excludeEndpoint?: string | null;
  },
) {
  try {
    if (!ensureVapid()) return;

    const { data: rows, error } = await admin()
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("group_name", group);

    if (error || !rows?.length) return;

    const targets = info.excludeEndpoint
      ? rows.filter((row) => row.endpoint !== info.excludeEndpoint)
      : rows;

    if (!targets.length) return;

    const who = info.userName?.trim() || "모임원";
    const book = info.author?.trim()
      ? `『${info.title}』 (${info.author})`
      : `『${info.title}』`;

    const payload = JSON.stringify({
      title: `📚 ${who}님의 새 리뷰`,
      body: `${book} 리뷰가 등록됐어요!`,
      url: "/?" + new URLSearchParams({ group }).toString(),
    });

    const expiredIds: number[] = [];

    await Promise.allSettled(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            expiredIds.push(sub.id);
          }
        }
      }),
    );

    if (expiredIds.length > 0) {
      await admin()
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }
  } catch {
    // 푸시 전송 실패가 리뷰 저장 자체를 막지 않도록 무시합니다.
  }
}
