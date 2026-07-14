import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getAllArtistStats, getChartBeat, getWeeklyChart, type ChartBeatPost } from "@/lib/charts.functions";
import { chartBeatConfig, slugifyArtist } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useMemo, useState } from "react";

const blogs = Object.keys(chartBeatConfig) as (keyof typeof chartBeatConfig)[];
const chartForBlog: Record<keyof typeof chartBeatConfig, string> = { hot100: "songs", artists: "artists", top100Albums: "albums" };

function dateValue(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function nearestChartDate(value: string, dates: string[]) {
  const target = dateValue(value);
  if (target === null || !dates.length) return dates[dates.length - 1] ?? null;
  return dates.reduce((closest, date) => Math.abs(new Date(`${date}T00:00:00`).getTime() - target) < Math.abs(new Date(`${closest}T00:00:00`).getTime() - target) ? date : closest);
}

export const Route = createFileRoute("/chart-beat/$blog")({
  loader: async ({ params }) => {
    if (!(blogs as string[]).includes(params.blog)) throw notFound();
    const blog = params.blog as keyof typeof chartBeatConfig;
    const chartId = chartForBlog[blog];
    const [data, chart, stats] = await Promise.all([getChartBeat({ data: { blog } }), getWeeklyChart({ data: { chartId } }), getAllArtistStats()]);
    return {
      blog,
      chartId,
      artists: Object.values(stats).map((artist) => artist.name),
      data: {
        ...data,
        posts: data.posts.map((post) => ({ ...post, relatedDate: nearestChartDate(post.publicationDate, chart.dates) })),
      },
    };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.data.title ?? "Chart Beat"} — Chart Beat | daegon charts` }, { name: "description", content: "News and commentary connected to the weekly charts." }] }),
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: ChartBeatPage,
});

type ArticlePost = ChartBeatPost & { relatedDate: string | null };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ArticleText({ text, artists }: { text: string; artists: string[] }) {
  const mentionedArtists = artists.filter((artist) => text.toLocaleLowerCase().includes(artist.toLocaleLowerCase())).sort((a, b) => b.length - a.length);
  const parts = mentionedArtists.length ? [...mentionedArtists.map(escapeRegex), "#?\\d+(?:[.,]\\d+)?(?:[KMBkmb])?"].join("|") : "#?\\d+(?:[.,]\\d+)?(?:[KMBkmb])?";
  const matcher = new RegExp(`(${parts})`, "gi");
  const artistByName = new Map(mentionedArtists.map((artist) => [artist.toLocaleLowerCase(), artist]));

  return <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base text-justify">{text.split(matcher).map((part, index) => {
    const artist = artistByName.get(part.toLocaleLowerCase());
    if (artist) return <Link key={index} to="/artist/$slug" params={{ slug: slugifyArtist(artist) }} className="font-bold text-[var(--accent)] hover:underline">{part}</Link>;
    if (/^#?\d+(?:[.,]\d+)?(?:[KMBkmb])?$/.test(part)) return <em key={index}>{part}</em>;
    return part;
  })}</div>;
}

function ArticleImage({ post }: { post: ArticlePost }) {
  const [imageUrl, setImageUrl] = useState<string | null>(post.image ?? null);
  useEffect(() => {
    if (post.image || !post.artist) return;
    let active = true;
    getSpotifyImage({ data: { query: `artist:"${post.artist}"`, type: "artist" } }).then((url) => { if (active) setImageUrl(url); });
    return () => { active = false; };
  }, [post.artist, post.image]);
  return imageUrl ? <img src={imageUrl} alt="" className="w-full h-52 md:h-72 object-cover rounded-xl border border-[var(--border)] mb-5" /> : null;
}

function ChartBeatPage() {
  const { data, blog, chartId, artists } = Route.useLoaderData();
  const posts = data.posts as ArticlePost[];
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const periods = useMemo(() => {
    const groups = new Map<string, ArticlePost[]>();
    posts.forEach((post) => {
      const timestamp = dateValue(post.publicationDate);
      const date = timestamp ? new Date(timestamp) : null;
      const label = date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "Other";
      groups.set(label, [...(groups.get(label) ?? []), post]);
    });
    return [...groups.entries()];
  }, [posts]);
  const visiblePosts = activeMonth ? posts.filter((post) => periods.find(([label, items]) => label === activeMonth)?.[1].includes(post)) : posts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <h1 className="section-title">Chart Beat</h1>
      <div className="flex gap-2 mb-8 flex-wrap">{blogs.map((item) => <Link key={item} to="/chart-beat/$blog" params={{ blog: item }} className={`btn-nav ${item === blog ? "active" : ""}`}>{chartBeatConfig[item].title}</Link>)}</div>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start bg-[var(--muted)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Archive</div>
          <button onClick={() => setActiveMonth(null)} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${!activeMonth ? "text-[var(--accent)] font-bold bg-black/20" : "hover:text-[var(--accent)]"}`}>All articles</button>
          {periods.map(([label, monthPosts]) => <button key={label} onClick={() => setActiveMonth(label)} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${activeMonth === label ? "text-[var(--accent)] font-bold bg-black/20" : "hover:text-[var(--accent)]"}`}>{label} <span className="text-xs text-muted-foreground">({monthPosts.length})</span></button>)}
        </aside>
        <main className="space-y-6">
          {visiblePosts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
          {visiblePosts.map((post) => <article key={post.slug} className="bg-[var(--muted)] border border-[var(--border)] rounded-xl p-5 md:p-7">
            <ArticleImage post={post} />
            <div className="text-xs text-muted-foreground mb-2">{post.publicationDate}</div>
            <h2 className="text-xl md:text-2xl font-extrabold gold mb-3">{post.title}</h2>
            {post.artist && <Link to="/artist/$slug" params={{ slug: slugifyArtist(post.artist) }} className="inline-flex items-center gap-1 mb-5 text-sm font-bold text-[var(--accent)] hover:underline"><i className="fas fa-user" /> {post.artist}</Link>}
            <ArticleText text={post.fullText} artists={artists} />
            {post.relatedDate && <Link to="/chart/$chartId/$date" params={{ chartId, date: post.relatedDate }} className="inline-flex items-center gap-2 mt-7 text-sm font-semibold text-[var(--accent)] hover:underline"><i className="fas fa-chart-bar" /> View the related weekly chart</Link>}
          </article>)}
        </main>
      </div>
    </div>
  );
}
