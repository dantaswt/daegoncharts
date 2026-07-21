import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getWeeklyChart, getAllArtistStats, type ChartEntry, type WeeklyChartData } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { chartsConfig, weeklyChartIds, slugifyArtist } from "@/lib/charts-config";
import { getLatestBeatArticles, type GeneratedBeatArticle } from "@/lib/chart-beat-generator";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [songsData, albumsData, artistsData, artistStats, latestArticles] = await Promise.all([
      getWeeklyChart({ data: { chartId: "songs" } }),
      getWeeklyChart({ data: { chartId: "albums" } }),
      getWeeklyChart({ data: { chartId: "artists" } }),
      getAllArtistStats(),
      getLatestBeatArticles(),
    ]);

    // Load all weekly charts for #1 this week
    const allWeeklyData = await Promise.all(
      weeklyChartIds.map(id => getWeeklyChart({ data: { chartId: id } }))
    );

    const numberOnes = allWeeklyData.map((chart) => {
      const latestDate = chart.dates[chart.dates.length - 1];
      const entries = chart.entriesByDate[latestDate];
      const no1 = entries?.[0] ?? null;
      return { chartId: chart.chartId, title: chart.title, kind: chart.kind, date: latestDate, entry: no1 };
    });

    const artistList = Object.values(artistStats)
      .map((a) => ({ name: a.name, slug: slugifyArtist(a.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // First Timers for Artist 50
    const artistsChartDates = artistsData.dates.slice().reverse(); // newest first
    const firstTimers: Array<{ artist: string, position: number, date: string }> = [];
    for (const date of artistsChartDates) {
      const entries = artistsData.entriesByDate[date] || [];
      for (const e of entries) {
        if (e.diff === "NEW" && !firstTimers.find(ft => ft.artist === e.name)) {
          firstTimers.push({ artist: e.name, position: e.position, date });
          if (firstTimers.length >= 5) break;
        }
      }
      if (firstTimers.length >= 5) break;
    }

    return {
      charts: {
        songs: { data: songsData, latestDate: songsData.dates[songsData.dates.length - 1] },
        albums: { data: albumsData, latestDate: albumsData.dates[albumsData.dates.length - 1] },
        artists: { data: artistsData, latestDate: artistsData.dates[artistsData.dates.length - 1] },
      },
      latestArticles,
      numberOnes,
      firstTimers,
      artistList,
    };
  },
  head: () => ({
    meta: [
      { title: "daegon charts — weekly music charts" },
      { name: "description", content: "Weekly music charts, year-end rankings and greatest of all time lists." },
    ],
  }),
  component: LandingPage,
});

/* ────── Spotify Image (small reusable) ────── */
function SpotifyImg({ query, type, rounded }: { query: string; type: "artist" | "album" | "track"; rounded?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [query, type]);
  if (!url) return <div className={`w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center text-muted-foreground ${rounded ? 'rounded-full' : 'rounded-lg'}`}><i className="fas fa-music text-lg" /></div>;
  return <img src={url} alt={query} className={`w-full h-full object-cover ${rounded ? 'rounded-full' : 'rounded-lg'}`} />;
}

/* ────── TOP CHARTS Section ────── */
function TopChartsSection({ charts }: { charts: any }) {
  const [active, setActive] = useState<"songs" | "albums" | "artists">("songs");
  const labels: { key: "songs" | "albums" | "artists"; label: string }[] = [
    { key: "songs", label: "Hot 100" },
    { key: "albums", label: "Top 100 Albums" },
    { key: "artists", label: "Top 50 Artists" },
  ];

  const { data, latestDate } = charts[active];
  const entries = data.entriesByDate[latestDate]?.slice(0, 5) ?? [];
  const cfg = chartsConfig[active];

  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>Top Charts</span>
        <Link to="/chart/$chartId/$date" params={{ chartId: active, date: latestDate }} className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View Chart <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {labels.map(l => (
          <button
            key={l.key}
            onClick={() => setActive(l.key)}
            className={`tab-pill ${active === l.key ? "active" : ""}`}
          >{l.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {entries.map((e: ChartEntry, i: number) => (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all group shadow-sm">
            <div className="aspect-square relative">
              <SpotifyImg
                query={cfg.kind === "album" ? `album:"${e.name}" artist:"${e.artist}"` : cfg.kind === "artist" ? `artist:"${e.name}"` : `artist:"${e.artist}" track:"${e.name}"`}
                type={cfg.kind === "album" ? "album" : cfg.kind === "artist" ? "artist" : "track"}
                rounded={false}
              />
              <div className="rank-badge">{e.position}</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                {cfg.kind === "artist" ? (
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">
                    {e.name}
                  </Link>
                ) : (
                  <span>{stripFeatFromTitle(e.name)}</span>
                )}
              </div>
              {cfg.kind !== "artist" && (
                <div className="text-xs text-muted-foreground whitespace-normal break-words">
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">
                    {e.artist}
                  </Link>
                  <TrackArtists song={e.name} artist={e.artist} className="text-xs text-muted-foreground" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────── NO.1 THIS WEEK Section ────── */
function NumberOnesSection({ numberOnes }: { numberOnes: any[] }) {
  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>No. 1 This Week</span>
        <Link to="/number-ones" className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {numberOnes.map((n, i) => {
          if (!n.entry) return null;
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={n.chartId} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex flex-col h-full shadow-sm">
              <div className="flex items-center gap-3 p-4 flex-grow">
                <div className="w-16 h-16 shrink-0">
                  <SpotifyImg
                    query={n.kind === "album" ? `album:"${n.entry.name}" artist:"${n.entry.artist}"` : n.kind === "artist" ? `artist:"${n.entry.name}"` : `artist:"${n.entry.artist}" track:"${n.entry.name}"`}
                    type={n.kind === "album" ? "album" : n.kind === "artist" ? "artist" : "track"}
                    rounded={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">{n.title}</div>
                  <div className="font-bold text-sm whitespace-normal break-words">{n.kind === "artist" ? n.entry.name : stripFeatFromTitle(n.entry.name)}</div>
                  {n.kind !== "artist" ? (
                    <div className="text-xs text-muted-foreground whitespace-normal break-words">
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.artist) }} className="hover:text-[var(--accent)] hover:underline">
                        {n.entry.artist}
                      </Link>
                      <TrackArtists song={n.entry.name} artist={n.entry.artist} className="text-xs text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground whitespace-normal break-words">
                      {n.entry.artist}
                    </div>
                  )}
                  {n.kind === "artist" && (
                    <div className="text-xs mt-1">
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.name) }} className="font-semibold text-[var(--accent)] hover:underline">
                        View Artist Page
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <Link to="/chart/$chartId/$date" params={{ chartId: n.chartId, date: n.date }} className="block text-center text-xs text-[var(--accent)] font-semibold py-2 border-t border-[var(--border)] hover:bg-[rgba(0,230,118,0.05)] transition-colors mt-auto">
                View Chart →
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ────── FIRST-TIMERS Section ────── */
function FirstTimersSection({ firstTimers }: { firstTimers: any[] }) {
  if (!firstTimers || firstTimers.length === 0) return null;
  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>First-Timers</span>
        <Link to="/artists" className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {firstTimers.map((ft, i) => (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all group shadow-sm">
            <div className="aspect-square relative">
              <SpotifyImg query={ft.artist} type="artist" rounded={false} />
              <div className="rank-badge">{ft.position}</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                <Link to="/artist/$slug" params={{ slug: slugifyArtist(ft.artist) }} className="hover:underline">
                  {ft.artist}
                </Link>
              </div>
              <Link to="/chart/$chartId/$date" params={{ chartId: "artists", date: ft.date }} className="text-xs text-[var(--accent)] hover:underline block mt-1">
                Week of {new Date(ft.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ────── CHART BEAT Section ────── */
function ChartBeatSection({ articles }: { articles: GeneratedBeatArticle[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="section-banner">
        <span>Chart Beat</span>
        <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: "songs", date: articles[0]?.date ?? "" }} className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          View All <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        {articles.map((article, i) => {
          const dateLabel = new Date(article.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const cfg = chartsConfig[article.chartId];
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={article.chartId}>
              <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: article.chartId, date: article.date }} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex items-stretch group shadow-sm">
                {article.artist && (
                  <div className="w-20 sm:w-32 h-auto shrink-0">
                    <SpotifyImg query={`artist:"${article.artist}"`} type="artist" rounded={false} />
                  </div>
                )}
                <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1 truncate">{cfg?.title ?? article.chartTitle}</div>
                  <div className="font-bold text-xs sm:text-base mb-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2 break-words">{article.headline}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{dateLabel}</div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ────── SIDEBAR ────── */
function Sidebar({ artistList }: { artistList: { name: string; slug: string }[] }) {
  const [search, setSearch] = useState("");
  const [yeOpen, setYeOpen] = useState(false);
  const [goatOpen, setGoatOpen] = useState(false);
  const navigate = useNavigate();

  const filteredArtists = search.trim()
    ? artistList.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  return (
    <aside className="space-y-4">
      {/* Search Artists */}
      <div className="sidebar-section">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Search Artists</div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search Artists"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sidebar-search"
          />
          <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
        </div>
        {filteredArtists.length > 0 && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {filteredArtists.map(a => (
              <Link key={a.slug} to="/artist/$slug" params={{ slug: a.slug }} className="sidebar-link whitespace-normal break-words">
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Charts */}
      <div className="sidebar-section">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Weekly Charts</div>
        <div className="space-y-1">
          {weeklyChartIds.map(id => {
            const cfg = chartsConfig[id];
            return (
              <Link key={id} to="/chart/$chartId" params={{ chartId: id }} className="sidebar-link">
                <i className={`fas ${cfg.icon} text-xs text-muted-foreground w-4`} />
                {cfg.title}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Greatest of All Time */}
      <div className="sidebar-section">
        <button onClick={() => setGoatOpen(!goatOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Greatest of All Time</div>
          <i className={`fas fa-chevron-${goatOpen ? 'up' : 'down'} text-xs text-muted-foreground`} />
        </button>
        {goatOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/goat/$chartId" params={{ chartId: "goatSongs" }} className="sidebar-link"><i className="fas fa-music text-xs text-muted-foreground w-4" /> Songs</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatArtists" }} className="sidebar-link"><i className="fas fa-user text-xs text-muted-foreground w-4" /> Artists</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatAlbums" }} className="sidebar-link"><i className="fas fa-compact-disc text-xs text-muted-foreground w-4" /> Albums</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatRadio" }} className="sidebar-link"><i className="fas fa-broadcast-tower text-xs text-muted-foreground w-4" /> Radio</Link>
          </div>
        )}
      </div>

      {/* Year-End */}
      <div className="sidebar-section">
        <button onClick={() => setYeOpen(!yeOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Year-End Charts</div>
          <i className={`fas fa-chevron-${yeOpen ? 'up' : 'down'} text-xs text-muted-foreground`} />
        </button>
        {yeOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndSongs" }} className="sidebar-link"><i className="fas fa-music text-xs text-muted-foreground w-4" /> Hot 100</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndArtists" }} className="sidebar-link"><i className="fas fa-user text-xs text-muted-foreground w-4" /> Artist 50</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndAlbums" }} className="sidebar-link"><i className="fas fa-compact-disc text-xs text-muted-foreground w-4" /> Top 100 Albums</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndRadio" }} className="sidebar-link"><i className="fas fa-broadcast-tower text-xs text-muted-foreground w-4" /> Radio Songs</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndStreamingSongs" }} className="sidebar-link"><i className="fas fa-headphones text-xs text-muted-foreground w-4" /> Streaming Songs</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndTopStreamingAlbums" }} className="sidebar-link"><i className="fas fa-headphones text-xs text-muted-foreground w-4" /> Top Streaming Albums</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndTopAlbumSales" }} className="sidebar-link"><i className="fas fa-chart-simple text-xs text-muted-foreground w-4" /> Top Album Sales</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndDigitalSongsSales" }} className="sidebar-link"><i className="fas fa-download text-xs text-muted-foreground w-4" /> Digital Songs Sales</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndNewArtists" }} className="sidebar-link"><i className="fas fa-user-plus text-xs text-muted-foreground w-4" /> New Artists</Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <Link to="/stats" className="sidebar-section block hover:border-[var(--accent)] transition-all">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-chart-line mr-2" />Stats</div>
      </Link>
    </aside>
  );
}

/* ────── LANDING PAGE ────── */
function LandingPage() {
  const { charts, latestArticles, numberOnes, firstTimers, artistList } = Route.useLoaderData();

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero Title */}
      <div className="text-center py-10 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[8rem] md:text-[14rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">Charts</span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-[var(--foreground)] tracking-tight relative z-10">daegon charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">Weekly music charts, year-end rankings & greatest of all time lists</p>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar - Left Side */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 lg:h-fit">
          <Sidebar artistList={artistList} />
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <TopChartsSection charts={charts} />
          <NumberOnesSection numberOnes={numberOnes} />
          <FirstTimersSection firstTimers={firstTimers} />
          <ChartBeatSection articles={latestArticles} />
          
          {/* Chart Battle Mobile Link */}
          <div className="md:hidden mt-10">
            <Link to="/chart-battle" className="block bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(0,230,118,0.3)] p-4 rounded-xl flex items-center justify-center gap-4 group">
              <div className="bg-[var(--accent)] text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 group-hover:scale-110 transition-transform">
                VS
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--card-foreground)] uppercase tracking-widest">New Mini-Game!</div>
                <div className="text-lg font-black uppercase text-[var(--card-foreground)]">Play Chart Battle 🏆</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom nav (moved from header) */}
      <div className="mt-14 border-t border-[var(--border)] pt-8 pb-4">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/artists" className="hover:text-[var(--accent)] transition-colors font-semibold">Artists</Link>
          <span className="text-muted-foreground">|</span>
          <Link to="/chart-beat-2/$chartId/$date" params={{ chartId: "songs", date: "2026-07-06" }} className="hover:text-[var(--accent)] transition-colors font-semibold">Chart Beat</Link>
          <span className="text-muted-foreground">|</span>
          <Link to="/stats" className="hover:text-[var(--accent)] transition-colors font-semibold">Stats</Link>
          <span className="text-muted-foreground">|</span>
          <Link to="/number-ones" className="hover:text-[var(--accent)] transition-colors font-semibold">#1's</Link>
          <span className="text-muted-foreground">|</span>
          <Link to="/chart-battle" className="hover:text-[var(--accent)] transition-colors font-semibold gold">Chart Battle</Link>
        </div>
      </div>
    </div>
      
      {/* Chart Battle Floating Tooltip */}
      <Link to="/chart-battle" className="fixed bottom-6 left-6 z-50 animate-bounce cursor-pointer group hidden md:block">
        <div className="bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(0,230,118,0.3)] px-4 py-3 rounded-2xl flex items-center gap-3">
          <div className="bg-[var(--accent)] text-white w-10 h-10 rounded-full flex items-center justify-center font-black">
            VS
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">New Mini-Game!</div>
            <div className="text-sm font-semibold text-[var(--card-foreground)]">Play Chart Battle 🏆</div>
          </div>
        </div>
      </Link>
    </>
  );
}
