import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, Compass, Map, BarChart3, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

  const handleAiSearch = () => {
    window.location.href = `/navigator?q=${encodeURIComponent(aiSearch)}`;
  };

  return (
    <div className="bg-background min-h-screen selection:bg-primary/20">
      {/* ─── Top Nav ──── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white shadow-lg shadow-primary/20">
              5
            </div>
            <span className="text-xl font-bold tracking-tighter text-white" style={{ fontFamily: "var(--font-display)" }}>
              5iO Navigator
            </span>
          </div>
          <div className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-widest text-white/70 md:flex">
            <Link to="/navigator" className="transition hover:text-white/80">
              Navigator
            </Link>
            <Link to="/map" className="transition hover:text-white/80">
              Startup Map
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
          <div className="flex items-center gap-4">
            {user ? (
              <Button size="sm" variant="outline" className="h-9 border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10" asChild>
                <Link to="/dashboard">My Dashboard</Link>
              </Button>
            ) : (
              <Button size="sm" className="h-9 shadow-xl shadow-primary/20" asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            )}
            <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
              <Compass className="h-6 w-6" />
            </button>
          </div>
        </div>
        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-full w-full bg-slate-900 border-b border-white/10 p-6 flex flex-col gap-4 text-white text-sm uppercase tracking-widest md:hidden">
            <Link to="/navigator" onClick={() => setMenuOpen(false)}>Navigator</Link>
            <Link to="/map" onClick={() => setMenuOpen(false)}>Startup Map</Link>
            <Link to="/ecosystem" onClick={() => setMenuOpen(false)}>Ecosystem</Link>
            {user && <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>}
          </div>
        )}
      </nav>

      {/* ─── Hero Section ──── */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 pt-20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -left-1/4 top-0 h-[800px] w-[800px] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
          <div className="absolute -right-1/4 bottom-0 h-[800px] w-[800px] rounded-full bg-[oklch(0.58_0.10_230)]/10 blur-[120px] animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            Empowering the Utah Startup State
          </div>
          
          <h1 className="animate-fade-in-up text-5xl font-bold tracking-tight text-white md:text-8xl leading-[0.9]" style={{ fontFamily: "var(--font-display)" }}>
            Navigate the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-200">
              Silicon Slopes.
            </span>
          </h1>
          
          <p className="mx-auto mt-8 max-w-2xl animate-fade-in-up text-lg text-white/60 md:text-xl leading-relaxed" style={{ animationDelay: "0.1s" }}>
            The definitive platform for Utah founders. Find capital, mentors, and community tailored to your stage and sector in 60 seconds.
          </p>

          {/* AI Instant Match */}
          <div className="mt-12 mx-auto max-w-2xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="group relative rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-2xl transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <div className="flex items-center gap-3 px-4">
                <Search className="h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Tell us about your startup..."
                  className="h-14 w-full bg-transparent text-white placeholder:text-white/30 focus:outline-none"
                  value={aiSearch}
                  onChange={(e) => setAiSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
                />
                <Button 
                  onClick={handleAiSearch} 
                  className="h-11 rounded-2xl px-6 shadow-lg shadow-primary/20"
                  disabled={!aiSearch.trim()}
                >
                  Match Me
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <span>Try: "B2B SaaS in Provo"</span>
              <span>"Rural manufacturing grants"</span>
              <span>"UofU student biotech"</span>
            </div>
          </div>
        </div>

        {/* Ecosystem Trust Banner */}
        <div className="relative z-10 mt-20 w-full max-w-7xl border-t border-white/5 pt-12">
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale transition hover:grayscale-0 hover:opacity-100 duration-500">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/60 mr-4">Official Ecosystem Partners</span>
            <img src="https://utahinnovationcenter.utah.gov/wp-content/uploads/2021/03/Governor_s_Office_of_Economic_Opportunity_Logo_White.png" alt="Utah GOEO" className="h-8" />
            <img src="https://siliconslopes.com/content/images/2022/04/SS_Logo_White.png" alt="Silicon Slopes" className="h-6" />
            <img src="https://lassonde.utah.edu/wp-content/uploads/2014/10/lassonde-logo-white.png" alt="Lassonde Institute" className="h-8" />
          </div>
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
