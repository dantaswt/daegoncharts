import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndGenerated, getYearEndNewArtists, type YECEntry } from "@/lib/charts.functions";
import { chartsConfig, yearEndChartIds, slugifyArtist } from "@/lib/charts-config";
import { ChartImage } from "@/components/chart-image";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { useState } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/year-end/$chartId")({
  loader: async ({ params }) => {
    const cfg = chartsConfig[params.chartId];
    if (!cfg || cfg.group !== "yearEnd") throw notFound();
    const weeklyId = params.chartId.replace("yearEnd", "").replace(/^./, (c) => c.toLowerCase());
    const weeklyMap: Record<string, string> = {
      songs: "songs", artists: "artists", albums: "albums", radio: "radioSongs",
      streamingSongs: "streamingSongs", topStreamingAlbums: "topStreamingAlbums",
      topAlbumSales: "topAlbumSales", digitalSongsSales: "digitalSongsSales",
    };
    const mappedId = weeklyMap[weeklyId] ?? weeklyId;
    if (params.chartId === "yearEndNewArtists") {
      const data = await getYearEndNewArtists();
      return { data, chartId: params.chartId, mappedId: "artists" };
    }
    const data = await getYearEndGenerated({ data: { chartId: mappedId } });
    return { data, chartId: params.chartId, mappedId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId]?.title : "Year-End";
    return { meta: [{ title: `${t} | daegon charts` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: YearEndChartPage,
});

function formatMetric(v: number): string {
  if (v <= 0) return "-";
  return v.toLocaleString("en-US");
}

function YearEndChartPage() {
  const { data, chartId, mappedId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  const [selectedYear, setSelectedYear] = useState<string>(data.years[0] || "");
  const entries = selectedYear ? data.entriesByYear[selectedYear] ?? [] : [];
  const isAlbum = data.kind === "album";
  const imageSize = isAlbum ? 56 : 40;

  const metricKey = mappedId === "songs" ? "points" : mappedId === "streamingSongs" || mappedId === "topStreamingAlbums" ? "streams" : mappedId === "radioSongs" ? "audience" : mappedId === "topAlbumSales" || mappedId === "digitalSongsSales" ? "sales" : "units";
  const metricLabel = metricKey === "points" ? "Points" : metricKey === "streams" ? "Streams" : metricKey === "audience" ? "Audience" : metricKey === "sales" ? "Sales" : "Units";
  const metricIcon = metricKey === "points" ? "fa-star" : metricKey === "streams" ? "fa-headphones" : metricKey === "audience" ? "fa-broadcast-tower" : metricKey === "sales" ? "fa-shopping-cart" : "fa-chart-bar";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 lg:h-fit">
          <aside className="space-y-4">
            <div className="sidebar-section">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Year</div>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {data.years.map((y: string) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`sidebar-link w-full text-left ${selectedYear === y ? "active" : ""}`}
                  >
                    <i className="fas fa-calendar text-xs text-muted-foreground w-4" />
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <Link to="/year-end" className="sidebar-section block hover:border-[var(--accent)] transition-all">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Year-End</div>
            </Link>
          </aside>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="relative text-center py-8 md:py-10 mb-6 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-[5rem] md:text-[8rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">YEC</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black gold tracking-tight relative z-10">
              <i className={`fas ${cfg?.icon ?? "fa-calendar"} mr-2`} />
              {cfg?.title ?? "Year-End"} {selectedYear}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 relative z-10">
              {entries.length} items ranked by {metricLabel.toLowerCase()}
            </p>
            <div className="flex justify-center mt-4 relative z-10">
              <ChartImage
                entries={entries.map((e) => ({ position: e.position, diff: "", name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1 }))}
                chartTitle={cfg?.title ?? "Year-End"}
                chartId={chartId}
                date={`${selectedYear}-12-31`}
                kind={data.kind}
              />
            </div>
          </div>

          {/* Entries */}
          {entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map((e: YECEntry) => (
                <motion.div
                  key={`${e.position}-${e.name}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(e.position * 0.01, 0.3) }}
                  className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:shadow-md transition-all group"
                >
                  <div className={`flex items-center justify-center font-black shrink-0 ${isAlbum ? "w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-base" : "w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-sm"} ${e.position <= 3 ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-white"}`}>
                    {e.position}
                  </div>
                  <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={imageSize} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-bold group-hover:text-[var(--accent)] transition-colors truncate ${isAlbum ? "text-base" : "text-sm"}`}>
                      {e.kind === "artist" ? (
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">{e.name}</Link>
                      ) : (
                        e.name
                      )}
                    </div>
                    {e.kind !== "artist" && (
                      <div className="text-xs text-muted-foreground truncate">
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.artist}</Link>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground shrink-0">
                    <div className="text-center hidden sm:block">
                      <div className="text-[9px] uppercase font-bold tracking-wider">Peak</div>
                      <div className="font-black gold text-sm">#{e.peak}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] uppercase font-bold tracking-wider">Weeks</div>
                      <div className="font-black text-[var(--foreground)] text-sm">{e.weeks}</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-[var(--accent)]">
                        <i className={`fas ${metricIcon} text-[9px]`} />
                        <span className="text-[9px] uppercase font-bold tracking-wider">{metricLabel}</span>
                      </div>
                      <div className="font-black text-[var(--foreground)] text-sm">{formatMetric(e.totalUnits)}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {selectedYear ? "No data for this year." : "Select a year."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
