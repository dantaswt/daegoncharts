import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllArtistStats } from "@/lib/charts.functions";
import { slugifyArtist } from "@/lib/charts-config";

export const Route = createFileRoute("/artists")({
  loader: async () => {
    const all = await getAllArtistStats();
    const list: { name: string; slug: string; entries: number }[] = Object.values(all)
      .map((a) => ({
        name: a.name,
        slug: slugifyArtist(a.name),
        entries: Object.values(a.chartsByKind).reduce<number>((s, arr) => s + (arr as unknown[]).length, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { list };
  },
  head: () => ({
    meta: [
      { title: "All Artists — daegon charts" },
      { name: "description", content: "Every artist that has ever appeared on daegon charts." },
    ],
  }),
  component: AllArtistsPage,
});

function AllArtistsPage() {
  const { list } = Route.useLoaderData();
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="section-title">All Artists Entries</h1>
      <p className="text-sm text-muted-foreground mb-6">{list.length} artists tracked.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {list.map((a: { name: string; slug: string; entries: number }) => (
          <Link
            key={a.slug}
            to="/artist/$slug"
            params={{ slug: a.slug }}
            className="bg-[var(--muted)] hover:bg-[#222] rounded-lg p-3 flex items-center justify-between transition-colors"
          >
            <span className="font-medium truncate">{a.name}</span>
            <span className="text-xs text-muted-foreground ml-2">{a.entries}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
