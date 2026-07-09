import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getStats } from "@/lib/charts.functions";

export const Route = createFileRoute("/stats/$category")({
  loader: async ({ params }) => {
    const data = await getStats();
    const cat = decodeURIComponent(params.category);
    const items = data.byCategory[cat];
    if (!items) throw notFound();
    return { items, category: cat, categories: data.categories };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.category ?? "Stats"} | daegon charts` },
      { name: "description", content: `Stats ranking: ${loaderData?.category ?? ""}` },
    ],
  }),
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: StatsCategoryPage,
});

function StatsCategoryPage() {
  const { items, category, categories } = Route.useLoaderData();
  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/stats" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> Stats</Link>
      <h1 className="section-title mt-4">{category}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((c: string) => (
          <Link key={c} to="/stats/$category" params={{ category: encodeURIComponent(c) }} className={`btn-nav ${c === category ? "active" : ""}`}>{c}</Link>
        ))}
      </div>
      <div className="bg-[var(--muted)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-3 w-16">Rank</th>
              <th className="p-3">Item</th>
              <th className="p-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: { rank: number; item: string; number: string }, i: number) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="p-3 font-bold gold">#{it.rank}</td>
                <td className="p-3">{it.item}</td>
                <td className="p-3 text-right font-mono text-[var(--run-up)]">{it.number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
