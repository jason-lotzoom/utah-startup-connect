import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, Loader2, Search, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { buildAvatarUrl } from "@/components/Avatar";

export const Route = createFileRoute("/navigator")({
  head: () => ({
    meta: [
      { title: "Founder's Navigator â 0iO" },
      { name: "description", content: "Find the right Utah programs, capital and resources in two minutes." },
      { property: "og:title", content: "Founder's Navigator â 0iO" },
      { property: "og:description", content: "Find the right Utah programs, capital and resources in two minutes." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return { q: (search.q as string) || undefined };
  },
  component: NavigatorPage,
});

const STARTERS = [
  { label: "Jordan â Student founder, Salt Lake City", query: "Pre-seed student founder in Salt Lake City, idea stage, Tech/Software, looking for mentorship and first steps to start a company" },
  { label: "Maria â Women-owned ag business, St. George", query: "Women-owned small agricultural operation near St. George, rural, looking to scale, need grants and capital" },
  { label: "Marcus â Veteran, manufacturing, Ogden", query: "Military veteran starting custom fabrication and manufacturing business in Ogden, early-stage, looking for veteran entrepreneur resources and capital" },
  { label: "Priya â B2B SaaS, raising Series A", query: "B2B SaaS startup 18 months in with paying customers in Salt Lake City, ready to raise Series A, looking for angel investors and venture capital" },
  { label: "David â Medical device, FDA cleared, going international", query: "Medical device company 12 employees FDA cleared in Provo, growth stage, looking to expand to international markets" },
  { label: "Dr. Amir â PhD, tech transfer, ommercializing research", query: "PhD candidate at University of Utah developing novel technology, want to commercialize research and found a company, never started a business" },
];

function NavigatorPage() {
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.q ?? "");
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.q) {
      setQuery(search.q);
      runSearch(search.q);
    }
  }, [search.q]);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const { data: resources, error } = await supabase
        .from("resources")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      setResults(rankResources(resources ?? [], q));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setQuery("");
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />
      {!results && !loading ? (
        <SearchInput query={query} setQuery={setQuery} onSearch={runSearch} />
      ) : (
        <Results query={query} results={results} loading={loading} reset={reset} />
      )}
      <SiteFooter />
    </div>
  );
}

