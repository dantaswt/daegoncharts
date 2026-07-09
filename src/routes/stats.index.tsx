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
      <div className="flex flex-wrap gap-2 mb-6">
        {data.categories.map((c: string) => (
          <Link key={c} to="/stats/$category" params={{ category: encodeURIComponent(c) }} className="btn-nav">{c}</Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Pick a category to view rankings.</p>
    </div>
  );
}
