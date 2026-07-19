import { Link } from "@tanstack/react-router";
import type { ChartEntry } from "@/lib/charts.functions";
import { slugifyArtist, chartsConfig } from "@/lib/charts-config";
import { useEffect, useMemo, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { motion } from "framer-motion";

function DiffIndicator({ diff }: { diff: string }) {
  if (!diff) return null;
  if (diff === "NEW") return <span className="diff-badge diff-new">NEW</span>;
  if (diff === "RE") return <span className="diff-badge diff-new">RE-ENTRY</span>;
  if (diff === "=") return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>;
  if (diff.startsWith("▲")) {
    return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v10M4 7l4-4 4 4"/></svg></span>;
  }
  if (diff.startsWith("▼")) {
    return <span className="diff-steady flex items-center justify-center"><svg className="diff-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M4 9l4 4 4-4"/></svg></span>;
  }
  return <span className="text-xs">{diff}</span>;
}

interface Props {
  entry: ChartEntry;
  kind: "song" | "album" | "artist";
  chartId?: string;
  date?: string;
  chartDates?: string[];
  chartEntriesByDate?: Record<string, ChartEntry[]>;
  showDiff?: boolean;
}

function SpotifyImage({ entry, kind }: { entry: ChartEntry; kind: "song" | "album" | "artist" }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const query = useMemo(() => {
    if (kind === "album") {
      return `album:"${entry.name}" artist:"${entry.artist}"`;
    }
    if (kind === "artist") {
      const name = entry.name.trim();
      if (/^ja[oã]$/i.test(name)) return 'artist:"Jão"';
      if (/^anitta$/i.test(name)) return 'artist:"Anitta"';
      return `artist:"${name}"`;
    }
    // Resolve artists from the charted song first, avoiding similarly named artists.
    const artistName = entry.artist.trim();
    if (/^ja[oã]$/i.test(artistName)) return 'artist:"Jão"';
    if (/^anitta$/i.test(artistName)) return 'artist:"Anitta"';
    return `artist:"${artistName}" track:"${entry.name}"`;
  }, [entry.name, entry.artist, kind]);
  const type = kind === "album" ? "album" : "artist";

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => {
      active = false;
    };
  }, [query, type]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={entry.name}
        className="w-full h-full object-cover shadow-sm rounded-none"
      />
    );
  }

  return <i className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} text-2xl opacity-50`} />;
}

function ChartMetrics({ entry, showDiff }: { entry: ChartEntry; showDiff?: boolean }) {
  const lastWeek = entry.lastWeek !== undefined && entry.lastWeek.trim() !== "" ? (entry.lastWeek === "0" ? "-" : entry.lastWeek) : "-";
  const peak = entry.peak > 0 ? `#${entry.peak}` : "-";
  const weeks = entry.weeks > 0 ? String(entry.weeks) : "-";

  return (
    <div className="mt-1 md:mt-2 grid grid-cols-3 gap-x-2 md:flex md:gap-x-3 text-[10px] md:text-[11px] text-muted-foreground">
      {showDiff && <span className="truncate">LW: <span className="font-semibold">{lastWeek}</span></span>}
      <span className="truncate">Peak: <span className="font-semibold">{peak}</span></span>
      <span className="truncate">Weeks: <span className="font-semibold">{weeks}</span></span>
    </div>
  );
}

