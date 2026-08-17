import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, useState, useRef, useCallback } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BackToTop } from "@/components/chart-nav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-question text-3xl text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">This chart week or page doesn't exist.</p>
        <Link to="/" className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity inline-block">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">This page didn't load</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Try again in a moment.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity"
          >
            <i className="fas fa-redo mr-2" />Try again
          </button>
          <a href="/" className="px-6 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function PendingComponent() {
  return null;
}

function LoadingBar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = router.subscribe("onBeforeNavigate", () => {
      setLoading(true);
    });
    const unsub2 = router.subscribe("onResolved", () => {
      setLoading(false);
    });
    return () => { unsub(); unsub2(); };
  }, [router]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
      <div
        className={`h-full bg-[var(--accent)] transition-all duration-300 ${
          loading
            ? "w-3/4 animate-loading-bar"
            : "w-0"
        }`}
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "daegon charts — weekly music charts" },
      { name: "description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:title", content: "daegon charts — weekly music charts" },
      { property: "og:description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "daegon charts — weekly music charts" },
      { name: "twitter:description", content: "Weekly music charts, year-end rankings and greatest of all time lists based on dantaswt's Last.fm data. Each week gets its own shareable page." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec607b97-ae27-46db-b1cd-33cd5ee21c48/id-preview-d264bb45--5db350f4-251b-4e58-9690-0882b7b15f41.lovable.app-1783601743675.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ec607b97-ae27-46db-b1cd-33cd5ee21c48/id-preview-d264bb45--5db350f4-251b-4e58-9690-0882b7b15f41.lovable.app-1783601743675.png" },
    ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "https://i.imgur.com/jaBZ19n.png", type: "image/png" },
        { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
      ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  pendingComponent: PendingComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      navigate({ to: "/artists", search: { q: searchQuery.trim() } });
      setSearchQuery("");
      setMenuOpen(false);
    }
  }, [searchQuery, navigate]);

  const navItems = [
    { label: "HOT 100", to: "/chart/$chartId" as const, params: { chartId: "songs" } },
    { label: "CHART BEAT", to: "/chart-beat-2/$chartId/$date" as const, params: { chartId: "songs", date: "2026-07-06" } },
    { label: "YEAR-END CHARTS", to: "/year-end/$chartId" as const, params: { chartId: "yearEndSongs" } },
    { label: "GREATEST OF ALL TIME", to: "/goat/$chartId" as const, params: { chartId: "goatSongs" } },
    { label: "STATS", to: "/stats" as const, params: {} },
    { label: "#1'S", to: "/number-ones" as const, params: {} },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--muted)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        {/* Logo */}
        <Link to="/" className="text-lg md:text-xl font-extrabold text-white lowercase tracking-wide shrink-0">
          daegon charts
        </Link>

        {/* Desktop nav — centered */}
        <nav className="hidden lg:flex items-center justify-center gap-5">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={item.params}
              className="text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <div className="hidden lg:flex items-center shrink-0">
          <input
            type="text"
            placeholder="SEARCH ARTIST"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-transparent border border-gray-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 w-56 placeholder-gray-500 focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden text-white text-2xl p-1 cursor-pointer"
          aria-label="Menu"
        >
          <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div ref={menuRef} className="lg:hidden bg-[var(--muted)] border-t border-[var(--border)]">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                params={item.params}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-[var(--accent)] transition-colors py-2 border-b border-[var(--border)]"
              >
                {item.label}
              </Link>
            ))}
            {/* Mobile search */}
            <div className="pt-2">
              <input
                type="text"
                placeholder="SEARCH ARTIST"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full bg-transparent border border-gray-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 placeholder-gray-500 focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-[var(--muted)] mt-10 py-8 border-t border-[var(--border)]">
      <div className="container mx-auto px-4">
        <div className="text-center text-muted-foreground text-xs">
          <p>Chart generated based on dantaswt's Last.fm data.</p>
          <p className="mt-1">Powered by TanStack Start.</p>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingBar />
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <main className="flex-grow container mx-auto p-3 md:p-6 pt-20 md:pt-24">
          <Outlet />
        </main>
        <SiteFooter />
        <BackToTop />
      </div>
    </QueryClientProvider>
  );
}
