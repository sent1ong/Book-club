import { groupQuery, readGroup } from "../group";

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

export function GET(request: Request) {
  const group = readGroup(request.url);
  if (group === null) return new Response("Invalid group", { status: 400 });
  const query = groupQuery(group);
  // A route response bypasses layout metadata: exactly one manifest, in initial HTML.
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#008080">
    <title>모임 설치 - Book Club 98</title>
    <link rel="manifest" href="/pwa/manifest?${escapeHtml(query)}">
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
      <h1>이 모임 설치</h1>
      <p>${escapeHtml(group)}</p>
      <p id="status" role="status">안드로이드 Chrome 일반 탭에서 이 주소를 여세요. 설치 버튼이 나타나지 않으면 Chrome 메뉴의 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 확인하세요. 여러 모임 설치는 기기와 Chrome의 지원에 따라 제한될 수 있습니다.</p>
      <button id="install" type="button" hidden>이 모임 설치</button>
      <a href="/?${escapeHtml(query)}">모임으로 돌아가기</a>
    </main>
    <script>
      let pending = null;
      const button = document.getElementById("install");
      const status = document.getElementById("status");
      window.addEventListener("beforeinstallprompt", (event) => {
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
