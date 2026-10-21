"use client";
import React, { useState } from "react";
import { PetPopup } from "./pets/PetDiary";

export function useDraftClose(dirty: boolean, busy: boolean, close: () => void) {
  const [confirm, setConfirm] = useState(false);
  const requestClose = () => { if (!busy) { if (dirty) setConfirm(true); else close(); } };
  const confirmation = confirm ? <PetPopup title="작성 중인 내용" front close={() => setConfirm(false)}>
    <p>작성 중인 내용이 있어요.<br />저장하지 않고 닫을까요?</p>
    <div className="flex justify-end gap-2 mt-3"><button type="button" className="win-btn px-3 py-2" autoFocus onClick={() => setConfirm(false)}>계속 작성</button><button type="button" className="win-btn px-3 py-2" disabled={busy} onClick={() => { setConfirm(false); close(); }}>나가기</button></div>
  </PetPopup> : null;
  return { requestClose, confirmation };
}
