import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getWeeklyChart, getChartBeat, getAllArtistStats, type ChartEntry, type WeeklyChartData, type ChartBeatPost } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { chartsConfig, weeklyChartIds, chartBeatConfig, slugifyArtist } from "@/lib/charts-config";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [songsData, albumsData, artistsData, hot100Beat, artistsBeat, albumsBeat, artistStats] = await Promise.all([
      getWeeklyChart({ data: { chartId: "songs" } }),
      getWeeklyChart({ data: { chartId: "albums" } }),
      getWeeklyChart({ data: { chartId: "artists" } }),
      getChartBeat({ data: { blog: "hot100" } }),
      getChartBeat({ data: { blog: "artists" } }),
      getChartBeat({ data: { blog: "top100Albums" } }),
      getAllArtistStats(),
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
      chartBeat: {
        hot100: hot100Beat,
        artists: artistsBeat,
        top100Albums: albumsBeat,
      },
      numberOnes,
      firstTimers,
      artistList,
    };
  },
  head: () => ({
    meta: [
      { title: "daegon charts — weekly music charts" },
      { name: "description", content: "Weekly music charts, year-end rankings and GOAT lists." },
    ],
  }),
  component: LandingPage,
});

/* ────── Spotify Image (small reusable) ────── */
function SpotifyImg({ query, type, rounded }: { query: string; type: "artist" | "album"; rounded?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [query, type]);
  if (!url) return <div className={`w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center text-gray-600 ${rounded ? 'rounded-full' : 'rounded-lg'}`}><i className="fas fa-music text-lg" /></div>;
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
      <h2 className="text-2xl md:text-3xl font-extrabold mb-6 uppercase tracking-wide">Top Charts</h2>
      <div className="flex flex-wrap gap-2 mb-6">
        {labels.map(l => (
          <button
            key={l.key}
            onClick={() => setActive(l.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${
              active === l.key
                ? "bg-[var(--accent)] text-black"
                : "bg-[var(--muted)] text-muted-foreground hover:text-white border border-[var(--border)]"
            }`}
          >{l.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {entries.map((e: ChartEntry, i: number) => (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={i} className="bg-[var(--muted)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all group">
            <div className="aspect-square relative">
              <SpotifyImg
                query={cfg.kind === "album" ? `${e.name} ${e.artist}` : cfg.kind === "artist" ? e.name : e.artist}
                type={cfg.kind === "album" ? "album" : "artist"}
                rounded={false}
              />
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-black px-2 py-1 rounded-md">#{e.position}</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                {cfg.kind === "artist" ? (
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.name) }} className="hover:underline">
                    {e.name}
                  </Link>
                ) : (
                  e.name
                )}
              </div>
              {cfg.kind !== "artist" && (
                <div className="text-xs text-muted-foreground whitespace-normal break-words">
                  <Link to="/artist/$slug" params={{ slug: slugifyArtist(e.artist) }} className="hover:text-[var(--accent)] hover:underline">
                    {e.artist}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <Link to="/chart/$chartId/$date" params={{ chartId: active, date: latestDate }} className="btn-gold">
          View Chart <i className="fas fa-arrow-right ml-1" />
        </Link>
      </div>
    </section>
  );
}

/* ────── NO.1 THIS WEEK Section ────── */
function NumberOnesSection({ numberOnes }: { numberOnes: any[] }) {
  return (
    <section className="mb-14">
      <h2 className="text-2xl md:text-3xl font-extrabold mb-6 uppercase tracking-wide">No. 1 This Week</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {numberOnes.map((n, i) => {
          if (!n.entry) return null;
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={n.chartId} className="bg-[var(--muted)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex flex-col h-full">
              <div className="flex items-center gap-3 p-4 flex-grow">
                <div className="w-16 h-16 shrink-0">
                  <SpotifyImg
                    query={n.kind === "album" ? `${n.entry.name} ${n.entry.artist}` : n.kind === "artist" ? n.entry.name : n.entry.artist}
                    type={n.kind === "album" ? "album" : "artist"}
                    rounded={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">{n.title}</div>
                  <div className="font-bold text-sm whitespace-normal break-words">{n.entry.name}</div>
                  {n.kind !== "artist" ? (
                    <div className="text-xs text-muted-foreground whitespace-normal break-words">
                      <Link to="/artist/$slug" params={{ slug: slugifyArtist(n.entry.artist) }} className="hover:text-[var(--accent)] hover:underline">
                        {n.entry.artist}
                      </Link>
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
              <Link to="/chart/$chartId/$date" params={{ chartId: n.chartId, date: n.date }} className="block text-center text-xs text-[var(--accent)] font-semibold py-2 border-t border-[var(--border)] hover:bg-[rgba(255,215,0,0.05)] transition-colors mt-auto">
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
      <h2 className="text-2xl md:text-3xl font-extrabold mb-6 uppercase tracking-wide">First-Timers</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {firstTimers.map((ft, i) => (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={i} className="bg-[var(--muted)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all group">
            <div className="aspect-square relative">
              <SpotifyImg query={ft.artist} type="artist" rounded={false} />
              <div className="absolute top-2 right-2 bg-[var(--accent)] text-black text-xs font-black px-2 py-1 rounded-md">NEW</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm whitespace-normal break-words group-hover:text-[var(--accent)] transition-colors">
                <Link to="/artist/$slug" params={{ slug: slugifyArtist(ft.artist) }} className="hover:underline">
                  {ft.artist}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Debut: #{ft.position}</div>
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
function ChartBeatSection({ chartBeat }: { chartBeat: any }) {
  const blogs: { key: keyof typeof chartBeatConfig; posts: ChartBeatPost[]; title: string }[] = [
    { key: "hot100", posts: chartBeat.hot100.posts, title: chartBeat.hot100.title },
    { key: "artists", posts: chartBeat.artists.posts, title: chartBeat.artists.title },
    { key: "top100Albums", posts: chartBeat.top100Albums.posts, title: chartBeat.top100Albums.title },
  ];

  return (
    <section className="mb-14">
      <h2 className="text-2xl md:text-3xl font-extrabold mb-6 uppercase tracking-wide">Chart Beat</h2>
      <div className="flex flex-col gap-4">
        {blogs.map((b, i) => {
          const latest = b.posts[0];
          if (!latest) return null;
          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} key={b.key}>
              <Link to="/chart-beat/$blog" params={{ blog: b.key }} className="bg-[var(--muted)] rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-all flex items-center group h-24 sm:h-32">
              {latest.artist && (
                <div className="w-24 sm:w-32 h-full shrink-0">
                  <SpotifyImg query={latest.artist} type="artist" rounded={false} />
                </div>
              )}
              <div className="p-4 flex flex-col justify-center flex-1 min-w-0">
                <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1 truncate">{b.title}</div>
                <div className="font-bold text-sm sm:text-base mb-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2">{latest.title}</div>
                <div className="text-xs text-muted-foreground">{latest.publicationDate}</div>
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
    <aside className="space-y-6">
      {/* Search Artists */}
      <div className="bg-[var(--muted)] rounded-xl border border-[var(--border)] p-4">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Search Artists</div>
        <div className="relative">
          <input
            type="text"
            placeholder="Type an artist name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
        </div>
        {filteredArtists.length > 0 && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {filteredArtists.map(a => (
              <Link key={a.slug} to="/artist/$slug" params={{ slug: a.slug }} className="block text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors whitespace-normal break-words">
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Charts */}
      <div className="bg-[var(--muted)] rounded-xl border border-[var(--border)] p-4">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-3">Weekly Charts</div>
        <div className="space-y-1">
          {weeklyChartIds.map(id => {
            const cfg = chartsConfig[id];
            return (
              <Link key={id} to="/chart/$chartId" params={{ chartId: id }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors">
                <i className={`fas ${cfg.icon} text-xs text-gray-500 w-4`} />
                {cfg.title}
              </Link>
            );
          })}
        </div>
      </div>

      {/* GOAT */}
      <div className="bg-[var(--muted)] rounded-xl border border-[var(--border)] p-4">
        <button onClick={() => setGoatOpen(!goatOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Greatest of All Time</div>
          <i className={`fas fa-chevron-${goatOpen ? 'up' : 'down'} text-xs text-gray-500`} />
        </button>
        {goatOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/goat/$chartId" params={{ chartId: "goatSongs" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-music text-xs text-gray-500 w-4" /> Songs</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatArtists" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-user text-xs text-gray-500 w-4" /> Artists</Link>
            <Link to="/goat/$chartId" params={{ chartId: "goatAlbums" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-compact-disc text-xs text-gray-500 w-4" /> Albums</Link>
          </div>
        )}
      </div>

      {/* Year-End */}
      <div className="bg-[var(--muted)] rounded-xl border border-[var(--border)] p-4">
        <button onClick={() => setYeOpen(!yeOpen)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest">Year-End Charts</div>
          <i className={`fas fa-chevron-${yeOpen ? 'up' : 'down'} text-xs text-gray-500`} />
        </button>
        {yeOpen && (
          <div className="mt-3 space-y-1">
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndSongs" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-music text-xs text-gray-500 w-4" /> Songs</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndArtists" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-user text-xs text-gray-500 w-4" /> Artists</Link>
            <Link to="/year-end/$chartId" params={{ chartId: "yearEndAlbums" }} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-[rgba(255,215,0,0.1)] hover:text-[var(--accent)] transition-colors"><i className="fas fa-compact-disc text-xs text-gray-500 w-4" /> Albums</Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <Link to="/stats" className="bg-[var(--muted)] rounded-xl border border-[var(--border)] p-4 block hover:border-[var(--accent)] transition-all">
        <div className="text-xs uppercase text-muted-foreground font-bold tracking-widest"><i className="fas fa-chart-line mr-2" />Stats</div>
      </Link>
    </aside>
  );
}

/* ────── LANDING PAGE ────── */
function LandingPage() {
  const { charts, chartBeat, numberOnes, firstTimers, artistList } = Route.useLoaderData();

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero Title */}
      <div className="text-center py-10 md:py-16">
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black gold tracking-tight">daegon charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3">Weekly music charts, year-end rankings & GOAT lists</p>
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
          <ChartBeatSection chartBeat={chartBeat} />
          
          {/* Chart Battle Mobile Link */}
          <div className="md:hidden mt-10">
            <Link to="/chart-battle" className="block bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(234,179,8,0.3)] p-4 rounded-xl flex items-center justify-center gap-4 group">
              <div className="bg-[var(--accent)] text-black w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 group-hover:scale-110 transition-transform">
                VS
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-black uppercase tracking-widest">New Mini-Game!</div>
                <div className="text-lg font-black uppercase text-black">Play Chart Battle 🏆</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom nav (moved from header) */}
      <div className="mt-14 border-t border-[var(--border)] pt-8 pb-4">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/artists" className="hover:text-[var(--accent)] transition-colors font-semibold">Artists</Link>
          <span className="text-[#3a3a3a]">|</span>
          <Link to="/chart-beat/$blog" params={{ blog: "hot100" }} className="hover:text-[var(--accent)] transition-colors font-semibold">Chart Beat</Link>
          <span className="text-[#3a3a3a]">|</span>
          <Link to="/stats" className="hover:text-[var(--accent)] transition-colors font-semibold">Stats</Link>
          <span className="text-[#3a3a3a]">|</span>
          <Link to="/number-ones" className="hover:text-[var(--accent)] transition-colors font-semibold">#1's</Link>
          <span className="text-[#3a3a3a]">|</span>
          <Link to="/chart-battle" className="hover:text-[var(--accent)] transition-colors font-semibold gold">Chart Battle</Link>
        </div>
      </div>
    </div>
      
      {/* Chart Battle Floating Tooltip */}
      <Link to="/chart-battle" className="fixed bottom-6 left-6 z-50 animate-bounce cursor-pointer group hidden md:block">
        <div className="bg-[var(--card)] border border-[var(--accent)] shadow-[0_0_15px_rgba(234,179,8,0.3)] px-4 py-3 rounded-2xl flex items-center gap-3">
          <div className="bg-[var(--accent)] text-black w-10 h-10 rounded-full flex items-center justify-center font-black">
            VS
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">New Mini-Game!</div>
            <div className="text-sm font-semibold text-black">Play Chart Battle 🏆</div>
          </div>
        </div>
      </Link>
    </>
  );
}
