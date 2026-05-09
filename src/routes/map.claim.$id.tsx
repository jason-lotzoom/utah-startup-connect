import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/map/claim/$id")({
  component: ClaimPage,
});

function ClaimPage() {
  const { id } = useParams({ from: "/map/claim/$id" });
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    supabase.from("companies").select("name").eq("id", id).maybeSingle().then(({ data }) => setCompany(data));
  }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("claim_requests").insert({
      company_id: id,
      user_id: user.id,
      email,
      message,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Claim submitted. We'll be in touch.");
    nav({ to: "/map/company/$id", params: { id } });
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Claim {company?.name ?? "this listing"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We'll verify your affiliation before granting edit access.
      </p>
      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Work email at this company</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Your role / context</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit claim"}
          </Button>
        </form>
      </Card>
      <Link to="/map/company/$id" params={{ id }} className="mt-4 inline-block text-sm text-muted-foreground hover:text-primary">
        ← Back to company
      </Link>
    </div>
  );
}