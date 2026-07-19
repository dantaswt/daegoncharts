import { createFileRoute } from "@tanstack/react-router";
import { getStats2, type Stats2Record, type Stats2Category } from "@/lib/charts.functions";
import { chartsConfig } from "@/lib/charts-config";
import { getSpotifyImage } from "@/lib/spotify.functions";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/stats/")({
  loader: async () => await getStats2(),
  head: () => ({
    meta: [
      { title: "Stats | daegon charts" },
      { name: "description", content: "Comprehensive chart statistics, records and milestones." },
    ],
  }),
  component: Stats2Page,
});

/* ── Image component ── */
function ItemImage({ name, artist, kind }: { name: string; artist: string; kind: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const query = kind === "album" ? `album:"${name}" artist:"${artist}"` : kind === "artist" ? `artist:"${name}"` : `artist:"${artist}" track:"${name}"`;
  const type = kind === "album" ? "album" : "artist";
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [query, type]);
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center shrink-0">
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : <i className="fas fa-music text-muted-foreground" />}
    </div>
  );
}

/* ── Record Row ── */
function RecordRow({ record, rank, kind, chartId }: { record: Stats2Record; rank: number; kind: string; chartId: string }) {
  const cfg = chartsConfig[chartId];
  const actualKind = cfg?.kind ?? kind;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.02, 0.4) }}
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:shadow-md transition-all group"
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${rank <= 3 ? "bg-[var(--accent)] text-black" : "bg-[var(--muted)] text-[var(--foreground)]"}`}>
        {rank}
      </div>
      <ItemImage name={record.name} artist={record.artist} kind={actualKind} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate group-hover:text-[var(--accent)] transition-colors">{record.name}</div>
        <div className="text-xs text-muted-foreground truncate">{record.artist}</div>
        {record.details && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{record.details}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-black text-base sm:text-lg gold">{record.valueLabel}</div>
        {record.peak && record.peak > 0 && (
          <div className="text-[10px] text-muted-foreground">Peak #{record.peak}</div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Summary Cards for the overview ── */
function SummaryCards({ categories, chartKind }: { categories: Stats2Category[]; chartKind: string }) {
  const summaryStats = categories.map((cat) => {
    const top = cat.records[0];
    return { ...cat, topRecord: top };
  });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
      {summaryStats.map((cat) => (
        <div key={cat.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition-all cursor-default shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
              <i className={`fas ${cat.icon} text-[var(--accent)] text-sm`} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight">{cat.title}</div>
          </div>
          {cat.topRecord ? (
            <>
              <div className="font-bold text-sm truncate">{cat.topRecord.name}</div>
              <div className="text-xs text-muted-foreground truncate">{cat.topRecord.artist}</div>
              <div className="mt-2 font-black text-lg gold">{cat.topRecord.valueLabel}</div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">No data</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Chart selector ── */
function ChartSelector({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const chartGroups = [
    { label: "Songs", ids: ["songs", "streamingSongs", "radioSongs", "digitalSongsSales"] },
    { label: "Albums", ids: ["albums", "topStreamingAlbums", "topAlbumSales"] },
    { label: "Artists", ids: ["artists"] },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chartGroups.map((group) => (
        group.ids.map((id) => {
          const cfg = chartsConfig[id];
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`tab-pill text-xs ${active === id ? "active" : ""}`}
            >
              <i className={`fas ${cfg.icon} mr-1`} />
              {cfg.title}
            </button>
          );
        })
      ))}
    </div>
  );
}

/* ── Stat type tabs ── */
function StatTypeTabs({ categories, active, onChange }: { categories: Stats2Category[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`tab-pill text-xs ${active === cat.id ? "active" : ""}`}
        >
          <i className={`fas ${cat.icon} mr-1`} />
          {cat.title}
        </button>
      ))}
    </div>
  );
}

/* ── Year filter ── */
function YearFilter({ years, active, onChange }: { years: string[]; active: string; onChange: (y: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange("all")}
        className={`tab-pill text-xs ${active === "all" ? "active" : ""}`}
      >
        All Years
      </button>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`tab-pill text-xs ${active === y ? "active" : ""}`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

/* ── Search filter ── */
function SearchFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search records..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sidebar-search pr-8"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[var(--accent)]"
        >
          <i className="fas fa-times text-xs" />
        </button>
      )}
    </div>
  );
}

/* ── Sort selector ── */
function SortSelector({ value, onChange, isLowerBetter }: { value: string; onChange: (v: string) => void; isLowerBetter: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <option value="auto">{isLowerBetter ? "Best (Lowest First)" : "Best (Highest First)"}</option>
      <option value="value-desc">Highest Value</option>
      <option value="value-asc">Lowest Value</option>
      <option value="name-asc">Name A-Z</option>
      <option value="name-desc">Name Z-A</option>
    </select>
  );
}

/* ── Main Stats Page ── */
function Stats2Page() {
  const data = Route.useLoaderData();
  const { chartStats, availableYears, chartIds } = data;

  const [selectedChart, setSelectedChart] = useState(chartIds[0]);
  const [selectedStat, setSelectedStat] = useState("debuts");
  const [selectedYear, setSelectedYear] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("auto");
  const [showCount, setShowCount] = useState(20);

  const categories = chartStats[selectedChart] ?? [];
  const activeCategory = categories.find((c) => c.id === selectedStat) ?? categories[0];

  const isLowerBetter = selectedStat === "biggestDrops";

  const filteredRecords = useMemo(() => {
    if (!activeCategory) return [];
    let records = [...activeCategory.records];

    // Year filter
    if (selectedYear !== "all") {
      records = records.filter((r) => r.firstDate?.startsWith(selectedYear));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.artist.toLowerCase().includes(q) ||
          (r.details && r.details.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === "name-asc") {
      records.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      records.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "value-asc") {
      records.sort((a, b) => a.value - b.value);
    } else if (sortBy === "value-desc") {
      records.sort((a, b) => b.value - a.value);
    } else {
      // auto: debuts/drops ascending, others descending
      records.sort((a, b) => isLowerBetter ? a.value - b.value : b.value - a.value);
    }

    return records;
  }, [activeCategory, selectedYear, searchQuery, sortBy, isLowerBetter]);

  const displayedRecords = filteredRecords.slice(0, showCount);
  const hasMore = filteredRecords.length > showCount;

  // Reset state when chart changes
  useEffect(() => {
    setSelectedStat(categories[0]?.id ?? "debuts");
    setSearchQuery("");
    setShowCount(20);
  }, [selectedChart]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      {/* Hero Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">STATS</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10">Stats</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Records, milestones & chart history across every chart</p>
      </div>

      {/* Chart Selector */}
      <section className="mb-6">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Select Chart</div>
        <ChartSelector active={selectedChart} onChange={setSelectedChart} />
      </section>

      {/* Year Filter */}
      <section className="mb-6">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Filter by Year</div>
        <YearFilter years={availableYears} active={selectedYear} onChange={setSelectedYear} />
      </section>

      {/* Summary Cards */}
      {categories.length > 0 && (
        <section className="mb-8">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Overview</div>
          <SummaryCards categories={categories} chartKind={chartsConfig[selectedChart]?.kind ?? "song"} />
        </section>
      )}

      {/* Stat Type Tabs */}
      <section className="mb-6">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Category</div>
        <StatTypeTabs categories={categories} active={selectedStat} onChange={setSelectedStat} />
      </section>

      {/* Filters Row */}
      <section className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <SearchFilter value={searchQuery} onChange={setSearchQuery} />
        </div>
        <SortSelector value={sortBy} onChange={setSortBy} isLowerBetter={isLowerBetter} />
      </section>

      {/* Results count */}
      <div className="text-xs text-muted-foreground mb-3">
        {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} found
        {selectedYear !== "all" && ` in ${selectedYear}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Records List */}
      <section className="space-y-2 sm:space-y-2.5">
        {displayedRecords.length > 0 ? (
            displayedRecords.map((record, i) => (
              <RecordRow
                key={`${record.name}||${record.artist}||${i}`}
                record={record}
                rank={i + 1}
                kind={chartsConfig[selectedChart]?.kind ?? "song"}
                chartId={selectedChart}
              />
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <i className="fas fa-search text-4xl mb-4 block opacity-30" />
              <p className="font-semibold">No records found</p>
              <p className="text-xs mt-1">Try adjusting your filters or search query</p>
            </div>
          )}
      </section>

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-8">
          <button
            onClick={() => setShowCount((c) => c + 20)}
            className="btn-gold"
          >
            <i className="fas fa-plus" /> Load More ({filteredRecords.length - showCount} remaining)
          </button>
        </div>
      )}

      {/* Back to top */}
      <div className="text-center mt-8">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-xs text-muted-foreground hover:text-[var(--accent)] transition-colors"
        >
          <i className="fas fa-arrow-up mr-1" /> Back to top
        </button>
      </div>
    </div>
  );
}
