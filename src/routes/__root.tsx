import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BackToTop } from "@/components/chart-nav";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-extrabold gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This chart week or page doesn't exist.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold">Go home</Link>
        </div>
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again in a moment.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-gold"
          >Try again</button>
          <a href="/" className="btn-nav">Go home</a>
        </div>
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="text-center">
        <i className="fas fa-circle-notch fa-spin text-4xl gold mb-4" />
        <div className="text-muted-foreground font-semibold">Loading...</div>
      </div>
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
  return (
    <header className="bg-[var(--muted)] border-b border-[var(--border)] sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3 md:py-4 flex justify-center items-center">
        <Link to="/" className="text-xl md:text-2xl font-extrabold text-white">daegon charts</Link>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-[var(--muted)] mt-10 py-8 border-t border-[var(--border)]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mb-6">
          <Link to="/artists" className="hover:text-[var(--accent)] transition-colors font-semibold">Artists</Link>
          <span className="text-gray-600">|</span>
          <Link to="/chart/$chartId" params={{ chartId: "albums" }} className="hover:text-[var(--accent)] transition-colors font-semibold">Albums</Link>
          <span className="text-gray-600">|</span>
          <Link to="/year-end/$chartId" params={{ chartId: "yearEndSongs" }} className="hover:text-[var(--accent)] transition-colors font-semibold">Year-End</Link>
          <span className="text-gray-600">|</span>
          <Link to="/goat/$chartId" params={{ chartId: "goatSongs" }} className="hover:text-[var(--accent)] transition-colors font-semibold">GOAT</Link>
          <span className="text-gray-600">|</span>
          <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: "songs", date: "2026-07-06" }} className="hover:text-[var(--accent)] transition-colors font-semibold">Chart Beat</Link>
          <span className="text-gray-600">|</span>
          <Link to="/stats" className="hover:text-[var(--accent)] transition-colors font-semibold">Stats</Link>
          <span className="text-gray-600">|</span>
          <Link to="/number-ones" className="hover:text-[var(--accent)] transition-colors font-semibold">#1's</Link>
          <span className="text-gray-600">|</span>
          <Link to="/chart-battle" className="hover:text-[var(--accent)] transition-colors font-semibold gold">Chart Battle</Link>
        </div>
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
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <main className="flex-grow container mx-auto p-3 md:p-6">
          <Outlet />
        </main>
        <SiteFooter />
        <BackToTop />
      </div>
    </QueryClientProvider>
  );
}
