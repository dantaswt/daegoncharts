import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllArtistStats, getArtistChartHistory, getGoatChart, getArtist50TotalUnits, getArtist50Totals } from "@/lib/charts.functions";
import { getSpotifyArtistProfile, getSpotifyFeaturedOn } from "@/lib/spotify.functions";
import { slugifyArtist, chartsConfig, weeklyChartIds } from "@/lib/charts-config";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle } from "@/components/track-artists";

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

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
  } catch {
    return d;
  }
}

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const [all, artist50Units, artist50Totals] = await Promise.all([getAllArtistStats(), getArtist50TotalUnits(), getArtist50Totals()]);
    const match = Object.values(all).find((a) => slugifyArtist(a.name) === params.slug);

    let profile = null;
    let goatData = null;
    let featuredOn = null;
    let chartHistory = null;
    if (match) {
      [profile, featuredOn, chartHistory] = await Promise.all([
        getSpotifyArtistProfile({ data: { artistName: match.name } }),
        getSpotifyFeaturedOn({ data: { artistName: match.name } }),
        getArtistChartHistory({ data: { artistName: match.name } }),
      ]);
      const goatArtists = await getGoatChart({ data: { chartId: "goatArtists" } }).catch(() => null);
      const foundInGoat = goatArtists?.entries.find(e => e.name === match.name);
      if (foundInGoat) {
        goatData = { position: foundInGoat.position, totalUnits: foundInGoat.totalUnits || foundInGoat.points };
      }

      if (chartHistory) {
        for (const [label, entries] of Object.entries(chartHistory)) {
          const existing = match.chartsByKind[label] || [];
          const existingKeys = new Set(existing.map((e: any) => e.item.toLowerCase()));
          for (const entry of entries) {
            if (!existingKeys.has(entry.item.toLowerCase())) {
              (match.chartsByKind[label] ||= []).push(entry);
            }
          }
          match.chartsByKind[label]?.sort((a: any, b: any) => a.peak - b.peak || b.weeks - a.weeks);
        }
      }
    }

    return { artist: match ?? null, slug: params.slug, profile, goatData, featuredOn, artist50Units, artist50Totals };
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
    <Link to="/chart/$chartId/$date" params={{ chartId: route.chartId, date }} className="hover:underline">
      {children}
    </Link>
  );
}

