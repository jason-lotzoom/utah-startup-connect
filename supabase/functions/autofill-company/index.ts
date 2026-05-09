import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTORS = ["Tech", "Life Sciences", "Aerospace", "Energy", "Outdoor", "Manufacturing", "Other"];
const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"];
const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

// Each field returns { value, confidence (0-1), evidence (short quote), source_url }
const fieldSchema = (valueSchema: unknown) => ({
  type: "object",
  properties: {
    value: valueSchema,
    confidence: { type: "number", minimum: 0, maximum: 1, description: "0=guess, 1=stated explicitly on page" },
    evidence: { type: "string", description: "Short quote (<160 chars) from the page that supports this value" },
    source_url: { type: "string", description: "URL of the page where this was found" },
  },
  required: ["value", "confidence"],
});

const SCHEMA = {
  type: "object",
  properties: {
    name: fieldSchema({ type: "string" }),
    description: fieldSchema({ type: "string", description: "One-line, max 200 chars" }),
    sector: fieldSchema({ type: "string", enum: SECTORS }),
    stage: fieldSchema({ type: "string", enum: STAGES }),
    full_address: fieldSchema({ type: "string", description: "City, State (e.g. 'Salt Lake City, UT')" }),
    year_founded: fieldSchema({ type: "number" }),
    employee_count: fieldSchema({ type: "string", enum: TEAM_SIZES }),
    linkedin_url: fieldSchema({ type: "string" }),
    hiring_status: fieldSchema({ type: "boolean" }),
  },
};

const PROMPT = `Extract company information from this page.

RULES — follow exactly:
- sector: pick the closest match from ${SECTORS.join(", ")}.
- stage: estimate from funding/team/age signals using ${STAGES.join(", ")}.
- employee_count: must be one of ${TEAM_SIZES.join(", ")}.
- full_address: format as "City, ST" (US 2-letter state code).
- For EVERY field include:
    confidence: 1.0 if explicitly stated, 0.7 if strongly implied, 0.4 if inferred, 0.2 if guess.
    evidence: a short verbatim quote from the page that supports it (< 160 chars).
    source_url: the URL where this evidence appears.
- Omit any field you cannot support with evidence — do not invent.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string") throw new Error("Provide a company name or website");

    const FC_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FC_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    let url = input.trim();
    const looksLikeUrl = /^(https?:\/\/|www\.)/i.test(url) || /\.[a-z]{2,}(\/|$)/i.test(url);
    const searchResults: Array<{ url: string; title?: string; description?: string }> = [];

    // 1. Resolve to a website if user gave a name
    if (!looksLikeUrl) {
      const sr = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FC_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${url} company official website`, limit: 5 }),
      });
      const sd = await sr.json();
      const web = sd?.data?.web ?? sd?.data ?? [];
      for (const r of web.slice(0, 5)) {
        if (r?.url) searchResults.push({ url: r.url, title: r.title, description: r.description });
      }
      if (!searchResults[0]) throw new Error(`Couldn't find a website for "${input}"`);
      url = searchResults[0].url;
    } else if (!/^https?:\/\//i.test(url)) {
      url = `https://${url.replace(/^www\./, "")}`;
    }

    // 2. Scrape with structured extraction
    const scrapeRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FC_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: [
          "markdown",
          "links",
          { type: "json", schema: SCHEMA, prompt: PROMPT },
        ],
        onlyMainContent: true,
      }),
    });
    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) throw new Error(scrapeData?.error || "Scrape failed");

    const doc = scrapeData.data ?? scrapeData;
    const extracted = doc?.json ?? doc?.extract ?? {};
    const meta = doc?.metadata ?? {};
    const markdown: string = doc?.markdown ?? "";

    // 3. Normalize per-field { value, confidence, evidence, source_url } shape
    const norm = (k: string, fallbackValue: unknown = null) => {
      const f = (extracted as Record<string, unknown>)[k] as
        | { value?: unknown; confidence?: number; evidence?: string; source_url?: string }
        | undefined;
      if (f && typeof f === "object" && "value" in f) {
        return {
          value: f.value ?? fallbackValue,
          confidence: typeof f.confidence === "number" ? f.confidence : 0.5,
          evidence: f.evidence ?? null,
          source_url: f.source_url || url,
        };
      }
      return fallbackValue == null
        ? null
        : { value: fallbackValue, confidence: 0.3, evidence: null, source_url: url };
    };

    const fields = {
      name: norm("name", meta.title?.split(/[|–\-—]/)[0]?.trim() || null),
      website: { value: url, confidence: 1, evidence: null, source_url: url },
      description: norm("description", meta.description || null),
      sector: norm("sector"),
      stage: norm("stage"),
      full_address: norm("full_address"),
      year_founded: norm("year_founded"),
      employee_count: norm("employee_count"),
      linkedin_url: norm("linkedin_url"),
      hiring_status: norm("hiring_status"),
    };

    // Citations the user can click to verify
    const citations = {
      primary_url: url,
      page_title: meta.title ?? null,
      search_results: searchResults,
      scraped_excerpt: markdown ? markdown.slice(0, 1200) : null,
    };

    return new Response(JSON.stringify({ success: true, fields, citations }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("autofill-company error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});