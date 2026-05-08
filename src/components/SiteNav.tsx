import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function SiteNav({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { user, isAdmin, signOut } = useAuth();
  const dark = variant === "dark";
  const linkCls = dark ? "text-white/80 hover:text-white" : "text-foreground/70 hover:text-foreground";
  return (
    <nav className={`relative z-20 border-b ${dark ? "border-white/10" : "border-border bg-background/80 backdrop-blur"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className={`flex items-center gap-2 text-2xl font-bold ${dark ? "text-white" : "text-foreground"}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className={`inline-block h-3 w-3 rounded-full ${dark ? "bg-white/90" : "bg-primary"}`} />
          5iO
        </Link>
        <div
          className="hidden items-center gap-7 text-xs uppercase tracking-[0.2em] md:flex"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          <Link to="/navigator" className={linkCls}>Navigator</Link>
          <Link to="/map" className={linkCls}>Startup Map</Link>
          {user && <Link to="/dashboard" className={linkCls}>Dashboard</Link>}
          {isAdmin && <Link to="/admin" className={linkCls}>Admin</Link>}
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button size="sm" variant={dark ? "secondary" : "outline"} onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <>
              <Link to="/auth/login">
                <Button size="sm" variant={dark ? "secondary" : "ghost"}>Sign in</Button>
              </Link>
              <Link to="/auth/signup" className="hidden sm:block">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[oklch(0.22_0.04_280)] py-12 text-white/80">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
          5iO
        </div>
        <p className="mt-2 text-sm">Build the Startup State.</p>
        <p className="mt-6 text-xs text-white/50">
          Presented by Utah Governor's Office of Economic Development · startup.utah.gov
        </p>
      </div>
    </footer>
  );
}