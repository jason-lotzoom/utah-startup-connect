import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, MapPin, Plus, Search } from "lucide-react";
import Map, { Marker, Popup, NavigationControl, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export const Route = createFileRoute("/map/")({
  component: MapPage,
});

const SECTORS = ["Tech", "Life Sciences", "Aerospace", "Energy", "Outdoor", "Manufacturing", "Other"];
const STAGES = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"];

function MapPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("status", "active")
        .order("name");
      setCompanies(data ?? []);
      setLoading(false);
      setUpdatedAt(new Date());
    };
    load();
    const channel = supabase
      .channel("companies-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (sector && c.sector !== sector) return false;
      if (stage && c.stage !== stage) return false;
      if (hiring && !c.hiring_status) return false;
      if (q && !`${c.name} ${c.description || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [companies, q, sector, stage, hiring]);

  const [popup, setPopup] = useState<any | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const geo = filtered.filter((c) => c.latitude && c.longitude);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: "var(--gradient-canyon)" }}>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70" style={{ fontFamily: "var(--font-accent)" }}>
            Utah Startup Map
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold md:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
            The state's startup ecosystem, mapped.
          </h1>
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <Stat n={companies.length} l="Companies" />
            <Stat n={companies.filter((c) => c.hiring_status).length} l="Hiring now" />
            <Stat n={SECTORS.length} l="Sectors" />
          </div>
          {updatedAt && (
            <p className="mt-3 text-xs text-white/60" style={{ fontFamily: "var(--font-accent)" }}>
              Live data · updated {updatedAt.toLocaleTimeString()}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <Link to="/map/add-company">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Plus className="mr-2 h-4 w-4" /> Submit a company
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Map / Fallback */}
      <section className="border-b border-border">
        <div className="relative h-[560px] w-full overflow-hidden bg-[#0b0d12]">
          <Map
            initialViewState={{ longitude: -111.891, latitude: 39.8, zoom: 5.6, pitch: 45, bearing: -10 }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <NavigationControl position="top-right" />
            <FlyOnSelect target={popup} />
            {geo.map((c) => {
              const isHover = hovered === c.id;
              const color = c.hiring_status ? "var(--primary)" : "var(--accent)";
              return (
                <Marker
                  key={c.id}
                  longitude={Number(c.longitude)}
                  latitude={Number(c.latitude)}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setPopup(c);
                  }}
                >
                  <div
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="relative cursor-pointer"
                    style={{ transform: isHover ? "scale(1.6)" : "scale(1)", transition: "transform 280ms cubic-bezier(.2,.8,.2,1)" }}
                  >
                    {c.hiring_status && (
                      <span
                        className="absolute inset-0 -m-2 rounded-full opacity-70"
                        style={{ background: color, animation: "pulse-ring 2.2s ease-out infinite" }}
                      />
                    )}
                    <span
                      className="relative block h-3 w-3 rounded-full border-2 border-white"
                      style={{ background: color, boxShadow: `0 0 14px ${c.hiring_status ? "rgba(217,93,57,.9)" : "rgba(232,180,120,.6)"}` }}
                    />
                  </div>
                </Marker>
              );
            })}
            {popup && popup.latitude && popup.longitude && (
              <Popup
                longitude={Number(popup.longitude)}
                latitude={Number(popup.latitude)}
                anchor="bottom"
                offset={18}
                onClose={() => setPopup(null)}
                closeButton
                closeOnClick={false}
                className="cinematic-popup"
              >
                <div className="text-foreground min-w-[180px]">
                  <p className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{popup.name}</p>
                  {popup.sector && <p className="text-xs text-muted-foreground">{popup.sector}</p>}
                  {popup.hiring_status && (
                    <Badge className="mt-2 text-[10px]"><Briefcase className="mr-1 h-3 w-3" />Hiring</Badge>
                  )}
                  <Link
                    to="/map/company/$id"
                    params={{ id: popup.id }}
                    className="mt-2 block text-xs text-primary hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </Popup>
            )}
          </Map>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/60 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/60 to-transparent" />
        </div>
      </section>

      {/* Filters + List */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip label="Hiring" active={hiring} onClick={() => setHiring(!hiring)} />
            {SECTORS.map((s) => (
              <Chip key={s} label={s} active={sector === s} onClick={() => setSector(sector === s ? null : s)} />
            ))}
          </div>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Chip key={s} label={s} active={stage === s} onClick={() => setStage(stage === s ? null : s)} small />
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{filtered.length} companies</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, limit).map((c) => (
                <Link key={c.id} to="/map/company/$id" params={{ id: c.id }}>
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm)]">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
                        {c.name}
                      </h3>
                      {c.hiring_status && (
                        <Badge variant="default" className="text-[10px]">
                          <Briefcase className="mr-1 h-3 w-3" /> Hiring
                        </Badge>
                      )}
                    </div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                      {c.sector && <Badge variant="secondary">{c.sector}</Badge>}
                      {c.stage && <Badge variant="outline">{c.stage}</Badge>}
                      {c.full_address && (
                        <Badge variant="outline" className="font-normal">
                          <MapPin className="mr-1 h-2.5 w-2.5" /> {c.full_address.split(",")[0]}
                        </Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            {limit < filtered.length && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => setLimit(limit + 40)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {n}
      </div>
      <div className="text-xs uppercase tracking-widest text-white/70">{l}</div>
    </div>
  );
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
      className={`rounded-full border px-3 ${small ? "py-1 text-xs" : "py-1.5 text-sm"} transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}

function FlyOnSelect({ target }: { target: any | null }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!target || !map || !target.latitude || !target.longitude) return;
    map.flyTo({
      center: [Number(target.longitude), Number(target.latitude)],
      zoom: 11,
      pitch: 60,
      bearing: -20,
      speed: 1.2,
      curve: 1.6,
      essential: true,
    });
  }, [target, map]);
  return null;
}