function SearchInput({
  query,
  setQuery,
  onSearch,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2x+	      px-6 py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-primary" style={{ fontFamily: "var(--font-accent)" }}>
        Founder's Navigator
      </p>
      <h1 className="mt-3 text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
        Find the right programs for your startup
      </h1>
      <p className="mt-3 text-muted-foreground">
        Describe your company and what you're looking for â we'll match you with the best Utah programs and resources.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSearch(query);
            }
          }}
          placeholder="e.g. I'm building a SaaS product, pre-seed stage, based in Salt Lake City. I need help finding capital and mentorship."
          rows={4}
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          autoFocus
        />
        <Button
          onClick={() => onSearch(query)}
          disabled={!query.trim()}
          className="self-end rounded-2xl px-6"
        >
          Find programs <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Try an example</p>
        <div className="flex flex-col gap-2">
          {STARTERS-map((s) => (
            <button
              key={s.label}
              onClick={() => { setQuery(s.query); onSearch(s.query); }}
              className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/50 hover:bg-muted/50"
            >
              <span className="block font-medium text-foreground">{s.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">{s.query}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseQuery(q: string) {
  const lower = q.toLowerCase();

  let stage = "Idea";
  if (lower.match(/\pre.?seed\b/)) stage = "Pre-seed";
  else if (lower.match(/\seed\b/)) stage = "Seed";
  else if (lower.match(/\b(series [abc]|growth.stage|scaling)\b/)) stage = "Series A+";
  else if (lower.match(/\bbootstrap/)) stage = "Bootstrapped";

  let industry = "Other";
  if (lower.match(/\b(tech|software|saas|app|platform|ai\b|ml\b|startup)\b/)) industry = "Tech / Software";
  else if (lower.match(/\b(biotech|life science|medical|health|pharma|bio)\b/)) industry = "Life Sciences";
  else if (lower.match(/\baerospace\b/)) industry = "AerOSpace";
  else if (lower.match(/\benergy\b/)) industry = "Energy";
  else if (lower.match(/\b(outdoor|consumer|retail|ecommerce|e-commerce)\b/)) industry = "Outdoor / Consumer";
  else if (lower.match(/\bmanufacturing\b/)) industry = "Manufacturing";

  const needs: string[] = [];
  if (lower.match(/\b(capital|fund|invest|grant|loan|money|financing|equity)\b/)) needs.push("Capital");
  if (lower.match(/\b(mentor|coach|advisor|guidance|advice)\b/)) needs.push("Mentorship");
  if (lower.match(/\b(workspace|office|cowork|space|studio)\b/)) needs.push("Workspace");
  if (lower.match(/\b(talent|hire|hiring|recruit|team|staff)\b/)) needs.push("Talent");
  if (lower.match(/\b(customer|sales|market|revenue|traction)\b/)) needs.push("Customers");
  if (lower.match(/\b(compliance|legal|regulation|permit)\b/)) needs.push("Compliance");
  if (lower.match(/\b(r&d|research|lab|university|science)\b/)) needs.push("R&D");
  if (lower.match(/\b(education|learn|training|program|workshop)\b/)) needs.push("Education");

  let location = "Salt Lake County";
  if (lower.match(/\b(provo|orem|utah county)\b/)) location = "Utah County";
  else if (lower.match(/\b(ogden|weber county)\b/)) location = "Weber County";
  else if (lower.match(/\b(davis county|bountiful|layton|kaysville)\b/)) location = "Davis County";
  else if (lower.match(/\b(st\.? george|washington county|southern utah)\b/)) location = "Washington County";
  else if (lower.match(/\b(logan|cache county)\b/)) location = "Cache County";
  else if (lower.match(/\b(salt lake|slc)\b/)) location = "Salt Lake County";

  let community = "Any";
  if (lower.match(/\b(women|woman|female)\b/)) community = "Women";
  else if (lower.match(/\bveteran\b/)) community = "Veterans";
  else if (lower.match(/\brural\b/)) community = "Rural";
  else if (lower.match(/\b(underrepresented|minority|diverse)\b/)) community = "Underrepresented";
  else if (lower.match(/\bstudent\b/)) community = "Students";

  return { stage, industry, needs, location, community };
}

function rankResources(resources: any[], rawQuery: string) {
  const parsed = parseQuery(rawQuery);
  const queryLower = rawQuery.toLowerCase();

  const tokenize = (s: string | undefined) =>
    (s || "")
      .toLowerCase()
      .split(/[\s/,&]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !["the", "and", "for", "any", "other"].includes(t));

  const needTokens = parsed.needs.flatMap(tokenize);
  const industryTokens = tokenize(parsed.industry);
  const locationTokens = tokenize(parsed.location);
  const communityTokens = parsed.community !== "Any" ? tokenize(parsed.community) : [];
  // All meaningful words from the raw query for full-text fallback
  const queryTokens = tokenize(rawQuery).filter((t) => t.length > 3);

  const arrHas = (arr: string[] | undefined, tokens: string[]) => {
    if (!arr || !tokens.length) return false;
    const joined = arr.join(" ").toLowerCase();
    return tokens.some((t) => joined.includes(t));
  };

  const scored = resources.map((r) => {
    let score = 0;
    const reasons: string[] = [];

    // Hard boost for community match â Maria/Marcus/Dr. Amir personas hinge on this
    if (communityTokens.length && arrHas(r.communities, communityTokens)) {
      score += 12;
      reasons.push(`ðâ${parsed.community} founders`);
    }
    // Stage match â check stages[] array, and fall back to topic/text signals
    const stageToken = parsed.stage.toLowerCase();
    const stageTokens = [stageToken];
    // Alias lookups for better matching
    if (stageToken === "series a+") stageTokens.push("series a", "series b", "growth", "scaling");
    if (stageToken === "pre-seed" || stageToken === "idea") stageTokens.push("early", "beginning", "first", "startup");
    if (arrHas(r.stages, stageTokens)) {
      score += 6;
      reasons.push(`ð ${parsed.stage} stage`);
    } else {
      // Partial stage signal from topics
      const isEarly = ["Idea", "Pre-seed"].includes(parsed.stage);
      const isGrowth = ["Series A", "Series A+", "Series B+", "Profitable"].includes(parsed.stage);
      if (isEarly && arrHas(r.topics, ["Education", "Mentorship", "Workspace"])) { score += 2; }
      if (isGrowth && arrHas(r.topics, ["Capital"])) { score += 2; }
    }
    if (arrHas(r.locations, locationTokens)) {
      score += 5;
      reasons.push("ð Near you");
    }
    if (arrHas(r.industries, industryTokens)) {
      score += 3;
      reasons.push("ð½ Industry match");
    }
    if (arrHas(r.topics, needTokens)) {
      score += 3;
      reasons.push("ð§ Matches your needs");
    }
    if (arrHas(r.industries, needTokens)) score += 1;

    // Full-text match against title + description using raw query tokens
    const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();
    for (const t of queryTokens) {
      if (text.includes(t)) score += 0.5;
    }
    // Also check structured fields for industry/need tokens
    for (const t of [...needTokens, ...industryTokens]) {
      if (text.includes(t)) score += 0.5;
    }
    // Persona-specific keyword boosts (FDA, veteran, university, etc.)
    if (queryLower.includes("fda") && text.includes("fda")) { score += 8; reasons.push("â/fda"); }
    if (queryLower.includes("medical device") && text.includes("medical")) { score += 6; }
    if (queryLower.match(/\b(veteran|military)\b/) && text.includes("veteran")) { score += 8; }
    if (queryLower.match(/\b(women|female)\b/) && text.includes("women")) { score += 8; }
    if (queryLower.match(/\b(rural|farm|agricult)\b/) && (text.includes("rural") || text.includes("agricult"))) { score += 8; }
    if (queryLower.match(/\b(phd|research|university|tech.transfer)\b/) && (text.includes("research") || text.includes("commercial"))) { score += 6; }
    if (queryLower.match(/\b(angel|venture|vc|series [ab])\b/) && (text.includes("angel") || text.includes("venture") || text.includes("invest"))) { score += 6; }
    if (queryLower.match(/\b(international|export|global|trade)\b/) && (text.includes("export") || text.includes("international") || text.includes("trade"))) { score += 8; reasons.push("ð International trade"); }
    if (queryLower.match(/\b(fda.cleared|clearance|510k|medical.device)\b/) && (text.includes("fda") || text.includes("medical device") || text.includes("510k"))) { score += 8; reasons.push("â/fda / medical device"); }

    return { ...r, _score: score, _reasons: reasons };
  });

  // Show all matches with score > 0, or top 12 if nothing scored well
  const filtered = scored.filter((r) => r._score > 0).sort((a, b) => b._score - a._score);
  return (filtered.length > 0 ? filtered : scored.sort((a, b) => b._score - a._score)).slice(0, 24);
}

function Results( {
  query,
  results,
  loading,
  reset,
}: {
  query: string;
  results: any[] | null;
  loading: boolean;
  reset: () => void;
}) {
  const NEEDS = ["Capital", "Mentorship", "Workspace", "Talent", "Customers", "Compliance", "R&D", "Education"];
  const [filter, setFilter] = useState<string | null>(null);
  const filtered = useMemo(() => {
    if (!results) return [];
    if (!filter) return results;
    return results.filter((r) =>
      [...(r.topics || []), ...(r.industries || [])].some((t: string) =>
        t.toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [results, filter]);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[380px_1fr]">
      <aside className="lgsticky lg:top-6 lg:self-start">
        <ChatPanel query={query} results={results ?? []} loading={loading} />
        <Card className="mt-4 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-accent)" }}>
            Filter by topic
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEEDS.map((n) => (
              <button
                key={n}
                onClick={() => setFilter(filter === n ? null : n)}
                className={`rounded-full border px-3 py-1 text-xs ${filter === n ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={reset}>
            New search
          </Button>
        </Card>
      </aside>

      <section>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {loading ? "Finding programs.â¦" : `${filtered.length} programs matched`}
        </h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground line-clamp-1">"{query}"</p>
          {!loading && results && results.length > 0 && (
            <Link
              to="/navigator/snapshot"
              search={{ q: query }}
              className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Open share card â
            </Link>
          )}
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {filtered.length === 0 && (
              <Card className="col-span-full rounded-3xl border-dashed bg-muted/30 p-10 text-center">
                <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  No exact matches
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Try describing your needs differently, or browse everything below.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link to="/capital">
                    <Button variant="outline" className="rounded-2xl">Browse all capital sources</Button>
                  </Link>
                  <Link to="/map">
                    <Button variant="outline" className="rounded-2xl">Explore the startup map</Button>
                  </Link>
                  <Button variant="ghost" className="rounded-2xl" onClick={reset}>Try a different search</Button>
                </div>
              </Card>
            )}
            {filtered.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

function ResourceCard({ r }: { r: any }) {
  const hue = hashHue(r.id);
  return (
    <Link
      to="/navigator/resource/$id"
      params={{ id: r.id }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-[var(--shadow-warm)]"
    >
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={r.image_url ? undefined : {background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 40) % 360} 70% 40%))`}}
      >
        {r.image_url ? (
          <img src={r.image_url} alt={r.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/90" style={{ fontFamily: "var(--font-display)" }}>
            {initials(r.title || "")}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{r.title}</h3>
        {r.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(r.topics || []).slice(0, 3).map((t: string) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
        {r._reasons && r._reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r._reasons.map((reason: string, i: number) => (
              <span key={i} className="inline-flex items-center rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                {reason}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-semibold text-primary">View details â</span>
          {r.link && (
            <a href={r.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              Visit site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

function ChatPanel({ query, results, loading }: { query: string; results: any[]; loading: boolean }) {
  const greeting = loading
    ? `Searching for programs matching: "${query}"â¦`
    : `I found ${results.length} programs for you. Ask me anything about them â like "which ones offer non-dilutive capital?" or "what's the best fit for my stage?"`;

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: greeting },
  ]);

  useEffect(() => {
    setMessages((m) => {
      if (m.length === 1 && m[0].role === "assistant") {
        return [{ role: "assistant", content: greeting }];
      }
      return m;
    });
  }, [loading, results.length]);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: "user" as const, content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/navigator-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          // Drop the initial greeting (assistant message) â API requires starting with a user message
          messages: next.filter((m, i) => !(i === 0 && m.role === "assistant")),
          query,
          resources: results.slice(0, 20).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            topics: r.topics,
            industries: r.industries,
            communities: r.communities,
            locations: r.locations,
            link: r.link,
            email: r.email,
          })),
        }),
      });
      if (res.status === 429) throw new Error("Rate limited â please wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      if (!res.ok || !res.body) throw new Error("Chat failed.");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let assistant = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const tok = j.choices?.[0]?.delta?.content;
            if (tok) {
              assistant += tok;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistant };
                return copy;
              });
            }
          } catch {
            // skip unparseable SSE lines (e.g. metadata, thinking tokens)
          }
        }
      }
      if (!assistant) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: "Sorry, I didn't get a response. Please try again." };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." };
          return copy;
        }
        return [...m, { role: "assistant", content: "Something went wrong. Please try again." }];
      });
      toast.error(e.message);
    } finally {
      setStreaming(false);
    }
  };

  const guideAvatarUrl = buildAvatarUrl("navigator-guide", {
    hair: "shortFlat",
    hairColor: "black",
    skinColor: "light",
    facialHair: "_none",
    accessories: "prescription01",
    clothing: "blazerAndShirt",
    clothingColor: "blue03",
    eyeType: "default",
    eyebrowType: "default",
    mouthType: "smile",
  });

  return (
    <Card className="flex h-[480px] flex-col p-0">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <img src={guideAvatarUrl} alt="Guide" className="h-10 w-10 rounded-full bg-muted" />
        <div>
          <p className="text-sm font-semibold leading-none">Guide</p>
          <p className="text-xs text-muted-foreground">Navigator AI</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            {m.content || (streaming && i === messages.length - 1 ? "â¦" : "")}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about programsâ¦"
          disabled={streaming}
        />
        <Button size="icon" onClick={send} disabled={streaming}>
          <Send className="h-4 w-4" />
        </Button>
        </div>
    </Card>
  );
}
