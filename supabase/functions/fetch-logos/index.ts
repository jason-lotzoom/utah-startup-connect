import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CLEARBIT_LOGO = "https://logo.clearbit.com";

async function fetchClearbitLogo(domain: string): Promise<string | null> {
  try {
    const url = `${CLEARBIT_LOGO}/${domain}`;
    const r = await fetch(url, { method: "HEAD" });
    if (r.ok && r.headers.get("content-type")?.startsWith("image/")) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

async function scrapeLogoFromSite(website: string, firecrawlKey: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: website,
        formats: ["extract"],
        extract: {
          prompt:
            "Find the company logo image URL from this page. Look for og:image, twitter:image, or the main logo in the header. Return as JSON with a logo_url field (absolute URL string).",
          schema: {
            type: "object",
            properties: { logo_url: { type: "string" } },
          },
        },
        onlyMainContent: false,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const data = j.data ?? j;
    const extracted = data.extract ?? data.json;
    return extracted?.logo_url ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Auth: require valid JWT + admin role
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRow } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse limit from request body or query param
  const url = new URL(req.url);
  let limitParam = Number(url.searchParams.get("limit") ?? "");
  if (!Number.isFinite(limitParam) || limitParam <= 0) {
    try {
      const body = await req.json().catch(() => ({}));
      limitParam = Number(body?.limit ?? 0);
    } catch {
      limitParam = 0;
    }
  }
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

  // Fetch companies: website set, logo_url null/empty, ordered oldest updated_at first
  const { data: companies } = await supa
    .from("companies")
    .select("id, name, website, logo_url")
    .eq("status", "active")
    .not("website", "is", null)
    .or("logo_url.is.null,logo_url.eq.")
    .order("updated_at", { ascending: true })
    .limit(limit);

  const list = (companies ?? []).filter(
    (c) => c.website && /^https?:\/\//i.test(c.website)
  );

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of list) {
    processed++;
    try {
      let logoUrl: string | null = null;

      // 1. Try Clearbit first
      const domain = new URL(c.website).hostname.replace(/^www\./, "");
      logoUrl = await fetchClearbitLogo(domain);

      // 2. Fall back to Firecrawl scrape if Clearbit failed and key is available
      if (!logoUrl && FIRECRAWL_API_KEY) {
        logoUrl = await scrapeLogoFromSite(c.website, FIRECRAWL_API_KEY);
      }

      if (logoUrl) {
        const { error } = await supa
          .from("companies")
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq("id", c.id);
        if (error) {
          errors.push(`DB update "${c.name}": ${error.message}`);
        } else {
          updated++;
        }
      } else {
        skipped++;
      }
    } catch (e: any) {
      errors.push(`"${c.name}": ${e?.message ?? String(e)}`);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(
    JSON.stringify({ processed, updated, skipped, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
