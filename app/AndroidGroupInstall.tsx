"use client";

import { useEffect, useState } from "react";

export default function AndroidGroupInstall({
  groupName,
}: {
  groupName: string;
}) {
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    setAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  if (!android) return null;

  return (
    <a
      href={
        "/pwa/install?" + new URLSearchParams({ group: groupName }).toString()
      }
      className="win-btn block px-3 py-2 text-left"
    >
      📲 이 모임 설치 안내
    </a>
  );
}
