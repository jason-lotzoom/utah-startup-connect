import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface BadgeRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

const COLOR_CLASSES: Record<string, string> = {
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  green:  "bg-green-100  text-green-700  border-green-200",
  blue:   "bg-blue-100   text-blue-700   border-blue-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  teal:   "bg-teal-100   text-teal-700   border-teal-200",
  coral:  "bg-rose-100   text-rose-700   border-rose-200",
};

interface BadgeShelfProps {
  userId: string;
  className?: string;
}

export function BadgeShelf({ userId, className }: BadgeShelfProps) {
  const [allBadges, setAllBadges] = useState<BadgeRow[]>([]);
  const [earned, setEarned] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("badges").select("*").order("id"),
      supabase.from("profiles").select("earned_badges").eq("id", userId).single(),
    ]).then(([{ data: badges }, { data: profile }]) => {
      setAllBadges(badges ?? []);
      setEarned(profile?.earned_badges ?? []);
    });
  }, [userId]);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {allBadges.map((badge) => {
        const isEarned = earned.includes(badge.id);
        const colorClass = COLOR_CLASSES[badge.color] ?? COLOR_CLASSES.purple;
        return (
          <div key={badge.id} className="relative">
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                isEarned
                  ? colorClass
                  : "border-border bg-muted/40 text-muted-foreground opacity-50"
              )}
              onMouseEnter={() => setTooltip(badge.id)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(badge.id)}
              onBlur={() => setTooltip(null)}
              aria-label={`${badge.name}: ${badge.description}`}
            >
              {isEarned ? (
                <span>{badge.icon}</span>
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {badge.name}
            </button>

            {tooltip === badge.id && (
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-2 text-center text-[11px] leading-snug text-popover-foreground shadow-lg">
                {isEarned ? (
                  <><span className="font-bold text-primary">Earned!</span><br />{badge.description}</>
                ) : (
                  <><span className="font-bold">Locked</span><br />{badge.description}</>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
