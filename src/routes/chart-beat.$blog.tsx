import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getChartBeat, type ChartBeatPost } from "@/lib/charts.functions";
import { chartBeatConfig, slugifyArtist } from "@/lib/charts-config";
import { useState } from "react";

const blogs = Object.keys(chartBeatConfig) as (keyof typeof chartBeatConfig)[];

function dateParts(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? { year: "Other", month: "Other" } : { year: String(date.getFullYear()), month: date.toLocaleDateString("en-US", { month: "long" }) };
}

export const Route = createFileRoute("/chart-beat/$blog")({
  loader: async ({ params }) => {
    if (!(blogs as string[]).includes(params.blog)) throw notFound();
    return { data: await getChartBeat({ data: { blog: params.blog as keyof typeof chartBeatConfig } }), blog: params.blog };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.data.title ?? "Chart Beat"} — Chart Beat | daegon charts` }, { name: "description", content: "Chart news, analysis and weekly rankings." }] }),
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: ChartBeatIndex,
});

function ChartBeatIndex() {
  const { data, blog } = Route.useLoaderData();
  const posts = data.posts as ChartBeatPost[];
  const archive = posts.reduce<Record<string, Record<string, number>>>((years, post) => {
    const { year, month } = dateParts(post.publicationDate);
    years[year] ||= {}; years[year][month] = (years[year][month] ?? 0) + 1;
    return years;
  }, {});
  const artists = [...new Set(posts.map((post) => post.artist).filter((artist): artist is string => Boolean(artist)))].sort((a, b) => a.localeCompare(b));
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const visiblePosts = selectedArtist ? posts.filter((post) => post.artist === selectedArtist) : posts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <h1 className="section-title">Chart Beat</h1>
      <div className="flex gap-2 mb-8 flex-wrap">{blogs.map((item) => <Link key={item} to="/chart-beat/$blog" params={{ blog: item }} className={`btn-nav ${item === blog ? "active" : ""}`}>{chartBeatConfig[item].title}</Link>)}</div>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start bg-[var(--muted)] border border-[var(--border)] rounded-xl p-4 space-y-5">
          <div><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Archive</div>{Object.entries(archive).sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => <details key={year} className="group border-b border-[var(--border)] pb-2"><summary className="cursor-pointer list-none flex justify-between font-semibold hover:text-[var(--accent)]">{year}<i className="fas fa-chevron-down text-xs transition-transform group-open:rotate-180" /></summary><div className="mt-2 ml-2 space-y-1">{Object.entries(months).map(([month, count]) => <a key={month} href={`#${year}-${month}`} className="block text-sm text-muted-foreground hover:text-[var(--accent)]">{month} ({count})</a>)}</div></details>)}</div>
          <div><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Artists</div>{selectedArtist && <button onClick={() => setSelectedArtist(null)} className="mb-2 text-xs text-[var(--accent)] hover:underline">Clear filter</button>}<div className="flex flex-wrap gap-2">{artists.map((artist) => <button key={artist} onClick={() => setSelectedArtist(artist)} className={`rounded-full border px-2 py-1 text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] ${selectedArtist === artist ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)]"}`}>{artist}</button>)}</div></div>
        </aside>
        <main className="space-y-4">{visiblePosts.map((post) => { const period = dateParts(post.publicationDate); return <article key={post.slug} id={post.artist ? `artist-${slugifyArtist(post.artist)}` : undefined} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]"><div id={`${period.year}-${period.month}`} className="text-xs text-muted-foreground mb-2">{post.publicationDate}</div><Link to="/chart-beat/$blog/$slug" params={{ blog, slug: post.slug }} className="block"><h2 className="text-xl font-extrabold gold hover:underline">{post.title}</h2></Link>{post.artist && <Link to="/artist/$slug" params={{ slug: slugifyArtist(post.artist) }} className="mt-2 inline-block text-sm font-bold text-[var(--accent)] hover:underline">{post.artist}</Link>}<p className="mt-3 text-sm text-muted-foreground">{post.fullText.slice(0, 220)}{post.fullText.length > 220 ? "…" : ""}</p><Link to="/chart-beat/$blog/$slug" params={{ blog, slug: post.slug }} className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline">Read article →</Link></article>; })}</main>
      </div>
    </div>
  );
}
