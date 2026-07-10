import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getChartBeat, type ChartBeatPost } from "@/lib/charts.functions";
import { chartBeatConfig } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useState } from "react";

const blogs = Object.keys(chartBeatConfig) as (keyof typeof chartBeatConfig)[];

export const Route = createFileRoute("/chart-beat/$blog")({
  loader: async ({ params }) => {
    if (!(blogs as string[]).includes(params.blog)) throw notFound();
    const data = await getChartBeat({ data: { blog: params.blog as keyof typeof chartBeatConfig } });
    return { data, blog: params.blog };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.data.title ?? "Chart Beat";
    return {
      meta: [
        { title: `${t} — Chart Beat | daegon charts` },
        { name: "description", content: `News and commentary about ${t}.` },
      ],
    };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: ChartBeatPage,
});

function ChartBeatCard({ post, blog }: { post: ChartBeatPost; blog: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(post.image ?? null);

  useEffect(() => {
    let active = true;
    if (post.image) return;
    if (!post.artist) return;
    getSpotifyImage({ data: { query: post.artist, type: "artist" } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => {
      active = false;
    };
  }, [post.artist, post.image]);

  const preview = post.fullText.length > 200 ? post.fullText.slice(0, 200) + "…" : post.fullText;

  return (
    <Link
      to="/chart-beat/$blog/$postId"
      params={{ blog, postId: post.slug }}
      className="bg-[var(--muted)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-[var(--accent)] transition-colors block"
    >
      {imageUrl ? (
        <img src={imageUrl} alt={post.title} className="w-full h-52 object-cover" />
      ) : null}
      <div className="p-5">
        <div className="text-xs text-muted-foreground mb-2">{post.publicationDate}</div>
        <h2 className="font-bold text-lg mb-2 gold">{post.title}</h2>
        <p className="text-sm text-muted-foreground">{preview}</p>
        <span className="text-xs mt-3 inline-block text-[var(--accent)]">Read more →</span>
      </div>
    </Link>
  );
}

function ChartBeatPage() {
  const { data, blog } = Route.useLoaderData();
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="section-title">Chart Beat</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {blogs.map((b) => (
          <Link
            key={b}
            to="/chart-beat/$blog"
            params={{ blog: b }}
            className={`btn-nav ${b === blog ? "active" : ""}`}
          >
            {chartBeatConfig[b].title}
          </Link>
        ))}
      </div>
      <div className="space-y-4">
        {data.posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
        {data.posts.map((p: ChartBeatPost, i: number) => (
          <ChartBeatCard key={i} post={p} blog={blog} />
        ))}
      </div>
    </div>
  );
}
