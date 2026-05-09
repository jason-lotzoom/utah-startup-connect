import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, MapPin, Plus, Search, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const SECTOR_VAR: Record<string, string> = {
  Tech: "var(--sector-tech)",
  "Life Sciences": "var(--sector-life)",
  Aerospace: "var(--sector-aero)",
  Energy: "var(--sector-energy)",
  Outdoor: "var(--sector-outdoor)",
  Manufacturing: "var(--sector-mfg)",
  Other: "var(--sector-other)",
};
const COUNTIES = ["Salt Lake", "Utah", "Davis", "Weber", "Washington", "Cache", "Summit"];
const SIZES = ["1-10", "11-50", "51-200", "200+"];
function inferCounty(addr?: string | null): string {
  if (!addr) return "Other";
  const a = addr.toLowerCase();
  if (a.includes("salt lake") || a.includes(" slc")) return "Salt Lake";
  if (a.includes("provo") || a.includes("orem") || a.includes("lehi") || a.includes("utah county")) return "Utah";
  if (a.includes("ogden") || a.includes("weber")) return "Weber";
  if (a.includes("layton") || a.includes("bountiful") || a.includes("davis")) return "Davis";
  if (a.includes("st. george") || a.includes("st george") || a.includes("washington")) return "Washington";
  if (a.includes("logan") || a.includes("cache")) return "Cache";
  if (a.includes("park city") || a.includes("summit")) return "Summit";
  return "Other";
}
function inferSize(employees?: string | null): string {
  if (!employees) return "1-10";
  if (/200\+|201|500|1000/.test(employees)) return "200+";
  if (/51|100|150|200/.test(employees)) return "51-200";
  if (/11|20|30|50/.test(employees)) return "11-50";
  return "1-10";
}

function getEffectiveLogo(company: any): string | null {
  if (company.logo_url) return company.logo_url;
  if (!company.website) return null;
  try {
    const domain = new URL(company.website).hostname.replace(/^www\./, '');
    return `https://logo.clearbit.com/${domain}`;
  } catch {
    return null;
  }
}

function companyInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function hashHue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 360;
}

