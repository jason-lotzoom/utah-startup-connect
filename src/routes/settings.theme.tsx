import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { THEMES, type Theme } from "@/lib/themes";
import { Shuffle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings/theme")({
  head: () => ({ meta: [{ title: "Theme — 5iO" }] }),
  component: ThemeSettingsPage,
});

function ThemeSettingsPage() {
  const { activeId, previewId, setTheme, previewTheme, surpriseMe } = useTheme();

  const handleMouseEnter = useCallback(
    (id: string) => { if (id !== activeId) previewTheme(id); },
    [activeId, previewTheme],
  );

  const handleMouseLeave = useCallback(
    () => previewTheme(null),
    [previewTheme],
  );

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <SiteNav />

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Settings
            </p>
            <h1
              className="mt-1 text-3xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Theme
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a color scheme inspired by Utah's landscapes.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-2xl"
            onClick={surpriseMe}
          >
            <Shuffle className="h-4 w-4" />
            Surprise me
          </Button>
        </div>

        {/* Preview hint */}
        {previewId && previewId !== activeId && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Previewing <span className="font-bold text-foreground">{THEMES.find(t => t.id === previewId)?.name}</span> — click to apply
          </div>
        )}

        {/* Theme grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={activeId === theme.id}
              isPreviewing={previewId === theme.id}
              onSelect={() => setTheme(theme.id)}
              onMouseEnter={() => handleMouseEnter(theme.id)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </div>

        {/* About section */}
        <div className="mt-14 rounded-3xl border border-border/50 bg-card p-6 backdrop-blur-sm">
          <h2
            className="font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            About themes
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Each theme changes the color palette, typography, and background
            atmosphere of the entire app. Your choice is saved in your browser
            and restored automatically next time you visit. Hover any card for
            a full-app preview before committing.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ThemeCard({
  theme,
  isActive,
  isPreviewing,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: ThemeCardProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border text-left transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10",
        isActive
          ? "border-primary ring-2 ring-primary/30 shadow-lg"
          : "border-border/60",
        isPreviewing && !isActive && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      {/* Background image thumbnail */}
      <div className="relative h-36 w-full overflow-hidden bg-muted">
        {theme.bgImage ? (
          <img
            src={theme.bgImage}
            alt={theme.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          /* Default theme: show a gradient swatch instead */
          <div
            className="h-full w-full"
            style={{ background: "var(--gradient-canyon)" }}
          />
        )}

        {/* Active checkmark badge */}
        {isActive && (
          <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4 bg-card backdrop-blur-sm">
        <div>
          <p
            className="font-bold leading-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {theme.name}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {theme.tagline}
          </p>
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-1.5">
          {theme.swatches.map((color, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-full border border-border/40 shadow-sm ring-1 ring-white/20"
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>

        {/* Font preview */}
        <p
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          style={{ fontFamily: theme.vars["--font-accent"] || "var(--font-accent)" }}
        >
          {theme.id === "default" ? "Playfair Display + Inter" : theme.vars["--font-display"]?.match(/'([^']+)'/)?.[1] ?? ""}
        </p>
      </div>

      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 ring-2 ring-primary/40 transition-opacity duration-300 group-hover:opacity-100" />
    </button>
  );
}
