import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, Loader2, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/navigator")({
  head: () => ({
    meta: [
      { title: "Founder's Navigator — 5iO" },
      { name: "description", content: "Find the right Utah programs, capital and resources in two minutes." },
      { property: "og:title", content: "Founder's Navigator — 5iO" },
      { property: "og:description", content: "Find the right Utah programs, capital and resources in two minutes." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      stage: (search.stage as string) || undefined,
      industry: (search.industry as string) || undefined,
      location: (search.location as string) || undefined,
      needs: (search.needs as string) || undefined,
      community: (search.community as string) || undefined,
      q: (search.q as string) || undefined,
    };
  },
  component: NavigatorPage,
});

type Quiz = {
  stage: string;
  industry: string;
  needs: string[];
  location: string;
  community: string;
};

const STAGES = ["Idea", "Pre-seed", "Seed", "Series A+", "Bootstrapped"];
const INDUSTRIES = ["Tech / Software", "Life Sciences", "Aerospace", "Energy", "Outdoor / Consumer", "Manufacturing", "Other"];
const NEEDS = ["Capital", "Mentorship", "Workspace", "Talent", "Customers", "Compliance", "R&D", "Education"];
const LOCATIONS = ["Salt Lake County", "Utah County", "Davis County", "Weber County", "Washington County", "Cache County", "Other Utah"];
const COMMUNITIES = ["Any", "Women", "Veterans", "Rural", "Underrepresented", "Students"];

const KEY = "5io.navigator.v1";

function loadQuiz(): { step: number; quiz: Partial<Quiz> } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function NavigatorPage() {
  const search = Route.useSearch();
  const [step, setStep] = useState(0);
  const [quiz, setQuiz] = useState<Partial<Quiz>>({});

  // Initialize from search or localStorage
  useEffect(() => {
    const saved = loadQuiz();
    
    // If we have search params, prioritize them and skip to end
    if (search.stage || search.industry || search.location || search.q) {
      const q: Partial<Quiz> = {
        stage: search.stage || saved?.quiz.stage || "Idea",
        industry: search.industry || saved?.quiz.industry || "Tech / Software",
        location: search.location || saved?.quiz.location || "Salt Lake County",
        needs: search.needs ? search.needs.split(",") : saved?.quiz.needs || [],
        community: search.community || saved?.quiz.community || "Any",
      };
      setQuiz(q);
      setStep(5); // Final step
      return;
    }

    if (saved) {
      setStep(saved.step);
      setQuiz(saved.quiz);
    }
  }, [search]);
  const [results, setResults] = useState<any[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [aiQuery, setAiQuery] = useState<string | null>(null);

  useEffect(() => {
    // Check for AI instant-match URL params
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setAiQuery(q);
      const prefilled: Partial<Quiz> = {};
      if (params.get("stage")) prefilled.stage = params.get("stage")!;
      if (params.get("industry")) prefilled.industry = params.get("industry")!;
      if (params.get("community")) prefilled.community = params.get("community")!;
      if (params.get("needs")) prefilled.needs = [params.get("needs")!];
      // Fill defaults for missing fields
      if (!prefilled.stage) prefilled.stage = "Pre-seed";
      if (!prefilled.industry) prefilled.industry = "Other";
      if (!prefilled.needs?.length) prefilled.needs = ["Mentorship", "Education"];
      if (!prefilled.community) prefilled.community = "Any";
      prefilled.location = "Salt Lake County";
      setQuiz(prefilled);
      // Auto-submit
      setLoadingResults(true);
      setStep(5);
      supabase
        .from("resources")
        .select("*")
        .eq("is_active", true)
        .then(({ data: resources, error }) => {
          if (error) {
            toast.error(error.message);
            setLoadingResults(false);
            return;
          }
          const ranked = rankResources(resources ?? [], prefilled as Quiz);
          setResults(ranked);
          setLoadingResults(false);
        });
      return;
    }

    const saved = loadQuiz();
    if (saved) {
      setStep(saved.step);
      setQuiz(saved.quiz);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ step, quiz }));
  }, [step, quiz]);

  const submit = async (final: Partial<Quiz>) => {
    setLoadingResults(true);
    setStep(5);
    try {
      // Fetch all resources, rank client-side using overlap heuristic; AI re-rank optional
      const { data: resources, error } = await supabase
        .from("resources")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      const ranked = rankResources(resources ?? [], final as Quiz);
      setResults(ranked);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingResults(false);
    }
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    setStep(0);
    setQuiz({});
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />
      {step < 5 && (
        <Quiz
          step={step}
          quiz={quiz}
          setQuiz={setQuiz}
          setStep={setStep}
          onComplete={submit}
        />
      )}
      {step === 5 && (
        <Results
          quiz={quiz as Quiz}
          results={results}
          loading={loadingResults}
          reset={reset}
        />
      )}
      <SiteFooter />
    </div>
  );
}

