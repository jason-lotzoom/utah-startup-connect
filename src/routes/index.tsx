import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Search, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import HeroLiveMap, { SECTOR_LEGEND, type HeroLiveMapHandle } from "@/components/HeroLiveMap";
import { awardBadge } from "@/lib/badges";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "5iO — Utah's Startup Ecosystem Platform" },
      { name: "description", content: "Find resources, explore startups, and navigate Utah's world-class entrepreneurial ecosystem." },
      { property: "og:title", content: "5iO — Utah's Startup Ecosystem Platform" },
      { property: "og:description", content: "Find resources, explore startups, and navigate Utah's world-class entrepreneurial ecosystem." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiSearch, setAiSearch] = useState("");
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; sector: string | null }>>([]);
  const [activeSectors, setActiveSectors] = useState<Set<string>>(new Set());
  const [showSuggest, setShowSuggest] = useState(false);
  const [heroStats, setHeroStats] = useState<{
    companies: number;
    resources: number;
    sectors: number;
    latest: { name: string; sector: string | null; id: string } | null;
  }>({ companies: 0, resources: 0, sectors: 0, latest: null });
  const flyToRef = useRef<HeroLiveMapHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load real ecosystem counts + freshest company
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("companies").select("id, name, sector", { count: "exact" }).eq("status", "active"),
      supabase.from("resources").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("companies")
        .select("id, name, sector, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
    ]).then(([c, r, latest]) => {
      if (!active) return;
      const sectors = new Set((c.data ?? []).map((x: any) => x.sector).filter(Boolean));
      setHeroStats({
        companies: c.count ?? c.data?.length ?? 0,
        resources: r.count ?? 0,
        sectors: sectors.size,
        latest: latest.data?.[0]
          ? { id: latest.data[0].id, name: latest.data[0].name, sector: latest.data[0].sector }
          : null,
      });
    });
    return () => { active = false; };
  }, []);

  const STATIC_SUGGESTIONS = [
    "Find seed capital",
    "Mentors in Lehi",
    "Biotech grants",
    "Hiring in Provo",
    "Rural programs",
    "Aerospace events",
  ];

  const sectorVar = (sector: string | null) => {
    switch (sector) {
      case "Tech": return "tech";
      case "Life Sciences": return "life";
      case "Aerospace": return "aero";
      case "Energy": return "energy";
      case "Outdoor": return "outdoor";
      case "Manufacturing": return "mfg";
      default: return "other";
    }
  };

  const suggestions = useMemo(() => {
    const q = aiSearch.trim().toLowerCase();
    const companyHits = q
      ? companies
          .filter((c) => c.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((c) => ({ kind: "company" as const, id: c.id, label: c.name, sector: c.sector }))
      : [];
    const staticHits = (q
      ? STATIC_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q))
      : STATIC_SUGGESTIONS
    )
      .slice(0, 6 - companyHits.length)
      .map((s) => ({ kind: "query" as const, label: s }));
    return [...companyHits, ...staticHits];
  }, [aiSearch, companies]);

  const toggleSector = (label: string) => {
    setActiveSectors((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const clearSearch = () => {
    setAiSearch("");
    searchInputRef.current?.focus();
  };

  const handleAiSearch = () => {
    if (user) awardBadge(user.id, "first_scout");
    if (aiSearch.trim()) {
      flyToRef.current?.flyToQuery(aiSearch);
      setTimeout(() => {
        window.location.href = `/navigator?q=${encodeURIComponent(aiSearch)}`;
      }, 1200);
      return;
    }
    window.location.href = `/navigator?q=${encodeURIComponent(aiSearch)}`;
  };

  return (
    <div className="bg-background min-h-screen selection:bg-primary/20">
      {/* ─── Top Nav ──── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white shadow-lg shadow-primary/20">
              5
            </div>
            <span className="text-xl font-bold tracking-tighter text-white" style={{ fontFamily: "var(--font-display)" }}>
              5iO Navigator
            </span>
          </div>
          <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-widest text-white/70 lg:flex shrink-0">
            <Link to="/navigator" className="transition hover:text-white/80">
              Navigator
            </Link>
            <Link to="/map" className="transition hover:text-white/80">
              Map
            </Link>
            <Link to="/events" className="transition hover:text-white/80">
              Events
            </Link>
            <Link to="/ecosystem" className="transition hover:text-white/80">
              Ecosystem
            </Link>
            {user && (
              <Link to="/dashboard" className="transition hover:text-white/80">
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="transition hover:text-white/80">
                Admin
              </Link>
            )}
          </div>

          {/* Header search — compact, with clear button + suggest dropdown */}
          <div className="hidden md:block relative w-[320px] lg:w-[380px] ml-auto">
            <div className="group relative flex w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-xl focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
              <Search className="h-4 w-4 text-white/50 group-focus-within:text-primary" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tell us about your startup…"
                className="h-8 w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                value={aiSearch}
                onChange={(e) => { setAiSearch(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
              />
              {aiSearch && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="text-white/50 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <Button
                size="sm"
                onClick={handleAiSearch}
                className="h-7 rounded-full px-3 text-xs shadow-md shadow-primary/20"
                disabled={!aiSearch.trim()}
              >
                Match
              </Button>
            </div>
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-foreground/10 bg-card/95 p-1.5 shadow-xl backdrop-blur-xl z-50">
                {suggestions.map((s, i) => (
                  s.kind === "company" ? (
                    <Link
                      key={`c-${s.id}`}
                      to="/map/company/$id"
                      params={{ id: s.id }}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: `var(--sector-${sectorVar(s.sector)})` }} />
                      <span className="flex-1 truncate">{s.label}</span>
                      <span className="text-[10px] uppercase tracking-widest text-foreground/40">Company</span>
                    </Link>
                  ) : (
                    <button
                      key={`q-${i}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAiSearch(s.label);
                        setShowSuggest(false);
                        setTimeout(handleAiSearch, 0);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <Search className="h-3.5 w-3.5 text-foreground/40" />
                      <span className="flex-1 truncate">{s.label}</span>
                    </button>
                  )
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 md:ml-3">
            {user ? (
              <Button size="sm" variant="outline" className="h-9 border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10" asChild>
                <Link to="/dashboard">My Dashboard</Link>
              </Button>
            ) : (
              <Button size="sm" className="h-9 shadow-xl shadow-primary/20" asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            )}
            <button className="lg:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
              <Compass className="h-6 w-6" />
            </button>
          </div>
        </div>
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-full w-full bg-slate-900 border-b border-white/10 p-6 flex flex-col gap-4 text-white text-sm uppercase tracking-widest lg:hidden">
            <div className="md:hidden flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Search className="h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Tell us about your startup…"
                className="h-8 w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none normal-case tracking-normal"
                value={aiSearch}
                onChange={(e) => setAiSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
              />
            </div>
            <Link to="/navigator" onClick={() => setMenuOpen(false)}>Navigator</Link>
            <Link to="/map" onClick={() => setMenuOpen(false)}>Startup Map</Link>
            <Link to="/events" onClick={() => setMenuOpen(false)}>Events</Link>
            <Link to="/ecosystem" onClick={() => setMenuOpen(false)}>Ecosystem</Link>
            {user && <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>}
          </div>
        )}
      </nav>

      {/* ─── Hero Section ──── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-background px-6 pt-20">
        {/* Live cinematic map background */}
        <div className="absolute inset-0 z-0">
          <HeroLiveMap
            onReady={(n) => setTrackedCount(n)}
            flyToRef={flyToRef}
            activeSectors={activeSectors.size > 0 ? activeSectors : null}
            onCompaniesLoaded={(rows) => setCompanies(rows.map((r) => ({ id: r.id, name: r.name, sector: r.sector })))}
            hideHotspotChip
          />
          {/* Creamy parchment tint to match the brand palette */}
          <div className="hero-map-tint" />
          {/* Soft fade only at top + bottom so map stays clean & centered */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>

        {/* LIVE chip top-right */}
        <div className="absolute top-20 right-6 z-20 hidden md:flex items-center gap-2 rounded-full border border-emerald-600/30 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 backdrop-blur-md shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · {trackedCount ?? "—"} startups tracked
        </div>

        {/* Sector legend bottom-right — clickable filter */}
        <div className="absolute bottom-6 right-6 z-20 hidden lg:flex flex-col gap-1 rounded-2xl border border-foreground/10 bg-white/80 px-3 py-2.5 backdrop-blur-md shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/50 mb-1">Filter by sector</p>
          {SECTOR_LEGEND.map((s) => {
            const active = activeSectors.size === 0 || activeSectors.has(s.label === "Life Sci" ? "Life Sciences" : s.label === "Mfg" ? "Manufacturing" : s.label);
            const sectorKey = s.label === "Life Sci" ? "Life Sciences" : s.label === "Mfg" ? "Manufacturing" : s.label;
            return (
              <button
                key={s.label}
                type="button"
                aria-pressed={activeSectors.has(sectorKey)}
                onClick={() => toggleSector(sectorKey)}
                className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px] transition hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? "text-foreground/80" : "text-foreground/30"}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? s.color : "transparent", border: active ? "none" : `1.5px solid ${s.color}` }}
                />
                {s.label}
              </button>
            );
          })}
          {activeSectors.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveSectors(new Set())}
              className="mt-1 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
            >
              Show all
            </button>
          )}
        </div>

        {/* SR-only h1 for SEO/a11y — hero is intentionally a clean live map */}
        <h1 className="sr-only">Navigate the Silicon Slopes — Utah's startup ecosystem platform</h1>

        {/* Ecosystem Stats Banner */}
        <div className="relative z-10 mt-auto w-full max-w-7xl border-t border-foreground/10 pt-8 pb-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
            <HeroStat value={heroStats.companies} label="Active Companies" />
            <HeroStat value={heroStats.resources} label="State Resources" />
            <HeroStat value={heroStats.sectors} label="Sectors Covered" />
            <NewThisWeek latest={heroStats.latest} />
          </div>
        </div>
      </section>

      {/* ─── Platform Cards ──── */}
      <section className="mx-auto max-w-6xl px-6 py-24" id="navigator">
        <p
          className="mb-3 text-xs uppercase tracking-[0.3em] text-[oklch(0.52_0.16_38)]"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          The Platform
        </p>
        <h2 className="text-4xl font-bold md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          Three tools, deeply connected.
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Link to="/navigator" className="block rounded-t-[2.5rem] rounded-b-2xl border border-border bg-card p-8 shadow-[var(--shadow-warm)] transition hover:-translate-y-1">
            <div className="mb-4 inline-block rounded-full bg-[oklch(0.52_0.16_38)]/10 px-3 py-1 text-xs uppercase tracking-widest text-[oklch(0.52_0.16_38)]" style={{ fontFamily: "var(--font-accent)" }}>
              Founder's Navigator
            </div>
            <h3 className="mb-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              From idea to the right program in 2 minutes.
            </h3>
            <p className="mb-6 text-muted-foreground">
              An AI-guided quiz matches you with personalized state programs from a curated library of 213 Utah resources. Then chat with our AI to refine.
            </p>
            <span className="text-sm font-semibold text-[oklch(0.52_0.16_38)]">Open Navigator →</span>
          </Link>

          <Link
            to="/map"
            id="map"
            className="block rounded-t-[2.5rem] rounded-b-2xl border border-border bg-card p-8 shadow-[var(--shadow-warm)] transition hover:-translate-y-1"
          >
            <div className="mb-4 inline-block rounded-full bg-[oklch(0.58_0.10_230)]/10 px-3 py-1 text-xs uppercase tracking-widest text-[oklch(0.58_0.10_230)]" style={{ fontFamily: "var(--font-accent)" }}>
              Utah Startup Map
            </div>
            <h3 className="mb-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              The state's startup ecosystem, mapped.
            </h3>
            <p className="mb-6 text-muted-foreground">
              222 verified Utah startups across 7 sectors. Filter by sector, stage, or hiring status — and claim your own listing.
            </p>
            <span className="text-sm font-semibold text-[oklch(0.58_0.10_230)]">Open Map →</span>
          </Link>

          <Link
            to="/events"
            className="block rounded-t-[2.5rem] rounded-b-2xl border border-border bg-card p-8 shadow-[var(--shadow-warm)] transition hover:-translate-y-1"
          >
            <div className="mb-4 inline-block rounded-full bg-[oklch(0.58_0.16_148)]/10 px-3 py-1 text-xs uppercase tracking-widest text-[oklch(0.58_0.16_148)]" style={{ fontFamily: "var(--font-accent)" }}>
              Events Feed
            </div>
            <h3 className="mb-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Upcoming Utah startup events.
            </h3>
            <p className="mb-6 text-muted-foreground">
              Personalized events, conventions, pitch nights, and meetups for Utah entrepreneurs — matched to your profile.
            </p>
            <span className="text-sm font-semibold text-[oklch(0.58_0.16_148)]">Browse Events →</span>
          </Link>
        </div>
      </section>

      {/* ─── How it Works ──── */}
      <section className="bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-primary" style={{ fontFamily: "var(--font-accent)" }}>The Path to Success</h2>
            <h3 className="mt-4 text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>Simple. Smart. Seamless.</h3>
          </div>

          <div className="mt-20 grid gap-12 md:grid-cols-3">
            <StepCard 
              n="01" 
              t="Define your Profile" 
              d="Tell the Navigator about your sector, stage, and specific needs in our 60-second quiz." 
            />
            <StepCard 
              n="02" 
              t="AI Intelligent Match" 
              d="Our engine scans the entire Utah ecosystem to find the top 1% of programs for you." 
            />
            <StepCard 
              n="03" 
              t="Take Direct Action" 
              d="Apply directly, connect with mentors, and start scaling with verified state resources." 
            />
          </div>
        </div>
      </section>

      {/* ─── Personas ──── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-primary" style={{ fontFamily: "var(--font-accent)" }}>Built for Everyone</h2>
              <h3 className="mt-4 text-4xl font-bold text-slate-900 md:text-6xl" style={{ fontFamily: "var(--font-display)" }}>Who are you building for?</h3>
            </div>
            <Button variant="outline" className="rounded-2xl h-12 px-8 border-slate-200" asChild>
              <Link to="/navigator">View all paths →</Link>
            </Button>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PersonaCard 
            name="Jordan" 
            role="Student Founder" 
            loc="Salt Lake City" 
            needs="Mentorship & R&D"
            img="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop"
            search={{ stage: "Idea", industry: "Tech / Software", needs: "Mentorship", location: "Salt Lake County" }}
          />
          <PersonaCard 
            name="Maria" 
            role="Rural Entrepreneur" 
            loc="Cedar City" 
            needs="Grants & Workspace"
            img="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
            search={{ stage: "Pre-seed", industry: "Manufacturing", needs: "Capital", location: "Other Utah", community: "Rural" }}
          />
          <PersonaCard 
            name="Dr. Amir" 
            role="Biotech Researcher" 
            loc="Provo / BYU" 
            needs="Commercialization"
            img="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop"
            search={{ stage: "Seed", industry: "Life Sciences", needs: "Compliance", location: "Utah County" }}
          />
          </div>
        </div>
      </section>

      {/* ─── Live Stats ──── */}
      <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
        <div className="absolute inset-0 bg-primary/5 opacity-50" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <StatBlock n={450} l="Active Companies" />
            <StatBlock n={85} l="State Resources" />
            <StatBlock n={120} l="Capital Sources" />
            <StatBlock n={12} l="Rural Programs" />
          </div>
        </div>
      </section>

      {/* ─── Hiring CTA ──── */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[3rem] bg-slate-900 shadow-2xl">
          <div className="grid md:grid-cols-2">
            <div className="p-12 md:p-20">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Data Feed
              </div>
              <h3 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Utah is <br /> hiring.
              </h3>
              <p className="mt-6 text-white/60 text-lg leading-relaxed">
                Our AI-powered engine tracks thousands of open roles across the state. Explore the hiring map and find your next venture.
              </p>
              <Button size="lg" className="mt-10 h-14 rounded-2xl px-10 text-base shadow-xl shadow-primary/20" asChild>
                <Link to="/map" search={{ hiring: "true" } as any}>Explore the map</Link>
              </Button>
            </div>
            <div className="relative hidden md:block overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&fit=crop" 
                alt="Utah Startup Culture" 
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-1000 hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-slate-900 via-transparent to-slate-900" />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function StepCard({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="group relative">
      <div className="text-6xl font-black text-white/5 transition-colors group-hover:text-primary/10 select-none" style={{ fontFamily: "var(--font-display)" }}>{n}</div>
      <div className="relative -mt-8 pl-4">
        <h4 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{t}</h4>
        <p className="mt-3 text-white/50 leading-relaxed">{d}</p>
      </div>
    </div>
  );
}

function PersonaCard({ name, role, loc, needs, img, search }: { name: string; role: string; loc: string; needs: string; img: string, search: any }) {
  return (
    <Link 
      to="/navigator" 
      search={search}
      className="group relative h-96 overflow-hidden rounded-[2.5rem] bg-slate-900 transition-all hover:-translate-y-2 hover:shadow-2xl"
    >
      <img src={img} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-50 grayscale transition-all group-hover:opacity-80 group-hover:grayscale-0 duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
      <div className="absolute bottom-0 p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">{role}</p>
        <h4 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{name}</h4>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-white/10 text-white/80 border-none backdrop-blur-md text-[10px] uppercase tracking-wider">{loc}</Badge>
          <Badge variant="outline" className="border-white/20 text-white/60 text-[10px] uppercase tracking-wider">{needs}</Badge>
        </div>
      </div>
    </Link>
  );
}

function StatBlock({ n, l }: { n: number; l: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        let start = 0;
        const end = n;
        const duration = 2000;
        const step = (timestamp: number) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          setCount(Math.floor(progress * end));
          if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [n]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-5xl font-bold tracking-tighter" style={{ fontFamily: "var(--font-display)" }}>{count}+</div>
      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">{l}</p>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="text-4xl md:text-5xl font-normal text-foreground/90 leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
        <span className="text-foreground/60">+</span>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/50">
        {label}
      </p>
    </div>
  );
}
