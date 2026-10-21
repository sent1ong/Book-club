import React from "react";
export function PetNameplate({ name }: { name: string }) {
  return <span className="inline-flex items-center gap-1 text-[#000080]">💗 {name}</span>;
}
