import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

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
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Admin</h1>
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
        <Tabs defaultValue="companies" className="mt-6">
          <TabsList>
            <TabsTrigger value="companies">Pending companies ({pending.length})</TabsTrigger>
            <TabsTrigger value="claims">Claim requests ({claims.length})</TabsTrigger>
          </TabsList>
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