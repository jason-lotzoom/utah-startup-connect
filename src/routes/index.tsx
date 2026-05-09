import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteNav";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HeroLiveMap, { SECTOR_LEGEND, type HeroLiveMapHandle } from "@/components/HeroLiveMap";
import { supabase } from "@/integrations/supabase/client";
import ConciergeAgent from "@/components/ConciergeAgent";
import {
  HomeNavigatorPreview,
  HomeMapPreview,
  HomeEventsPreview,
  HomeJobsPreview,
} from "@/components/home/HomeToolSections";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const [activeSectors, setActiveSectors] = useState<Set<string>>(new Set());
  const [heroStats, setHeroStats] = useState<{
    companies: number;
    resources: number;
    sectors: number;
    newThisWeek: number;
  }>({ companies: 0, resources: 0, sectors: 0, newThisWeek: 0 });
  const flyToRef = useRef<HeroLiveMapHandle | null>(null);

  // Load real ecosystem counts + how many companies joined this week
  useEffect(() => {
    let active = true;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      supabase.from("companies").select("id, name, sector", { count: "exact" }).eq("status", "active"),
      supabase.from("resources").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("created_at", weekAgo),
    ]).then(([c, r, weekly]) => {
      if (!active) return;
      const sectors = new Set((c.data ?? []).map((x: any) => x.sector).filter(Boolean));
      setHeroStats({
        companies: c.count ?? c.data?.length ?? 0,
        resources: r.count ?? 0,
        sectors: sectors.size,
        newThisWeek: weekly.count ?? 0,
      });
    });
    return () => { active = false; };
  }, []);

  const toggleSector = (label: string) => {
    setActiveSectors((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
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
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <Button size="sm" className="h-9 shadow-xl shadow-primary/20" asChild>
              <Link to="/map/add-company">List your company</Link>
            </Button>
            <button className="lg:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
              <Compass className="h-6 w-6" />
            </button>
          </div>
        </div>
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-full w-full bg-slate-900 border-b border-white/10 p-6 flex flex-col gap-4 text-white text-sm uppercase tracking-widest lg:hidden">
            <Link to="/navigator" onClick={() => setMenuOpen(false)}>Navigator</Link>
            <Link to="/map" onClick={() => setMenuOpen(false)}>Startup Map</Link>
            <Link to="/events" onClick={() => setMenuOpen(false)}>Events</Link>
            <Link to="/ecosystem" onClick={() => setMenuOpen(false)}>Ecosystem</Link>
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
            <HeroStat value={heroStats.newThisWeek} label="New this week" />
          </div>
        </div>
      </section>

      {/* ─── Inline tool previews ──── */}
      <HomeNavigatorPreview />
      <HomeMapPreview />
      <HomeEventsPreview />
      <HomeJobsPreview />

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
          <PersonaCard
            name="Marcus"
            role="Veteran Founder"
            loc="Ogden"
            needs="Defense & Capital"
            img="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop"
            search={{ stage: "Pre-seed", industry: "Manufacturing", needs: "Capital", location: "Weber County", community: "Veterans" }}
          />
          <PersonaCard
            name="Priya"
            role="B2B SaaS Founder"
            loc="Lehi"
            needs="Series A Capital"
            img="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop"
            search={{ stage: "Series A+", industry: "Tech / Software", needs: "Capital", location: "Utah County" }}
          />
          <PersonaCard
            name="David"
            role="Medical Device Founder"
            loc="Salt Lake City"
            needs="International Trade"
            img="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop"
            search={{ stage: "Seed", industry: "Life Sciences", needs: "International Trade", location: "Salt Lake County" }}
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
      <ConciergeAgent />
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

function HeroStat({ value, label }: { value: number; label: string }) {
  const [count, setCount] = useState(0);

  // Looping count-up: animates whenever the target value changes,
  // and replays every ~9s so the hero feels alive.
  useEffect(() => {
    if (!value) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const duration = 1600;
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setCount(Math.floor(eased * value));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    run();
    const loop = setInterval(() => {
      setCount(0);
      run();
    }, 9000);
    return () => { cancelAnimationFrame(raf); clearInterval(loop); };
  }, [value]);

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="text-4xl md:text-5xl font-normal text-foreground/90 leading-none tabular-nums"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {count}
        <span className="text-foreground/60">+</span>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/50">
        {label}
      </p>
    </div>
  );
}

