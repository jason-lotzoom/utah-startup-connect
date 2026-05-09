import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email(),
  message: z.string().optional(),
});

function domainOf(value?: string | null): string | null {
  if (!value) return null;
  try {
    const u = value.includes("@")
      ? value.split("@").pop()!
      : new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
    return u.replace(/^www\./, "").toLowerCase().trim() || null;
  } catch {
    return null;
  }
}

export const submitClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Pull company website + claim status
    const { data: company, error: cErr } = await supabase
      .from("companies")
      .select("id,name,website,is_claimed,claimed_by")
      .eq("id", data.companyId)
      .maybeSingle();
    if (cErr || !company) {
      throw new Error("Company not found");
    }
    if (company.is_claimed) {
      throw new Error("This company has already been claimed.");
    }

    const websiteDomain = domainOf(company.website);
    const emailDomain = domainOf(data.email);
    const sessionEmailDomain = domainOf((claims?.email as string) ?? null);

    const autoVerified = Boolean(
      websiteDomain &&
        ((emailDomain && emailDomain === websiteDomain) ||
          (sessionEmailDomain && sessionEmailDomain === websiteDomain))
    );

    // Insert request row first (RLS allows the user to insert their own)
    const { error: insertErr } = await supabase.from("claim_requests").insert({
      company_id: data.companyId,
      user_id: userId,
      email: data.email,
      message: data.message ?? null,
      status: autoVerified ? "auto_approved" : "pending",
    });
    if (insertErr) throw new Error(insertErr.message);

    if (autoVerified) {
      // Use the admin client to flip ownership immediately (RLS would
      // require the user to already own the row, which they don't).
      const { error: upErr } = await supabaseAdmin
        .from("companies")
        .update({
          is_claimed: true,
          is_verified: true,
          claimed_by: userId,
        })
        .eq("id", data.companyId);
      if (upErr) throw new Error(upErr.message);
    }

    return {
      autoVerified,
      matchedDomain: autoVerified ? websiteDomain : null,
      companyName: company.name,
    };
  });