function Quiz({
  step,
  quiz,
  setQuiz,
  setStep,
  onComplete,
}: {
  step: number;
  quiz: Partial<Quiz>;
  setQuiz: (q: Partial<Quiz>) => void;
  setStep: (n: number) => void;
  onComplete: (q: Partial<Quiz>) => void;
}) {
  const steps = [
    { key: "stage", title: "What stage is your company?", options: STAGES, multi: false },
    { key: "industry", title: "Which industry?", options: INDUSTRIES, multi: false },
    { key: "needs", title: "What do you need most right now?", options: NEEDS, multi: true },
    { key: "location", title: "Where in Utah are you based?", options: LOCATIONS, multi: false },
    { key: "community", title: "Any community focus?", options: COMMUNITIES, multi: false },
  ] as const;
  const current = steps[step];
  const value = quiz[current.key as keyof Quiz];

  const select = (opt: string) => {
    if (current.multi) {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
      setQuiz({ ...quiz, [current.key]: next });
    } else {
      const updated = { ...quiz, [current.key]: opt };
      setQuiz(updated);
      setTimeout(() => {
        if (step === steps.length - 1) onComplete(updated);
        else setStep(step + 1);
      }, 200);
    }
  };

  const canNext = current.multi ? Array.isArray(value) && (value as string[]).length > 0 : !!value;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-primary" style={{ fontFamily: "var(--font-accent)" }}>
        Founder's Navigator · Step {step + 1} of {steps.length}
      </p>
      <h1 className="mt-3 text-3xl font-bold md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
        {current.title}
      </h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {current.options.map((opt) => {
          const active = current.multi
            ? Array.isArray(value) && (value as string[]).includes(opt)
            : value === opt;
          return (
            <button
              key={opt}
              onClick={() => select(opt)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-warm)]"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="font-semibold">{opt}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        {current.multi && (
          <Button
            disabled={!canNext}
            onClick={() => {
              if (step === 4) onComplete(quiz);
              else setStep(step + 1);
            }}
          >
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function rankResources(resources: any[], q: Quiz) {
  const tokenize = (s?: string) =>
    (s || "")
      .toLowerCase()
      .split(/[\s/,&]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !["the", "and", "for", "any", "other"].includes(t));

  const needTokens = (q.needs || []).flatMap(tokenize);
  const industryTokens = tokenize(q.industry);
  const locationTokens = tokenize(q.location);
  const communityTokens = q.community && q.community !== "Any" ? tokenize(q.community) : [];

  const arrHas = (arr: string[] | undefined, tokens: string[]) => {
    if (!arr || !tokens.length) return false;
    const joined = arr.join(" ").toLowerCase();
    return tokens.some((t) => joined.includes(t));
  };

  const scored = resources.map((r) => {
    let score = 0;
    const reasons: string[] = [];

    if (arrHas(r.locations, locationTokens)) {
      score += 5;
      reasons.push("📍 Near you");
    }
    if (communityTokens.length && arrHas(r.communities, communityTokens)) {
      score += 5;
      reasons.push(`👥 ${q.community} founders`);
    }
    if (arrHas(r.industries, industryTokens)) {
      score += 3;
      reasons.push("🏭 Industry match");
    }
    if (arrHas(r.topics, needTokens)) {
      score += 3;
      reasons.push("🎯 Matches your needs");
    }
    if (arrHas(r.industries, needTokens)) score += 1;

    const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();
    for (const t of [...needTokens, ...industryTokens]) {
      if (text.includes(t)) score += 0.5;
    }

    return { ...r, _score: score, _reasons: reasons };
  });

  return scored
    .filter((r) => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 24);
}

function Results({
  quiz,
  results,
  loading,
  reset,
}: {
  quiz: Quiz;
  results: any[] | null;
  loading: boolean;
  reset: () => void;
}) {
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
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ChatPanel quiz={quiz} results={results ?? []} loading={loading} />
        <Card className="mt-4 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-accent)" }}>
            Filter by topic
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEEDS.map((n) => (
              <button
                key={n}
                onClick={() => setFilter(filter === n ? null : n)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  filter === n ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={reset}>
            Restart quiz
          </Button>
        </Card>
      </aside>

      <section>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {loading ? "Matching you with programs…" : `${filtered.length} programs for you`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stage: <strong>{quiz.stage}</strong> · Industry: <strong>{quiz.industry}</strong> ·{" "}
          {quiz.location}
        </p>

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
                  We couldn't find programs matching every criterion. Try one of these instead:
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link to="/capital">
                    <Button variant="outline" className="rounded-2xl">Browse all capital sources</Button>
                  </Link>
                  <Link to="/map">
                    <Button variant="outline" className="rounded-2xl">Explore the startup map</Button>
                  </Link>
                  <Link to="/jobs">
                    <Button variant="outline" className="rounded-2xl">See open roles</Button>
                  </Link>
                  <Button variant="ghost" className="rounded-2xl" onClick={reset}>Restart quiz</Button>
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
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
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
        style={
          r.image_url
            ? undefined
            : {
                background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 40) % 360} 70% 40%))`,
              }
        }
      >
        {r.image_url ? (
          <img
            src={r.image_url}
            alt={r.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/90"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {initials(r.title || "")}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          {r.title}
        </h3>
        {r.description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(r.topics || []).slice(0, 3).map((t: string) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        {/* Match reasons */}
        {r._reasons && r._reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r._reasons.map((reason: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-semibold text-primary">View details →</span>
          {r.link && (
            <a
              href={r.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              Visit site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Link>
  );
}

function ChatPanel({
  quiz,
  results,
  loading,
}: {
  quiz: Quiz;
  results: any[];
  loading: boolean;
}) {
  const resultsCount = results.length;
  const greeting = loading
    ? `Matching you with Utah programs for a ${quiz.stage} ${quiz.industry} company in ${quiz.location}…`
    : `I'm your Navigator AI. I found ${resultsCount} matches for a ${quiz.stage} ${quiz.industry} company in ${quiz.location}. Ask me anything — like "which programs offer non-dilutive capital?"`;
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: greeting },
  ]);

  // Refresh greeting when results arrive, but only if user hasn't started chatting
  useEffect(() => {
    setMessages((m) => {
      if (m.length === 1 && m[0].role === "assistant") {
        return [{ role: "assistant", content: greeting }];
      }
      return m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, resultsCount]);
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
          messages: next,
          quiz,
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
      if (res.status === 429) throw new Error("Rate limited — please wait a moment.");
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
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Card className="flex h-[480px] flex-col p-0">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-primary" style={{ fontFamily: "var(--font-accent)" }}>
          Navigator AI
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about programs…"
          disabled={streaming}
        />
        <Button size="icon" onClick={send} disabled={streaming}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}