import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

type Company = {
  id: string;
  name: string;
  sector: string | null;
  hiring_status: boolean | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
};

const SECTOR_COLOR: Record<string, string> = {
  Tech: "var(--sector-tech)",
  "Life Sciences": "var(--sector-life)",
  Aerospace: "var(--sector-aero)",
  Energy: "var(--sector-energy)",
  Outdoor: "var(--sector-outdoor)",
  Manufacturing: "var(--sector-mfg)",
  Other: "var(--sector-other)",
};

// Cinematic flyTo cycle around Utah hot spots
const HOTSPOTS = [
  { name: "Salt Lake City", longitude: -111.891, latitude: 40.7608, zoom: 11.2, bearing: 0, pitch: 45 },
  { name: "Lehi · Silicon Slopes", longitude: -111.8505, latitude: 40.3916, zoom: 11.6, bearing: 30, pitch: 50 },
  { name: "Provo · BYU", longitude: -111.6585, latitude: 40.2338, zoom: 11.4, bearing: -20, pitch: 48 },
  { name: "Park City", longitude: -111.4980, latitude: 40.6461, zoom: 11.0, bearing: 60, pitch: 52 },
  { name: "Ogden", longitude: -111.9738, latitude: 41.2230, zoom: 11.0, bearing: -45, pitch: 46 },
  { name: "Cedar City", longitude: -113.0619, latitude: 37.6775, zoom: 10.5, bearing: 15, pitch: 42 },
];

export interface HeroLiveMapHandle {
  flyToQuery: (q: string) => boolean;
}

export default function HeroLiveMap({
  onReady,
  flyToRef,
}: {
  onReady?: (totalCount: number) => void;
  flyToRef?: React.MutableRefObject<HeroLiveMapHandle | null>;
}) {
  const [token, setToken] = useState<string>("");
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [zoom, setZoom] = useState(7);
  const [hotspot, setHotspot] = useState(0);
  const mapRef = useRef<MapRef | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);

  // Load Mapbox token via edge function
  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke("get-mapbox-token")
      .then(({ data }) => {
        if (!active) return;
        setToken((data as any)?.token ?? "");
      })
      .catch(() => active && setToken(""))
      .finally(() => active && setTokenLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  // Load companies
  useEffect(() => {
    supabase
      .from("companies")
      .select("id, name, sector, hiring_status, latitude, longitude, logo_url")
      .eq("status", "active")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("logo_url", { ascending: true, nullsFirst: false })
      .order("hiring_status", { ascending: false })
      .limit(180)
      .then(({ data }) => {
        const rows = (data ?? []) as Company[];
        setCompanies(rows);
        onReady?.(rows.length);
      });
  }, [onReady]);

  // Cinematic flyTo cycle
  const startCycle = () => {
    if (cycleTimer.current) clearTimeout(cycleTimer.current);
    const map = mapRef.current?.getMap();
    if (!map || pausedRef.current) return;
    const next = HOTSPOTS[indexRef.current % HOTSPOTS.length];
    indexRef.current += 1;
    setHotspot(indexRef.current % HOTSPOTS.length);
    map.flyTo({
      center: [next.longitude, next.latitude],
      zoom: next.zoom,
      bearing: next.bearing,
      pitch: next.pitch,
      duration: 9000,
      essential: true,
      curve: 1.4,
    });
    cycleTimer.current = setTimeout(startCycle, 12000);
  };

  const pauseCycle = () => {
    pausedRef.current = true;
    if (cycleTimer.current) clearTimeout(cycleTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      pausedRef.current = false;
      startCycle();
    }, 8000);
  };

  // Imperative flyTo for search
  useEffect(() => {
    if (!flyToRef) return;
    flyToRef.current = {
      flyToQuery: (q: string) => {
        const map = mapRef.current?.getMap();
        if (!map || !q.trim()) return false;
        const lower = q.toLowerCase();
        // Try city hotspots first
        const cityHit = HOTSPOTS.find((h) => lower.includes(h.name.split(" ")[0].toLowerCase()));
        if (cityHit) {
          pausedRef.current = true;
          if (cycleTimer.current) clearTimeout(cycleTimer.current);
          map.flyTo({
            center: [cityHit.longitude, cityHit.latitude],
            zoom: 12,
            pitch: 55,
            duration: 2500,
            essential: true,
          });
          return true;
        }
        // Match company name
        const c = companies.find((x) => x.name.toLowerCase().includes(lower));
        if (c && c.latitude && c.longitude) {
          pausedRef.current = true;
          if (cycleTimer.current) clearTimeout(cycleTimer.current);
          map.flyTo({
            center: [Number(c.longitude), Number(c.latitude)],
            zoom: 13,
            pitch: 55,
            duration: 2500,
            essential: true,
          });
          return true;
        }
        return false;
      },
    };
  }, [companies, flyToRef]);

  const handleLoad = () => {
    // start cycle after a brief beat
    setTimeout(startCycle, 1500);
  };

  useEffect(() => {
    return () => {
      if (cycleTimer.current) clearTimeout(cycleTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // labels only when zoomed in
  const showLabels = zoom >= 9.5;
  const visibleCompanies = useMemo(() => companies.slice(0, 160), [companies]);

  if (!tokenLoaded) return null;
  if (!token) return null; // parent renders fallback

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ longitude: -111.7, latitude: 40.0, zoom: 6.6, pitch: 40, bearing: 10 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        interactive
        onLoad={handleLoad}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onMouseDown={pauseCycle}
        onTouchStart={pauseCycle}
        onWheel={pauseCycle}
        onDragStart={pauseCycle}
      >
        {visibleCompanies.map((c) => {
          const color = SECTOR_COLOR[c.sector || "Other"] ?? SECTOR_COLOR.Other;
          return (
            <Marker
              key={c.id}
              longitude={Number(c.longitude)}
              latitude={Number(c.latitude)}
              anchor="center"
            >
              <Link
                to="/map/company/$id"
                params={{ id: c.id }}
                className="relative block"
                onClick={(e) => e.stopPropagation()}
              >
                <LogoPin name={c.name} logoUrl={c.logo_url} color={color} />
                {showLabels && <div className="hero-pin-label">{c.name}</div>}
              </Link>
            </Marker>
          );
        })}
      </Map>

      {/* Hotspot label, bottom-left */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Now viewing · {HOTSPOTS[hotspot]?.name}
      </div>
    </div>
  );
}

export const SECTOR_LEGEND: { label: string; color: string }[] = [
  { label: "Tech", color: "var(--sector-tech)" },
  { label: "Life Sci", color: "var(--sector-life)" },
  { label: "Aerospace", color: "var(--sector-aero)" },
  { label: "Energy", color: "var(--sector-energy)" },
  { label: "Outdoor", color: "var(--sector-outdoor)" },
  { label: "Mfg", color: "var(--sector-mfg)" },
];

function LogoPin({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl: string | null;
  color: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const showLogo = !!logoUrl && !broken;
  return (
    <div className="hero-logo-pin" style={{ ["--pin-color" as any]: color }}>
      {showLogo ? (
        <img
          src={logoUrl!}
          alt={name}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="hero-monogram">{initial}</div>
      )}
    </div>
  );
}