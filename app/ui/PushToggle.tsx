"use client";

import { useEffect, useState } from "react";

export const PUSH_ENDPOINT_STORAGE_KEY = "bc98_push_endpoint";
const PUSH_GROUPS_STORAGE_KEY = "bc98_push_groups";

function getSubscribedGroups(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PUSH_GROUPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSubscribedGroup(groupName: string, endpoint: string | null) {
  const map = getSubscribedGroups();
  if (endpoint) {
    map[groupName] = endpoint;
    localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, endpoint);
  } else {
    delete map[groupName];
    const remaining = Object.values(map);
    if (remaining.length > 0) {
      localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, remaining[0]);
    } else {
      localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
    }
  }
  localStorage.setItem(PUSH_GROUPS_STORAGE_KEY, JSON.stringify(map));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isMobileDevice(): boolean {
  return (
    /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function PushToggle({
  groupName,
  userName,
  variant = "button",
  onDone,
}: {
  groupName: string;
  userName?: string;
  variant?: "menu" | "button";
  onDone?: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isMobileDevice()) return;
    setMobile(true);

    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    const savedMap = getSubscribedGroups();
    setSubscribed(Boolean(savedMap[groupName]));

    let active = true;
    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!active) return;

        if (!sub) {
          localStorage.removeItem(PUSH_GROUPS_STORAGE_KEY);
          localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
          setSubscribed(false);
        } else {
          const currentMap = getSubscribedGroups();
          const isGroupOn = currentMap[groupName] === sub.endpoint;
          setSubscribed(isGroupOn);
        }
      } catch {
        // 무시
      }
    })();

    return () => {
      active = false;
    };
  }, [groupName]);

  if (!mobile) return null;

  const handleToggle = async () => {
    if (busy) return;

    const isIos =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone) {
      alert(
        "아이폰에서는 하단 공유 버튼 → [홈 화면에 추가]로 앱을 설치한 뒤, 그 앱을 열어서 알림을 켜주세요!",
      );
      return;
    }

    if (!supported) {
      alert("이 브라우저에서는 푸시 알림을 지원하지 않아요.");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      alert("알림 설정 키가 아직 준비되지 않았어요.");
      return;
    }

    setBusy(true);
    try {
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (subscribed) {
        if (sub) {
          await fetch("/api/bookclub/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              group: groupName,
              action: "unsubscribe",
              endpoint: sub.endpoint,
            }),
          });
        }
        setSubscribedGroup(groupName, null);
        setSubscribed(false);

        const remaining = Object.keys(getSubscribedGroups());
        if (remaining.length === 0 && sub) {
          await sub.unsubscribe().catch(() => {});
        }
        onDone?.();
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert(
          "알림 권한이 거부되어 있어요. 기기 설정에서 알림을 허용해 주세요.",
        );
        return;
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const res = await fetch("/api/bookclub/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: groupName,
          action: "subscribe",
          userName,
          subscription: sub.toJSON(),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        alert(json?.error?.message || "알림을 켜지 못했어요.");
        return;
      }

      setSubscribedGroup(groupName, sub.endpoint);
      setSubscribed(true);
      onDone?.();
    } catch (err) {
      alert(
        "알림 설정 중 오류가 났어요: " +
          (err instanceof Error ? err.message : ""),
      );
    } finally {
      setBusy(false);
    }
  };

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={busy}
        className="bc-start-item flex items-center space-x-2 px-2 py-1.5 hover:bg-[#000080] hover:text-white rounded text-left transition-colors w-full"
      >
        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-sm">
          {subscribed ? "🔔" : "🔕"}
        </span>
        <span className="truncate">
          {busy
            ? "처리 중..."
            : subscribed
              ? "새 리뷰 폰 알림 끄기"
              : "새 리뷰 폰 알림 켜기"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={busy}
      className="win-btn px-2 py-1 text-xs font-bold"
    >
      {busy
        ? "처리 중..."
        : subscribed
          ? "🔔 폰 알림 끄기"
          : "🔕 폰 알림 켜기"}
    </button>
  );
}
