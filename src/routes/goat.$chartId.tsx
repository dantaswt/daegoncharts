import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getGoatGenerated, type GOATEntry } from "@/lib/charts.functions";
import { chartsConfig, goatChartIds, slugifyArtist } from "@/lib/charts-config";
import { ChartImage } from "@/components/chart-image";
import { SpotifyItemImage } from "@/components/spotify-item-image";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";

export const Route = createFileRoute("/goat/$chartId")({
  loader: async ({ params }) => {
    if (!goatChartIds.includes(params.chartId)) throw notFound();
    const data = await getGoatGenerated({ data: { chartId: params.chartId } });
    return { data, chartId: params.chartId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId]?.title : "Greatest of All Time";
    return { meta: [{ title: `${t} | daegon charts` }, { name: "description", content: `${t} — greatest of all time.` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: GoatPage,
});

function formatMetric(n: number, useStreamFormat: boolean): string {
  if (n <= 0) return "0";
  if (useStreamFormat) {
    if (n >= 1_000_000) {
      const val = n / 1_000_000;
      return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
    }
    if (n >= 1_000) {
      const val = n / 1_000;
      return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
    }
    return `${n}`;
  }
  return n.toLocaleString("en-US");
}

function GoatPage() {
  const { data, chartId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  const isAlbum = data.kind === "album";
  const isRadio = chartId === "goatRadio";
  const [sortBy, setSortBy] = useState<"weeks" | "units" | "streams" | "sales" | "audience">("weeks");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const sorted = useMemo(() => {
    let list = [...data.entries];
    if (sortBy === "units") list.sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak);
    else if (sortBy === "streams") list.sort((a, b) => b.totalStreams - a.totalStreams || a.peak - b.peak);
    else if (sortBy === "sales") list.sort((a, b) => b.totalSales - a.totalSales || a.peak - b.peak);
    else if (sortBy === "audience") list.sort((a, b) => b.totalAudience - a.totalAudience || a.peak - b.peak);
    else list.sort((a, b) => b.weeks - a.weeks || a.peak - b.peak);
    return list.map((e, i) => ({ ...e, position: i + 1 }));
  }, [data.entries, sortBy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((e) => e.name.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q));
  }, [sorted, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const top3 = sorted.slice(0, 3);
  const showWeeksCol = sortBy !== "weeks";
  const imageSize = isAlbum ? 56 : 40;

  const sortOptions = [
    { key: "weeks" as const, label: "Weeks on Chart", icon: "fa-calendar-week" },
    { key: "units" as const, label: "Total Units", icon: "fa-chart-bar" },
    { key: "streams" as const, label: "Total Streams", icon: "fa-headphones" },
    { key: "sales" as const, label: "Total Sales", icon: "fa-shopping-cart" },
    ...(isRadio ? [{ key: "audience" as const, label: "Total Audience", icon: "fa-broadcast-tower" }] : []),
  ];

  const metricLabel = sortBy === "units" ? "Units" : sortBy === "streams" ? "Streams" : sortBy === "sales" ? "Sales" : sortBy === "audience" ? "Audience" : "Weeks";
  const metricIcon = sortBy === "units" ? "fa-chart-bar" : sortBy === "streams" ? "fa-headphones" : sortBy === "sales" ? "fa-shopping-cart" : sortBy === "audience" ? "fa-broadcast-tower" : "fa-calendar-week";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 lg:h-fit">
          <aside className="space-y-4">
            <div className="sidebar-section">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Sort By</div>
              <div className="space-y-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortBy(opt.key); setCurrentPage(1); }}
                    className={`sidebar-link w-full text-left ${sortBy === opt.key ? "active" : ""}`}
                  >
                    <i className={`fas ${opt.icon} text-xs text-muted-foreground w-4`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Charts</div>
              <div className="space-y-1">
                {goatChartIds.map((id) => {
                  const c = chartsConfig[id];
                  return (
                    <Link
                      key={id}
                      to="/goat/$chartId"
                      params={{ chartId: id }}
                      className={`sidebar-link ${id === chartId ? "active" : ""}`}
                    >
                      <i className={`fas ${c.icon} text-xs text-muted-foreground w-4`} />
                      {c.title}
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link to="/goat" className="sidebar-section block hover:border-[var(--accent)] transition-all">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-arrow-left mr-2" />All Greatest of All Time</div>
            </Link>
          </aside>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="relative text-center py-8 md:py-10 mb-6 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <span className="text-[4rem] md:text-[6rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">Greatest of All Time</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black gold tracking-tight relative z-10">
              <i className={`fas ${cfg?.icon ?? "fa-trophy"} mr-2`} />
              {cfg?.title ?? "Greatest of All Time"}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 relative z-10">
              {sorted.length} greatest of all time
            </p>
            <div className="flex justify-center mt-4 relative z-10">
              <ChartImage
                entries={sorted.slice(0, 50).map((e) => ({ position: e.position, diff: "", name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1 }))}
                chartTitle={cfg?.title ?? "Greatest of All Time"}
                chartId={chartId}
                date="2025-12-31"
                kind={data.kind}
              />
            </div>
          </div>

          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
              {[1, 0, 2].map((idx) => {
                const item = top3[idx];
                const isFirst = idx === 0;
                return (
                  <motion.div
                    key={`${item.name}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx === 0 ? 0.2 : idx === 1 ? 0 : 0.4 }}
                    className={`relative text-center p-4 sm:p-6 rounded-2xl border overflow-hidden ${isFirst ? "border-[var(--accent)] bg-[rgba(0,230,118,0.03)]" : "border-[var(--border)] bg-[var(--card)]"}`}
                  >
                    {isFirst && <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />}
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl ${isFirst ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-white"}`}>
                      {idx + 1}
                    </div>
                    <div className="font-bold text-sm sm:text-base break-words">{stripFeatFromTitle(item.name)}</div>
                    {data.kind !== "artist" && (
                      <div className="text-xs text-muted-foreground break-words">
                        {item.artist}
                        <TrackArtists song={item.name} artist={item.artist} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-sm font-black gold">
                      <i className={`fas ${metricIcon} text-xs`} />
                      {sortBy === "units" ? `${formatMetric(item.totalUnits, false)} units` : sortBy === "streams" ? `${formatMetric(item.totalStreams, true)} streams` : sortBy === "sales" ? `${formatMetric(item.totalSales, false)} sales` : sortBy === "audience" ? `${formatMetric(item.totalAudience, false)} audience` : `${item.weeks} weeks`}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-6">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors pr-8"
            />
            {search && (
              <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--accent)]">
                <i className="fas fa-times text-xs" />
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="text-xs text-muted-foreground mb-3">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} found
            {search && ` matching "${search}"`}
          </div>

          {/* List */}
          <section className="space-y-2">
            {displayed.length > 0 ? (
              displayed.map((e, i) => (
                <motion.div
                  key={`${e.name}-${e.artist}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.3) }}
                  className={`flex items-center gap-3 sm:gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:shadow-md transition-all group ${isAlbum ? "p-3 sm:p-4" : "p-3 sm:p-4"}`}
                >
                  <div className={`flex items-center justify-center font-black text-sm shrink-0 ${isAlbum ? "w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-base" : "w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-sm"} ${e.position <= 3 ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-white"}`}>
                    {e.position}
                  </div>
                  <SpotifyItemImage name={e.name} artist={e.artist} kind={data.kind} size={imageSize} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-bold group-hover:text-[var(--accent)] transition-colors break-words ${isAlbum ? "text-base" : "text-sm"}`}>
                      {data.kind === "artist" ? (
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">{e.name}</Link>
                      ) : (
                        stripFeatFromTitle(e.name)
                      )}
                    </div>
                    {data.kind !== "artist" && (
                      <div className="text-xs text-muted-foreground break-words">
                        <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">{e.artist}</Link>
                        <TrackArtists song={e.name} artist={e.artist} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground shrink-0">
                    <div className="text-center hidden sm:block">
                      <div className="text-[9px] uppercase font-bold tracking-wider">Peak</div>
                      <div className="font-black gold text-sm">#{e.peak}</div>
                    </div>
                    {showWeeksCol && (
                      <div className="text-center">
                        <div className="text-[9px] uppercase font-bold tracking-wider">Weeks</div>
                        <div className="font-black text-[var(--foreground)] text-sm">{e.weeks}</div>
                      </div>
                    )}
                    {sortBy !== "weeks" && (
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-[var(--accent)]">
                          <i className={`fas ${metricIcon} text-[9px]`} />
                          <span className="text-[9px] uppercase font-bold tracking-wider">{metricLabel}</span>
                        </div>
                        <div className="font-black text-[var(--foreground)] text-sm">
                          {sortBy === "units" ? formatMetric(e.totalUnits, false) : sortBy === "streams" ? formatMetric(e.totalStreams, true) : sortBy === "sales" ? formatMetric(e.totalSales, false) : sortBy === "audience" ? formatMetric(e.totalAudience, false) : e.weeks}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">No results found.</div>
            )}
          </section>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-30 transition-colors"
              >
                <i className="fas fa-chevron-left" />
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-30 transition-colors"
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
