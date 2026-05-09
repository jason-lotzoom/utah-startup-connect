import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, X, Building2, Sparkles, Loader2, ExternalLink, AlertTriangle, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/map/add-company")({
  head: () => ({ meta: [{ title: "Submit a company — 5iO" }] }),
  component: AddCompany,
});

function AddCompany() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    website: "",
    description: "",
    sector: "Tech",
    stage: "Seed",
    full_address: "",
    year_founded: "",
    employee_count: "1-10",
    hiring_status: false,
    linkedin_url: "",
    photo_urls: [""] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  type FieldMeta = { confidence: number; evidence: string | null; source_url: string | null };
  const [meta, setMeta] = useState<Partial<Record<keyof typeof form, FieldMeta>>>({});
  const [citations, setCitations] = useState<{
    primary_url?: string;
    page_title?: string | null;
    search_results?: Array<{ url: string; title?: string; description?: string }>;
    scraped_excerpt?: string | null;
  } | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const runAutofill = async () => {
    if (!aiInput.trim()) return toast.error("Enter a company name or website");
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("autofill-company", {
        body: { input: aiInput.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Autofill failed");
      const f = data.fields as Record<string, { value: unknown; confidence: number; evidence: string | null; source_url: string | null } | null>;
      const get = <T,>(k: string, fallback: T): T => (f?.[k]?.value ?? fallback) as T;

      setForm((prev) => ({
        ...prev,
        name: get("name", prev.name),
        website: get("website", prev.website),
        description: get("description", prev.description),
        sector: get("sector", prev.sector),
        stage: get("stage", prev.stage),
        full_address: get("full_address", prev.full_address),
        year_founded: f?.year_founded?.value ? String(f.year_founded.value) : prev.year_founded,
        employee_count: get("employee_count", prev.employee_count),
        linkedin_url: get("linkedin_url", prev.linkedin_url),
        hiring_status: get<boolean>("hiring_status", prev.hiring_status),
      }));

      const newMeta: typeof meta = {};
      for (const k of Object.keys(f || {}) as Array<keyof typeof form>) {
        const v = f?.[k as string];
        if (v) newMeta[k] = { confidence: v.confidence ?? 0.5, evidence: v.evidence ?? null, source_url: v.source_url ?? null };
      }
      setMeta(newMeta);
      setCitations(data.citations ?? null);

      const lowConf = Object.entries(newMeta).filter(([, m]) => (m as FieldMeta).confidence < 0.6).length;
      toast.success(
        lowConf > 0
          ? `Prefilled — ${lowConf} field${lowConf > 1 ? "s" : ""} need review`
          : "Prefilled — please review before submitting"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Autofill failed");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Filter out empty photo URLs
    const photos = form.photo_urls.filter((u) => u.trim().length > 0);

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: form.name,
        website: form.website || null,
        description: form.description || null,
        sector: form.sector,
        stage: form.stage,
        full_address: form.full_address || null,
        year_founded: form.year_founded ? Number(form.year_founded) : null,
        employee_count: form.employee_count,
        hiring_status: form.hiring_status,
        linkedin_url: form.linkedin_url || null,
        photos: photos.length > 0 ? photos : null,
        status: "pending",
        submitted_by: user?.id ?? null,
      })
      .select()
      .single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted! We'll review it shortly.");
    nav({ to: "/map/company/$id", params: { id: data.id } });
  };

  const addPhotoField = () => {
    if (form.photo_urls.length >= 6) return;
    setForm({ ...form, photo_urls: [...form.photo_urls, ""] });
  };

  const removePhotoField = (idx: number) => {
    setForm({
      ...form,
      photo_urls: form.photo_urls.filter((_, i) => i !== idx),
    });
  };

  const updatePhoto = (idx: number, val: string) => {
    const updated = [...form.photo_urls];
    updated[idx] = val;
    setForm({ ...form, photo_urls: updated });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        to="/map"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to map
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Add your company
          </h1>
          <p className="text-sm text-muted-foreground">
            Submissions are reviewed before appearing on the public map.
          </p>
        </div>
      </div>

      <Card className="mt-8 p-6">
        <form onSubmit={submit} className="space-y-5">
          {/* ─── AI Autofill ──── */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> AI Autofill
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your website or company name. We'll research and prefill, with sources and confidence scores so you can verify each value.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="acme.com or Acme Robotics"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runAutofill();
                  }
                }}
              />
              <Button type="button" onClick={runAutofill} disabled={aiLoading} className="shrink-0">
                {aiLoading ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Researching</>
                ) : (
                  <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Autofill</>
                )}
              </Button>
            </div>

            {citations && (
              <div className="mt-3 space-y-2 border-t border-primary/20 pt-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-semibold uppercase tracking-widest">Primary source:</span>
                  <a href={citations.primary_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[60%]">
                    {citations.page_title || citations.primary_url} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {citations.search_results && citations.search_results.length > 0 && (
                  <div>
                    <div className="text-muted-foreground font-semibold uppercase tracking-widest mb-1">Search results considered:</div>
                    <ul className="space-y-1">
                      {citations.search_results.map((r) => (
                        <li key={r.url}>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            {r.title || r.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {citations.scraped_excerpt && (
                  <button type="button" onClick={() => setShowRaw((s) => !s)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <ChevronDown className={`h-3 w-3 transition ${showRaw ? "rotate-180" : ""}`} />
                    {showRaw ? "Hide" : "Show"} raw scraped excerpt
                  </button>
                )}
                {showRaw && citations.scraped_excerpt && (
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-2 text-[11px] text-muted-foreground">
                    {citations.scraped_excerpt}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* ─── Basic Info ──── */}
          <div
            className="text-xs font-semibold uppercase tracking-widest text-primary"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Basic Information
          </div>

          <Field label="Company name" required meta={meta.name}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Your startup name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Website" meta={meta.website}>
              <Input
                type="url"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn" meta={meta.linkedin_url}>
              <Input
                type="url"
                placeholder="https://linkedin.com/company/..."
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              />
            </Field>
          </div>

          <Field label="One-line description" meta={meta.description}>
            <Textarea
              rows={3}
              placeholder="What does your company do?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          {/* ─── Company Details ──── */}
          <div
            className="mt-2 text-xs font-semibold uppercase tracking-widest text-primary"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Company Details
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector" meta={meta.sector}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
              >
                {["Tech", "Life Sciences", "Aerospace", "Energy", "Outdoor", "Manufacturing", "Other"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage" meta={meta.stage}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {["Idea", "Pre-seed", "Seed", "Series A", "Series B+", "Profitable"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City, State" meta={meta.full_address}>
              <Input
                placeholder="Salt Lake City, UT"
                value={form.full_address}
                onChange={(e) => setForm({ ...form, full_address: e.target.value })}
              />
            </Field>
            <Field label="Year founded" meta={meta.year_founded}>
              <Input
                type="number"
                placeholder="2024"
                value={form.year_founded}
                onChange={(e) => setForm({ ...form, year_founded: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Team size" meta={meta.employee_count}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.employee_count}
              onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
            >
              {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hiring_status}
              onChange={(e) => setForm({ ...form, hiring_status: e.target.checked })}
              className="rounded"
            />
            Currently hiring
          </label>

          {/* ─── Photo Gallery ──── */}
          <div
            className="mt-2 text-xs font-semibold uppercase tracking-widest text-primary"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Photo Gallery
          </div>
          <p className="text-xs text-muted-foreground">
            Add up to 6 image URLs showcasing your team, office, or product.
          </p>

          <div className="space-y-2">
            {form.photo_urls.map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="https://example.com/photo.jpg"
                  value={url}
                  onChange={(e) => updatePhoto(idx, e.target.value)}
                />
                {form.photo_urls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removePhotoField(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {form.photo_urls.length < 6 && (
              <Button type="button" variant="ghost" size="sm" onClick={addPhotoField}>
                <Plus className="mr-1 h-3 w-3" /> Add another photo
              </Button>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting…" : "Submit company"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

type FieldMeta = { confidence: number; evidence: string | null; source_url: string | null };

function Field({
  label,
  required,
  children,
  meta,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  meta?: FieldMeta;
}) {
  const low = meta && meta.confidence < 0.6;
  const confPct = meta ? Math.round(meta.confidence * 100) : null;
  const confColor =
    !meta ? "" :
    meta.confidence >= 0.8 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    meta.confidence >= 0.6 ? "bg-sky-100 text-sky-700 border-sky-200" :
    meta.confidence >= 0.4 ? "bg-amber-100 text-amber-800 border-amber-200" :
    "bg-rose-100 text-rose-700 border-rose-200";

  return (
    <div className={`space-y-1.5 ${low ? "rounded-md ring-2 ring-amber-300/60 bg-amber-50/40 p-2 -m-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label} {required && <span className="text-primary">*</span>}
        </Label>
        {meta && (
          <div className="flex items-center gap-1.5">
            {low && <AlertTriangle className="h-3 w-3 text-amber-600" aria-label="Low confidence" />}
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold ${confColor}`}
              title={meta.evidence ? `Evidence: "${meta.evidence}"` : "AI confidence"}
            >
              AI {confPct}%
            </span>
            {meta.source_url && (
              <a
                href={meta.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
                title={`Source: ${meta.source_url}`}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
      {children}
      {meta?.evidence && (
        <p className="text-[11px] italic text-muted-foreground line-clamp-2">"{meta.evidence}"</p>
      )}
    </div>
  );
}