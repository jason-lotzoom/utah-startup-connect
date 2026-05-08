import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, isAdmin } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--font-body)" }}>
      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-canyon)" }}
      >
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            <span className="inline-block h-3 w-3 rounded-full bg-white/90" />
            5iO
          </div>
          <div className="hidden items-center gap-7 text-sm uppercase tracking-widest md:flex" style={{ fontFamily: "var(--font-accent)" }}>
            <Link to="/navigator" className="hover:text-white/80">Navigator</Link>
            <Link to="/map" className="hover:text-white/80">Startup Map</Link>
            {user && <Link to="/dashboard" className="hover:text-white/80">Dashboard</Link>}
            {isAdmin && <Link to="/admin" className="hover:text-white/80">Admin</Link>}
            {user ? null : (
              <Link to="/auth/login" className="rounded-full border border-white/40 px-4 py-1.5 text-xs hover:bg-white/10">
                Sign in
              </Link>
            )}
          </div>
        </nav>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-16 md:pt-28">
          <p className="mb-6 text-xs uppercase tracking-[0.3em] text-white/70" style={{ fontFamily: "var(--font-accent)" }}>
            Utah Governor's Office of Economic Development
          </p>
          <h1
            className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Build the Startup State.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85 md:text-xl">
            Two tools. One platform. Built for Utah founders.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/navigator"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.52_0.16_38)] shadow-lg transition hover:bg-white/90"
              style={{ fontFamily: "var(--font-accent)", letterSpacing: "0.05em" }}
            >
              Find Resources →
            </Link>
            <Link
              to="/map"
              className="rounded-2xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              style={{ fontFamily: "var(--font-accent)", letterSpacing: "0.05em" }}
            >
              Explore the Map →
            </Link>
          </div>
        </div>

        {/* Mountain silhouette */}
        <svg
          viewBox="0 0 1440 200"
          className="absolute bottom-0 left-0 right-0 h-24 w-full md:h-40"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,200 L0,140 L160,80 L280,130 L420,40 L560,120 L700,60 L860,140 L1000,90 L1160,150 L1300,70 L1440,130 L1440,200 Z"
            fill="oklch(0.965 0.015 75)"
          />
        </svg>
      </section>

      {/* Two products */}
      <section className="mx-auto max-w-6xl px-6 py-24" id="navigator">
        <p
          className="mb-3 text-xs uppercase tracking-[0.3em] text-[oklch(0.52_0.16_38)]"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          The Platform
        </p>
        <h2 className="text-4xl font-bold md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          Two tools, deeply connected.
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
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
        </div>
      </section>

      {/* By the numbers */}
      <section className="border-y border-border bg-[oklch(0.92_0.02_70)]/40 py-16" id="about">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          {[
            ["213", "Resources"],
            ["222", "Startups"],
            ["29", "Counties"],
            ["7", "Sectors"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="text-5xl font-bold text-[oklch(0.52_0.16_38)]" style={{ fontFamily: "var(--font-display)" }}>
                {n}
              </div>
              <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-accent)" }}>
                {l}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
