import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndGenerated, getYearEndNewArtists, type YECEntry } from "@/lib/charts.functions";
import { chartsConfig, yearEndChartIds, slugifyArtist } from "@/lib/charts-config";
import { ChartImage } from "@/components/chart-image";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";
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

function formatMetric(v: number, metricKey: string): string {
  if (v <= 0) return "-";
  if (metricKey === "streams") {
    if (v >= 1_000_000) {
      const val = v / 1_000_000;
      return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
    }
    if (v >= 1_000) {
      const val = v / 1_000;
      return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    return `${v}`;
  }
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

  const years = data.years;
  const yearIdx = years.indexOf(selectedYear);
  const prevYear = yearIdx > 0 ? years[yearIdx - 1] : null;
  const nextYear = yearIdx >= 0 && yearIdx < years.length - 1 ? years[yearIdx + 1] : null;

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Fixed chart type nav sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-wrap md:flex-col gap-2 justify-center md:justify-start mb-6">
          {yearEndChartIds.map((id) => {
            const c = chartsConfig[id];
            return (
              <Link
                key={id}
                to="/year-end/$chartId"
                params={{ chartId: id }}
                className={`btn-nav ${id === chartId ? "active" : ""}`}
              >
                <i className={`fas ${c.icon} mr-1`} />
                {c.title}
              </Link>
            );
          })}
        </div>
        <Link to="/year-end" className="sidebar-section block hover:border-[var(--accent)] transition-all">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Year-End</div>
        </Link>
      </aside>

      {/* Content */}
      <main>
        {/* Header */}
        <div className="mb-2 text-center md:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--foreground)] inline-flex items-center gap-2 justify-center md:justify-start">
                <i className={`fas ${cfg?.icon ?? "fa-calendar"}`} /> {cfg?.title ?? "Year-End"} {selectedYear}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                {entries.length} items ranked by {metricLabel.toLowerCase()}
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <ChartImage
                entries={entries.map((e) => ({ position: e.position, diff: "", name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1 }))}
                chartTitle={cfg?.title ?? "Year-End"}
                chartId={chartId}
                date={`${selectedYear}-12-31`}
                kind={data.kind}
              />
            </div>
          </div>
        </div>

        {/* Year navigator */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-4">
          {prevYear ? (
            <button onClick={() => setSelectedYear(prevYear)} className="btn-gold">
              <i className="fas fa-chevron-left" /> Prev
            </button>
          ) : (
            <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
          )}
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Year</div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--foreground)] px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {nextYear ? (
            <button onClick={() => setSelectedYear(nextYear)} className="btn-gold">
              Next <i className="fas fa-chevron-right" />
            </button>
          ) : (
            <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
          )}
        </div>

        {/* Entries */}
        {entries.length > 0 ? (
          <div className="space-y-2 max-w-4xl mx-auto">
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
                  <div className={`font-bold group-hover:text-[var(--accent)] transition-colors break-words ${isAlbum ? "text-base" : "text-sm"}`}>
                    {e.kind === "artist" ? (
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">{e.name}</Link>
                    ) : (
                      <span>{stripFeatFromTitle(e.name)}</span>
                    )}
                  </div>
                  {e.kind !== "artist" && (
                    <div className="text-xs text-muted-foreground break-words">
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.artist}</Link>
                      <TrackArtists song={e.name} artist={e.artist} className="text-xs text-muted-foreground" />
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
                    <div className="font-black text-[var(--foreground)] text-sm">{formatMetric(e.totalUnits, metricKey)}</div>
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

        {/* Year navigator bottom */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {prevYear ? (
              <button onClick={() => setSelectedYear(prevYear)} className="btn-gold">
                <i className="fas fa-chevron-left" /> Prev
              </button>
            ) : (
              <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
            )}
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Year</div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--foreground)] px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {nextYear ? (
              <button onClick={() => setSelectedYear(nextYear)} className="btn-gold">
                Next <i className="fas fa-chevron-right" />
              </button>
            ) : (
              <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
