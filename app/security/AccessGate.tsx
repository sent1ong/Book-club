"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isRegisteredGroup } from "./groups";

export default function AccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const group = params.get("group") || "기본모임";
  const [readyGroup, setReadyGroup] = useState<string | null>(null);
  const [message, setMessage] = useState("모임 접속을 확인하고 있어요.");
  const [retry, setRetry] = useState(0);
  const [invitation, setInvitation] = useState("");
  const [accessState, setAccessState] = useState<{
    group: string;
    phase: "checking" | "denied" | "error";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessage("모임 접속을 확인하고 있어요.");
    setReadyGroup(null);
    setAccessState({ group, phase: "checking" });
    if (!isRegisteredGroup(group)) {
      setAccessState({ group, phase: "error" });
      setMessage(
        "등록되지 않은 모임입니다. 전달받은 모임 링크로 접속해 주세요.",
      );
      return;
    }
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const invite = fragment.get("invite");
    void fetch("/api/bookclub/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ group, invite }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setAccessState({
            group,
            phase: response.status === 403 ? "denied" : "error",
          });
          setMessage(
            result.error?.message ||
              "접속을 확인하지 못했습니다. 다시 시도해 주세요.",
          );
          return;
        }
        if (invite) {
          fragment.delete("invite");
          url.hash = fragment.toString();
          window.history.replaceState(
            window.history.state,
            "",
            url.pathname + url.search + url.hash,
          );
        }
        setReadyGroup(group);
      })
      .catch((error) => {
        if (!cancelled) {
          setAccessState({ group, phase: "error" });
          setReadyGroup(null);
          setMessage(error.message || "연결을 확인해 주세요.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [group, retry]);

  if (readyGroup === group) return <>{children}</>;
  const checking =
    !accessState ||
    accessState.group !== group ||
    accessState.phase === "checking";
  const showInvitation =
    !checking &&
    accessState?.phase === "denied" &&
    isRegisteredGroup(group) &&
    group !== "forgaedus26" &&
    group !== "nogmbdj26";
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#008080] p-6">
      <div className="win-outset bg-[#c0c0c0] p-5 max-w-md text-sm">
        <h1 className="font-bold mb-3">BOOK CLUB 98</h1>
        <p role="status">{checking ? "모임을 불러오고 있어요." : message}</p>
        {showInvitation && (
          <>
            <p className="mt-3">
              새로 설치한 앱에서 접속 권한을 찾지 못하면 전달받은 이 모임의 초대
              링크를 아래에 붙여넣어 주세요.
            </p>
            <label className="block mt-3">
              비밀 초대 링크
              <input
                type="password"
                autoComplete="off"
                value={invitation}
                onChange={(event) => setInvitation(event.target.value)}
                className="win-inset block w-full p-2 mt-1"
              />
            </label>
            <button
              type="button"
              className="win-btn mt-3 px-4 py-2"
              onClick={() => {
                try {
                  const link = new URL(invitation);
                  if (
                    link.origin !== window.location.origin ||
                    link.pathname !== "/" ||
                    link.searchParams.get("group") !== group ||
                    !new URLSearchParams(link.hash.slice(1)).get("invite")
                  )
                    throw Error();
                  window.history.replaceState(
                    window.history.state,
                    "",
                    link.pathname + link.search + link.hash,
                  );
                  setInvitation("");
                  setAccessState({ group, phase: "checking" });
                  setReadyGroup(null);
                  setRetry((value) => value + 1);
                } catch {
                  setMessage("이 모임의 초대 링크를 확인해 주세요.");
                }
              }}
            >
              초대 링크 연결
            </button>
          </>
        )}
        {!checking && (
          <button
            type="button"
            className="win-btn mt-4 px-4 py-2"
            onClick={() => {
              setReadyGroup(null);
              setAccessState({ group, phase: "checking" });
              setRetry((value) => value + 1);
            }}
          >
            다시 확인
          </button>
        )}
      </div>
    </main>
  );
}
