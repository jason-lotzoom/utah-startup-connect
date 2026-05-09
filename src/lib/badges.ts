import { supabase } from "@/integrations/supabase/client";

export async function awardBadge(userId: string, badgeId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("earned_badges")
    .eq("id", userId)
    .single();

  if (!profile || (profile.earned_badges ?? []).includes(badgeId)) return;

  await supabase
    .from("profiles")
    .update({ earned_badges: [...(profile.earned_badges ?? []), badgeId] })
    .eq("id", userId);
}
