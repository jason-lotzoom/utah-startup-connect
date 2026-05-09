import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Building2,
  BookOpen,
  Eye,
} from "lucide-react";
import {
  parseResourceCSV,
  parseCompanyCSV,
  type ResourceRow,
  type CompanyRow,
  type ImportStats,
} from "@/lib/csv-import";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — 5iO" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading, isAdmin, roles } = useAuth();
  const nav = useNavigate();
  const [pending, setPending] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRun, setLastRun] = useState<{ scanned: number; hiring: number; jobs_imported: number; errors: string[] } | null>(null);
  const [eventsRefreshing, setEventsRefreshing] = useState(false);
  const [eventsLastRun, setEventsLastRun] = useState<{ scraped: number; inserted: number; updated: number; errors: string[] } | null>(null);
  const [logosRefreshing, setLogosRefreshing] = useState(false);
  const [logosLastRun, setLogosLastRun] = useState<{ processed: number; updated: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth/login" });
    else if (roles.length > 0 && !isAdmin) nav({ to: "/" });
  }, [user, loading, isAdmin, roles, nav]);

  const refresh = async () => {
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase.from("companies").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("claim_requests").select("*, companies(name)").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setPending(c ?? []);
    setClaims(cl ?? []);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const approve = async (id: string) => {
    const { error } = await supabase.from("companies").update({ status: "active", is_verified: true }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Approved");
      refresh();
    }
  };
  const reject = async (id: string) => {
    const { error } = await supabase.from("companies").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const resolveClaim = async (claimId: string, companyId: string, userId: string, status: "approved" | "rejected") => {
    if (status === "approved") {
      await supabase.from("companies").update({ is_claimed: true, claimed_by: userId }).eq("id", companyId);
      await supabase.from("profiles").update({ company_id: companyId }).eq("id", userId);
    }
    await supabase.from("claim_requests").update({ status }).eq("id", claimId);
    toast.success(`Claim ${status}`);
    refresh();
  };

  if (!isAdmin) return null;

  const runLogosRefresh = async (limit = 20) => {
    setLogosRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-logos', { body: { limit } });
      if (error) throw error;
      setLogosLastRun(data);
      toast.success(`Logos: ${data.updated} updated · ${data.skipped} skipped · ${data.processed} processed`);
    } catch (e: any) {
      toast.error(e.message ?? 'Logo fetch failed');
    } finally {
      setLogosRefreshing(false);
    }
  };

  const runEventsRefresh = async () => {
    setEventsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-events");
      if (error) throw error;
      setEventsLastRun(data);
      toast.success(`Scraped ${data.scraped} · ${data.inserted} new · ${data.updated} updated`);
    } catch (e: any) {
      toast.error(e.message ?? "Events refresh failed");
    } finally {
      setEventsRefreshing(false);
    }
  };

  const runHiringRefresh = async (limit = 15) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-hiring", { body: { limit } });
      if (error) throw error;
      setLastRun(data);
      toast.success(`Scanned ${data.scanned} · ${data.hiring} hiring · ${data.jobs_imported} jobs`);
    } catch (e: any) {
      toast.error(e.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage companies, review claims, and import data.
        </p>
        <Card className="mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Hiring data refresh</h2>
              <p className="text-sm text-muted-foreground">
                Scrapes a batch of company career pages with Firecrawl and updates hiring status + open roles.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => runHiringRefresh(15)} disabled={refreshing}>
                {refreshing ? "Scanning…" : "Refresh 15 companies"}
              </Button>
              <Button variant="outline" onClick={() => runHiringRefresh(40)} disabled={refreshing}>
                Refresh 40
              </Button>
            </div>
          </div>
          {lastRun && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last run: scanned {lastRun.scanned} · {lastRun.hiring} hiring · {lastRun.jobs_imported} jobs imported
              {lastRun.errors.length > 0 && ` · ${lastRun.errors.length} errors`}
            </p>
          )}
        </Card>

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Company logos</h2>
              <p className="text-sm text-muted-foreground">
                Fetches logos for companies without one via Clearbit, with Firecrawl as fallback. Stores the URL in the DB.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => runLogosRefresh(20)} disabled={logosRefreshing}>
                {logosRefreshing ? 'Fetching…' : 'Fetch 20 logos'}
              </Button>
              <Button variant="outline" onClick={() => runLogosRefresh(50)} disabled={logosRefreshing}>
                Fetch 50
              </Button>
            </div>
          </div>
          {logosLastRun && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last run: processed {logosLastRun.processed} · {logosLastRun.updated} updated · {logosLastRun.skipped} skipped
              {logosLastRun.errors.length > 0 && ` · ${logosLastRun.errors.length} errors`}
            </p>
          )}
        </Card>

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Events feed refresh</h2>
              <p className="text-sm text-muted-foreground">
                Scrapes Silicon Slopes, Eventbrite, Meetup, Utah Foundation, and SBA Utah for upcoming events.
              </p>
            </div>
            <Button
              onClick={runEventsRefresh}
              disabled={eventsRefreshing}
              className="bg-[oklch(0.58_0.16_148)] hover:bg-[oklch(0.52_0.14_148)] text-white"
            >
              {eventsRefreshing ? "Scraping…" : "Refresh Events"}
            </Button>
          </div>
          {eventsLastRun && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last run: scraped {eventsLastRun.scraped} · {eventsLastRun.inserted} new · {eventsLastRun.updated} updated
              {eventsLastRun.errors.length > 0 && ` · ${eventsLastRun.errors.length} errors`}
            </p>
          )}
        </Card>
        <Tabs defaultValue="import" className="mt-6">
          <TabsList>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Import Data
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Claims ({claims.length})
            </TabsTrigger>
          </TabsList>

          {/* ─── Import Data Tab ──── */}
          <TabsContent value="import" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <CSVImporter
                type="resources"
                title="Resources"
                description="Import state programs, accelerators, and support resources from the GOED spreadsheet."
                icon={<BookOpen className="h-5 w-5" />}
                sampleColumns={["Title", "Description", "Link", "Topics", "Industries", "Communities", "Locations"]}
              />
              <CSVImporter
                type="companies"
                title="Companies"
                description="Import startup listings for the Utah Startup Map."
                icon={<Building2 className="h-5 w-5" />}
                sampleColumns={["Name", "Description", "Website", "Sector", "Stage", "Address", "Latitude", "Longitude"]}
              />
            </div>
          </TabsContent>

          {/* ─── Pending Companies Tab ──── */}
          <TabsContent value="companies" className="mt-6 grid gap-3">
            {pending.length === 0 && <p className="text-muted-foreground">No pending submissions.</p>}
            {pending.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-xs">
                      {c.sector && <Badge variant="secondary">{c.sector}</Badge>}
                      {c.stage && <Badge variant="outline">{c.stage}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => approve(c.id)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(c.id)}>Reject</Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* ─── Claims Tab ──── */}
          <TabsContent value="claims" className="mt-6 grid gap-3">
            {claims.length === 0 && <p className="text-muted-foreground">No pending claims.</p>}
            {claims.map((cl) => (
              <Card key={cl.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold">{cl.companies?.name}</h3>
                    <p className="text-xs text-muted-foreground">{cl.email}</p>
                    {cl.message && <p className="mt-1 text-sm">{cl.message}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => resolveClaim(cl.id, cl.company_id, cl.user_id, "approved")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveClaim(cl.id, cl.company_id, cl.user_id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
      <SiteFooter />
    </div>
  );
}

/* ─── CSV Importer Component ──── */

function CSVImporter({
  type,
  title,
  description,
  icon,
  sampleColumns,
}: {
  type: "resources" | "companies";
  title: string;
  description: string;
  icon: React.ReactNode;
  sampleColumns: string[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [mode, setMode] = useState<"update" | "skip">("update");

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      setStats(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (type === "resources") {
          const { rows, errors } = parseResourceCSV(text);
          setPreview(rows);
          setParseErrors(errors);
        } else {
          const { rows, errors } = parseCompanyCSV(text);
          setPreview(rows);
          setParseErrors(errors);
        }
      };
      reader.readAsText(f);
    },
    [type]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) handleFile(f);
      else toast.error("Please drop a .csv file");
    },
    [handleFile]
  );

  const runImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    const result: ImportStats = { added: 0, updated: 0, skipped: 0, errors: [] };

    try {
      const table = type === "resources" ? "resources" : "companies";
      const nameField = type === "resources" ? "title" : "name";

      for (const row of preview) {
        const name = (row as any)[nameField];
        // Check if already exists
        const { data: existing } = await ((supabase as any)
          .from(table)
          .select("id")
          .eq(nameField, name)
          .maybeSingle());

        if (existing) {
          if (mode === "update") {
            const { error } = await supabase.from(table).update(row).eq("id", existing.id);
            if (error) result.errors.push(`Update "${name}": ${error.message}`);
            else result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          const { error } = await supabase.from(table).insert(row);
          if (error) result.errors.push(`Insert "${name}": ${error.message}`);
          else result.added++;
        }
      }

      setStats(result);
      if (result.errors.length === 0) {
        toast.success(`Import complete! ${result.added} added, ${result.updated} updated.`);
      } else {
        toast.warning(`Import done with ${result.errors.length} error(s).`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setParseErrors([]);
    setStats(null);
  };

  return (
    <Card className="flex flex-col p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {!file ? (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-primary/40 hover:bg-muted/50"
          >
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a CSV file here</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <span>Choose file</span>
              </Button>
            </label>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              Expected columns: {sampleColumns.join(", ")}
            </p>
          </div>
        </>
      ) : stats ? (
        /* ─── Import Results ──── */
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Import Complete
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-emerald-600">{stats.added}</div>
                <div className="text-xs text-muted-foreground">Added</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>
            {stats.errors.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                {stats.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" onClick={reset} className="mt-auto">
            Import another file
          </Button>
        </div>
      ) : (
        /* ─── Preview ──── */
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="font-medium">{file.name}</span>
              <Badge variant="secondary">{preview?.length ?? 0} rows</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              ✕
            </Button>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {parseErrors.length} warning(s)
              </div>
              <ul className="mt-1 list-inside list-disc">
                {parseErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 5 && <li>…and {parseErrors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      {type === "resources" ? "Title" : "Name"}
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      {type === "resources" ? "Topics" : "Sector"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((r: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1 font-medium">{r.title || r.name}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {type === "resources"
                          ? (r.topics || []).slice(0, 2).join(", ")
                          : r.sector || "—"}
                      </td>
                    </tr>
                  ))}
                  {preview.length > 10 && (
                    <tr className="border-t border-border">
                      <td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">
                        …and {preview.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Conflict mode */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground">If duplicate:</span>
            <button
              onClick={() => setMode("update")}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                mode === "update"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              Update existing
            </button>
            <button
              onClick={() => setMode("skip")}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                mode === "skip"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              Skip duplicates
            </button>
          </div>

          <Button onClick={runImport} disabled={importing || !preview?.length} className="mt-auto">
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import {preview?.length ?? 0} {type}
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}