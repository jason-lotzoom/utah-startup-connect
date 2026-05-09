import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, buildAvatarUrl } from "@/components/Avatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Values match DiceBear v7 avataaars schema exactly (top[] param)
const HAIR_STYLES = [
  "noHair",
  "bigHair", "bob", "bun", "curly", "curvy",
  "dreads", "dreads01", "dreads02", "frida", "frizzle", "fro", "froBand",
  "longButNotTooLong", "miaWallace",
  "shaggy", "shaggyMullet", "shavedSides",
  "shortCurly", "shortFlat", "shortRound", "shortWaved",
  "sides", "straight01", "straight02", "straightAndStrand",
  "theCaesar", "theCaesarAndSidePart",
  "hat", "hijab", "turban",
  "winterHat1", "winterHat02", "winterHat03", "winterHat04",
];

const HAIR_COLORS = [
  "auburn", "black", "blonde", "blondeGolden", "brown",
  "brownDark", "pastelPink", "platinum", "red", "silverGray",
];

const SKIN_COLORS = [
  "tanned", "yellow", "pale", "light", "brown", "darkBrown", "black",
];

// "_none" is a sentinel — buildAvatarUrl converts it to facialHairProbability=0
const FACIAL_HAIR = [
  "_none", "beardLight", "beardMajestic", "beardMedium",
  "moustacheFancy", "moustacheMagnum",
];

// "_none" → accessoriesProbability=0
const ACCESSORIES = [
  "_none", "kurt", "prescription01", "prescription02",
  "round", "sunglasses", "wayfarers",
];

const CLOTHING = [
  "blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt",
  "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck",
];

const CLOTHING_COLORS = [
  "black", "blue01", "blue02", "blue03", "gray01", "gray02",
  "heather", "pastelBlue", "pastelGreen",
  "pastelRed", "pastelYellow", "pink", "red", "white",
];

const EYE_TYPES = [
  "closed", "cry", "default", "eyeRoll", "happy",
  "hearts", "side", "squint", "surprised", "wink", "winkWacky", "xDizzy",
];

const EYEBROW_TYPES = [
  "angry", "angryNatural", "default", "defaultNatural", "flatNatural",
  "frownNatural", "raisedExcited", "raisedExcitedNatural", "sadConcerned",
  "sadConcernedNatural", "unibrowNatural", "upDown", "upDownNatural",
];

const MOUTH_TYPES = [
  "concerned", "default", "disbelief", "eating", "grimace",
  "sad", "screamOpen", "serious", "smile", "tongue", "twinkle", "vomit",
];

type OptionKey =
  | "hair" | "hairColor" | "skinColor" | "facialHair"
  | "accessories" | "clothing" | "clothingColor"
  | "eyeType" | "eyebrowType" | "mouthType";

interface Options {
  hair: string;
  hairColor: string;
  skinColor: string;
  facialHair: string;
  accessories: string;
  clothing: string;
  clothingColor: string;
  eyeType: string;
  eyebrowType: string;
  mouthType: string;
}

const DEFAULTS: Options = {
  hair: "shortFlat",
  hairColor: "brown",
  skinColor: "light",
  facialHair: "_none",
  accessories: "_none",
  clothing: "hoodie",
  clothingColor: "blue03",
  eyeType: "default",
  eyebrowType: "default",
  mouthType: "smile",
};

interface AvatarCustomizerProps {
  userId: string;
  onSaved?: () => void;
}

function OptionPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition",
              value === o
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {o.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarCustomizer({ userId, onSaved }: AvatarCustomizerProps) {
  const [seed, setSeed] = useState(userId);
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select(
        "avatar_seed, avatar_hair, avatar_hair_color, avatar_skin_color, avatar_facial_hair, avatar_accessories, avatar_clothing, avatar_clothing_color, avatar_eye_type, avatar_eyebrow_type, avatar_mouth_type"
      )
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSeed(data.avatar_seed ?? userId);
          setOpts({
            hair: data.avatar_hair ?? DEFAULTS.hair,
            hairColor: data.avatar_hair_color ?? DEFAULTS.hairColor,
            skinColor: data.avatar_skin_color ?? DEFAULTS.skinColor,
            facialHair: data.avatar_facial_hair ?? DEFAULTS.facialHair,
            accessories: data.avatar_accessories ?? DEFAULTS.accessories,
            clothing: data.avatar_clothing ?? DEFAULTS.clothing,
            clothingColor: data.avatar_clothing_color ?? DEFAULTS.clothingColor,
            eyeType: data.avatar_eye_type ?? DEFAULTS.eyeType,
            eyebrowType: data.avatar_eyebrow_type ?? DEFAULTS.eyebrowType,
            mouthType: data.avatar_mouth_type ?? DEFAULTS.mouthType,
          });
        }
        setLoaded(true);
      });
  }, [userId]);

  const set = (key: OptionKey) => (val: string) =>
    setOpts((prev) => ({ ...prev, [key]: val }));

  const previewUrl = buildAvatarUrl(seed, opts);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_hair: opts.hair,
        avatar_hair_color: opts.hairColor,
        avatar_skin_color: opts.skinColor,
        avatar_facial_hair: opts.facialHair,
        avatar_accessories: opts.accessories,
        avatar_clothing: opts.clothing,
        avatar_clothing_color: opts.clothingColor,
        avatar_eye_type: opts.eyeType,
        avatar_eyebrow_type: opts.eyebrowType,
        avatar_mouth_type: opts.mouthType,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Could not save avatar");
    } else {
      toast.success("Avatar saved!");
      onSaved?.();
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Live preview */}
      <div className="flex flex-col items-center gap-4 lg:sticky lg:top-24">
        <img
          src={previewUrl}
          alt="Avatar preview"
          className="h-40 w-40 rounded-full border-4 border-primary/20 bg-muted shadow-xl"
        />
        <Button
          onClick={save}
          disabled={saving}
          className="w-40 rounded-2xl shadow-lg shadow-primary/10"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save avatar
        </Button>
      </div>

      {/* Pickers */}
      <div className="flex-1 space-y-5">
        <OptionPicker label="Hair style" options={HAIR_STYLES} value={opts.hair} onChange={set("hair")} />
        <OptionPicker label="Hair color" options={HAIR_COLORS} value={opts.hairColor} onChange={set("hairColor")} />
        <OptionPicker label="Skin tone" options={SKIN_COLORS} value={opts.skinColor} onChange={set("skinColor")} />
        <OptionPicker label="Facial hair" options={FACIAL_HAIR} value={opts.facialHair} onChange={set("facialHair")} />
        <OptionPicker label="Accessories" options={ACCESSORIES} value={opts.accessories} onChange={set("accessories")} />
        <OptionPicker label="Clothing" options={CLOTHING} value={opts.clothing} onChange={set("clothing")} />
        <OptionPicker label="Clothing color" options={CLOTHING_COLORS} value={opts.clothingColor} onChange={set("clothingColor")} />
        <OptionPicker label="Eyes" options={EYE_TYPES} value={opts.eyeType} onChange={set("eyeType")} />
        <OptionPicker label="Eyebrows" options={EYEBROW_TYPES} value={opts.eyebrowType} onChange={set("eyebrowType")} />
        <OptionPicker label="Mouth" options={MOUTH_TYPES} value={opts.mouthType} onChange={set("mouthType")} />
      </div>
    </div>
  );
}
