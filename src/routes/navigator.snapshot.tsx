import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/navigator/snapshot")({
  validateSearch: (s: Record<string, unknown>) => ({ q: (s.q as string) || "" }),
  head: () => ({
    meta: [
      { title: "Founder Snapshot — 5iO" },
      { name: "description", content: "Your curated Utah startup playbook." },
      { property: "og:title", content: "Founder Snapshot — 5iO" },
      { property: "og:description", content: "Your curated Utah startup playbook." },
    ],
  }),
  component: SnapshotPage,
});

function SnapshotPage() {
  const { q } = Route.useSearch();
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (!q) return;
    supabase.from("resources").select("*").eq("is_active", true).then(({ data }) => {
      const ranked = rank(data ?? [], q).slice(0, 6);
      setItems(ranked);
    });
  }, [q]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const mailto = `mailto:?subject=${encodeURIComponent("My Utah Founder Snapshot")}&body=${encodeURIComponent(
    `Curated resources for: ${q}\n\n${(items ?? []).map((r) => `• ${r.title}${r.link ? ` — ${r.link}` : ""}`).join("\n")}\n\nSee the full list: ${shareUrl}`
  )}`;

  return (
    <article
      className="mx-auto max-w-3xl px-6 py-12"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <Link to="/navigator" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Navigator
      </Link>
      <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-muted-foreground" style={{ fontFamily: "var(--font-accent)" }}>
        Founder Snapshot
      </p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
        Your Utah playbook.
      </h1>
      {q && (
        <p className="mt-3 text-lg text-muted-foreground">
          Curated for: <span className="text-foreground font-medium">{q}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a href={mailto}>
          <Button variant="outline" size="sm"><Mail className="mr-2 h-4 w-4" /> Email this list</Button>
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "Founder Snapshot", url: shareUrl });
              else { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); }
            } catch {}
          }}
        >
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
      </div>

      <div className="mt-10 grid gap-4">
        {(items ?? Array.from({ length: 4 })).map((r: any, i: number) =>
          r ? (
            <Card key={r.id} className="p-5 rounded-3xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>
                    {r.title}
                  </h3>
                  {r.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{r.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(r.communities ?? []).slice(0, 3).map((c: string) => (
                      <Badge key={c} variant="secondary" className="text-[9px] uppercase tracking-wider">{c}</Badge>
                    ))}
                    {(r.stages ?? []).slice(0, 2).map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[9px] uppercase tracking-wider">{s}</Badge>
                    ))}
                  </div>
                </div>
                {r.link && (
                  <a href={r.link} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                )}
              </div>
            </Card>
          ) : (
            <Card key={i} className="h-24 animate-pulse rounded-3xl bg-muted/30" />
          )
        )}
      </div>
    </article>
  );
}

function rank(rows: any[], q: string) {
  const lower = q.toLowerCase();
  return rows
    .map((r) => {
      let score = 0;
      const text = `${r.title} ${r.description ?? ""}`.toLowerCase();
      if (text.includes(lower)) score += 5;
      for (const arr of [r.communities, r.stages, r.industries, r.locations, r.topics]) {
        for (const v of arr ?? []) if (lower.includes(String(v).toLowerCase())) score += 3;
      }
      return { ...r, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}