import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllArtistStats, getGoatChart, getArtist50TotalUnits, getArtist50Totals } from "@/lib/charts.functions";
import { getSpotifyArtistProfile } from "@/lib/spotify.functions";
import { slugifyArtist, chartsConfig, weeklyChartIds } from "@/lib/charts-config";
import React, { useState } from "react";
import { motion } from "framer-motion";

/* ────── Chart name → route mapping ────── */
const chartNameToRoute: Record<string, { chartId: string }> = {};
for (const id of weeklyChartIds) {
  const cfg = chartsConfig[id];
  if (cfg) chartNameToRoute[cfg.title] = { chartId: id };
}
chartNameToRoute["Hot 100 Songs"] = { chartId: "songs" };
chartNameToRoute["Top 50 Artists"] = { chartId: "artists" };
chartNameToRoute["Top 100 Albums"] = { chartId: "albums" };
chartNameToRoute["Radio Songs"] = { chartId: "radioSongs" };
chartNameToRoute["Top 40 Radio"] = { chartId: "radioSongs" };
chartNameToRoute["Top Streaming Albums"] = { chartId: "topStreamingAlbums" };
chartNameToRoute["Top Album Sales"] = { chartId: "topAlbumSales" };
chartNameToRoute["Streaming Songs"] = { chartId: "streamingSongs" };
chartNameToRoute["Digital Songs Sales"] = { chartId: "digitalSongsSales" };

/* ────── Format helpers ────── */
function parseEuro(v: string): number {
  let s = v.trim();
  if (!s || s === "-") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      s = s.replace(/\./g, "");
    } else {
      s = s.replace(/\./g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

function formatStreams(v: string | null | undefined): string {
  if (!v) return "—";
  const n = parseEuro(v);
  if (isNaN(n)) return v;
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
  }
  return n.toLocaleString("en-US");
}

function formatComma(v: string | null | undefined): string {
  if (!v) return "—";
  const n = parseEuro(v);
  if (isNaN(n)) return v;
  return n.toLocaleString("en-US");
}

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const [all, artist50Units, artist50Totals] = await Promise.all([getAllArtistStats(), getArtist50TotalUnits(), getArtist50Totals()]);
    const match = Object.values(all).find((a) => slugifyArtist(a.name) === params.slug);

    let profile = null;
    let goatData = null;
    if (match) {
      profile = await getSpotifyArtistProfile({ data: { artistName: match.name } });
      const goatArtists = await getGoatChart({ data: { chartId: "goatArtists" } });
      const foundInGoat = goatArtists.entries.find(e => e.name === match.name);
      if (foundInGoat) {
        goatData = { position: foundInGoat.position, totalUnits: foundInGoat.totalUnits || foundInGoat.points };
      }
    }

    return { artist: match ?? null, slug: params.slug, profile, goatData, artist50Units, artist50Totals };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.artist?.name ?? "Artist";
    return {
      meta: [
        { title: `${name} — chart history | daegon charts` },
        { name: "description", content: `Chart history and entries for ${name}.` },
        { property: "og:title", content: `${name} — daegon charts` },
      ],
    };
  },
  component: ArtistPage,
});

/* ────── Date Link ────── */
function DateLink({ chartName, date, children }: { chartName: string; date: string; children: React.ReactNode }) {
  const route = chartNameToRoute[chartName];
  if (!route || !date) return <span>{children}</span>;
  return (
    <Link to="/chart/$chartId/$date" params={{ chartId: route.chartId, date }} className="text-[var(--accent)] hover:underline">
      {children}
    </Link>
  );
}