function CompanyMarker({ company, onClick }: { company: any; onClick: () => void }) {
  const logoSrc = getEffectiveLogo(company);
  const [imgFailed, setImgFailed] = useState(false);
  const hue = hashHue(company.id);
  const isHiring = company.hiring_status;

  return (
    <button
      onClick={onClick}
      className="group relative cursor-pointer"
      style={{ background: 'none', border: 'none', padding: 0 }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white shadow-md transition-transform hover:scale-110 group-hover:shadow-lg"
        style={{
          borderColor: isHiring ? 'oklch(0.55 0.18 148)' : 'oklch(0.70 0.15 75)',
          boxShadow: isHiring
            ? '0 2px 8px oklch(0.55 0.18 148 / 0.4)'
            : '0 2px 6px rgb(0 0 0 / 0.25)',
        }}
      >
        {logoSrc && !imgFailed ? (
          <img
            src={logoSrc}
            alt={company.name}
            className="h-6 w-6 rounded-full object-contain"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <span
            className="text-[10px] font-bold text-white leading-none"
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <span
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 40) % 360} 70% 40%))`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {companyInitials(company.name)}
            </span>
          </span>
        )}
      </div>
      {isHiring && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[oklch(0.55_0.18_148)]" />
      )}
    </button>
  );
}

export const Route = createFileRoute("/map/")({
  component: MapPage,
});

const SECTORS = ["B2B Software", "Consumer", "FinTech", "Bio/Medical Tech", "Energy", "Marketplaces", "Security"];
const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"];

function MapPage() {
  const { isAdmin } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [county, setCounty] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
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
      if (sector && (c.sector || "").trim().toLowerCase() !== sector.toLowerCase()) return false;
      if (stage && c.stage !== stage) return false;
      if (hiring && !c.hiring_status) return false;
      if (county && inferCounty(c.full_address) !== county) return false;
      if (size && inferSize(c.employee_count) !== size) return false;
      if (q && !`${c.name} ${c.description || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [companies, q, sector, stage, hiring, county, size]);

  const ecosystem = useMemo(() => {
    const total = filtered.length;
    const hiringCount = filtered.filter((c) => c.hiring_status).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = companies.filter(
      (c) => c.created_at && new Date(c.created_at).getTime() > weekAgo
    ).length;
    const sectorCounts: Record<string, number> = {};
    filtered.forEach((c) => {
      if (c.sector) sectorCounts[c.sector] = (sectorCounts[c.sector] || 0) + 1;
    });
    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);
    return { total, hiringCount, newThisWeek, topSectors };
  }, [filtered, companies]);

  // Handle hiring filter from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("hiring") === "true") setHiring(true);
  }, []);

  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(true);
  useEffect(() => {
    const viteToken = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "";
    if (viteToken) {
      setMapboxToken(viteToken);
      setTokenLoading(false);
      return;
    }
    supabase.functions
      .invoke("get-mapbox-token")
      .then(({ data }) => setMapboxToken((data as any)?.token ?? ""))
      .catch(() => setMapboxToken(""))
      .finally(() => setTokenLoading(false));
  }, []);
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
    <div className="bg-background min-h-screen">
      <section className="relative overflow-hidden text-white" style={{ background: "var(--gradient-canyon)" }}>
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-20">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/60 mb-2" style={{ fontFamily: "var(--font-accent)" }}>
            Utah Startup Ecosystem
          </p>
          <h1 className="text-4xl font-bold md:text-7xl leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            The startup map.
          </h1>
          <p className="mt-4 max-w-xl text-white/80 text-lg">
            Discover {companies.length || 220}+ verified Utah startups across {SECTORS.length} sectors.
          </p>
          
          <div className="mt-8 flex flex-wrap gap-8 text-sm">
            <Stat n={companies.length} l="Companies" />
            <Stat n={companies.filter((c) => c.hiring_status).length} l="Hiring now" />
            <Stat n={SECTORS.length} l="Sectors" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${
                statusLabel === "Live" ? "bg-emerald-400" :
                statusLabel === "Refreshing…" ? "bg-amber-300 animate-pulse" :
                statusLabel === "Last run failed" ? "bg-red-400" : "bg-white/20"
              }`} />
              <span className="font-semibold">Hiring data: {statusLabel}</span>
            </div>
            {updatedAgo && <span className="text-white/50 hidden sm:inline">· updated {updatedAgo}</span>}
            <span className="text-white/50 hidden md:inline">· scanned via Firecrawl</span>
            {isAdmin && (
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto h-8 rounded-xl"
                onClick={triggerRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Trigger scan
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/20">
        {tokenLoading ? (
          <div className="h-[300px] md:h-[500px] w-full flex items-center justify-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin opacity-40" />
          </div>
        ) : mapboxToken ? (
          <div className="h-[300px] md:h-[500px] w-full">
            <Map
              mapboxAccessToken={mapboxToken}
              initialViewState={{ longitude: -111.8910, latitude: 40.7608, zoom: 6.5 }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              style={{ width: "100%", height: "100%" }}
            >
              {geo.map((c) => (
                <Marker
                  key={c.id}
                  longitude={Number(c.longitude)}
                  latitude={Number(c.latitude)}
                  anchor="center"
                >
                  <CompanyMarker
                    company={c}
                    onClick={() => setPopup(c)}
                  />
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
                >
                  <div className="p-1 min-w-[160px] max-w-[220px]">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const src = getEffectiveLogo(popup);
                        return src ? (
                          <img
                            src={src}
                            alt={popup.name}
                            className="h-8 w-8 rounded-lg object-contain bg-gray-50 border border-gray-100"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : null;
                      })()}
                      <div>
                        <p className="font-bold text-sm leading-tight">{popup.name}</p>
                        <p className="text-[10px] text-muted-foreground">{popup.sector}</p>
                      </div>
                    </div>
                    <Link
                      to="/map/company/$id"
                      params={{ id: popup.id }}
                      className="mt-1.5 block text-[10px] font-bold text-primary"
                    >
                      View Profile →
                    </Link>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-12">
            <Card className="border-dashed bg-muted/40 p-12 text-center rounded-3xl">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-4 text-xl font-bold">Interactive map is offline</h3>
              <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
                The Mapbox access token isn't configured. You can still browse
                all {companies.length} startups in the directory below.
              </p>
              {isAdmin && (
                <div className="mt-6 mx-auto max-w-lg rounded-2xl border border-border/60 bg-background/60 p-4 text-left text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Admin: enable the map</p>
                  <p>Add a public Mapbox token (starts with <code className="rounded bg-muted px-1 py-0.5 text-foreground">pk.</code>) as the <code className="rounded bg-muted px-1 py-0.5 text-foreground">MAPBOX</code> secret in Lovable Cloud. The map will come online automatically.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between sticky top-[72px] z-20 bg-background/80 backdrop-blur-md py-4 -mx-2 px-2 rounded-b-2xl border-b border-border/50">
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
            {SECTORS.map((s) => (
              <Chip key={s} label={s} active={sector === s} onClick={() => setSector(sector === s ? null : s)} />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mr-1">Stage</span>
            {STAGES.map((s) => (
              <Chip key={s} label={s} active={stage === s} onClick={() => setStage(stage === s ? null : s)} small />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mr-1">County</span>
            {COUNTIES.map((s) => (
              <Chip key={s} label={s} active={county === s} onClick={() => setCounty(county === s ? null : s)} small />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mr-1">Size</span>
            {SIZES.map((s) => (
              <Chip key={s} label={s} active={size === s} onClick={() => setSize(size === s ? null : s)} small />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-border/50 bg-muted/20 p-5 sm:grid-cols-4">
          <EcoStat label="Visible" value={ecosystem.total} />
          <EcoStat
            label="Hiring now"
            value={`${ecosystem.hiringCount}${ecosystem.total ? ` · ${Math.round((ecosystem.hiringCount / ecosystem.total) * 100)}%` : ""}`}
          />
          <EcoStat label="New this week" value={ecosystem.newThisWeek} />
          <EcoStat
            label="Top sectors"
            value={ecosystem.topSectors.length ? ecosystem.topSectors.join(" · ") : "—"}
          />
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
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                        {c.name}
                      </h3>
                      {c.hiring_status && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                          <Briefcase className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
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
      </section>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">{l}</div>
    </div>
  );
}

function EcoStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </div>
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

