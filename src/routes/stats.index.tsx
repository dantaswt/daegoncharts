import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getStats } from "@/lib/charts.functions";

export const Route = createFileRoute("/stats/")({
  loader: async () => await getStats(),
  head: () => ({ meta: [{ title: "Stats | daegon charts" }] }),
  component: StatsPage,
});

function StatsPage() {
  const data = Route.useLoaderData();
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="section-title">Stats</h1>
      <ul className="grid gap-2 mb-6">
        {data.categories.map((c: string) => (
          <li key={c}>
            <Link to="/stats/$category" params={{ category: encodeURIComponent(c) }} className="block rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
              {c}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">Pick a category to view rankings.</p>
    </div>
  );
}
