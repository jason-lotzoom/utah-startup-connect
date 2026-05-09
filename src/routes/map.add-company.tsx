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
import { ArrowLeft, Plus, X, Building2, Briefcase, Sparkles, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/map/add-company")({
  head: () => ({ meta: [{ title: "Submit a company â 5iO" }] }),
  component: AddCompany,
});

interface JobEntry {
  title: string;
  type: string;
  location: string;
  url: string;
}

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
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const runAutofill = async () => {
    if (!aiInput.trim()) return toast.error("Enter a company name or website");
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("autofill-company", {
        body: { input: aiInput.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Autofill failed");
      const d = data.data;
      setForm((f) => ({
        ...f,
        name: d.name || f.name,
        website: d.website || f.website,
        description: d.description || f.description,
        sector: d.sector || f.sector,
        stage: d.stage || f.stage,
        full_address: d.full_address || f.full_address,
        year_founded: d.year_founded ? String(d.year_founded) : f.year_founded,
        employee_count: d.employee_count || f.employee_count,
        linkedin_url: d.linkedin_url || f.linkedin_url,
        hiring_status: d.hiring_status ?? f.hiring_status,
      }));
      toast.success("Fields prefilled - please review before submitting");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Autofill failed");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        hiring_status: form.hiring_status || jobs.length > 0,
        linkedin_url: form.linkedin_url || null,
        photos: photos.length > 0 ? photos : null,
        status: "pending",
        submitted_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Insert job postings if any
    const validJobs = jobs.filter((j) => j.title.trim());
    if (validJobs.length > 0 && data?.id) {
      const { error: jobsError } = await supabase.from("job_postings").insert(
        validJobs.map((j) => ({
          company_id: data.id,
          title: j.title.trim(),
          type: j.type || null,
          location: j.location || null,
          url: j.url || null,
          is_active: true,
          ai_imported: false,
        }))
      );
      if (jobsError) {
        console.warn("Jobs insert error:", jobsError.message);
      }
    }

    setLoading(false);
    toast.success("Submitted! We'll review it shortly.");
    nav({ to: "/map/company/$id", params: { id: data.id } });
  };

  const addPhotoField = () => {
    if (form.photo_urls.length >= 6) return;
    setForm({ ...form, photo_urls: [...form.photo_urls, ""] });
  };

  const removePhotoField = (idx: number) => {
    setForm({ ...form, photo_urls: form.photo_urls.filter((_, i) => i !== idx) });
  };

  const updatePhoto = (idx: number, val: string) => {
    const updated = [...form.photo_urls];
    updated[idx] = val;
    setForm({ ...form, photo_urls: updated });
  };

  const addJob = () => {
    if (jobs.length >= 10) return;
    setJobs([...jobs, { title: "", type: "Full-time", location: "", url: "" }]);
  };

  const removeJob = (idx: number) => setJobs(jobs.filter((_, i) => i !== idx));

  const updateJob = (idx: number, field: keyof JobEntry, val: string) => {
    const updated = [...jobs];
    updated[idx] = { ...updated[idx], [field]: val };
    setJobs(updated);
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
          {/* âââ Basic Info ââââ */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> AI Autofill
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your website or company name and we'll research the rest. Review and edit before submitting.
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
          </div>

          <SectionLabel>Basic Information</SectionLabel>

          <Field label="Company name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Your startup name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Website">
              <Input
                type="url"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                type="url"
                placeholder="https://linkedin.com/company/..."
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              />
            </Field>
          </div>

          <Field label="One-line description">
            <Textarea
              rows={3}
              placeholder="What does your company do?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          {/* âââ Company Details ââââ */}
          <SectionLabel>Company Details</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector">
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
            <Field label="Stage">
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
            <Field label="City, State">
              <Input
                placeholder="Salt Lake City, UT"
                value={form.full_address}
                onChange={(e) => setForm({ ...form, full_address: e.target.value })}
              />
            </Field>
            <Field label="Year founded">
              <Input
                type="number"
                placeholder="2024"
                min="1900"
                max={new Date().getFullYear()}
                value={form.year_founded}
                onChange={(e) => setForm({ ...form, year_founded: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Team size">
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

          {/* âââ Job Postings ââââ */}
          <SectionLabel>Job Postings</SectionLabel>
          <p className="text-xs text-muted-foreground -mt-2">
            List open roles at your company. Adding jobs automatically marks you as hiring.
          </p>

          {jobs.length > 0 && (
            <div className="space-y-4">
              {jobs.map((job, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" /> Role {idx + 1}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeJob(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Job title" required>
                      <Input
                        placeholder="e.g. Senior Engineer"
                        value={job.title}
                        onChange={(e) => updateJob(idx, "title", e.target.value)}
                        required={idx === 0}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={job.type}
                        onChange={(e) => updateJob(idx, "type", e.target.value)}
                      >
                        {["Full-time", "Part-time", "Contract", "Remote", "Internship"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Location">
                      <Input
                        placeholder="Salt Lake City, UT"
                        value={job.location}
                        onChange={(e) => updateJob(idx, "location", e.target.value)}
                      />
                    </Field>
                    <Field label="Apply URL">
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={job.url}
                        onChange={(e) => updateJob(idx, "url", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {jobs.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={addJob} className="rounded-xl">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add a job posting
            </Button>
          )}

          {/* âââ Photo Gallery ââââ */}
          <SectionLabel>Photo Gallery</SectionLabel>
          <p className="text-xs text-muted-foreground -mt-2">
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

          {/* âââ Verification Note ââââ */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Instant verification available</p>
            <p className="mt-1 text-xs text-emerald-700">
              After submission, claim your listing at <span className="font-mono">/map/claim/[id]</span>. If your work email domain matches your company website, you'll be auto-verified instantly and can edit your listing immediately.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submittingâ¦" : "Submit company"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-2 text-xs font-semibold uppercase tracking-widest text-primary"
      style={{ fontFamily: "var(--font-accent)" }}
    >
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
