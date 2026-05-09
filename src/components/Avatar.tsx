import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AvatarSize = "small" | "medium" | "large";

interface AvatarOptions {
  hair?: string;
  hairColor?: string;
  skinColor?: string;
  facialHair?: string;
  accessories?: string;
  clothing?: string;
  clothingColor?: string;
  eyeType?: string;
  eyebrowType?: string;
  mouthType?: string;
}

interface AvatarProps {
  userId: string;
  size?: AvatarSize;
  options?: AvatarOptions;
  className?: string;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  small: "h-8 w-8",
  medium: "h-12 w-12",
  large: "h-24 w-24",
};

const SIZE_PX: Record<AvatarSize, number> = {
  small: 32,
  medium: 48,
  large: 96,
};

// DiceBear v7 avataaars uses hex codes for color params
const SKIN_HEX: Record<string, string> = {
  tanned: "fd9841", yellow: "f8d25c", pale: "ffdbb4",
  light: "edb98a", brown: "d08b5b", darkBrown: "ae5d29", black: "614335",
};
const HAIR_HEX: Record<string, string> = {
  auburn: "a55728", black: "2c1b18", blonde: "b58143", blondeGolden: "d6b370",
  brown: "724133", brownDark: "4a312c", pastelPink: "f59797",
  platinum: "ecdcbf", red: "c93305", silverGray: "e8e1e1",
};
const CLOTHES_HEX: Record<string, string> = {
  black: "262e33", blue01: "65c9ff", blue02: "5199e4", blue03: "25557c",
  gray01: "e6e6e6", gray02: "929598", heather: "3c4f5c",
  pastelBlue: "b1e2ff", pastelGreen: "a7ffc4", pastelRed: "ffafb9",
  pastelYellow: "ffffb1", pink: "ff488e", red: "ff5c5c", white: "ffffff",
};

export function buildAvatarUrl(seed: string, opts: AvatarOptions = {}): string {
  let url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
  if (opts.hair === "noHair") {
    url += `&topProbability=0`;
  } else if (opts.hair) {
    url += `&top[]=${opts.hair}`;
  }
  if (opts.hairColor) url += `&hairColor[]=${HAIR_HEX[opts.hairColor] ?? opts.hairColor}`;
  if (opts.skinColor) url += `&skinColor[]=${SKIN_HEX[opts.skinColor] ?? opts.skinColor}`;
  if (opts.facialHair === "_none") {
    url += `&facialHairProbability=0`;
  } else if (opts.facialHair) {
    url += `&facialHair[]=${opts.facialHair}`;
  }
  if (opts.accessories === "_none") {
    url += `&accessoriesProbability=0`;
  } else if (opts.accessories) {
    url += `&accessories[]=${opts.accessories}`;
  }
  if (opts.clothing) url += `&clothing[]=${opts.clothing}`;
  if (opts.clothingColor) url += `&clothesColor[]=${CLOTHES_HEX[opts.clothingColor] ?? opts.clothingColor}`;
  if (opts.eyeType) url += `&eyes[]=${opts.eyeType}`;
  if (opts.eyebrowType) url += `&eyebrows[]=${opts.eyebrowType}`;
  if (opts.mouthType) url += `&mouth[]=${opts.mouthType}`;
  return url;
}

export function Avatar({ userId, size = "medium", options, className }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select(
        "avatar_seed, avatar_hair, avatar_hair_color, avatar_skin_color, avatar_facial_hair, avatar_accessories, avatar_clothing, avatar_clothing_color, avatar_eye_type, avatar_eyebrow_type, avatar_mouth_type"
      )
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        const seed = data?.avatar_seed ?? userId;
        const opts: AvatarOptions = options ?? {
          hair: data?.avatar_hair ?? undefined,
          hairColor: data?.avatar_hair_color ?? undefined,
          skinColor: data?.avatar_skin_color ?? undefined,
          facialHair: data?.avatar_facial_hair ?? undefined,
          accessories: data?.avatar_accessories ?? undefined,
          clothing: data?.avatar_clothing ?? undefined,
          clothingColor: data?.avatar_clothing_color ?? undefined,
          eyeType: data?.avatar_eye_type ?? undefined,
          eyebrowType: data?.avatar_eyebrow_type ?? undefined,
          mouthType: data?.avatar_mouth_type ?? undefined,
        };
        setUrl(buildAvatarUrl(seed, opts));
      });
  }, [userId, options]);

  const px = SIZE_PX[size];

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border/50",
        SIZE_CLASS[size],
        className
      )}
    >
      {url ? (
        <img src={url} alt="Avatar" width={px} height={px} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
    </div>
  );
}
