import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllArtistStats, getGoatChart } from "@/lib/charts.functions";
import { getSpotifyArtistProfile } from "@/lib/spotify.functions";
import { slugifyArtist } from "@/lib/charts-config";
import React from "react";

export const Route = createFileRoute("/artist/$slug")({
  loader: async ({ params }) => {
    const all = await getAllArtistStats();
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
    
    return { artist: match ?? null, slug: params.slug, profile, goatData };
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

function ChartSection({ chart, entries }: { chart: string; entries: any[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const displayChartName = chart === "Top 40 Radio" ? "Radio Songs" : chart;
  const visibleEntries = expanded ? entries : entries.slice(0, 10);
  
  if (entries.length === 0) return null;

  const no1s = entries.filter(e => e.peak === 1).length;
  const top10s = entries.filter(e => e.peak >= 1 && e.peak <= 10).length;

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
  const colLabel = unitsLabel[chart] ?? "Units";

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
        <h2 className="section-title mb-0">{displayChartName}</h2>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded">
            #1's: <span className="text-[var(--foreground)]">{no1s}</span>
          </span>
          <span className="bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded">
            Top 10: <span className="text-[var(--foreground)]">{top10s}</span>
          </span>
          <span className="bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded">
            Entries: <span className="text-[var(--foreground)]">{entries.length}</span>
          </span>
        </div>
      </div>
      <div className="bg-[var(--card)] rounded-lg overflow-hidden border border-[var(--border)]">
        <div className="table-responsive">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-[var(--border)]">
                <th className="p-3">Item</th>
                <th className="p-3 text-center">Peak</th>
                <th className="p-3 text-center">Weeks</th>
                <th className="p-3 text-center">First Entry</th>
                <th className="p-3 text-center">Peak Date</th>
                <th className="p-3 text-right">{colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e, i: number) => (
                <tr key={i} className="border-t border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="p-3 font-semibold">{e.item}</td>
                  <td className="p-3 text-center font-bold gold">#{e.peak}</td>
                  <td className="p-3 text-center">{e.weeks}</td>
                  <td className="p-3 text-center text-muted-foreground text-xs">{e.firstEntry ?? "—"}</td>
                  <td className="p-3 text-center text-muted-foreground text-xs">{e.peakDate ?? "—"}</td>
                  <td className="p-3 text-right text-muted-foreground text-xs">{e.unitsSold ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.length > 10 && (
          <div className="p-3 text-center border-t border-[var(--border)]">
            <button
              onClick={() => setExpanded((value) => !value)}
              className="text-[var(--accent)] hover:underline text-sm font-semibold cursor-pointer"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ArtistPage() {
  const { artist, profile, goatData } = Route.useLoaderData();
  
  if (!artist) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold gold">Artist not found</h2>
        <Link to="/artists" className="btn-gold mt-4 inline-flex">Browse all artists</Link>
      </div>
    );
  }

  const top50 = artist.chartsByKind["Top 50 Artists"]?.[0] || artist.chartsByKind["Artists"]?.[0];
  const totalUnitsAny = artist.chartsByKind["Top 50 Artists"]?.[0]?.totalUnits || artist.chartsByKind["Artists"]?.[0]?.totalUnits || artist.chartsByKind["Top 50 Artists"]?.[0]?.unitsSold || artist.chartsByKind["Artists"]?.[0]?.unitsSold;

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      <Link to="/artists" className="text-sm text-muted-foreground hover:text-[var(--accent)] mb-4 inline-block">
        <i className="fas fa-arrow-left" /> All artists
      </Link>
      
      <div className="mt-2 mb-10 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)] shadow-md">
        {profile?.imageUrl ? (
          <img src={profile.imageUrl} alt={artist.name} className="w-20 h-20 sm:w-28 sm:h-28 md:w-48 md:h-48 rounded-full object-cover shadow-xl border-4 border-[var(--border)] shrink-0" />
        ) : (
          <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-48 md:h-48 rounded-full bg-[var(--muted)] flex items-center justify-center text-2xl sm:text-3xl md:text-4xl text-gray-500 border-4 border-[var(--border)] shrink-0">
            <i className="fas fa-user" />
          </div>
        )}

        <div className="flex-1 text-center md:text-left flex flex-col justify-center h-full min-h-0 w-full">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold mb-2 text-[var(--card-foreground)]">{artist.name}</h1>

          {profile && (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mb-4">
               {profile.followers > 0 && <span className="bg-[var(--card)] px-2 py-1 rounded-full border border-[var(--border)]"><i className="fas fa-users mr-2 text-muted-foreground"></i> {profile.followers.toLocaleString()} Followers</span>}
               {profile.genres.length > 0 && <span className="bg-[var(--card)] px-2 py-1 rounded-full border border-[var(--border)] capitalize"><i className="fas fa-music mr-2 text-muted-foreground"></i> {profile.genres.slice(0,3).join(", ")}</span>}
            </div>
          )}

          <div className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center justify-center md:justify-start gap-3 bg-[var(--card)] p-3 sm:p-4 rounded-xl border border-[var(--border)] w-full">
            <div className="text-center sm:text-left">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">GOAT Position</div>
              <div className="text-lg sm:text-2xl font-black gold">{goatData ? `#${goatData.position}` : "N/A"}</div>
            </div>
            <div className="w-px bg-[var(--border)] hidden sm:block"></div>
            <div className="text-center sm:text-left">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Total Units</div>
              <div className="text-lg sm:text-2xl font-black">{totalUnitsAny || goatData?.totalUnits || "—"}</div>
            </div>
            <div className="w-px bg-[var(--border)] hidden sm:block"></div>
            {top50 && (
              <>
                <div className="text-center sm:text-left">
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Top 50 Peak</div>
                  <div className="text-lg sm:text-2xl font-black">#{top50.peak}</div>
                </div>
                <div className="w-px bg-[var(--border)] hidden sm:block"></div>
                <div className="text-center sm:text-left">
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Weeks on Chart</div>
                  <div className="text-lg sm:text-2xl font-black">{top50.weeks}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {chartsToRender.map(c => (
          <ChartSection key={c} chart={c} entries={artist.chartsByKind[c]} />
        ))}
        {otherCharts.map(c => (
          <ChartSection key={c} chart={c} entries={artist.chartsByKind[c]} />
        ))}
      </div>
    </div>
  );
}
