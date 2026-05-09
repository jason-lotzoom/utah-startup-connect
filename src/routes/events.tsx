import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type EventRow = Tables<"events">;

type Quiz = {
  stage: string;
  industry: string;
  needs: string[];
  location: string;
  community: string;
};

const KEY = "5io.navigator.v1";

function loadQuizProfile(): { step: number; quiz: Partial<Quiz> } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

function tokenize(s?: string): string[] {
  return (s || "")
    .toLowerCase()
    .split(/[\s/,&+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !["the", "and", "for", "any", "other"].includes(t));
}

function arrHas(arr: string[] | undefined, tokens: string[]): boolean {
  if (!arr || !tokens.length) return false;
  const joined = arr.join(" ").toLowerCase();
  return tokens.some((t) => joined.includes(t));
}

function scoreEvent(event: EventRow, quiz: Partial<Quiz>): number {
  let score = 0;
  const industryTokens = tokenize(quiz.industry);
  const stageTokens = tokenize(quiz.stage);
  const needTokens = (quiz.needs || []).flatMap(tokenize);
  if (arrHas(event.industries, industryTokens)) score += 4;
  if (arrHas(event.stages, stageTokens)) score += 3;
  if (arrHas(event.topics, needTokens)) score += 3;
  const text = `${event.title} ${event.description || ""}`.toLowerCase();
  for (const t of [...industryTokens, ...needTokens]) if (text.includes(t)) score += 0.5;
  return score;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    silicon_slopes: { label: "Silicon Slopes", cls: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800" },
    eventbrite: { label: "Eventbrite", cls: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400 dark:border-orange-800" },
    meetup: { label: "Meetup", cls: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800" },
    utah_foundation: { label: "Utah Foundation", cls: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800" },
    sba_utah: { label: "SBA Utah", cls: "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:text-indigo-400 dark:border-indigo-800" },
    manual: { label: "5iO", cls: "bg-[oklch(0.58_0.16_148)]/10 text-[oklch(0.35_0.12_148)] border-[oklch(0.58_0.16_148)]/20" },
  };
  const { label, cls } = map[source] ?? { label: source, cls: "bg-gray-500/10 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

type DateFilter = "all" | "week" | "month";
type TopicFilter = "capital" | "mentorship" | "education" | "networking" | "talent" | null;

const TOPIC_CHIPS: { label: string; value: TopicFilter }[] = [
  { label: "All", value: null },
  { label: "Capital", value: "capital" },
  { label: "Mentorship", value: "mentorship" },
  { label: "Education", value: "education" },
  { label: "Networking", value: "networking" },
  { label: "Talent", value: "talent" },
];

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — 5iO" },
      { name: "description", content: "Upcoming Utah startup events, meetups, and conferences." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState<TopicFilter>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [forYou, setForYou] = useState(true);
  const [quizProfile, setQuizProfile] = useState<{ step: number; quiz: Partial<Quiz> } | null>(null);

  useEffect(() => {
    const profile = loadQuizProfile();
    setQuizProfile(profile);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("start_date", { ascending: true })
        .limit(60);
      if (!error && data) setEvents(data);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const hasQuiz = !!(quizProfile?.quiz?.stage || quizProfile?.quiz?.industry);

  const filtered = useMemo(() => {
    const now = new Date();
    let result = events;

    // Date filter
    if (dateFilter === "week") {
      const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      result = result.filter((e) => {
        if (!e.start_date) return true;
        const d = new Date(e.start_date);
        return d >= now && d <= cutoff;
      });
    } else if (dateFilter === "month") {
      const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      result = result.filter((e) => {
        if (!e.start_date) return true;
        const d = new Date(e.start_date);
        return d >= now && d <= cutoff;
      });
    }

    // Topic filter
    if (topicFilter) {
      result = result.filter((e) => {
        if (topicFilter === "networking") {
          return e.topics.includes("networking") || e.topics.includes("mentorship");
        }
        return e.topics.includes(topicFilter);
      });
    }

    return result;
  }, [events, dateFilter, topicFilter]);

  const displayed = useMemo(() => {
    if (forYou && hasQuiz && quizProfile?.quiz) {
      return [...filtered]
        .map((e) => ({ ...e, _score: scoreEvent(e, quizProfile.quiz) }))
        .sort((a, b) => b._score - a._score);
    }
    return filtered.map((e) => ({ ...e, _score: 0 }));
  }, [filtered, forYou, hasQuiz, quizProfile]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />

      {/* Hero */}
      <div className="border-b border-border bg-[oklch(0.58_0.16_148)]/8 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p
            className="mb-3 text-xs uppercase tracking-[0.3em] text-[oklch(0.46_0.14_148)]"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Events Feed
          </p>
          <h1
            className="text-4xl font-bold md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Startup Events
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Upcoming Utah events, meetups, and conferences — personalized for your journey.
          </p>

          {hasQuiz && quizProfile?.quiz ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[oklch(0.58_0.16_148)]/10 border border-[oklch(0.58_0.16_148)]/20 px-4 py-1.5 text-sm text-[oklch(0.40_0.14_148)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.58_0.16_148)]" />
              Personalized for: {quizProfile.quiz.stage}
              {quizProfile.quiz.industry && ` · ${quizProfile.quiz.industry}`}
              {quizProfile.quiz.location && ` · ${quizProfile.quiz.location}`}
            </div>
          ) : (
            <Link
              to="/navigator"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[oklch(0.46_0.14_148)] hover:underline"
            >
              Take the Navigator quiz to personalize your feed →
            </Link>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          {/* Topic chips */}
          <div className="flex flex-wrap items-center gap-2">
            {TOPIC_CHIPS.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setTopicFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  topicFilter === value
                    ? "border-[oklch(0.58_0.16_148)] bg-[oklch(0.58_0.16_148)] text-white"
                    : "border-border text-muted-foreground hover:border-[oklch(0.58_0.16_148)]/50"
                }`}
                style={{ fontFamily: "var(--font-accent)", letterSpacing: "0.05em" }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Date filter */}
            <div className="flex items-center gap-1 text-xs" style={{ fontFamily: "var(--font-accent)" }}>
              {(["all", "week", "month"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`rounded-full px-3 py-1 transition ${
                    dateFilter === d
                      ? "bg-[oklch(0.58_0.16_148)]/10 text-[oklch(0.46_0.14_148)] font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d === "all" ? "All dates" : d === "week" ? "This week" : "This month"}
                </button>
              ))}
            </div>

            {/* For you toggle — only if quiz exists */}
            {hasQuiz && (
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5 text-xs" style={{ fontFamily: "var(--font-accent)" }}>
                <button
                  onClick={() => setForYou(true)}
                  className={`rounded-full px-3 py-1 transition ${
                    forYou ? "bg-[oklch(0.58_0.16_148)] text-white" : "text-muted-foreground"
                  }`}
                >
                  For you
                </button>
                <button
                  onClick={() => setForYou(false)}
                  className={`rounded-full px-3 py-1 transition ${
                    !forYou ? "bg-[oklch(0.58_0.16_148)] text-white" : "text-muted-foreground"
                  }`}
                >
                  All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <svg className="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading events…
          </div>
        ) : displayed.length === 0 ? (
          <div className="mx-auto max-w-lg rounded-t-[2rem] rounded-b-xl border border-border bg-card p-10 text-center shadow-[var(--shadow-warm)]">
            <div className="mb-3 text-4xl">📅</div>
            <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              No events found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Events are refreshed regularly. Check back soon!
            </p>
            {topicFilter || dateFilter !== "all" ? (
              <button
                onClick={() => { setTopicFilter(null); setDateFilter("all"); }}
                className="mt-4 text-sm font-medium text-[oklch(0.58_0.16_148)] hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {displayed.length} event{displayed.length !== 1 ? "s" : ""}
              {hasQuiz && forYou ? " · sorted by relevance" : ""}
            </p>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {displayed.map((event) => (
                <EventCard key={event.id} event={event} score={(event as EventRow & { _score: number })._score} />
              ))}
            </div>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

function EventCard({ event, score }: { event: EventRow; score: number }) {
  const card = (
    <div className="rounded-t-[2rem] rounded-b-xl border border-border bg-card p-5 shadow-[var(--shadow-warm)] transition hover:-translate-y-0.5 hover:shadow-md">
      {event.image_url && (
        <img
          src={event.image_url}
          alt={event.title}
          className="mb-4 h-36 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SourceBadge source={event.source} />
        {event.is_online && (
          <Badge variant="outline" className="text-xs">
            Online
          </Badge>
        )}
      </div>
      <h3 className="mb-1 font-bold leading-snug" style={{ fontFamily: "var(--font-display)" }}>
        {event.title}
      </h3>
      {event.description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(event.start_date)}</span>
        {event.location_name && <span>· {event.location_name}</span>}
      </div>
      {score > 0 && (
        <div className="mt-2 text-xs font-semibold text-[oklch(0.46_0.14_148)]">
          ★ Recommended for you
        </div>
      )}
    </div>
  );

  if (event.url) {
    return (
      <a href={event.url} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }
  return <div>{card}</div>;
}
