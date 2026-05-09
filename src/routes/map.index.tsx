import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, MapPin, Plus, Search, RefreshCw, ArrowRight, Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import MapGL, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

export const Route = createFileRoute("/map/")({
  component: MapPage,
});

const SECTORS = ["Tech", "Life Sciences", "Aerospace", "Energy", "Outdoor", "Manufacturing", "Other"];
const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"];

// Well-known Utah startup logos (favicon URLs that actually work)
const KNOWN_LOGOS: Record<string, string> = {
  "Lucid": "https://logo.clearbit.com/lucid.co",
  "Pluralsight": "https://logo.clearbit.com/pluralsight.com",
  "Qualtrics": "https://logo.clearbit.com/qualtrics.com",
  "Domo": "https://logo.clearbit.com/domo.com",
  "MX": "https://logo.clearbit.com/mx.com",
  "Podium": "https://logo.clearbit.com/podium.com",
  "Divvy": "https://logo.clearbit.com/divvy.co",
  "BambooHR": "https://logo.clearbit.com/bamboohr.com",
  "Instructure": "https://logo.clearbit.com/instructure.com",
  "Health Catalyst": "https://logo.clearbit.com/healthcatalyst.com",
  "Weave": "https://logo.clearbit.com/getweave.com",
  "Filevine": "https://logo.clearbit.com/filevine.com",
  "Awardco": "https://logo.clearbit.com/awardco.com",
  "Lendio": "https://logo.clearbit.com/lendio.com",
  "Cotopaxi": "https://logo.clearbit.com/cotopaxi.com",
  "Pura": "https://logo.clearbit.com/pura.com",
  "Pattern": "https://logo.clearbit.com/pattern.com",
  "Nomi Health": "https://logo.clearbit.com/nomihealth.com",
  "Neighbor": "https://logo.clearbit.com/neighbor.com",
  "Route": "https://logo.clearbit.com/route.com",
  "Homie": "https://logo.clearbit.com/homie.com",
  "Gabb Wireless": "https://logo.clearbit.com/gabb.com",
  "SalesRabbit": "https://logo.clearbit.com/salesrabbit.com",
  "JobNimbus": "https://logo.clearbit.com/jobnimbus.com",
  "Zonos": "https://logo.clearbit.com/zonos.com",
  "Tava Health": "https://logo.clearbit.com/tavahealth.com",
};

function getLogoUrl(company: any): string | null {
  // Priority: known logo > website-based clearbit > null
  if (KNOWN_LOGOS[company.name]) return KNOWN_LOGOS[company.name];
  if (company.website) {
    try {
      const domain = new URL(
        company.website.startsWith("http") ? company.website : `https://${company.website}`
      ).hostname;
      return `https://logo.clearbit.com/${domain}`;
    } catch {
      return null;
    }
  }
  return null;
}

