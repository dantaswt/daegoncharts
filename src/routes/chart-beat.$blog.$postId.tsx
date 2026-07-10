import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getChartBeat, type ChartBeatPost } from "@/lib/charts.functions";
import { chartBeatConfig } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useState } from "react";

const blogs = Object.keys(chartBeatConfig) as (keyof typeof chartBeatConfig)[];

export const Route = createFileRoute("/chart-beat/$blog/$postId")({
  loader: async ({ params }) => {
    if (!(blogs as string[]).includes(params.blog)) throw notFound();
    const data = await getChartBeat({ data: { blog: params.blog as keyof typeof chartBeatConfig } });
    const post = data.posts.find((p) => p.slug === params.postId || p.slug === decodeURIComponent(params.postId));
    if (!post) throw notFound();
    return { post, blog: params.blog, blogTitle: data.title };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.post.title ?? "Post";
    return {
      meta: [
        { title: `${title} — Chart Beat | daegon charts` },
        { name: "description", content: loaderData?.post.fullText.slice(0, 160) ?? "" },
      ],
    };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Post not found</div>,
  component: ChartBeatPostPage,
});

function ChartBeatPostPage() {
  const { post, blog, blogTitle } = Route.useLoaderData();
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <Link
        to="/chart-beat/$blog"
        params={{ blog }}
        className="text-sm text-muted-foreground hover:text-[var(--accent)] inline-flex items-center gap-1 mb-6"
      >
        <i className="fas fa-arrow-left" /> Back to {blogTitle}
      </Link>

      {imageUrl && (
        <img
          src={imageUrl}
          alt={post.title}
          className="w-full max-h-[400px] object-cover rounded-lg mb-6"
        />
      )}

      <article>
        <div className="text-xs text-muted-foreground mb-2">{post.publicationDate}</div>
        <h1 className="text-2xl md:text-3xl font-extrabold gold mb-4">{post.title}</h1>
        {post.artist && (
          <div className="text-sm text-muted-foreground mb-4">
            <i className="fas fa-user mr-1" /> {post.artist}
          </div>
        )}
        <div className="prose prose-invert max-w-none text-sm md:text-base whitespace-pre-wrap leading-relaxed">
          {post.fullText}
        </div>
        {post.chartLink && (
          <a
            href={post.chartLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-6 text-sm text-[var(--accent)] hover:underline"
          >
            <i className="fas fa-chart-bar" /> View related chart →
          </a>
        )}
      </article>
    </div>
  );
}
