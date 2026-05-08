import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/navigator/resource/$id")({
  head: () => ({
    meta: [
      { title: "Program details — 5iO Navigator" },
      { name: "description", content: "Details for a Utah founder resource." },
    ],
  }),
  component: ResourceDetail,
});

function hashHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function ResourceDetail() {
  const { id } = Route.useParams();
  const [r, setR] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("resources")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast.error(error.message);
        setR(data);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/navigator"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Navigator
        </Link>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !r ? (
          <p className="mt-16 text-center text-muted-foreground">Program not found.</p>
        ) : (
          <article className="mt-6">
            <div
              className="aspect-[21/9] w-full overflow-hidden rounded-2xl"
              style={
                r.image_url
                  ? undefined
                  : {
                      background: `linear-gradient(135deg, hsl(${hashHue(r.id)} 65% 55%), hsl(${(hashHue(r.id) + 40) % 360} 70% 40%))`,
                    }
              }
            >
              {r.image_url ? (
                <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" />
              ) : null}
            </div>

            <h1 className="mt-8 text-4xl font-bold md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
              {r.title}
            </h1>

            {r.description && (
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                {r.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {r.link && (
                <Button asChild>
                  <a href={r.link} target="_blank" rel="noreferrer">
                    Visit official site <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              {r.email && (
                <Button variant="outline" asChild>
                  <a href={`mailto:${r.email}`}>
                    <Mail className="mr-2 h-4 w-4" /> {r.email}
                  </a>
                </Button>
              )}
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <TagSection title="Topics" items={r.topics} />
              <TagSection title="Industries" items={r.industries} />
              <TagSection title="Communities" items={r.communities} />
              <TagSection title="Locations" items={r.locations} />
            </div>
          </article>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function TagSection({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p
        className="text-xs uppercase tracking-widest text-primary"
        style={{ fontFamily: "var(--font-accent)" }}
      >
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <Badge key={t} variant="secondary" className="text-xs">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}