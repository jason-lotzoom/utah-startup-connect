import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { awardBadge } from "@/lib/badges";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, DollarSign, Loader2 } from "lucide-react";

export const Route = createFileRoute("/capital")({
  head: () => ({
    meta: [
      { title: "Capital Tracker — Utah Funding Sources | 5iO" },
      { name: "description", content: "Browse Utah grants, accelerators, angel groups and venture funds. Filter by stage, sector and community." },
      { property: "og:title", content: "Capital Tracker — Utah Funding Sources | 5iO" },
      { property: "og:description", content: "Browse Utah grants, accelerators, angel groups and venture funds. Filter by stage, sector and community." },
    ],
  }),
  component: CapitalPage,
});

const STAGES = ["Idea", "Pre-seed", "Seed", "Series A+", "Bootstrapped"];
const COMMUNITIES = ["Rural", "Women", "Veterans", "Underrepresented", "Students"];

function CapitalPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [community, setCommunity] = useState<string | null>(null);

  useEffect(() => {
    if (user) awardBadge(user.id, "capital_curious");
  }, [user]);

  useEffect(() => {
    supabase
      .from("resources")
      .select("*")
      .eq("is_active", true)
      .contains("topics", ["Funding"])
      .order("title", { ascending: true })
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r.industries || []).forEach((i: string) => s.add(i)));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q) {
        const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();
        if (!text.includes(q.toLowerCase())) return false;
      }
      if (stage && !(r.stages || []).includes(stage)) {
        // fallback: heuristic match against title/description
        const text = `${r.title || ""} ${r.description || ""}`.toLowerCase();
        if (!text.includes(stage.toLowerCase())) return false;
      }
      if (sector && !(r.industries || []).includes(sector)) return false;
      if (community && !(r.communities || []).includes(community)) return false;
      return true;
    });
  }, [rows, q, stage, sector, community]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />

      <section className="relative overflow-hidden text-white" style={{ background: "var(--gradient-canyon)" }}>
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-20">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/60 mb-2" style={{ fontFamily: "var(--font-accent)" }}>
            Utah Capital Tracker
          </p>
          <h1 className="text-4xl font-bold md:text-7xl leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Find your funding.
          </h1>
          <p className="mt-4 max-w-xl text-white/80 text-lg">
            {rows.length} active funding sources across grants, angels, accelerators, and venture funds.
          </p>
          <div className="mt-8 flex flex-wrap gap-8 text-sm">
            <div>
              <div className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{rows.length}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">Funding Sources</div>
            </div>
            <div>
              <div className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{sectors.length}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">Sectors Served</div>
            </div>
            <div>
              <div className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{COMMUNITIES.length}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">Communities</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="sticky top-[72px] z-20 -mx-2 rounded-b-2xl border-b border-border/50 bg-background/80 px-2 py-4 backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search grants, funds, programs…"
                  className="pl-9 h-11 rounded-2xl border-border/50 bg-muted/30"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <FilterRow label="Stage" options={STAGES} value={stage} onChange={setStage} />
            <FilterRow label="Community" options={COMMUNITIES} value={community} onChange={setCommunity} />
            {sectors.length > 0 && (
              <FilterRow label="Sector" options={sectors.slice(0, 8)} value={sector} onChange={setSector} />
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-20 flex flex-col items-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin opacity-30" />
            <p className="mt-4">Loading capital sources…</p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Showing {filtered.length} of {rows.length} sources
            </p>
            {filtered.length === 0 ? (
              <Card className="mt-6 rounded-3xl border-dashed bg-muted/40 p-12 text-center">
                <DollarSign className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-4 text-xl font-bold">No matches with these filters</h3>
                <p className="mt-2 text-muted-foreground">Try clearing a filter or broadening your search.</p>
                <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => { setQ(""); setStage(null); setSector(null); setCommunity(null); }}>
                  Clear all filters
                </Button>
              </Card>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r) => (
                  <CapitalCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

function FilterRow({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? null : o)}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            value === o
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CapitalCard({ r }: { r: any }) {
  return (
    <Card className="flex h-full flex-col rounded-3xl border-border/50 p-5 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <DollarSign className="h-5 w-5" />
        </div>
        <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          {r.title}
        </h3>
      </div>
      {r.description && (
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(r.stages || []).slice(0, 2).map((s: string) => (
          <Badge key={s} variant="secondary" className="border-none bg-primary/5 text-[9px] uppercase tracking-wider text-primary">
            {s}
          </Badge>
        ))}
        {(r.communities || []).slice(0, 2).map((c: string) => (
          <Badge key={c} variant="outline" className="border-border/50 text-[9px] uppercase tracking-wider text-muted-foreground">
            {c}
          </Badge>
        ))}
        {(r.industries || []).slice(0, 2).map((i: string) => (
          <Badge key={i} variant="outline" className="border-border/50 text-[9px] uppercase tracking-wider text-muted-foreground">
            {i}
          </Badge>
        ))}
      </div>
      {r.link && (
        <a
          href={r.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 border-t border-border/30 pt-3 text-xs font-bold text-primary"
        >
          Learn more & apply <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </Card>
  );
}