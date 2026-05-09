import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/Avatar";
import { AvatarCustomizer } from "@/components/AvatarCustomizer";
import { BadgeShelf } from "@/components/BadgeShelf";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — 5iO" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data);
      if (data?.company_id) {
        supabase.from("companies").select("*").eq("id", data.company_id).maybeSingle().then(({ data: c }) => setCompany(c));
      }
    });
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center gap-5">
          <Avatar userId={user.id} size="large" />
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            <button
              onClick={() => setShowCustomizer((v) => !v)}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              {showCustomizer ? "Hide customizer" : "Customize avatar"}
            </button>
          </div>
        </div>

        {showCustomizer && (
          <Card className="mt-6 rounded-3xl p-6">
            <h2 className="mb-4 font-bold" style={{ fontFamily: "var(--font-display)" }}>Avatar</h2>
            <AvatarCustomizer userId={user.id} onSaved={() => setShowCustomizer(false)} />
          </Card>
        )}

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Your badges</h2>
          <BadgeShelf userId={user.id} />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Your company</h2>
            {company ? (
              <>
                <p className="mt-2 text-lg font-semibold">{company.name}</p>
                <Badge className="mt-1" variant="secondary">{company.status}</Badge>
                <Link to="/map/company/$id" params={{ id: company.id }}>
                  <Button size="sm" variant="outline" className="mt-4">View public profile</Button>
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  You haven't claimed or submitted a company yet.
                </p>
                <div className="mt-4 flex gap-2">
                  <Link to="/map/add-company">
                    <Button size="sm">Submit one</Button>
                  </Link>
                  <Link to="/map">
                    <Button size="sm" variant="outline">Find on map</Button>
                  </Link>
                </div>
              </>
            )}
          </Card>
          <Card className="p-6">
            <h2 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Resources</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Get matched with personalized Utah programs.
            </p>
            <Link to="/navigator">
              <Button size="sm" className="mt-4">Open Navigator</Button>
            </Link>
          </Card>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}