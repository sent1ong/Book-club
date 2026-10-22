"use client";
import React, { useEffect, useState } from "react";
export function savedNotice(message: string, hint = false) { window.dispatchEvent(new CustomEvent("bc98:saved", { detail: hint ? { message, hint } : message })); }
export function SaveNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => { clearTimeout(timer); const detail = (event as CustomEvent).detail; setMessage(typeof detail === "string" ? "✓ " + detail : "⚠️ " + String(detail?.message || "")); timer = setTimeout(() => setMessage(""), 3000); };
    window.addEventListener("bc98:saved", show);
    return () => { clearTimeout(timer); window.removeEventListener("bc98:saved", show); };
  }, []);
  return message ? <div role="status" className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] win-outset bg-[#ffffe1] px-3 py-2 text-xs text-black max-w-[90vw]">{message}</div> : null;
}
