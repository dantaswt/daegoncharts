import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getStats } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import React, { useEffect, useState } from "react";

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

function StatsItemImage({ query }: { query: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type: "artist" } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center text-xl text-gray-500">
      {imageUrl ? <img src={imageUrl} alt={query} className="w-full h-full object-cover" /> : <i className="fas fa-chart-bar" />}
    </div>
  );
}

function parseStatsItem(item: string) {
  const parts = item.split(/\s*\/\s*/);
  if (parts.length > 1) {
    return { title: parts[0].trim(), subtext: parts.slice(1).join(" / ").trim() };
  }
  return { title: item.trim(), subtext: undefined };
}

function StatsCategoryPage() {
  const { items, category, categories } = Route.useLoaderData();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
      <Link to="/stats" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> Stats</Link>
      <h1 className="section-title mt-4">{category}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((c: string) => (
          <Link key={c} to="/stats/$category" params={{ category: encodeURIComponent(c) }} className={`btn-nav ${c === category ? "active" : ""}`}>{c}</Link>
        ))}
      </div>
      <div className="space-y-3">
        {items.map((it: { rank: number; item: string; number: string }, i: number) => {
          const parsed = parseStatsItem(it.item);
          const rank = it.rank || i + 1;
          return (
            <div key={i} className="bg-[var(--muted)] rounded-3xl border border-[var(--border)] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-3xl bg-[#111827] text-lg font-black text-[var(--accent)]">{rank}</div>
              <StatsItemImage query={parsed.subtext ?? parsed.title} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{parsed.title}</div>
                {parsed.subtext && <div className="text-xs text-muted-foreground mt-1">{parsed.subtext}</div>}
              </div>
              <div className="text-right text-lg font-bold gold min-w-[5rem]">{it.number}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
