import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getAlbumDetails } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useState } from "react";

export const Route = createFileRoute("/album/$slug")({
  loader: async ({ params }) => {
    const album = await getAlbumDetails({ data: { slug: params.slug } });
    if (!album) throw notFound();
    const imageUrl = await getSpotifyImage({ data: { query: `${album.name} ${album.artist}`, type: "album" } });
    return { album, imageUrl };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.album.name} — ${loaderData.album.artist} | daegon charts` : "Album | daegon charts";
    return {
      meta: [
        { title },
        { name: "description", content: `Album details for ${loaderData?.album.name} by ${loaderData?.album.artist}.` },
      ],
    };
  },
  component: AlbumPage,
});

function AlbumPage() {
  const { album, imageUrl } = Route.useLoaderData();

  const chartLabels: Record<string, string> = {
    albums: "Top 100 Albums",
    topStreamingAlbums: "Top Streaming Albums",
    topAlbumSales: "Top Album Sales",
  };

  // Group chart runs by chart
  const chartRunsByChart: Record<string, typeof album.chartRuns> = {};
  for (const run of album.chartRuns) {
    (chartRunsByChart[run.chartId] ||= []).push(run);
  }

  // Build chart run grids: for each chart, find all dates the album appeared
  // and build a grid showing position per week
  const chartGrids = albumChartIds().map((chartId) => {
    const runs = chartRunsByChart[chartId] || [];
    const dateMap = new Map<string, { position: number; peak: number; weeks: number }>();
    for (const r of runs) {
      dateMap.set(r.date, { position: r.position, peak: r.peak, weeks: r.weeks });
    }
    return { chartId, title: chartLabels[chartId] || chartId, dateMap, hasData: runs.length > 0 };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      {/* Back link */}
      <Link to="/chart/$chartId" params={{ chartId: "albums" }} className="text-sm text-muted-foreground hover:text-[var(--accent)] inline-flex items-center gap-2">
        <i className="fas fa-arrow-left" /> Back to Albums
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 bg-[var(--card)] rounded-3xl p-6 border border-[var(--border)] shadow-lg">
        {/* Cover */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-[var(--muted)] shrink-0 mx-auto sm:mx-0">
          {imageUrl ? (
            <img src={imageUrl} alt={album.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-muted-foreground">
              <i className="fas fa-compact-disc" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-1">{album.artist}</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 break-words">{album.name}</h1>

          {/* GOAT badge */}
          {album.goatPosition && (
            <div className="inline-flex items-center gap-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <i className="fas fa-trophy" />
              GOAT Albums #{album.goatPosition} · {album.goatWeeks} total weeks
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatBox label="Peak" value={`#${album.peak}`} />
            <StatBox label="Weeks" value={String(album.weeks)} />
            <StatBox label="Total Units" value={album.totalUnits || "—"} />
            <StatBox label="Sales" value={album.totalSales || "—"} />
            <StatBox label="Streams" value={album.totalStreams || "—"} />
          </div>

          {album.certification && (
            <div className="mt-3 text-sm text-muted-foreground">
              Certification: <span className="text-foreground font-semibold">{album.certification}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Run Grid */}
      <section className="space-y-6">
        <h2 className="text-xl font-extrabold">Chart Run</h2>
        {chartGrids.filter((g) => g.hasData).length === 0 ? (
          <p className="text-sm text-muted-foreground">No chart run data available.</p>
        ) : (
          <div className="space-y-6">
            {chartGrids.filter((g) => g.hasData).map((grid) => (
              <div key={grid.chartId} className="space-y-2">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{grid.title}</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...grid.dateMap.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, { position }]) => (
                      <Link
                        key={date}
                        to="/chart/$chartId/$date"
                        params={{ chartId: grid.chartId, date }}
                        className="group relative"
                        title={`${grid.title} — ${formatDateShort(date)} — #${position}`}
                      >
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110 ${
                          position <= 10 ? "bg-[var(--accent)] text-black" :
                          position <= 25 ? "bg-[var(--accent)]/60 text-black" :
                          position <= 50 ? "bg-[var(--accent)]/30 text-foreground" :
                          "bg-[var(--muted)] text-muted-foreground border border-[var(--border)]"
                        }`}>
                          {position}
                        </div>
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {formatDateShort(date)}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tracks on this album */}
      {album.songs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold">Tracks</h2>
          <div className="grid gap-2">
            {album.songs.map((song, i) => (
              <div key={`${song.name}-${song.artist}`} className="flex items-center gap-3 rounded-2xl bg-[var(--muted)] p-3 border border-[var(--border)]">
                <span className="text-sm text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{song.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Badge label={`#${song.peak}`} title="Peak" />
                  <Badge label={`${song.weeks}w`} title="Weeks" />
                  {song.points && <Badge label={song.points} title="Points" />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Year-End History */}
      {album.yecEntries.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold">Year-End History</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {album.yecEntries.map((e) => (
              <Link
                key={`${e.year}-${e.chartId}`}
                to="/year-end/$chartId"
                params={{ chartId: e.chartId }}
                className="flex items-center gap-3 rounded-2xl bg-[var(--muted)] p-3 border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-lg font-extrabold text-[var(--accent)] shrink-0">
                  #{e.position}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{e.year}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.chartTitle}</div>
                  <div className="text-xs text-muted-foreground">Peak #{e.peak} · {e.weeks} weeks</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stats Records */}
      {album.statsRecords.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold">Records</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {album.statsRecords.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-[var(--muted)] p-3 border border-[var(--border)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <i className="fas fa-chart-bar text-[var(--accent)] text-sm" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{rec.category}</div>
                  <div className="text-sm font-bold">{rec.value}</div>
                  {rec.details && <div className="text-xs text-muted-foreground">{rec.details}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--muted)] p-3 text-center">
      <div className="uppercase tracking-[0.2em] text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}

function Badge({ label, title }: { label: string; title?: string }) {
  return (
    <span className="rounded-full bg-[var(--muted)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title={title}>
      {label}
    </span>
  );
}

function formatDateShort(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function albumChartIds(): string[] {
  return ["albums", "topStreamingAlbums", "topAlbumSales"];
}