function MapPage() {
  const { isAdmin } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [limit, setLimit] = useState(40);
  const [lastRun, setLastRun] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    supabase
      .from("companies")
      .select("*")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        setCompanies(data ?? []);
        setLoading(false);
      });
  }, []);

  // Last hiring refresh run + realtime
  useEffect(() => {
    const loadRun = async () => {
      const { data } = await supabase
        .from("hiring_refresh_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastRun(data);
    };
    loadRun();

    const ch = supabase
      .channel("map-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "companies" },
        (payload) => {
          const row: any = payload.new;
          setCompanies((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hiring_refresh_runs" },
        () => loadRun()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const triggerRefresh = async () => {
    setRefreshing(true);
    toast.info("Refreshing hiring data… this can take a few minutes.");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-hiring`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
        }
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      toast.success(`Done. Scanned ${j.scanned}, hiring ${j.hiring}, jobs ${j.jobs_imported}.`);
    } catch (e: any) {
      toast.error(e.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (sector && c.sector !== sector) return false;
      if (stage && c.stage !== stage) return false;
      if (hiring && !c.hiring_status) return false;
      if (q && !`${c.name} ${c.description || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [companies, q, sector, stage, hiring]);

  // Handle hiring filter from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("hiring") === "true") setHiring(true);
  }, []);

  const mapboxToken = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || "";
  const [popup, setPopup] = useState<any | null>(null);
  const geo = filtered.filter((c) => c.latitude && c.longitude);

  const statusLabel =
    refreshing || lastRun?.status === "running"
      ? "Refreshing…"
      : lastRun?.status === "failed"
      ? "Last run failed"
      : lastRun
      ? "Live"
      : "No data yet";
  const updatedAgo = lastRun?.finished_at ? relativeTime(lastRun.finished_at) : null;

  return (
    <div className="bg-slate-950 min-h-screen">
      {/* ─── Hero: Split Layout (Title Left, Map Right) ──── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid lg:grid-cols-2 min-h-[70vh]">
            {/* Left: Content */}
            <div className="flex flex-col justify-center px-8 md:px-16 py-20 lg:py-0 relative z-10">
              <p
                className="text-[10px] uppercase tracking-[0.4em] text-primary mb-4"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                Utah Startup Ecosystem
              </p>
              <h1
                className="text-5xl font-bold md:text-7xl lg:text-8xl leading-[0.9] text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                The startup
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-amber-200">
                  map.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-white/50 text-lg leading-relaxed">
                Discover {companies.length} verified Utah startups across {SECTORS.length} sectors.
                Filter by industry, stage, or hiring status — and claim your listing.
              </p>

              {/* Stats Row */}
              <div className="mt-10 flex gap-10">
                <HeroStat n={companies.length} l="Companies" />
                <HeroStat n={companies.filter((c) => c.hiring_status).length} l="Hiring now" />
                <HeroStat n={SECTORS.length} l="Sectors" />
              </div>

              {/* Data Freshness Bar */}
              <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs backdrop-blur-md max-w-lg">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-2 w-2 rounded-full ${
                    statusLabel === "Live" ? "bg-emerald-400" :
                    statusLabel === "Refreshing…" ? "bg-amber-300 animate-pulse" :
                    statusLabel === "Last run failed" ? "bg-red-400" : "bg-white/20"
                  }`} />
                  <span className="font-semibold text-white/80">Hiring data: {statusLabel}</span>
                </div>
                {updatedAgo && <span className="text-white/30 hidden sm:inline">· updated {updatedAgo}</span>}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto h-8 rounded-xl"
                    onClick={triggerRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Scan
                  </Button>
                )}
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/map/add-company">
                  <Button size="lg" className="h-14 rounded-2xl px-8 text-base shadow-xl shadow-primary/20">
                    <Plus className="mr-2 h-4 w-4" /> Submit your company
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-2xl px-8 text-base border-white/20 text-white hover:bg-white/10"
                  onClick={() => {
                    document.getElementById("directory")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Browse directory <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Right: Live Map */}
            <div className="relative lg:h-auto h-[400px]">
              {/* Gradient overlay for blending */}
              <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none hidden lg:block" />
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-950 to-transparent z-10 pointer-events-none" />

              {mapboxToken ? (
                <MapGL
                  mapboxAccessToken={mapboxToken}
                  initialViewState={{ longitude: -111.8910, latitude: 40.7608, zoom: 6.5 }}
                  mapStyle="mapbox://styles/mapbox/dark-v11"
                  style={{ width: "100%", height: "100%" }}
                >
                  <NavigationControl position="top-right" />
                  {geo.map((c) => (
                    <Marker
                      key={c.id}
                      longitude={Number(c.longitude)}
                      latitude={Number(c.latitude)}
                      onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        setPopup(c);
                      }}
                    >
                      <LogoMarker company={c} />
                    </Marker>
                  ))}
                  {popup && (
                    <Popup
                      longitude={Number(popup.longitude)}
                      latitude={Number(popup.latitude)}
                      anchor="bottom"
                      onClose={() => setPopup(null)}
                      closeButton={false}
                      closeOnClick={false}
                      className="rounded-xl overflow-hidden"
                      offset={20}
                    >
                      <div className="p-2 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          {getLogoUrl(popup) && (
                            <img
                              src={getLogoUrl(popup)!}
                              alt=""
                              className="h-6 w-6 rounded-md object-contain bg-white p-0.5"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div>
                            <p className="font-bold text-sm">{popup.name}</p>
                            <p className="text-[10px] text-muted-foreground">{popup.sector} · {popup.stage}</p>
                          </div>
                        </div>
                        {popup.hiring_status && (
                          <Badge className="mt-1.5 bg-emerald-600 text-white text-[9px]">Hiring</Badge>
                        )}
                        <Link
                          to="/map/company/$id"
                          params={{ id: popup.id }}
                          className="mt-2 block text-[11px] font-bold text-primary hover:underline"
                        >
                          View Profile →
                        </Link>
                      </div>
                    </Popup>
                  )}
                </MapGL>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-slate-900">
                  <Card className="border-dashed bg-muted/10 border-white/10 p-12 text-center rounded-3xl max-w-md">
                    <MapPin className="mx-auto h-10 w-10 text-white/20" />
                    <h3 className="mt-4 text-xl font-bold text-white">Interactive map offline</h3>
                    <p className="mt-2 text-white/40 max-w-md mx-auto">
                      Mapbox token missing. Browse the {companies.length} startups in the directory below.
                    </p>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Directory Section ──── */}
      <section id="directory" className="bg-background">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-md py-4 -mx-2 px-2 rounded-b-2xl border-b border-border/50">
            <div className="flex-1 max-w-md">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find a startup..."
                  className="pl-9 h-11 rounded-2xl border-border/50 bg-muted/30 focus:bg-background transition-all"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip label="🔥 Hiring" active={hiring} onClick={() => setHiring(!hiring)} />
              <div className="h-8 w-px bg-border mx-1 hidden sm:block self-center" />
              {SECTORS.slice(0, 4).map((s) => (
                <Chip key={s} label={s} active={sector === s} onClick={() => setSector(sector === s ? null : s)} />
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Chip key={s} label={s} active={stage === s} onClick={() => setStage(stage === s ? null : s)} small />
            ))}
          </div>

          {loading ? (
            <div className="mt-20 flex flex-col items-center justify-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-20" />
              <p>Loading the ecosystem...</p>
            </div>
          ) : (
            <>
              <div className="mt-8 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Showing {filtered.length} companies
                </p>
                <Link to="/map/add-company">
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Plus className="mr-1 h-3 w-3" /> Add yours
                  </Button>
                </Link>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.slice(0, limit).map((c) => (
                  <Link key={c.id} to="/map/company/$id" params={{ id: c.id }}>
                    <Card className="h-full p-5 rounded-3xl border-border/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 group">
                      <div className="flex items-start gap-3">
                        <CompanyLogo company={c} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors truncate" style={{ fontFamily: "var(--font-display)" }}>
                              {c.name}
                            </h3>
                            {c.hiring_status && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 shrink-0 ml-2">
                                <Briefcase className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {c.description && (
                        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[9px] uppercase tracking-wider bg-primary/5 text-primary border-none">
                          {c.sector}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-border/50 text-muted-foreground">
                          {c.stage}
                        </Badge>
                        {c.full_address && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                            <MapPin className="h-3 w-3" /> {c.full_address.split(",")[0]}
                          </div>
                        )}
                      </div>
                      {c.updated_at && (
                        <div className="mt-4 pt-3 border-t border-border/30 text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                          Updated {relativeTime(c.updated_at)}
                        </div>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
              
              {limit < filtered.length && (
                <div className="mt-12 text-center">
                  <Button variant="outline" size="lg" className="rounded-2xl px-12" onClick={() => setLimit(limit + 40)}>
                    Discover more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Logo Marker on Map ──── */
function LogoMarker({ company }: { company: any }) {
  const logoUrl = getLogoUrl(company);
  const [imgOk, setImgOk] = useState(true);

  if (logoUrl && imgOk) {
    return (
      <div className="group cursor-pointer relative">
        <div className="h-9 w-9 rounded-full border-2 border-white/80 bg-white shadow-lg shadow-black/40 overflow-hidden transition-transform hover:scale-125 hover:z-50">
          <img
            src={logoUrl}
            alt={company.name}
            className="h-full w-full object-contain p-1"
            onError={() => setImgOk(false)}
          />
        </div>
        {company.hiring_status && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
        )}
      </div>
    );
  }

  // Fallback: colored circle with initials
  const hue = hashHue(company.id || company.name);
  const initials = (company.name || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="group cursor-pointer relative">
      <div
        className="h-9 w-9 rounded-full border-2 border-white/60 shadow-lg shadow-black/40 flex items-center justify-center text-[10px] font-bold text-white transition-transform hover:scale-125 hover:z-50"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 70% 35%))` }}
      >
        {initials}
      </div>
      {company.hiring_status && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
      )}
    </div>
  );
}

/* ─── Company Logo in Directory Cards ──── */
function CompanyLogo({ company, size = "md" }: { company: any; size?: "sm" | "md" }) {
  const logoUrl = getLogoUrl(company);
  const [imgOk, setImgOk] = useState(true);
  const dim = size === "md" ? "h-10 w-10" : "h-7 w-7";

  if (logoUrl && imgOk) {
    return (
      <div className={`${dim} rounded-xl bg-muted/50 border border-border/50 overflow-hidden shrink-0 p-1`}>
        <img
          src={logoUrl}
          alt={company.name}
          className="h-full w-full object-contain"
          onError={() => setImgOk(false)}
        />
      </div>
    );
  }

  const hue = hashHue(company.id || company.name);
  const initials = (company.name || "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 50%), hsl(${(hue + 40) % 360} 70% 40%))` }}
    >
      {initials}
    </div>
  );
}

/* ─── Utilities ──── */
function hashHue(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function HeroStat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">{l}</div>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Chip({
  label,
  active,
  onClick,
  small,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border transition-all duration-200 ${
        small ? "px-3 py-1 text-[10px] uppercase tracking-widest" : "px-5 py-2 text-sm font-medium"
      } ${
        active 
          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}