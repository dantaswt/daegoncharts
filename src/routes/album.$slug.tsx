import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getAlbumDetails } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { ChartRow } from "@/components/chart-row";

export const Route = createFileRoute("/album/$slug")({
  loader: async ({ params }) => {
    const album = await getAlbumDetails({ data: { slug: params.slug } });
    if (!album) throw notFound();
    const imageUrl = await getSpotifyImage({ data: { query: `${album.name} ${album.artist}`, type: "album" } });
    return { album, imageUrl };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.album.name} — Album | daegon charts` : "Album | daegon charts";
    return {
      meta: [
        { title },
        { name: "description", content: `Album page for ${loaderData?.album.name} by ${loaderData?.album.artist}.` },
      ],
    };
  },
  component: AlbumPage,
});

function AlbumPage() {
  const { album, imageUrl } = Route.useLoaderData();

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link to="/chart/$chartId" params={{ chartId: "albums" }} className="text-sm text-muted-foreground hover:text-[var(--accent)] inline-flex items-center gap-2">
          <i className="fas fa-arrow-left" /> Back to Albums
        </Link>
        <h1 className="section-title">{album.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)] shadow-lg">
        <div className="rounded-3xl overflow-hidden bg-[var(--muted)] h-72">
          {imageUrl ? (
            <img src={imageUrl} alt={album.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">
              <i className="fas fa-compact-disc" />
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-1">{album.artist}</div>
            <div className="text-4xl font-extrabold">{album.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl bg-[var(--muted)] p-4">
              <div className="uppercase tracking-[0.2em] text-[10px]">Peak</div>
              <div className="text-2xl font-bold text-foreground">#{album.peak}</div>
            </div>
            <div className="rounded-2xl bg-[var(--muted)] p-4">
              <div className="uppercase tracking-[0.2em] text-[10px]">Weeks</div>
              <div className="text-2xl font-bold text-foreground">{album.weeks}</div>
            </div>
            <div className="rounded-2xl bg-[var(--muted)] p-4">
              <div className="uppercase tracking-[0.2em] text-[10px]">Total units</div>
              <div className="text-2xl font-bold text-foreground">{album.totalUnits ?? "—"}</div>
            </div>
            <div className="rounded-2xl bg-[var(--muted)] p-4">
              <div className="uppercase tracking-[0.2em] text-[10px]">Certification</div>
              <div className="text-2xl font-bold text-foreground">{album.certification ? `🎖️ ${album.certification}` : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title">Chart runs</h2>
          <span className="text-sm text-muted-foreground">{album.chartRuns.length} entries</span>
        </div>
        <div className="grid gap-3">
          {album.chartRuns.map((run) => (
            <div key={`${run.chartId}-${run.date}-${run.position}`} className="rounded-3xl bg-[var(--muted)] p-4 border border-[var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{run.chartTitle}</span>
                <span>{new Date(run.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm font-semibold text-white">This week #{run.position}</div>
                <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm text-white">Peak #{run.peak}</div>
                <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm text-white">{run.weeks} weeks</div>
                {run.points && <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm text-white">Points {run.points}</div>}
                {run.totalUnits && <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm text-white">Total {run.totalUnits}</div>}
                {run.certification && <div className="rounded-2xl bg-[var(--muted)] px-3 py-2 text-sm text-white">Cert {run.certification}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Songs on this album</h2>
        {album.songs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No song data available for this album yet.</p>
        ) : (
          <div className="space-y-3">
            {album.songs.map((song) => (
              <div key={`${song.name}-${song.artist}`} className="rounded-3xl bg-[var(--muted)] p-4 border border-[var(--border)]">
                <div className="font-semibold">{song.name}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">{song.artist}</div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <div className="rounded-full bg-[var(--muted)] px-3 py-1 text-white">Peak #{song.peak}</div>
                  <div className="rounded-full bg-[var(--muted)] px-3 py-1 text-white">{song.weeks} weeks</div>
                  {song.points && <div className="rounded-full bg-[var(--muted)] px-3 py-1 text-white">Points {song.points}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
