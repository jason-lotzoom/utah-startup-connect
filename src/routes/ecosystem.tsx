import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  TrendingUp,
  Briefcase,
  MapPin,
  Users,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/ecosystem" as any)({
  head: () => ({
    meta: [
      { title: "Ecosystem Dashboard — 5iO" },
      {
        name: "description",
        content: "Utah's startup ecosystem at a glance — sectors, stages, hiring activity, and growth.",
      },
    ],
  }),
  component: EcosystemDashboard,
});

const SECTOR_COLORS: Record<string, string> = {
  Tech: "#C1440E",
  "Life Sciences": "#2E86AB",
  Aerospace: "#6C48C5",
  Energy: "#E8A87C",
  Outdoor: "#4A9B3D",
  Manufacturing: "#8B6914",
  Other: "#888888",
};

function EcosystemDashboard() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("companies").select("*").eq("status", "active"),
      supabase.from("resources").select("*").eq("is_active", true),
    ]).then(([c, r]) => {
      setCompanies(c.data ?? []);
      setResources(r.data ?? []);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const sectors: Record<string, number> = {};
    const stages: Record<string, number> = {};
    let hiring = 0;
    let withJobs = 0;

    for (const c of companies) {
      if (c.sector) sectors[c.sector] = (sectors[c.sector] || 0) + 1;
      if (c.stage) stages[c.stage] = (stages[c.stage] || 0) + 1;
      if (c.hiring_status) hiring++;
    }

    const sectorData = Object.entries(sectors)
      .map(([name, value]) => ({ name, value, color: SECTOR_COLORS[name] || "#888" }))
      .sort((a, b) => b.value - a.value);

    const stageOrder = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"];
    const stageData = stageOrder
      .filter((s) => stages[s])
      .map((name) => ({ name, value: stages[name] || 0 }));

    return { sectors: sectorData, stages: stageData, hiring, totalCompanies: companies.length, totalResources: resources.length };
  }, [companies, resources]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />

      {/* ─── Hero ──── */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: "var(--gradient-canyon)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p
            className="text-xs uppercase tracking-[0.3em] text-white/70"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Ecosystem Dashboard
          </p>
          <h1
            className="mt-3 max-w-3xl text-4xl font-bold md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Utah's startup ecosystem at a glance.
          </h1>
          <p className="mt-4 max-w-xl text-white/80">
            Real-time data from {stats.totalCompanies} companies and {stats.totalResources}{" "}
            resources across the state.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2">Loading ecosystem data…</span>
          </div>
        ) : (
          <>
            {/* ─── Key Metrics ──── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<Building2 className="h-5 w-5" />}
                label="Active Companies"
                value={stats.totalCompanies}
                color="text-primary"
              />
              <MetricCard
                icon={<Layers className="h-5 w-5" />}
                label="State Resources"
                value={stats.totalResources}
                color="text-[oklch(0.58_0.10_230)]"
              />
              <MetricCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Currently Hiring"
                value={stats.hiring}
                color="text-emerald-600"
              />
              <MetricCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Sectors Covered"
                value={stats.sectors.length}
                color="text-amber-600"
              />
            </div>

            {/* ─── Charts ──── */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Sector Distribution */}
              <Card className="p-6">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Companies by Sector
                </h3>
                <div className="mt-4 flex items-center gap-6">
                  <div className="h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.sectors}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {stats.sectors.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stats.sectors.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-semibold">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Stage Distribution */}
              <Card className="p-6">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Companies by Stage
                </h3>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.stages}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" fill="oklch(0.52 0.16 38)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* ─── Hiring Spotlight ──── */}
            <Card className="mt-8 p-6">
              <div className="flex items-center justify-between">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  🔥 Hiring now
                </h3>
                <Link
                  to="/map"
                  search={{ hiring: true } as any}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View all on map <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {companies
                  .filter((c) => c.hiring_status)
                  .slice(0, 6)
                  .map((c) => (
                    <Link key={c.id} to="/map/company/$id" params={{ id: c.id }}>
                      <div className="rounded-xl border border-border p-4 transition hover:shadow-[var(--shadow-warm)]">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                            {c.name}
                          </p>
                          <Badge variant="default" className="bg-emerald-600 text-white text-[10px]">
                            Hiring
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[c.sector, c.full_address?.split(",")[0]].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
            </Card>

            {/* ─── CTA ──── */}
            <div className="mt-12 rounded-2xl bg-[oklch(0.22_0.04_280)] p-8 text-center text-white md:p-12">
              <h3
                className="text-2xl font-bold md:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Ready to be part of the ecosystem?
              </h3>
              <p className="mx-auto mt-3 max-w-md text-white/70">
                Add your company to the map, find resources, and connect with Utah's startup
                community.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link to="/map/add-company">
                  <button className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.52_0.16_38)] transition hover:bg-white/90">
                    Submit your company
                  </button>
                </Link>
                <Link to="/navigator">
                  <button className="rounded-2xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Find resources
                  </button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="p-5 transition hover:shadow-[var(--shadow-warm)]">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
      <p
        className="mt-1 text-xs uppercase tracking-widest text-muted-foreground"
        style={{ fontFamily: "var(--font-accent)" }}
      >
        {label}
      </p>
    </Card>
  );
}