/* ────── Chart History Table ────── */
function ChartHistoryTable({ chartName, entries }: { chartName: string; entries: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayChartName = chartName === "Top 40 Radio" ? "Radio Songs" : chartName;
  const visibleEntries = expanded ? entries : entries.slice(0, 5);

  if (entries.length === 0) return null;

  const no1s = entries.filter(e => e.peak === 1).length;
  const top5 = entries.filter(e => e.peak >= 1 && e.peak <= 5).length;
  const top10 = entries.filter(e => e.peak >= 1 && e.peak <= 10).length;

  const unitsLabel: Record<string, string> = {
    "Hot 100 Songs": "Units",
    "Digital Songs Sales": "Sales",
    "Streaming Songs": "Streams",
    "Top 40 Radio": "Audience",
    "Top 100 Albums": "Units",
    "Top Album Sales": "Sales",
    "Top Streaming Albums": "Streams",
    "Top 50 Artists": "Units",
  };
  const colLabel = unitsLabel[chartName] ?? "Units";
  const isStreams = chartName === "Streaming Songs" || chartName === "Top Streaming Albums";
  const isSales = chartName === "Digital Songs Sales" || chartName === "Top Album Sales";

  const chartIcons: Record<string, string> = {
    "Hot 100 Songs": "fa-music",
    "Digital Songs Sales": "fa-download",
    "Streaming Songs": "fa-headphones",
    "Top 40 Radio": "fa-broadcast-tower",
    "Top 100 Albums": "fa-compact-disc",
    "Top Album Sales": "fa-shopping-cart",
    "Top Streaming Albums": "fa-headphones-alt",
    "Top 50 Artists": "fa-user",
  };

  const isAlbumChart = chartName === "Top 100 Albums" || chartName === "Top Album Sales" || chartName === "Top Streaming Albums";
  const itemLabel = isAlbumChart ? "Album" : "Song";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <i className={`fas ${chartIcons[chartName] ?? "fa-chart-bar"} text-[var(--accent)] text-lg`} />
            <div>
              <h3 className="font-bold text-base sm:text-lg">{displayChartName}</h3>
              <p className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? "entry" : "entries"}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {no1s > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[rgba(255,215,0,0.1)] text-[#FFD700] text-[10px] font-bold rounded-full border border-[rgba(255,215,0,0.3)]">
                <i className="fas fa-crown" /> #1's: {no1s}
              </span>
            )}
            {top5 > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[rgba(0,230,118,0.08)] text-[var(--accent)] text-[10px] font-bold rounded-full border border-[rgba(0,230,118,0.2)]">
                Top 5: {top5}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[rgba(56,189,248,0.08)] text-[#38BDF8] text-[10px] font-bold rounded-full border border-[rgba(56,189,248,0.2)]">
              Top 10: {top10}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-muted-foreground tracking-wider">
                <th className="px-4 sm:px-5 py-3 font-bold">{itemLabel}</th>
                <th className="px-3 py-3 text-center font-bold">Peak</th>
                <th className="px-3 py-3 text-center font-bold">Weeks</th>
                <th className="px-3 py-3 text-center font-bold hidden md:table-cell">First Entry</th>
                <th className="px-3 py-3 text-center font-bold hidden md:table-cell">Peak Date</th>
                <th className="px-4 sm:px-5 py-3 text-right font-bold">{colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e, i: number) => (
                <tr key={i} className="border-t border-[var(--border)] hover:bg-[rgba(0,230,118,0.02)] transition-colors">
                  <td className="px-4 sm:px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold whitespace-normal break-words">{e.item}</span>
                      {(e.weeksAt1 ?? 0) > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] font-bold rounded uppercase whitespace-nowrap shrink-0">
                          {e.weeksAt1} {e.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-black ${e.peak === 1 ? "gold text-base" : e.peak <= 3 ? "text-[var(--accent)]" : ""}`}>
                      #{e.peak}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">{e.weeks}</td>
                  <td className="px-3 py-3 text-center text-xs hidden md:table-cell">
                    {e.firstEntry ? <DateLink chartName={chartName} date={e.firstEntry}>{e.firstEntry}</DateLink> : "—"}
                  </td>
                  <td className="px-3 py-3 text-center text-xs hidden md:table-cell">
                    {e.peakDate ? <DateLink chartName={chartName} date={e.peakDate}>{e.peakDate}</DateLink> : "—"}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right text-xs">
                    {isStreams ? formatStreams(e.unitsSold) : formatComma(e.unitsSold)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entries.length > 5 && (
          <div className="p-3 text-center border-t border-[var(--border)]">
            <button
              onClick={() => setExpanded((value) => !value)}
              className="text-[var(--accent)] hover:underline text-sm font-semibold cursor-pointer"
            >
              {expanded ? "Show less" : `Show all ${entries.length} entries`}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ────── ARTIST PAGE ────── */
function ArtistPage() {
  const { artist, profile, goatData, artist50Units, artist50Totals } = Route.useLoaderData();
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!artist) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center text-3xl text-muted-foreground mx-auto mb-6">
          <i className="fas fa-user" />
        </div>
        <h2 className="text-2xl font-bold gold mb-2">Artist not found</h2>
        <p className="text-muted-foreground text-sm mb-6">The artist you're looking for doesn't exist in our database.</p>
        <Link to="/artists" className="btn-gold inline-flex items-center gap-2">
          <i className="fas fa-arrow-left" /> Browse all artists
        </Link>
      </div>
    );
  }

  const top50 = artist.chartsByKind["Top 50 Artists"]?.[0] || artist.chartsByKind["Artists"]?.[0];
  const totals = artist50Totals?.[artist.name];

  const order = [
    "Hot 100 Songs",
    "Digital Songs Sales",
    "Streaming Songs",
    "Top 40 Radio",
    "Top 100 Albums",
    "Top Album Sales",
    "Top Streaming Albums"
  ];

  const chartsToRender = order.filter(c => artist.chartsByKind[c] && artist.chartsByKind[c].length > 0);
  const otherCharts = Object.keys(artist.chartsByKind).filter(c => !order.includes(c) && c !== "Top 50 Artists" && c !== "Artists");

  const totalEntries = Object.values(artist.chartsByKind).reduce((sum, entries) => sum + entries.length, 0);
  const totalNo1s = Object.values(artist.chartsByKind).reduce((sum, entries) => sum + entries.filter((e: any) => e.peak === 1).length, 0);
  const totalWeeks = Object.values(artist.chartsByKind).reduce((sum, entries) => sum + entries.reduce((s: number, e: any) => s + (e.weeks || 0), 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      {/* Back Link */}
      <Link to="/artists" className="text-sm text-muted-foreground hover:text-[var(--accent)] mb-6 inline-flex items-center gap-2 transition-colors">
        <i className="fas fa-arrow-left" /> All artists
      </Link>

      {/* Hero Card */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-lg mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(0,230,118,0.03)] via-transparent to-[rgba(56,189,248,0.03)]" />

        <div className="relative flex flex-col md:flex-row items-center md:items-stretch gap-0">
          {/* Artist Image */}
          <div className="relative w-full md:w-72 h-64 md:h-auto shrink-0 overflow-hidden">
            {profile?.imageUrl ? (
              <>
                <img
                  src={profile.imageUrl}
                  alt={artist.name}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImgLoaded(true)}
                />
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center">
                    <i className="fas fa-user text-4xl text-muted-foreground" />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center">
                <i className="fas fa-user text-5xl text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-[var(--card)]" />
          </div>

          {/* Info */}
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-center min-w-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-3 text-[var(--foreground)]">
              {artist.name}
            </h1>

            {profile && (
              <div className="flex flex-wrap items-center gap-2 text-xs mb-5">
                {profile.followers > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--foreground)]">
                    <i className="fas fa-users text-[var(--accent)]" />
                    {profile.followers >= 1000000
                      ? `${(profile.followers / 1000000).toFixed(1)}M`
                      : profile.followers >= 1000
                      ? `${(profile.followers / 1000).toFixed(0)}K`
                      : profile.followers.toLocaleString()} Followers
                  </span>
                )}
                {profile.genres.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] capitalize text-[var(--foreground)]">
                    <i className="fas fa-music text-[var(--accent)]" />
                    {profile.genres.slice(0, 3).join(", ")}
                  </span>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {goatData && (
                <div className="text-center p-3 rounded-xl border border-[rgba(255,215,0,0.2)]">
                  <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Greatest of All Time Rank</div>
                  <div className="text-xl font-black gold">#{goatData.position}</div>
                </div>
              )}
              <div className="text-center p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Entries</div>
                <div className="text-xl font-black text-[var(--foreground)]">{totalEntries}</div>
              </div>
              <div className="text-center p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">#1's</div>
                <div className="text-xl font-black gold">{totalNo1s}</div>
              </div>
              <div className="text-center p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Weeks</div>
                <div className="text-xl font-black text-[var(--foreground)]">{totalWeeks}</div>
              </div>
            </div>

            {/* Sales / Units / Streams */}
            {totals && (totals.totalSales || totals.totalUnits || totals.totalStreams) && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
                {totals.totalSales && (
                  <div className="text-center p-2 sm:p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Sales</div>
                    <div className="text-sm sm:text-lg font-black text-[var(--foreground)]">{formatComma(totals.totalSales)}</div>
                  </div>
                )}
                {totals.totalUnits && (
                  <div className="text-center p-2 sm:p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Units</div>
                    <div className="text-sm sm:text-lg font-black text-[var(--foreground)]">{formatComma(totals.totalUnits)}</div>
                  </div>
                )}
                {totals.totalStreams && (
                  <div className="text-center p-2 sm:p-3 rounded-xl border border-[var(--border)]">
                    <div className="text-[8px] sm:text-[9px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Streams</div>
                    <div className="text-sm sm:text-lg font-black text-[var(--foreground)]">{formatStreams(totals.totalStreams)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Chart History Sections */}
      <div className="space-y-8">
        {chartsToRender.map((c) => (
          <ChartHistoryTable key={c} chartName={c} entries={artist.chartsByKind[c]} />
        ))}
        {otherCharts.map((c) => (
          <ChartHistoryTable key={c} chartName={c} entries={artist.chartsByKind[c]} />
        ))}
      </div>

      {/* Back Link Bottom */}
      <div className="mt-12 text-center">
        <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--accent)] transition-colors">
          <i className="fas fa-arrow-left" /> Browse all artists
        </Link>
      </div>
    </div>
  );
}