export function ChartRow({ entry, kind, chartId, date, chartDates, chartEntriesByDate, showDiff = true }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const slug = slugifyArtist(entry.artist);
  const isGoat = chartId?.startsWith("goat");

  const detailFields = useMemo(() => {
    const items: Array<{ label: string; value: string | undefined }> = [];
    if (kind === "song" && entry.points) items.push({ label: "Points", value: entry.points });
    if (chartId === "songs" && entry.units) items.push({ label: "Units", value: entry.units });
    if ((kind === "album" || kind === "artist") && entry.units && !["topStreamingAlbums", "topAlbumSales", "streamingSongs", "digitalSongsSales"].includes(chartId ?? "")) {
      items.push({ label: "Units", value: entry.units });
    }
    if (chartId === "yearEndRadio" || chartId === "goatRadio") {
      if (entry.units) items.push({ label: "Total Audience", value: entry.units });
    }
    if (!isGoat && entry.audience) items.push({ label: "Audience", value: entry.audience });
    if (!isGoat && entry.airplay) items.push({ label: "Airplay", value: entry.airplay });
    if (!isGoat && entry.sales) {
      const label = chartId === "albums" ? "Pure Sales" : "Sales";
      items.push({ label, value: entry.sales });
    }
    if (!isGoat && entry.streams && ["songs", "albums", "topStreamingAlbums", "streamingSongs", "yearEndAlbums"].includes(chartId ?? "")) {
      let label = "Streaming";
      if (chartId === "songs") label = "Streams";
      if (chartId === "albums" || chartId === "topStreamingAlbums") label = "Streams";
      if (chartId === "streamingSongs") label = "Streams";
      items.push({ label, value: entry.streams });
    }    if (!isGoat && entry.totalStreams) {
      items.push({ label: "Total Streams", value: entry.totalStreams });
    }
    if (!isGoat && entry.totalSales) {
      const label = chartId === "albums" || chartId === "topStreamingAlbums" ? "" : "Total Sales";
      if (label) items.push({ label, value: entry.totalSales });
    }
    if (entry.totalUnits && chartId !== "yearEndRadio" && chartId !== "goatRadio") {
      let totalLabel = "Total Units";
      if (chartId === "topStreamingAlbums" || chartId === "streamingSongs") totalLabel = "Total Streams";
      if (chartId === "topAlbumSales" || chartId === "digitalSongsSales") totalLabel = "Total Sales";
      if (chartId === "albums" || chartId === "topStreamingAlbums") totalLabel = "Total Units";
      if (chartId === "yearEndRadio" || chartId === "goatRadio") totalLabel = "Total Audience";
      items.push({ label: totalLabel, value: entry.totalUnits });
    }
    if (entry.certification) items.push({ label: "Certification", value: entry.certification });
    return items;
  }, [chartId, entry.airplay, entry.audience, entry.certification, entry.points, entry.sales, entry.streams, entry.totalUnits, entry.units, entry.lastWeek, isGoat, kind]);

  const metric = kind === "song" ? entry.points ?? entry.units : entry.units ?? entry.points;

  const handleCopy = () => {
    const cfg = chartId ? chartsConfig[chartId] : undefined;
    const chartTitle = cfg ? cfg.title : "Chart";
    const isAlbum = kind === "album";
    
    // Convert diff symbols: ▲→+, ▼→-
    let copyDiff = entry.diff;
    if (copyDiff === "NEW" || copyDiff === "RE") copyDiff = copyDiff.toLowerCase();
    if (copyDiff.startsWith("▲")) copyDiff = "+" + copyDiff.slice(1);
    else if (copyDiff.startsWith("▼")) copyDiff = "-" + copyDiff.slice(1);
    
    // Use raw values from CSV columns (no locale conversion)
    const metricStr = isAlbum && entry.units ? entry.units : "";
    const totalStr = isAlbum && entry.totalUnits ? `(${entry.totalUnits} total units)` : "";
    
    const peakStr = (entry.weeksAt1 ?? 0) > 0 ? `*peak: #${entry.peak} for ${entry.weeksAt1} weeks*` : `*peak: #${entry.peak}*`;
    
    let chartDateStr = "";
    if (date) {
      const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      chartDateStr = `\n\nChart dated ${formattedDate}.`;
    }

    const parts = [
      `Daegon's ${chartTitle}:`,
      `#${entry.position}(${copyDiff})`,
      `${entry.name},`,
      entry.artist,
      metricStr,
      totalStr,
      `[${entry.weeks} weeks].`,
      peakStr
    ].filter(Boolean).join(" ");

    navigator.clipboard.writeText(`${parts}${chartDateStr}`);
  };

  const runEntries = useMemo(() => {
    if (!chartDates || !chartEntriesByDate || !chartId || isGoat) return [];
    const key = `${entry.name.toLowerCase()}|${entry.artist.toLowerCase()}`;
    return chartDates
      .filter((d) => !date || d <= date)
      .flatMap((d) => (chartEntriesByDate[d] || [])
        .filter((e) => `${e.name.toLowerCase()}|${e.artist.toLowerCase()}` === key)
        .map((e) => ({ date: d, position: e.position, peak: e.peak, weeks: e.weeks, points: e.points, totalUnits: e.totalUnits }))
      );
  }, [chartDates, chartEntriesByDate, chartId, entry.artist, entry.name, isGoat, date]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      id={`entry-${entry.position}`}
className="chart-card w-full"
  >
      <div className="flex gap-2 w-full md:grid md:grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] md:gap-3">
        <div className="flex items-center gap-2 md:contents">
          <div className="flex flex-col items-center justify-center w-10 md:w-16 flex-shrink-0">
            <div className="rank-num text-lg md:text-3xl font-black">{entry.position}</div>
            <div className="flex items-center justify-center h-4 md:hidden">
              {showDiff && <DiffIndicator diff={entry.diff} />}
            </div>
            {entry.position === 1 && (entry.weeksAt1 ?? 0) > 0 && (
              <div className="mt-0.5 px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] md:text-[9px] font-bold rounded whitespace-nowrap uppercase">
                {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"}
              </div>
            )}
          </div>
          <div className="placeholder-art flex items-center justify-center overflow-hidden bg-gray-100 rounded-none w-14 h-14 md:w-24 md:h-24 flex-shrink-0">
            <SpotifyImage entry={entry} kind={kind} />
          </div>
          <div className="hidden md:flex items-center justify-center w-8 flex-shrink-0">
            {showDiff && <DiffIndicator diff={entry.diff} />}
          </div>
        </div>

      <div className="min-w-0 flex flex-col flex-1">
        <div className="font-bold text-xs md:text-base break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
          {entry.name}
          {entry.position !== 1 && (entry.weeksAt1 ?? 0) > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] md:text-[9px] font-bold rounded whitespace-nowrap uppercase">
              {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
            </span>
          )}
        </div>
        <Link
          to="/artist/$slug"
          params={{ slug }}
          className="text-[10px] md:text-sm text-gray-500 hover:text-[var(--accent)] hover:underline block break-words line-clamp-2"
        >
          {kind === "artist" ? "View Artist Page" : entry.artist}
        </Link>
        {kind === "song" && chartId !== "songs" && chartId !== "streamingSongs" && entry.album && (
          <div className="text-[10px] text-gray-500 break-words truncate md:whitespace-normal md:break-words hidden md:block">{entry.album}</div>
        )}
        <div className="hidden md:block">
          <ChartMetrics entry={entry} showDiff={showDiff} />
        </div>
        <div className="md:hidden">
          <ChartMetrics entry={entry} showDiff={showDiff} />
        </div>
      </div>

      <div className="flex flex-row items-center gap-2 md:gap-4 w-auto flex-shrink-0 justify-end">
        {metric && (
          <div className="text-right text-sm md:text-2xl font-bold text-white tracking-tight">{metric}</div>
        )}
        <div className="flex flex-col md:flex-row gap-1 md:gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--accent)] transition-all duration-200 flex items-center justify-center"
            aria-label="Copy info"
          >
            <i className="fas fa-copy" />
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="w-7 h-7 md:w-8 md:h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--foreground)] transition-all duration-200 flex items-center justify-center"
            aria-label="Toggle details"
          >
            {showDetails ? "−" : "+"}
          </button>
        </div>
      </div>
      </div>
      {showDetails && (
        <div className="mt-3 w-full rounded-xl bg-[var(--muted)] p-3 border border-[var(--border)] text-sm text-muted-foreground animate-fade-in">
          {detailFields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {detailFields.map((item) => (
                <div key={item.label} className="rounded-3xl bg-[var(--muted)] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {runEntries.length > 0 ? (
            <div>
              <div className="font-semibold mb-2">Chart run</div>
              <div className="space-y-2">
                {runEntries.map((run) => (
                  <a
                    key={`${run.date}-${run.position}`}
                    href={`/chart/${chartId}/${run.date}`}
                    className="block rounded-3xl border border-[var(--border-dark)] bg-[var(--muted)] p-3 transition hover:border-[var(--accent)] hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>{new Date(run.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="font-semibold">{run.position}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-300">
                      <span>Peak: {run.peak}</span>
                      <span>Weeks: {run.weeks}</span>
                      {run.points && <span>Points: {run.points}</span>}
                      {run.totalUnits && <span>Total Units: {run.totalUnits}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Details shown. Press + again to close.</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
