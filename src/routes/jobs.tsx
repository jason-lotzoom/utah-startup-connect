import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { awardBadge } from "@/lib/badges";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Briefcase, Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Utah Startup Jobs — Open Roles | 5iO" },
      { name: "description", content: "Open roles at Utah startups. Filter by industry, location, and job type." },
      { property: "og:title", content: "Utah Startup Jobs — Open Roles | 5iO" },
      { property: "og:description", content: "Open roles at Utah startups. Filter by industry, location, and job type." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { isAdmin, user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRun, setLastRun] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: j }, { data: lr }] = await Promise.all([
        supabase
          .from("job_postings")
          .select("*, companies(id, name, sector, full_address, logo_url)")
          .eq("is_active", true)
          .order("posted_at", { ascending: false })
          .limit(500),
        supabase
          .from("hiring_refresh_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setJobs(j ?? []);
      setLastRun(lr);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("jobs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_postings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => j.companies?.sector && s.add(j.companies.sector));
    return Array.from(s).sort();
  }, [jobs]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      const loc = j.location || j.companies?.full_address;
      if (loc) s.add(loc.split(",")[0].trim());
    });
    return Array.from(s).sort().slice(0, 12);
  }, [jobs]);

  const types = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => j.type && s.add(j.type));
    return Array.from(s).sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (sector && j.companies?.sector !== sector) return false;
      if (type && j.type !== type) return false;
      if (city) {
        const loc = (j.location || j.companies?.full_address || "").toLowerCase();
        if (!loc.includes(city.toLowerCase())) return false;
      }
      if (q) {
        const text = `${j.title || ""} ${j.companies?.name || ""} ${j.description || ""}`.toLowerCase();
        if (!text.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, q, sector, type, city]);

  const triggerRefresh = async () => {
    setRefreshing(true);
    toast.info("Refresh started — this can take a few minutes.");
    const { data: sess } = await supabase.auth.getSession();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-hiring`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sess.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Refresh failed");
      toast.success(`Imported ${j.jobs_imported} roles from ${j.hiring} hiring companies.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />

      <section className="relative overflow-hidden text-white" style={{ background: "var(--gradient-canyon)" }}>
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-20">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/60 mb-2" style={{ fontFamily: "var(--font-accent)" }}>
            Utah Startup Jobs
          </p>
          <h1 className="text-4xl font-bold md:text-7xl leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Land your next role.
          </h1>
          <p className="mt-4 max-w-xl text-white/80 text-lg">
            {jobs.length} open roles across Utah startups, refreshed automatically.
          </p>
          <div className="mt-8 flex flex-wrap gap-8 text-sm">
            <Stat n={jobs.length} l="Open Roles" />
            <Stat n={sectors.length} l="Sectors Hiring" />
            <Stat n={new Set(jobs.map((j) => j.company_id)).size} l="Companies" />
          </div>

          {lastRun && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs backdrop-blur-md">
              <span className={`h-2 w-2 rounded-full ${lastRun.status === "completed" ? "bg-emerald-400" : "bg-amber-300"}`} />
              <span>Last refresh: {lastRun.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "running…"}</span>
              {isAdmin && (
                <Button size="sm" variant="secondary" className="ml-2 h-7 rounded-xl" onClick={triggerRefresh} disabled={refreshing}>
                  <RefreshCw className={`mr-1 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="sticky top-[72px] z-20 -mx-2 rounded-b-2xl border-b border-border/50 bg-background/80 px-2 py-4 backdrop-blur-md">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search role, company, or keyword…"
              className="pl-9 h-11 rounded-2xl border-border/50 bg-muted/30"
            />
          </div>
          <div className="mt-3 space-y-2">
            {sectors.length > 0 && <FilterRow label="Industry" options={sectors} value={sector} onChange={setSector} />}
            {cities.length > 0 && <FilterRow label="Location" options={cities} value={city} onChange={setCity} />}
            {types.length > 0 && <FilterRow label="Type" options={types} value={type} onChange={setType} />}
          </div>
        </div>

        {loading ? (
          <div className="mt-20 flex flex-col items-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin opacity-30" />
            <p className="mt-4">Loading open roles…</p>
          </div>
        ) : jobs.length === 0 ? (
          <Card className="mt-8 rounded-3xl border-dashed bg-muted/40 p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-xl font-bold">No live roles indexed yet</h3>
            <p className="mt-2 mx-auto max-w-md text-muted-foreground">
              Our crawler hasn't run yet. In the meantime, browse hiring companies on the map.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/map" search={{ hiring: "true" } as any}>
                <Button variant="outline" className="rounded-2xl">See companies hiring</Button>
              </Link>
              {isAdmin && (
                <Button onClick={triggerRefresh} disabled={refreshing} className="rounded-2xl">
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Trigger crawl now
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            <p className="mt-6 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Showing {filtered.length} of {jobs.length} roles
            </p>
            {filtered.length === 0 ? (
              <Card className="mt-6 rounded-3xl border-dashed bg-muted/40 p-12 text-center">
                <h3 className="text-xl font-bold">No roles match your filters</h3>
                <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => { setQ(""); setSector(null); setType(null); setCity(null); }}>
                  Clear filters
                </Button>
              </Card>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {filtered.map((j) => <JobCard key={j.id} j={j} userId={user?.id} />)}
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{n}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">{l}</div>
    </div>
  );
}

function FilterRow({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
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

function JobCard({ j, userId }: { j: any; userId?: string }) {
  const company = j.companies;
  const location = j.location || company?.full_address || "Utah";
  return (
    <Card className="flex flex-col gap-3 rounded-3xl border-border/50 p-5 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
      <div className="flex items-start gap-3">
        {company?.logo_url ? (
          <img src={company.logo_url} alt={company.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
            {company?.name?.[0] ?? "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{j.title}</h3>
          {company && (
            <Link to="/map/company/$id" params={{ id: company.id }} className="text-sm text-muted-foreground hover:text-primary">
              {company.name}
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location.split(",")[0]}</span>
        {j.type && <Badge variant="outline" className="border-border/50 text-[9px]">{j.type}</Badge>}
        {company?.sector && <Badge variant="secondary" className="border-none bg-primary/5 text-[9px] text-primary">{company.sector}</Badge>}
      </div>
      {j.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{j.description}</p>
      )}
      {j.url && (
        <a
          href={j.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => { if (userId) awardBadge(userId, "job_hunter"); }}
          className="mt-auto inline-flex items-center gap-1 border-t border-border/30 pt-3 text-xs font-bold text-primary"
        >
          Apply <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </Card>
  );
}