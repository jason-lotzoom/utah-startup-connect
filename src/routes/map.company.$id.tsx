import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ExternalLink,
  MapPin,
  Briefcase,
  ArrowLeft,
  Shield,
  Linkedin,
  Calendar,
  Users,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/map/company/$id")({
  component: CompanyPage,
});

function CompanyPage() {
  const { id } = useParams({ from: "/map/company/$id" });
  const { user } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("companies").select("*").eq("id", id).maybeSingle(),
      supabase.from("job_postings").select("*").eq("company_id", id).eq("is_active", true),
    ]).then(([c, j]) => {
      setCompany(c.data);
      setJobs(j.data ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading)
    return (
      <div className="mx-auto max-w-4xl p-12 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading…
        </div>
      </div>
    );
  if (!company) return <div className="mx-auto max-w-4xl p-12">Company not found.</div>;

  const photos = company.photos?.filter((p: string) => p?.trim()) ?? [];

  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      <Link
        to="/map"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to map
      </Link>

      {/* ─── Hero Header ──── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={`${company.name} logo`}
              className="h-16 w-16 rounded-xl border border-border object-contain bg-white p-1"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${hashHue(company.id)} 65% 55%), hsl(${(hashHue(company.id) + 40) % 360} 70% 40%))`,
                fontFamily: "var(--font-display)",
              }}
            >
              {initials(company.name)}
            </div>
          )}
          <div>
            <h1
              className="text-3xl font-bold md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {company.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {company.sector && <Badge variant="secondary">{company.sector}</Badge>}
              {company.stage && <Badge variant="outline">{company.stage}</Badge>}
              {company.is_verified && (
                <Badge variant="default">
                  <Shield className="mr-1 h-3 w-3" /> Verified
                </Badge>
              )}
              {company.hiring_status && (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                  <Briefcase className="mr-1 h-3 w-3" /> Hiring
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Globe className="mr-2 h-4 w-4" /> Website
              </Button>
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
              </Button>
            </a>
          )}
          {!company.is_claimed && user && (
            <Link to="/map/claim/$id" params={{ id }}>
              <Button>Claim this listing</Button>
            </Link>
          )}
        </div>
      </div>

      {/* ─── Description ──── */}
      {company.description && (
        <p className="mt-6 text-lg leading-relaxed text-foreground/80">{company.description}</p>
      )}

      {/* ─── Info Grid ──── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {company.full_address && (
          <InfoCard
            icon={<MapPin className="h-4 w-4 text-primary" />}
            label="Location"
            value={company.full_address}
          />
        )}
        {company.year_founded && (
          <InfoCard
            icon={<Calendar className="h-4 w-4 text-primary" />}
            label="Founded"
            value={String(company.year_founded)}
          />
        )}
        {company.employee_count && (
          <InfoCard
            icon={<Users className="h-4 w-4 text-primary" />}
            label="Team size"
            value={company.employee_count}
          />
        )}
        {company.sector && (
          <InfoCard
            icon={<Briefcase className="h-4 w-4 text-primary" />}
            label="Sector"
            value={company.sector}
          />
        )}
      </div>

      {/* ─── Photo Gallery ──── */}
      {photos.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Gallery
          </h2>
          <PhotoGallery photos={photos} companyName={company.name} />
        </section>
      )}

      {/* ─── Open Roles ──── */}
      <section className="mt-12">
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Open roles
        </h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-muted-foreground">No active job postings.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {jobs.map((j) => (
              <Card key={j.id} className="p-4 transition hover:shadow-[var(--shadow-warm)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{j.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {[j.type, j.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        Apply <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

/* ─── Photo Gallery Component ──── */

function PhotoGallery({ photos, companyName }: { photos: string[]; companyName: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <>
      <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted transition hover:shadow-[var(--shadow-warm)]"
          >
            <img
              src={url}
              alt={`${companyName} photo ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((lightbox - 1 + photos.length) % photos.length);
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((lightbox + 1) % photos.length);
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <img
            src={photos[lightbox]}
            alt={`${companyName} photo ${lightbox + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-6 text-sm text-white/60">
            {lightbox + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Helper Components ──── */

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="p-4 transition hover:shadow-sm">
      <p
        className="text-xs uppercase tracking-widest text-muted-foreground"
        style={{ fontFamily: "var(--font-accent)" }}
      >
        {label}
      </p>
      <p className="mt-1.5 flex items-center gap-2 font-medium">
        {icon}
        {value}
      </p>
    </Card>
  );
}

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}