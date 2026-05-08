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

export const Route = createFileRoute("/navigator")({
  head: () => ({
    meta: [
      { title: "Founder's Navigator — 5iO" },
      { name: "description", content: "Find the right Utah programs, capital and resources in two minutes." },
    ],
  }),
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
  const [step, setStep] = useState(0);
  const [quiz, setQuiz] = useState<Partial<Quiz>>({});
  const [results, setResults] = useState<any[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
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
  const needs = (q.needs || []).map((n) => n.toLowerCase());
  const wants = [
    q.industry?.toLowerCase() || "",
    q.location?.toLowerCase() || "",
    q.community?.toLowerCase() || "",
    ...needs,
  ].filter(Boolean);

  const scored = resources.map((r) => {
    const haystack = [
      r.title,
      r.description,
      ...(r.industries || []),
      ...(r.topics || []),
      ...(r.locations || []),
      ...(r.communities || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const w of wants) if (w && haystack.includes(w)) score += 1;
    if (q.community && q.community !== "Any" && (r.communities || []).some((c: string) => c.toLowerCase().includes(q.community.toLowerCase()))) score += 2;
    return { ...r, _score: score };
  });
  return scored.sort((a, b) => b._score - a._score).slice(0, 50);
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
        <ChatPanel quiz={quiz} resultsCount={results?.length ?? 0} />
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
          <div className="mt-6 grid gap-4">
            {filtered.map((r) => (
              <Card key={r.id} className="p-5 transition hover:shadow-[var(--shadow-warm)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(r.topics || []).slice(0, 4).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {r.link && (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChatPanel({ quiz, resultsCount }: { quiz: Quiz; resultsCount: number }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: `I'm your Navigator AI. I see ${resultsCount} matches for a ${quiz.stage} ${quiz.industry} company in ${quiz.location}. Ask me anything — like "which programs offer non-dilutive capital?"`,
    },
  ]);
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
        body: JSON.stringify({ messages: next, quiz }),
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