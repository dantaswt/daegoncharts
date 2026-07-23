import { Link } from "@tanstack/react-router";
import type { ChartEntry } from "@/lib/charts.functions";
import { slugifyArtist, slugify as slugifyAlbum, chartsConfig } from "@/lib/charts-config";
import { useEffect, useMemo, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { motion } from "framer-motion";
import { TrackArtists, stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";

const mbCharts = new Set(["radioSongs", "topStreamingAlbums", "streamingSongs"]);
const streamsMBCharts = new Set(["songs", "albums", "artists"]);

function parseEuropeanNumber(v: string | undefined): number {
  let s = (v ?? "").trim();
  if (!s || s === "-") return 0;
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  if (s.includes(".") && ((s.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, "");
  }
  s = s.replace(/,/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function formatMB(v: string | undefined): string {
  const num = parseEuropeanNumber(v);
  if (num === 0) return v ?? "-";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}M`;
  return String(num);
}

function ordinal(n: number): string {
  if (n <= 0) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function wordOrdinal(n: number): string {
  const words = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
  if (n >= 0 && n <= 20) return words[n];
  return ordinal(n);
}

function formatValue(v: string | undefined, chartId?: string, isStream?: boolean): string {
  if (!v || v.trim() === "" || v.trim() === "-") return "-";
  if (isStream && chartId && streamsMBCharts.has(chartId)) {
    return formatMB(v);
  }
  if (chartId && mbCharts.has(chartId)) {
    return formatMB(v);
  }
  const num = parseEuropeanNumber(v);
  if (num === 0) return v;
  return num.toLocaleString("en-US");
}

function AwardIcon({ type }: { type: "gainer" | "performance" }) {
  if (type === "gainer") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-[var(--foreground)]" title="Greatest gainer this week">
        <i className="fas fa-star text-[10px] text-[var(--foreground)]" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6" title="Gains in performance">
      <i className="fas fa-star text-[var(--foreground)]" />
    </span>
  );
}

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
    const artistName = entry.artist.trim();
    if (/^ja[oã]$/i.test(artistName)) return 'artist:"Jão"';
    if (/^anitta$/i.test(artistName)) return 'artist:"Anitta"';
    return `track:"${entry.name}" artist:"${artistName}"`;
  }, [entry.name, entry.artist, kind]);
  const type = kind === "song" ? "track" : kind === "album" ? "album" : "artist";

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => { active = false; };
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
    <div className="flex flex-col items-end gap-0.5 text-[11px] leading-tight">
      {showDiff && (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 uppercase tracking-wide">LW</span>
          <span className="font-bold text-black w-6 text-right">{lastWeek}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 uppercase tracking-wide">Peak</span>
        <span className="font-bold text-black w-6 text-right">{peak.replace("#", "")}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-400 uppercase tracking-wide">Weeks</span>
        <span className="font-bold text-black w-6 text-right">{weeks}</span>
      </div>
    </div>
  );
}

export function ChartRow({ entry, kind, chartId, date, chartDates, chartEntriesByDate, showDiff = true }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const slug = slugifyArtist(entry.artist);
  const isGoat = chartId?.startsWith("goat");

  const awards = useMemo(() => {
    if (!date || !chartEntriesByDate || isGoat) return { gainer: false, performance: false };
    const currentEntries = chartEntriesByDate[date] || [];
    const prevIdx = chartDates?.indexOf(date);
    const prevDate = prevIdx !== undefined && prevIdx > 0 ? chartDates[prevIdx - 1] : undefined;
    const prevEntries = prevDate ? (chartEntriesByDate[prevDate] || []) : [];

    const metricKey = (e: ChartEntry) => {
      const u = parseEuropeanNumber(e.units);
      if (u > 0) return u;
      const s = parseEuropeanNumber(e.sales);
      if (s > 0) return s;
      const st = parseEuropeanNumber(e.streams);
      return st;
    };

    let maxMetric = 0;
    let gainerKey = "";
    for (const e of currentEntries) {
      const v = metricKey(e);
      if (v > maxMetric) { maxMetric = v; gainerKey = `${e.name}|${e.artist}`; }
    }

    const myKey = `${entry.name}|${entry.artist}`;
    const isGainer = maxMetric > 0 && gainerKey === myKey;

    let maxGain = 0;
    let perfKey = "";
    const myPrev = prevEntries.find((e) => `${e.name}|${e.artist}` === myKey);
    const myCurrentUnits = parseEuropeanNumber(entry.units);
    const myPrevUnits = myPrev ? parseEuropeanNumber(myPrev.units) : 0;
    const myGain = myCurrentUnits - myPrevUnits;
    for (const e of currentEntries) {
      const ek = `${e.name}|${e.artist}`;
      const ep = prevEntries.find((pe) => `${pe.name}|${pe.artist}` === ek);
      const eGain = parseEuropeanNumber(e.units) - (ep ? parseEuropeanNumber(ep.units) : 0);
      if (eGain > maxGain) { maxGain = eGain; perfKey = ek; }
    }
    const isPerf = maxGain > 0 && perfKey === myKey && !isGainer;

    return { gainer: isGainer, performance: isPerf };
  }, [date, chartEntriesByDate, chartDates, entry, isGoat]);

  const detailFields = useMemo(() => {
    const items: Array<{ label: string; value: string | undefined }> = [];

    if (awards.gainer) {
      items.push({ label: "Greatest Gainer This Week", value: "★ #1 in Sales/Streams" });
    }
    if (awards.performance) {
      items.push({ label: "Gains In Performance", value: "★ Biggest increase in units" });
    }

    if (chartId === "artists") {
      const salesVal = parseEuropeanNumber(entry.sales);
      const totalSalesVal = parseEuropeanNumber(entry.totalSales);
      const streamsVal = parseEuropeanNumber(entry.streams);
      const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
      const unitsVal = parseEuropeanNumber(entry.units);
      const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      items.push({ label: "Total Sales", value: totalSalesVal > 0 ? formatValue(entry.totalSales, chartId) : "-" });
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      return items;
    }

    if (chartId === "songs") {
      if (entry.points) items.push({ label: "Points", value: formatValue(entry.points, chartId) });
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (entry.airplay !== undefined) {
        const airVal = parseEuropeanNumber(entry.airplay);
        items.push({ label: "Airplay", value: airVal > 0 ? formatValue(entry.airplay, chartId, true) : "-" });
      }
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      const unitsVal = parseEuropeanNumber(entry.units);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      if (entry.totalUnits !== undefined) {
        const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
        items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      }
      if (entry.certification) items.push({ label: "Certification", value: entry.certification });
      return items;
    }

    if (chartId === "albums") {
      const unitsVal = parseEuropeanNumber(entry.units);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
      if (entry.totalUnits !== undefined) {
        const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
        items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
      }
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Pure Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "SEA", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (entry.certification) items.push({ label: "Certification", value: entry.certification });
      return items;
    }

    if (chartId === "yearEndRadio" || chartId === "goatRadio") {
      if (entry.units) items.push({ label: "Total Audience", value: formatValue(entry.units, chartId) });
      return items;
    }

    if (chartId === "topStreamingAlbums" || chartId === "streamingSongs") {
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
      if (entry.totalStreams !== undefined) {
        const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
        items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
      }
      if (entry.certification) items.push({ label: "Certification", value: entry.certification });
      return items;
    }

    if (chartId === "topAlbumSales" || chartId === "digitalSongsSales") {
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
      if (entry.totalSales !== undefined) {
        const totalSalesVal = parseEuropeanNumber(entry.totalSales);
        items.push({ label: "Total Sales", value: totalSalesVal > 0 ? formatValue(entry.totalSales, chartId) : "-" });
      }
      if (entry.certification) items.push({ label: "Certification", value: entry.certification });
      return items;
    }

    // Fallback for other charts
    if (entry.units) {
      const unitsVal = parseEuropeanNumber(entry.units);
      items.push({ label: "Units", value: unitsVal > 0 ? formatValue(entry.units, chartId) : "-" });
    }
    if (entry.totalUnits) {
      const totalUnitsVal = parseEuropeanNumber(entry.totalUnits);
      items.push({ label: "Total Units", value: totalUnitsVal > 0 ? formatValue(entry.totalUnits, chartId) : "-" });
    }
    if (entry.sales) {
      const salesVal = parseEuropeanNumber(entry.sales);
      items.push({ label: "Sales", value: salesVal > 0 ? formatValue(entry.sales, chartId) : "-" });
    }
    if (entry.streams) {
      const streamsVal = parseEuropeanNumber(entry.streams);
      items.push({ label: "Streams", value: streamsVal > 0 ? formatValue(entry.streams, chartId, true) : "-" });
    }
    if (entry.totalStreams) {
      const totalStreamsVal = parseEuropeanNumber(entry.totalStreams);
      items.push({ label: "Total Streams", value: totalStreamsVal > 0 ? formatValue(entry.totalStreams, chartId, true) : "-" });
    }
    if (entry.audience !== undefined) {
      const audVal = parseEuropeanNumber(entry.audience);
      items.push({ label: "Audience", value: audVal > 0 ? formatValue(entry.audience, chartId) : "-" });
    }
    if (entry.airplay !== undefined) {
      const airVal = parseEuropeanNumber(entry.airplay);
      items.push({ label: "Airplay", value: airVal > 0 ? formatValue(entry.airplay, chartId, true) : "-" });
    }
    if (entry.certification) items.push({ label: "Certification", value: entry.certification });
    return items;
  }, [awards, chartId, entry.airplay, entry.audience, entry.certification, entry.points, entry.sales, entry.streams, entry.totalStreams, entry.totalUnits, entry.units, entry.lastWeek, isGoat, kind]);

  const metric = kind === "song" ? entry.points ?? entry.units : entry.units ?? entry.points;

  const handleCopy = async () => {
    const cfg = chartId ? chartsConfig[chartId] : undefined;
    const chartTitle = cfg ? cfg.title : "Chart";
    const isAlbum = kind === "album";
    const isNew = entry.diff === "NEW";
    const isReEntry = entry.diff === "RE";
    const isUp = entry.diff?.startsWith("▲");
    const atPeak = entry.position === entry.peak;
    const w1 = entry.weeksAt1 ?? 0;

    // Diff symbols: ▲→+, ▼→-
    let copyDiff = entry.diff;
    if (copyDiff === "NEW") copyDiff = "new";
    else if (copyDiff === "RE") copyDiff = "re";
    else if (copyDiff.startsWith("▲")) copyDiff = "+" + copyDiff.slice(1);
    else if (copyDiff.startsWith("▼")) copyDiff = "-" + copyDiff.slice(1);

    // Position part
    const posPart = isNew ? `#${entry.position}(new)` : `#${entry.position}(${copyDiff})`;

    // Metrics
    const metricsPart = isAlbum && entry.units ? formatValue(entry.units, chartId) : "";

    // Album new entry format: units first, then streams/sales in bracket
    let entryDetail = "";
    if (isAlbum && isNew) {
      const unitsRaw = parseEuropeanNumber(entry.units);
      const unitsStr = unitsRaw > 0 ? unitsRaw.toLocaleString("en-US") : "";
      const streamsRaw = parseEuropeanNumber(entry.streams);
      const salesRaw = parseEuropeanNumber(entry.sales);
      const streamsStr = streamsRaw > 0 ? `${streamsRaw.toLocaleString("en-US")} million on-demand streams` : "";
      const salesStr = salesRaw > 0 ? `${salesRaw.toLocaleString("en-US")} pure sales` : "";
      const bracketParts = [];
      if (streamsStr) bracketParts.push(streamsStr);
      if (salesStr) bracketParts.push(salesStr);
      const bracket = bracketParts.length > 0 ? ` [${bracketParts.join(" | ")}].` : ".";
      entryDetail = unitsStr ? `${unitsStr}${bracket}` : bracket;
    } else {
      const unitsStr = metricsPart || "";
      const totalUnitsRaw = parseEuropeanNumber(entry.totalUnits);
      const totalStr = totalUnitsRaw > 0 ? ` (${totalUnitsRaw.toLocaleString("en-US")} units since release)` : "";
      entryDetail = unitsStr ? `${unitsStr}${totalStr}` : "";
    }

    // Annotations at end (replaces peak annotation)
    let annotation = "";
    const isRePeak = atPeak && isUp && !isNew && entry.position === 1 && w1 > 1;
    const isWeeksAt1 = entry.position === 1 && w1 > 1 && !isRePeak;

    if (isRePeak) {
      annotation = `*re-peak; ${wordOrdinal(w1)} week at #1*`;
    } else if (isWeeksAt1) {
      annotation = `*${wordOrdinal(w1)} week at #1*`;
    } else if (atPeak && (isUp || isReEntry) && !isNew) {
      annotation = `*new peak*`;
    } else {
      annotation = w1 > 0 ? `*peak: #${entry.peak} for ${w1} weeks*` : `*peak: #${entry.peak}*`;
    }

    // Chart date
    let chartDateStr = "";
    if (date) {
      const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      chartDateStr = `\n\nChart dated ${formattedDate}.`;
    }

    const weeksPart = isNew ? "" : `[${entry.weeks} weeks].`;
    const annotationPart = isNew ? "" : annotation;

    const featInfo = getFeatArtistsFromTitle(entry.name);
    const artistPart = featInfo ? `${entry.artist} ${featInfo.prefix} ${featInfo.artists}` : entry.artist;

    const parts = [
      `Daegon's ${chartTitle}:`,
      posPart,
      `${stripFeatFromTitle(entry.name)},`,
      artistPart,
      entryDetail,
      weeksPart,
      annotationPart
    ].filter(Boolean).join(" ");

    const textToCopy = `${parts}${chartDateStr}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
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
      {/* Desktop layout */}
      <div className="hidden md:grid gap-3 items-center" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
        <div className={`flex flex-col items-center justify-center ${entry.position === 1 ? "w-24" : "w-16"}`}>
          <div className={`rank-num font-black ${entry.position === 1 ? "text-6xl" : "text-3xl"}`}>{entry.position}</div>
          {entry.position === 1 && (entry.weeksAt1 ?? 0) > 0 && (
            <div className="mt-0.5 px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
              {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"}
            </div>
          )}
        </div>
        <div className={`placeholder-art flex items-center justify-center overflow-hidden bg-gray-100 rounded-none flex-shrink-0 ${entry.position === 1 ? "w-[180px] h-[180px]" : "w-24 h-24"}`}>
          <SpotifyImage entry={entry} kind={kind} />
        </div>
        <div className="flex items-center justify-center w-8 flex-shrink-0">
          {showDiff && <DiffIndicator diff={entry.diff} />}
        </div>
        <div className="min-w-0 flex flex-col flex-1">
          <div className={`font-bold break-words line-clamp-2 flex flex-wrap items-center gap-1.5 ${entry.position === 1 ? "text-xl" : "text-base"}`}>
            {kind === "album" ? (
              <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                {stripFeatFromTitle(entry.name)}
              </Link>
            ) : kind === "song" ? (
              <Link to="/song/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                {stripFeatFromTitle(entry.name)}
              </Link>
            ) : (
              stripFeatFromTitle(entry.name)
            )}
            {entry.position !== 1 && (entry.weeksAt1 ?? 0) > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
                {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
              </span>
            )}
          </div>
          <div className={`break-words line-clamp-2 ${entry.position === 1 ? "text-base text-gray-400" : "text-sm text-gray-500"}`}>
            <Link
              to="/artist/$slug"
              params={{ slug }}
              className="hover:text-[var(--accent)] hover:underline"
            >
              {kind === "artist" ? "View Artist Page" : entry.artist}
            </Link>
            {kind === "song" && <TrackArtists song={entry.name} artist={entry.artist} className="text-sm text-gray-500" />}
          </div>
          {kind === "song" && chartId !== "songs" && chartId !== "streamingSongs" && entry.album && (
            <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.album) }} className="text-[11px] text-gray-500 break-words hover:text-[var(--accent)] hover:underline">{entry.album}</Link>
          )}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {(awards.gainer || awards.performance) && (
            <div className="flex items-center">
              <AwardIcon type={awards.gainer ? "gainer" : "performance"} />
            </div>
          )}
          <ChartMetrics entry={entry} showDiff={showDiff} />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={handleCopy} className="w-8 h-8 rounded-full bg-white text-black text-sm hover:bg-gray-200 active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Copy info">
              <i className="fas fa-copy" />
            </button>
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="w-8 h-8 rounded-full bg-white text-black text-sm hover:bg-gray-200 active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
              {showDetails ? "−" : "+"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col">
        {/* Top row: rank + image + name/artist + buttons */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center justify-center w-10 flex-shrink-0">
            <div className="rank-num text-lg font-black">{entry.position}</div>
            <div className="flex items-center justify-center h-4">
              {showDiff && <DiffIndicator diff={entry.diff} />}
            </div>
            {entry.position === 1 && (entry.weeksAt1 ?? 0) > 0 && (
              <div className="mt-0.5 px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] font-bold rounded whitespace-nowrap uppercase">
                {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"}
              </div>
            )}
          </div>
          <div className="placeholder-art flex items-center justify-center overflow-hidden bg-gray-100 rounded-none w-14 h-14 flex-shrink-0">
            <SpotifyImage entry={entry} kind={kind} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
              {kind === "album" ? (
                <Link to="/album/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                  {stripFeatFromTitle(entry.name)}
                </Link>
              ) : kind === "song" ? (
                <Link to="/song/$slug" params={{ slug: slugifyAlbum(entry.name) }} className="hover:text-[var(--accent)] hover:underline">
                  {stripFeatFromTitle(entry.name)}
                </Link>
              ) : (
                stripFeatFromTitle(entry.name)
              )}
              {entry.position !== 1 && (entry.weeksAt1 ?? 0) > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] font-bold rounded whitespace-nowrap uppercase">
                  {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 break-words line-clamp-2">
              <Link
                to="/artist/$slug"
                params={{ slug }}
                className="hover:text-[var(--accent)] hover:underline"
              >
                {kind === "artist" ? "View Artist Page" : entry.artist}
              </Link>
              {kind === "song" && <TrackArtists song={entry.name} artist={entry.artist} className="text-[10px] text-gray-500" />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {metric && (
              <div className="text-right text-sm font-bold text-white tracking-tight">{formatValue(metric, chartId)}</div>
            )}
            <div className="flex flex-row items-center gap-1.5">
              {(awards.gainer || awards.performance) && (
                <AwardIcon type={awards.gainer ? "gainer" : "performance"} />
              )}
              <button type="button" onClick={handleCopy} className="w-8 h-8 rounded-full bg-white text-black text-sm hover:bg-gray-200 active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Copy info">
                <i className="fas fa-copy" />
              </button>
              <button type="button" onClick={() => setShowDetails((v) => !v)} className="w-8 h-8 rounded-full bg-white text-black text-sm hover:bg-gray-200 active:bg-[var(--accent)] active:text-white active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
                {showDetails ? "−" : "+"}
              </button>
            </div>
          </div>
        </div>
        {/* Bottom row: LW / Peak / Weeks — always visible, fixed at bottom */}
        <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-3 text-[11px] text-muted-foreground">
          {showDiff && <span>LW: <span className="font-semibold text-[var(--foreground)]">{entry.lastWeek !== undefined && entry.lastWeek.trim() !== "" ? (entry.lastWeek === "0" ? "-" : entry.lastWeek) : "-"}</span></span>}
          <span>Peak: <span className="font-semibold text-[var(--foreground)]">{entry.peak > 0 ? `#${entry.peak}` : "-"}</span></span>
          <span>Weeks: <span className="font-semibold text-[var(--foreground)]">{entry.weeks > 0 ? String(entry.weeks) : "-"}</span></span>
        </div>
      </div>

      {/* Details panel (shared) */}
      {showDetails && (
        <div className="mt-3 w-full rounded-xl bg-black p-3 border border-white text-sm animate-fade-in">
          {detailFields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {detailFields.map((item) => (
                <div key={item.label} className="rounded-3xl bg-black border border-white p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          )}
          {runEntries.length > 0 ? (
            <div>
              <div className="font-semibold mb-2 text-white">Chart run</div>
              <div className="space-y-2">
                {runEntries.map((run) => (
                  <a
                    key={`${run.date}-${run.position}`}
                    href={`/chart/${chartId}/${run.date}`}
                    className="block rounded-3xl border border-white bg-black p-3 transition hover:border-[var(--accent)] hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm text-white">
                      <span>{new Date(run.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span className="font-semibold text-[var(--accent)]">{run.position}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                      <span>Peak: {run.peak}</span>
                      <span>Weeks: {run.weeks}</span>
                      {run.points && <span>Points: {formatValue(run.points, chartId)}</span>}
                      {run.totalUnits && <span>Total Units: {formatValue(run.totalUnits, chartId)}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Details shown. Press + again to close.</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
