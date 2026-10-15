"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function AndroidGroupInstall({
  groupName,
}: {
  groupName: string;
}) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(
      /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
  }, []);

  if (!mobile) return null;

  return (
    <a
      href={
        "/pwa/install?" + new URLSearchParams({ group: groupName }).toString()
      }
      className="flex items-center space-x-2 px-2 py-1.5 hover:bg-[#000080] hover:text-white rounded text-left transition-colors"
    >
      <div className="relative w-5 h-5 flex-shrink-0">
        <Image
          src="/icons/question.png"
          alt=""
          fill
          sizes="20px"
          className="object-contain"
        />
      </div>
      <span className="truncate">앱 설치 방법</span>
    </a>
  );
}
