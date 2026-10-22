"use client";
import React, { useState, useEffect } from "react";
import { secureClient as supabase } from "../security/client";
import { isRegisteredGroup as isValidGroup } from "../security/groups";
export function useSupabaseBingo(groupName: string) {
  const [snapshot, setSnapshot] = useState<{
    group: string;
    data: Record<string, number[]>;
  }>({ group: "", data: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reload, setReload] = useState(0);
  const activeGroup = React.useRef(groupName);
  const busy = React.useRef(false);
  const version = React.useRef(0);
  const refreshRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reading = false;
    activeGroup.current = groupName;
    busy.current = false;
    version.current += 1;
    setSaving(false);
    setLoading(true);
    setErrorMessage("");
    const load = async () => {
      if (cancelled || reading || busy.current || !isValidGroup(groupName))
        return;
      reading = true;
      const requestVersion = version.current;
      try {
        const { data, error } = await supabase
          .from("bingo_states")
          .select("user_name,cell_id,checked")
          .eq("group_name", groupName)
          .order("user_name")
          .order("cell_id");
        if (cancelled || busy.current || requestVersion !== version.current)
          return;
        if (error) throw error;
        const next: Record<string, number[]> = Object.create(null);
        (data || []).forEach((row) => {
          if (!row.checked) return;
          if (!next[row.user_name]) next[row.user_name] = [];
          next[row.user_name].push(row.cell_id);
        });
        setSnapshot({ group: groupName, data: next });
        setErrorMessage("");
      } catch {
        if (!cancelled && requestVersion === version.current) {
          setErrorMessage(
            "빙고를 불러오지 못했어요. Supabase 테이블·권한과 연결 상태를 확인해 주세요.",
          );
        }
      } finally {
        reading = false;
        if (!cancelled && requestVersion === version.current) setLoading(false);
      }
    };
    refreshRef.current = () => {
      void load();
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      refreshRef.current = null;
    };
  }, [groupName, reload]);

  const data = snapshot.group === groupName ? snapshot.data : {};
  const ready = snapshot.group === groupName && !loading;
  const save = async (user: string, cellId: number | null) => {
    if (!ready || busy.current || !user.trim()) return;
    const checked = !(data[user] || []).includes(cellId ?? 0);
    const rows =
      cellId === null
        ? Array.from({ length: 9 }, (_, index) => ({
            group_name: groupName,
            user_name: user,
            cell_id: index + 1,
            checked: false,
          }))
        : [
            {
              group_name: groupName,
              user_name: user,
              cell_id: cellId,
              checked,
            },
          ];
    busy.current = true;
    version.current += 1;
    const saveVersion = version.current;
    setSaving(true);
    setErrorMessage("");
    let saved = false;
    try {
      const { error } = await supabase
        .from("bingo_states")
        .upsert(rows, { onConflict: "group_name,user_name,cell_id" });
      if (error) throw error;
      if (activeGroup.current !== groupName || version.current !== saveVersion)
        return;
      saved = true;
      setSnapshot((previous) => {
        if (previous.group !== groupName) return previous;
        const current = previous.data[user] || [];
        const next =
          cellId === null
            ? []
            : checked
              ? Array.from(new Set([...current, cellId]))
              : current.filter((id) => id !== cellId);
        return { group: groupName, data: { ...previous.data, [user]: next } };
      });
    } catch {
      if (
        activeGroup.current === groupName &&
        version.current === saveVersion
      ) {
        setErrorMessage(
          "빙고 저장에 실패했어요. 체크는 변경하지 않았습니다. 연결을 확인하고 다시 눌러 주세요.",
        );
      }
    } finally {
      if (
        activeGroup.current === groupName &&
        version.current === saveVersion
      ) {
        busy.current = false;
        setSaving(false);
        if (saved) refreshRef.current?.();
      }
    }
  };
  return {
    data,
    loading,
    saving,
    ready,
    errorMessage,
    toggle: (user: string, id: number) => {
      void save(user, id);
    },
    reset: (user: string) => {
      void save(user, null);
    },
    retry: () => setReload((previous) => previous + 1),
  };
}

