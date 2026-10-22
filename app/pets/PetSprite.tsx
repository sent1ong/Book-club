"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
export interface PetGeneration {
  id: number;
  group_name: string;
  generation_number: number;
  species: string;
  pet_name: string | null;
  named_by: string | null;
  xp: number;
  stage: "egg" | "baby" | "teen" | "adult" | "dead";
  color_variant: string | null;
  decoration: string | null;
  born_at: string;
  adult_at: string | null;
  died_at: string | null;
}

// 🎨 세대별 펫 색상 변형
const PET_COLOR_FILTERS: Record<string, string> = {
  original: "none",
  lavender: "hue-rotate(25deg) saturate(1.1)",
  mint: "hue-rotate(115deg) saturate(1.05)",
  peach: "hue-rotate(315deg) saturate(1.1)",
  sky: "hue-rotate(175deg) saturate(1.05)",
  butter: "hue-rotate(55deg) saturate(1.1)",
};

// 세대 번호만으로 표시 색상을 순환하며 저장된 데이터는 변경하지 않습니다.
export const PET_COLOR_ORDER = [
  "original",
  "lavender",
  "mint",
  "peach",
  "sky",
  "butter",
] as const;
function getPetColorFilter(pet: PetGeneration): string {
  const generation = pet.generation_number;
  const variant =
    Number.isInteger(generation) && generation > 0
      ? PET_COLOR_ORDER[(generation - 1) % PET_COLOR_ORDER.length]
      : pet.color_variant || "original";
  return PET_COLOR_FILTERS[variant] || "none";
}

// 🎀 세대별 펫 장식
const PET_DECORATIONS: Record<string, string> = {
  star_mark: "/pets/deco/star_mark.png",
  patch_heart: "/pets/deco/patch_heart.png",
  patch_dot: "/pets/deco/patch_dot.png",
  sparkle: "/pets/deco/sparkle.png",
};

export const PetSprite = React.memo(function PetSprite({
  pet,
  stage,
  eating = false,
  happy = false,
  sleeping = false,
  size = 150,
  className = "",
}: {
  pet: PetGeneration;
  stage?: "egg" | "baby" | "teen" | "adult";
  eating?: boolean;
  happy?: boolean;
  sleeping?: boolean;
  size?: number;
  className?: string;
}) {
  const visibleStage = stage || (pet.stage === "dead" ? "adult" : pet.stage);

  // 🐾 우물우물: 일반 이미지와 먹는 이미지 교차
  const [chewFrame, setChewFrame] = useState(false);

  useEffect(() => {
    if (!eating || visibleStage === "egg") {
      setChewFrame(false);
      return;
    }

    setChewFrame(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setChewFrame((previous) => !previous);
    }, 180);

    return () => window.clearInterval(timer);
  }, [eating, visibleStage]);

  // 먹는 동안의 일반 프레임에도 happy/sleep이 끼어들지 않습니다.
  const fileName =
    visibleStage === "egg" || pet.stage === "dead"
      ? visibleStage
      : eating
        ? chewFrame
          ? `${visibleStage}_eat`
          : visibleStage
        : happy
          ? `${visibleStage}_happy`
          : sleeping
            ? `${visibleStage}_sleep`
            : visibleStage;

  const colorFilter = getPetColorFilter(pet);

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <Image
        src={`/pets/${pet.species}/${fileName}.png`}
        alt={pet.pet_name || "우리 펫"}
        width={size}
        height={size}
        unoptimized
        className="block object-contain"
        style={{
          width: size,
          height: size,
          filter: colorFilter,
        }}
      />
    </span>
  );
});

