"use client";
import { useEffect } from "react";
export function BackgroundActivity() {
  useEffect(() => {
    const update = () => { document.documentElement.dataset.bcBackground = String(document.visibilityState === "hidden"); };
    update(); document.addEventListener("visibilitychange", update);
    return () => { document.removeEventListener("visibilitychange", update); delete document.documentElement.dataset.bcBackground; };
  }, []);
  return null;
}
