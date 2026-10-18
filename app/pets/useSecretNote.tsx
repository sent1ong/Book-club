"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PetPopup } from "./PetDiary";
import { canLeaveNote, koreanDate, secretMessage, type SecretPet } from "./secrets";

const KEY = "bc98_secret_note_date";
export function useSecretNote(group: string, pet: SecretPet | null) {
  const [note, setNote] = useState<{ group: string; petId: number; date: string; body: string; signature: string } | null>(null);
  const [opened, setOpened] = useState(false);
  const active = useRef({ group, id: pet?.id });
  active.current = { group, id: pet?.id };
  const discovering = useRef(false);
  useEffect(() => { setNote(null); setOpened(false); }, [group, pet?.id, pet?.stage]);
  const discover = (clicked: SecretPet | null) => {
    if (!clicked || !canLeaveNote(clicked) || discovering.current) return;
    discovering.current = true;
    const run = () => {
      if (active.current.group !== clicked.group_name || active.current.id !== clicked.id) return;
      const today = koreanDate();
      try {
        if (localStorage.getItem(KEY) === today || Math.random() >= 0.1) return;
        const message = secretMessage(clicked);
        if (!message) return;
        localStorage.setItem(KEY, today);
        setNote({ group: clicked.group_name, petId: clicked.id, date: today, ...message });
      } catch { /* Without durable daily limiting, skip discovery. Never store the note. */ }
    };
    void (async () => {
      try {
        if (navigator.locks) await navigator.locks.request(KEY, run);
        else run();
      } finally { discovering.current = false; }
    })();
  };
  const visible = note && pet && canLeaveNote(pet) && note.group === group && note.petId === pet.id && note.date === koreanDate();
  const icon = visible ? <button type="button" aria-label="비밀 쪽지 열기" title="쪽지" className="pointer-events-auto absolute right-0 top-0 z-40" onClick={() => setOpened(true)}>
    <Image src="/icons/note.png" alt="쪽지" width={26} height={26} unoptimized />
  </button> : null;
  const popup = visible && opened ? <PetPopup title="SECRET_NOTE.exe" close={() => { setOpened(false); setNote(null); }} front>
    <p className="whitespace-pre-wrap break-words bg-[#fffbea] p-3 leading-6 win-inset">{note.body}</p><p className="mt-3 text-right">— {note.signature}</p>
  </PetPopup> : null;
  return { discover, icon, popup };
}
