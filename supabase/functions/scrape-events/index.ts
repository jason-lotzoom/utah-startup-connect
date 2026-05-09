import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL = "https://api.firecrawl.dev/v1";

const SOURCES = [
  { url: "https://siliconslopes.com/events", id: "silicon_slopes" },
  { url: "https://www.eventbrite.com/d/ut--salt-lake-city/startup/", id: "eventbrite" },
  {
    url: "https://www.meetup.com/find/?keywords=entrepreneur+startup&location=Utah%2C+US&source=EVENTS",
    id: "meetup",
  },
  { url: "https://utahfoundation.org/events/", id: "utah_foundation" },
  { url: "https://www.sba.gov/offices/district/ut/salt-lake-city", id: "sba_utah" },
];

type ScrapedEvent = {
  title: string;
  description?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
  location_name?: string;
  is_online?: boolean;
  organizer?: string;
  image_url?: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function autoTag(
  title: string,
  description: string,
): { industries: string[]; stages: string[]; topics: string[] } {
  const text = `${title} ${description}`.toLowerCase();

  const industries: string[] = [];
  if (/\b(tech|software|saas|app|platform|digital|cloud|ai|ml|data)\b/.test(text)) industries.push("tech");
  if (/\b(life sciences?|biotech|pharma|medical|health|bio)\b/.test(text)) industries.push("life sciences");
  if (/\b(aerospace|defense|aviation|space)\b/.test(text)) industries.push("aerospace");
  if (/\b(energy|cleantech|clean tech|solar|renewable|climate|sustainability)\b/.test(text)) industries.push("energy");
  if (/\b(outdoor|retail|consumer|e-commerce|ecommerce|apparel|gear)\b/.test(text)) industries.push("outdoor");
  if (/\b(manufactur)\b/.test(text)) industries.push("manufacturing");

  const stages: string[] = [];
  if (/\b(early.?stage|pre.?seed|idea|ideation|student|university)\b/.test(text)) {
    stages.push("idea");
    stages.push("pre-seed");
  }
  if (/\b(seed|early)\b/.test(text) && !stages.includes("seed")) stages.push("seed");
  if (/\b(series a|growth)\b/.test(text)) stages.push("series a");
  if (/\b(pitch competition|pitch night|pitch contest)\b/.test(text)) {
    if (!stages.includes("idea")) stages.push("idea");
    if (!stages.includes("pre-seed")) stages.push("pre-seed");
  }

  const topics: string[] = [];
  if (/\b(pitch|investor|capital|fund|funding|investment|angel|venture|vc)\b/.test(text)) topics.push("capital");
  if (/\b(mentor|advisor|coaching|guidance)\b/.test(text)) topics.push("mentorship");
  if (/\b(cowork|workspace|office|hub)\b/.test(text)) topics.push("workspace");
  if (/\b(job|hiring|talent|recruit|career)\b/.test(text)) topics.push("talent");
  if (/\b(network|meetup|mixer|social|connect|community)\b/.test(text)) topics.push("networking");
  if (/\b(workshop|class|bootcamp|learn|training|education|course|summit|conference)\b/.test(text)) topics.push("education");

  // Defaults
  if (topics.length === 0) {
    if (/\b(meetup|network|connect|mixer)\b/.test(text)) topics.push("mentorship");
    else if (/\b(workshop|summit|conference|event)\b/.test(text)) topics.push("education");
    else topics.push("education");
  }

  return { industries, stages, topics };
}

async function scrapeSource(
  sourceUrl: string,
  sourceId: string,
  firecrawlKey: string,
): Promise<{ events: ScrapedEvent[]; error?: string }> {
  try {
    const res = await fetch(`${FIRECRAWL}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sourceUrl,
        formats: ["extract"],
        extract: {
          prompt:
            "Extract a list of upcoming events, meetings, conferences, workshops, or networking events from this page. For each event extract: title (string), description (string, 1-2 sentences), url (string, full link to event details), start_date (ISO8601 string), end_date (ISO8601 string, optional), location_name (string, city/venue or 'Online'), is_online (boolean), organizer (string, optional), image_url (string, optional). Only include events that have not yet passed. Return as JSON with an 'events' array.",
          schema: {
            type: "object",
            properties: {
              events: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string" },
                    start_date: { type: "string" },
                    end_date: { type: "string" },
                    location_name: { type: "string" },
                    is_online: { type: "boolean" },
                    organizer: { type: "string" },
                    image_url: { type: "string" },
                  },
                  required: ["title"],
                },
              },
            },
          },
        },
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { events: [], error: `${sourceId}: HTTP ${res.status} — ${text.slice(0, 200)}` };
    }

    const json = await res.json();
    const data = json.data ?? json;
    const extracted = data.extract ?? data.json ?? null;

    if (!extracted) {
      return { events: [], error: `${sourceId}: no extract data in response` };
    }

    const rawEvents: ScrapedEvent[] = Array.isArray(extracted.events) ? extracted.events : [];
    return { events: rawEvents };
  } catch (e) {
    return { events: [], error: `${sourceId}: ${(e as Error).message}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const FC = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPA_URL = Deno.env.get("SUPABASE_URL");
    const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!FC) throw new Error("FIRECRAWL_API_KEY missing");
    if (!SUPA_URL || !SUPA_SERVICE) throw new Error("Supabase env missing");

    // Admin-only guard: verify JWT and check admin role
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPA_URL, SUPA_SERVICE);

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let totalScraped = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const errors: string[] = [];

    for (const source of SOURCES) {
      const { events: scraped, error } = await scrapeSource(source.url, source.id, FC);
      if (error) {
        errors.push(error);
        continue;
      }

      totalScraped += scraped.length;

      for (const ev of scraped) {
        if (!ev.title?.trim()) continue;

        const sourceId = `${source.id}_${slugify(ev.title + (ev.start_date ?? ""))}`;
        const { industries, stages, topics } = autoTag(ev.title, ev.description ?? "");

        const row = {
          title: ev.title.slice(0, 300),
          description: ev.description?.slice(0, 1000) ?? null,
          url: ev.url ?? null,
          source: source.id,
          source_id: sourceId,
          start_date: ev.start_date ?? null,
          end_date: ev.end_date ?? null,
          location_name: ev.location_name?.slice(0, 200) ?? null,
          is_online: ev.is_online ?? false,
          image_url: ev.image_url ?? null,
          organizer: ev.organizer?.slice(0, 200) ?? null,
          industries,
          stages,
          topics,
          scraped_at: new Date().toISOString(),
          is_active: true,
        };

        const { error: upsertErr, data: upserted } = await admin
          .from("events")
          .upsert(row, { onConflict: "source,source_id", ignoreDuplicates: false })
          .select("id, created_at")
          .single();

        if (upsertErr) {
          errors.push(`${source.id}/${ev.title.slice(0, 40)}: ${upsertErr.message}`);
        } else if (upserted) {
          // Determine insert vs update by comparing created_at proximity to now
          const age = Date.now() - new Date(upserted.created_at).getTime();
          if (age < 10_000) totalInserted++;
          else totalUpdated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ scraped: totalScraped, inserted: totalInserted, updated: totalUpdated, errors }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
