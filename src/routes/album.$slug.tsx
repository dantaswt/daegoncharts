import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getAlbumDetails, getCertificationMeta } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { slugifyArtist } from "@/lib/charts-config";
import React from "react";

export const Route = createFileRoute("/album/$slug")({
  loader: async ({ params }) => {
    const album = await getAlbumDetails({ data: { slug: params.slug } });
    if (!album) throw notFound();
    return { album };
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
  const { album } = Route.useLoaderData();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query: `album:"${album.name}" artist:"${album.artist}"`, type: "album" } }).then((url) => {
      if (active) setImageUrl(url ?? null);
    });
    return () => { active = false; };
  }, [album.name, album.artist]);

  const chartLabels: Record<string, string> = {
    albums: "Top 100 Albums",
    topStreamingAlbums: "Top Streaming Albums",
    topAlbumSales: "Top Album Sales",
  };

  const chartRunsByChart: Record<string, typeof album.chartRuns> = {};
  for (const run of album.chartRuns) {
    (chartRunsByChart[run.chartId] ||= []).push(run);
  }

  const chartGrids = albumChartIds().map((chartId) => {
    const runs = chartRunsByChart[chartId] || [];
    const dateMap = new Map<string, { position: number; peak: number; weeks: number }>();
    for (const r of runs) {
      dateMap.set(r.date, { position: r.position, peak: r.peak, weeks: r.weeks });
    }
    const stats = album.chartStats[chartId];
    return { chartId, title: chartLabels[chartId] || chartId, dateMap, hasData: runs.length > 0, stats };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
      <Link to="/chart/$chartId" params={{ chartId: "albums" }} className="text-sm text-gray-500 hover:text-[var(--accent)] dark:text-gray-400 inline-flex items-center gap-2">
        <i className="fas fa-arrow-left" /> Back to Albums
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 bg-white dark:bg-[#111] rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-lg">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 shrink-0 mx-auto sm:mx-0">
          {imageUrl ? (
            <img src={imageUrl} alt={album.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400">
              <i className="fas fa-compact-disc" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400 mb-1">
            <Link to="/artist/$slug" params={{ slug: slugifyArtist(album.artist) }} className="hover:text-[var(--accent)] transition-colors">{album.artist}</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 break-words text-gray-900 dark:text-white">{album.name}</h1>
          {album.goatPosition && (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full px-4 py-1.5 text-sm font-semibold mb-4 border border-amber-500/20">
              <i className="fas fa-trophy" />
              GOAT Albums #{album.goatPosition} · {album.goatWeeks} total weeks
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatBox label="Peak" value={`#${album.peak}`} />
            <StatBox label="Weeks" value={String(album.weeks)} />
            <StatBox label="Total Units" value={album.totalUnits || "—"} />
            <StatBox label="Sales" value={album.totalSales || "—"} />
            <StatBox label="Streams" value={album.totalStreams || "—"} />
            {album.certificationLevel && <CertificationBox level={album.certificationLevel} />}
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Chart Runs</h2>
        {chartGrids.filter((g) => g.hasData).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No chart run data available.</p>
        ) : (
          <div className="space-y-6">
            {chartGrids.filter((g) => g.hasData).map((grid) => (
              <div key={grid.chartId} className="bg-white dark:bg-[#111] rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-lg space-y-4">
                <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{grid.title}</div>
                {grid.stats && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">Peak #{grid.stats.weeksAt1 > 0 ? "1" : grid.dateMap.size > 0 ? Math.min(...[...grid.dateMap.values()].map((v) => v.position)) : "—"}</span>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{grid.dateMap.size} weeks</span>
                    {grid.stats.weeksAt1 > 0 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{grid.stats.weeksAt1} #1's</span>}
                    {grid.stats.top5 > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{grid.stats.top5} top 5</span>}
                    {grid.stats.top10 > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{grid.stats.top10} top 10</span>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(() => {
                    const sorted = [...grid.dateMap.entries()].sort(([a], [b]) => a.localeCompare(b));
                    const items: React.ReactNode[] = [];
                    sorted.forEach(([date, { position }], i) => {
                      if (i > 0) {
                        const prevDate = new Date(sorted[i - 1][0] + "T00:00:00");
                        const currDate = new Date(date + "T00:00:00");
                        const gapWeeks = Math.round((currDate.getTime() - prevDate.getTime()) / (7 * 86400000)) - 1;
                        if (gapWeeks > 0) {
                          items.push(
                            <div key={`out-${date}`} className="flex items-center justify-center h-8 sm:h-9 px-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-800" title={`Out for ${gapWeeks} week${gapWeeks > 1 ? "s" : ""}`}>
                              OUT {gapWeeks}x
                            </div>
                          );
                        }
                      }
                      items.push(
                        <Link
                          key={date}
                          to="/chart/$chartId/$date"
                          params={{ chartId: grid.chartId, date }}
                          className="group relative"
                          title={`${grid.title} — ${formatDateShort(date)} — #${position}`}
                        >
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-110 ${
                            position <= 10 ? "bg-emerald-500 text-white" :
                            position <= 25 ? "bg-emerald-500/70 text-white" :
                            position <= 50 ? "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300" :
                            "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                          }`}>
                            {position}
                          </div>
                          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {formatDateShort(date)}
                          </div>
                        </Link>
                      );
                    });
                    return items;
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {album.yecEntries.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Year-End History</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {album.yecEntries.map((e) => (
              <Link
                key={`${e.year}-${e.chartId}`}
                to="/year-end/$chartId"
                params={{ chartId: e.chartId }}
                className="flex items-center gap-3 rounded-2xl bg-white dark:bg-[#111] p-3 border border-gray-200 dark:border-gray-800 hover:border-[var(--accent)]/50 transition-colors shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-lg font-extrabold text-[var(--accent)] shrink-0">
                  #{e.position}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{e.year}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{e.chartTitle}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Peak #{e.peak} · {e.weeks} weeks</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {album.statsRecords.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Records</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {album.statsRecords.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-[#111] p-3 border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <i className="fas fa-chart-bar text-[var(--accent)] text-sm" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{rec.category}</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{rec.value}</div>
                  {rec.details && <div className="text-xs text-gray-500 dark:text-gray-400">{rec.details}</div>}
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
    <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-3 text-center border border-gray-200 dark:border-gray-800">
      <div className="uppercase tracking-[0.2em] text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
    </div>
  );
}

function CertificationBox({ level }: { level: string }) {
  const meta = getCertificationMeta(level);
  if (!meta) return null;
  return (
    <div className={`rounded-2xl p-3 text-center border ${meta.bg} ${meta.border}`}>
      <div className="uppercase tracking-[0.2em] text-[10px] text-gray-500 dark:text-gray-400">Certification</div>
      <div className={`text-xl font-bold mt-1 uppercase ${meta.color}`}>
        {level}
      </div>
    </div>
  );
}

function formatDateShort(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function albumChartIds(): string[] {
  return ["albums", "topStreamingAlbums", "topAlbumSales"];
}