/* ────── ARTIST PAGE ────── */
function ArtistPage() {
  const { artist, profile, goatData, featuredOn, artist50Units, artist50Totals } = Route.useLoaderData();
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
  const allCharts = [...chartsToRender, ...otherCharts];

  const [selectedChart, setSelectedChart] = useState(allCharts[0] || "");
  const currentEntries = selectedChart ? (artist.chartsByKind[selectedChart] || []) : [];

  const no1s = currentEntries.filter((e: any) => e.peak === 1).length;
  const titles = currentEntries.length;
  const top10 = currentEntries.filter((e: any) => e.peak >= 1 && e.peak <= 10).length;

  const isAlbumChart = selectedChart === "Top 100 Albums" || selectedChart === "Top Album Sales" || selectedChart === "Top Streaming Albums";

  const totals = artist50Totals?.[artist.name];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      {/* Back Link */}
      <Link to="/artists" className="text-sm text-muted-foreground hover:text-[var(--accent)] mb-6 inline-flex items-center gap-2 transition-colors">
        <i className="fas fa-arrow-left" /> All artists
      </Link>

      {/* Hero Header */}
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[rgba(0,0,0,0.07)] uppercase tracking-tighter leading-none">EXPLORE</span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-black gold tracking-tight relative z-10 uppercase">{artist.name}</h1>
      </div>

      {/* Artist Image + Bio */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col md:flex-row gap-6 mb-10">
        <div className="w-full md:w-80 shrink-0">
          {profile?.imageUrl ? (
            <div className="aspect-square relative overflow-hidden rounded-xl border border-[var(--border)]">
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
            </div>
          ) : (
            <div className="aspect-square bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] flex items-center justify-center rounded-xl border border-[var(--border)]">
              <i className="fas fa-user text-5xl text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {profile && (
            <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
              {profile.followers > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)]">
                  <i className="fas fa-users text-[var(--accent)]" />
                  {profile.followers >= 1000000
                    ? `${(profile.followers / 1000000).toFixed(1)}M`
                    : profile.followers >= 1000
                    ? `${(profile.followers / 1000).toFixed(0)}K`
                    : profile.followers.toLocaleString()} Followers
                </span>
              )}
              {profile.genres.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] capitalize">
                  <i className="fas fa-music text-[var(--accent)]" />
                  {profile.genres.slice(0, 3).join(", ")}
                </span>
              )}
            </div>
          )}
          <div className="text-sm text-muted-foreground leading-relaxed">
            {profile?.bio ? profile.bio : `${artist.name} has ${Object.values(artist.chartsByKind).reduce((sum, entries) => sum + entries.length, 0)} chart entries across all charts.`}
          </div>
        </div>
      </motion.div>

      {/* Chart Selector + Summary Cards */}
      {allCharts.length > 0 && (
        <div className="mb-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[var(--accent)] text-black p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="font-black text-base leading-tight uppercase">{selectedChart || "—"}</div>
              </div>
            </div>
            <div className="border border-[var(--accent)] p-4">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--foreground)]">{no1s}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">NO. 1 HITS</div>
              </div>
            </div>
            <div className="border border-[var(--accent)] p-4">
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--foreground)]">{titles}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">TITLES</div>
              </div>
            </div>
          </div>

          {/* Chart Selector */}
          <div className="mb-4">
            <select
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
              className="bg-black text-white border border-[var(--border)] text-sm font-bold px-4 py-2 min-w-[200px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              {allCharts.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Table Header */}
          {currentEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-muted-foreground tracking-wider border-b border-[var(--border)]">
                    <th className="px-4 py-3 font-bold">{isAlbumChart ? "Album" : "Song"}</th>
                    <th className="px-3 py-3 text-center font-bold">Debut Date</th>
                    <th className="px-3 py-3 text-center font-bold">Peak Pos.</th>
                    <th className="px-3 py-3 text-center font-bold">Peak Date</th>
                    <th className="px-3 py-3 text-center font-bold">Wks. on Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[rgba(0,230,118,0.02)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold whitespace-normal break-words">
                          {selectedChart === "Top 50 Artists" ? e.item : isAlbumChart ? (
                            <Link to="/album/$slug" params={{ slug: slugifyArtist(e.item) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.item)}</Link>
                          ) : (
                            <Link to="/song/$slug" params={{ slug: slugifyArtist(e.item) }} className="hover:text-[var(--accent)] hover:underline">{stripFeatFromTitle(e.item)}</Link>
                          )}
                        </div>
                        {selectedChart !== "Top 50 Artists" && (
                          <div className="text-xs text-muted-foreground break-words">
                            {artist.name}
                            {!isAlbumChart && <TrackArtists song={e.item} artist={artist.name} className="text-xs text-muted-foreground" />}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-xs">
                        {e.firstEntry ? <DateLink chartName={selectedChart} date={e.firstEntry}>{formatDate(e.firstEntry)}</DateLink> : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="font-black text-base">#{e.peak}</div>
                        {(e.weeksAt1 ?? 0) > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-[var(--accent)] text-black text-[8px] font-bold rounded uppercase whitespace-nowrap mt-1">
                            {e.weeksAt1} WKS
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-xs">
                        {e.peakDate ? <DateLink chartName={selectedChart} date={e.peakDate}>{formatDate(e.peakDate)}</DateLink> : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-black text-lg">{e.weeks}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">No entries found for this chart.</div>
          )}
        </div>
      )}

      {/* Featured Collaborations */}
      {featuredOn && featuredOn.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="mt-8">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-[var(--border)]">
              <i className="fas fa-handshake text-[var(--accent)] text-lg" />
              <div>
                <h3 className="font-bold text-base sm:text-lg uppercase">Featured Collaborations</h3>
                <p className="text-xs text-muted-foreground">{featuredOn.length} {featuredOn.length === 1 ? "track" : "tracks"} where {artist.name} is featured</p>
              </div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {featuredOn.map((track, i) => (
                <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[rgba(0,230,118,0.02)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm break-words">{track.name}</div>
                    <div className="text-xs text-muted-foreground break-words">
                      <Link to="/artist/$slug" params={{ slug: track.slug }} className="hover:text-[var(--accent)] hover:underline">
                        {track.artist}
                      </Link>
                      {" & "}{artist.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Back Link Bottom */}
      <div className="mt-12 text-center">
        <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--accent)] transition-colors">
          <i className="fas fa-arrow-left" /> Browse all artists
        </Link>
      </div>
    </div>
  );
}
