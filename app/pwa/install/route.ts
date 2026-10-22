import { groupQuery, readGroup } from "../group";
import { NextRequest } from "next/server";
import { authorize, fail } from "../../security/server";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function GET(request: NextRequest) {
  const group = readGroup(request.url);
  if (group === null) return new Response("Invalid group", { status: 400 });
  try {
    await authorize(request, group);
  } catch (error) {
    return fail(error);
  }
  const query = groupQuery(group);
  // A route response bypasses layout metadata: exactly one manifest, in initial HTML.
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#008080">
    <title>앱 설치 방법 - Book Club 98</title>
    <link rel="manifest" crossorigin="use-credentials" href="/pwa/manifest?${escapeHtml(query)}">
    <style>
      body { background: #008080; font-family: sans-serif; padding: 24px; }
      main { max-width: 480px; margin: auto; padding: 24px; background: #c0c0c0; border: 3px outset white; }
      button, a { display: block; margin-top: 20px; padding: 12px; }
      button { font-size: 16px; }
      [hidden] { display: none !important; }
    </style>
  </head>
  <body>
    <main>
      <h1>앱 설치 방법</h1>
      <p>${escapeHtml(group)}</p>
      <section id="android-guide">
        <h2>안드로이드</h2>
        <p>모임별로 설치하려면 Chrome에서 열어주세요. 삼성 인터넷에서는 다른 모임도 이미 설치한 앱으로 표시되어 추가 설치가 제한될 수 있습니다.</p>
        <p>Chrome 일반 탭에서 원하는 모임을 연 뒤, 시작 → 앱 설치 방법으로 들어오세요. 아래 설치 버튼 또는 Chrome 메뉴의 ‘홈 화면에 추가’ → ‘설치’를 이용하세요. 메뉴 이름은 버전에 따라 다를 수 있습니다.</p>
        <p id="status" role="status">설치 후 각 아이콘을 눌러 해당 모임으로 열리는지 확인해 주세요.</p>
        <button id="install" type="button" hidden>이 모임 설치</button>
      </section>
      <section>
        <h2>iPhone · iPad</h2>
        <p>Safari에서 원하는 모임을 열고 공유 버튼 → ‘홈 화면에 추가’ → ‘추가’를 눌러주세요. ‘웹 앱으로 열기’ 항목이 보이면 켜주세요. 공유 버튼은 Safari 버전에 따라 더 보기 메뉴 안에 있을 수 있습니다.</p>
        <p>이 안내 화면 대신 아래 버튼으로 모임 화면으로 돌아간 뒤 추가해 주세요.</p>
        <a href="/?${escapeHtml(query)}">모임 화면으로 이동해서 홈 화면에 추가</a>
      </section>
      <a href="/?${escapeHtml(query)}">모임으로 돌아가기</a>
    </main>
    <script>
      let pending = null;
      const button = document.getElementById("install");
      const status = document.getElementById("status");
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS) document.getElementById("android-guide").hidden = true;
      window.addEventListener("beforeinstallprompt", (event) => {
        if (isIOS) return;
        event.preventDefault();
        pending = event;
        button.hidden = false;
      });
      button.addEventListener("click", async () => {
        const event = pending;
        if (!event) return;
        pending = null;
        button.hidden = true;
        try {
          await event.prompt();
          const choice = await event.userChoice;
          status.textContent = choice.outcome === "accepted"
            ? "설치 요청을 수락했습니다. 홈 화면의 아이콘 생성과 실행 모임을 확인해 주세요."
            : "설치를 취소했습니다. 다시 시도하려면 이 화면을 새로고침하세요.";
        } catch {
          status.textContent = "설치를 시작하지 못했습니다. Chrome 메뉴를 확인하거나 새로고침하세요.";
        }
      });
      window.addEventListener("appinstalled", () => {
        pending = null;
        button.hidden = true;
        status.textContent = "설치 이벤트를 확인했습니다. 홈 화면에서 모임 아이콘을 실행해 주세요.";
      });
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
