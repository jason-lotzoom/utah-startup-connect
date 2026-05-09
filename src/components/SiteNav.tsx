import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Compass, Map, LayoutDashboard, Shield, ExternalLink, BarChart3 } from "lucide-react";

export function SiteNav({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { user, isAdmin, signOut } = useAuth();
  const dark = variant === "dark";
  const linkCls = dark
    ? "text-white/80 hover:text-white transition"
    : "text-foreground/70 hover:text-foreground transition";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = router.state.location.pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navBg = scrolled
    ? dark
      ? "border-white/10 bg-[oklch(0.22_0.04_280/0.9)] backdrop-blur-lg"
      : "border-border bg-background/90 backdrop-blur-lg shadow-sm"
    : dark
      ? "border-white/10"
      : "border-border bg-background/80 backdrop-blur";

  return (
    <nav className={`sticky top-0 z-30 border-b transition-all duration-300 ${navBg}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className={`flex items-center gap-2 text-2xl font-bold ${dark ? "text-white" : "text-foreground"}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span
            className={`inline-block h-3 w-3 rounded-full ${dark ? "bg-white/90" : "bg-primary"}`}
          />
          5iO
        </Link>

        {/* Desktop navigation */}
        <div
          className="hidden items-center gap-7 text-xs uppercase tracking-[0.2em] md:flex"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          <NavLink to="/navigator" label="Navigator" active={pathname.startsWith("/navigator")} cls={linkCls} />
          <NavLink to="/map" label="Startup Map" active={pathname.startsWith("/map")} cls={linkCls} />
          <NavLink to="/ecosystem" label="Ecosystem" active={pathname === "/ecosystem"} cls={linkCls} />
          {user && <NavLink to="/dashboard" label="Dashboard" active={pathname === "/dashboard"} cls={linkCls} />}
          {isAdmin && <NavLink to="/admin" label="Admin" active={pathname === "/admin"} cls={linkCls} />}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Button size="sm" variant={dark ? "secondary" : "outline"} onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <>
              <Link to="/auth/login" className="hidden sm:block">
                <Button size="sm" variant={dark ? "secondary" : "ghost"}>
                  Sign in
                </Button>
              </Link>
              <Link to="/auth/signup" className="hidden sm:block">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="flex flex-col gap-1 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span
              className={`block h-0.5 w-5 rounded transition-transform ${dark ? "bg-white" : "bg-foreground"} ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 rounded transition-opacity ${dark ? "bg-white" : "bg-foreground"} ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 rounded transition-transform ${dark ? "bg-white" : "bg-foreground"} ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className={`border-t px-6 py-4 md:hidden ${
            dark
              ? "border-white/10 bg-[oklch(0.22_0.04_280/0.95)] text-white"
              : "border-border bg-background text-foreground"
          }`}
        >
          <div
            className="flex flex-col gap-3 text-sm uppercase tracking-widest"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            <Link
              to="/navigator"
              className="flex items-center gap-2 py-1"
              onClick={() => setMenuOpen(false)}
            >
              <Compass className="h-4 w-4" /> Navigator
            </Link>
            <Link
              to="/map"
              className="flex items-center gap-2 py-1"
              onClick={() => setMenuOpen(false)}
            >
              <Map className="h-4 w-4" /> Startup Map
            </Link>
            <Link
              to="/ecosystem"
              className="flex items-center gap-2 py-1"
              onClick={() => setMenuOpen(false)}
            >
              <BarChart3 className="h-4 w-4" /> Ecosystem
            </Link>
            {user && (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 py-1"
                onClick={() => setMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 py-1"
                onClick={() => setMenuOpen(false)}
              >
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              {user ? (
                <Button size="sm" variant="outline" onClick={signOut} className="w-full">
                  Sign out
                </Button>
              ) : (
                <>
                  <Link to="/auth/login" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button size="sm" variant="outline" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/auth/signup" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button size="sm" className="w-full">
                      Get started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({
  to,
  label,
  active,
  cls,
}: {
  to: string;
  label: string;
  active: boolean;
  cls: string;
}) {
  return (
    <Link
      to={to}
      className={`relative ${cls} ${active ? "!text-primary font-semibold" : ""}`}
    >
      {label}
      {active && (
        <span className="absolute -bottom-[18px] left-0 right-0 h-0.5 rounded-full bg-primary" />
      )}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-[oklch(0.22_0.04_280)] py-16 text-white/80">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              5iO
            </div>
            <p className="mt-2 text-sm">Build the Startup State.</p>
            <p className="mt-4 text-xs text-white/40">
              Presented by Utah Governor's Office of Economic Development
            </p>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest text-white/50"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Platform
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link to="/navigator" className="hover:text-white transition">
                Founder's Navigator
              </Link>
              <Link to="/map" className="hover:text-white transition">
                Utah Startup Map
              </Link>
              <Link to="/map/add-company" className="hover:text-white transition">
                Submit a Company
              </Link>
            </div>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest text-white/50"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Resources
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a
                href="https://startup.utah.gov"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-white transition"
              >
                startup.utah.gov <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://business.utah.gov"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-white transition"
              >
                business.utah.gov <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} 5iO. All rights reserved. A project for the Utah GOED AI
            Builder Day hackathon.
          </p>
        </div>
      </div>
    </footer>
  );
}