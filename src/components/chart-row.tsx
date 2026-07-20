import { Link } from "@tanstack/react-router";
import type { ChartEntry } from "@/lib/charts.functions";
import { slugifyArtist, chartsConfig } from "@/lib/charts-config";
import { useEffect, useMemo, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { motion } from "framer-motion";

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
    <div className="mt-1.5 md:mt-2 flex flex-wrap gap-x-3 md:gap-x-4 gap-y-0.5 text-[11px] md:text-[12px] text-muted-foreground">
      {showDiff && <span>LW: <span className="font-semibold text-[var(--foreground)]">{lastWeek}</span></span>}
      <span>Peak: <span className="font-semibold text-[var(--foreground)]">{peak}</span></span>
      <span>Weeks: <span className="font-semibold text-[var(--foreground)]">{weeks}</span></span>
    </div>
  );
}

export function ChartRow({ entry, kind, chartId, date, chartDates, chartEntriesByDate, showDiff = true }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const slug = slugifyArtist(entry.artist);
  const isGoat = chartId?.startsWith("goat");

  const detailFields = useMemo(() => {
    const items: Array<{ label: string; value: string | undefined }> = [];

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
  }, [chartId, entry.airplay, entry.audience, entry.certification, entry.points, entry.sales, entry.streams, entry.totalStreams, entry.totalUnits, entry.units, entry.lastWeek, isGoat, kind]);

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

    const parts = [
      `Daegon's ${chartTitle}:`,
      posPart,
      `${entry.name},`,
      entry.artist,
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
      <div className="hidden md:grid gap-3" style={{ gridTemplateColumns: "auto auto auto minmax(0,1fr) auto" }}>
        <div className="flex flex-col items-center justify-center w-16">
          <div className="rank-num text-3xl font-black">{entry.position}</div>
          {entry.position === 1 && (entry.weeksAt1 ?? 0) > 0 && (
            <div className="mt-0.5 px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
              {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"}
            </div>
          )}
        </div>
        <div className="placeholder-art flex items-center justify-center overflow-hidden bg-gray-100 rounded-none w-24 h-24 flex-shrink-0">
          <SpotifyImage entry={entry} kind={kind} />
        </div>
        <div className="flex items-center justify-center w-8 flex-shrink-0">
          {showDiff && <DiffIndicator diff={entry.diff} />}
        </div>
        <div className="min-w-0 flex flex-col flex-1">
          <div className="font-bold text-base break-words line-clamp-2 flex flex-wrap items-center gap-1.5">
            {entry.name}
            {entry.position !== 1 && (entry.weeksAt1 ?? 0) > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[9px] font-bold rounded whitespace-nowrap uppercase">
                {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
              </span>
            )}
          </div>
          <Link
            to="/artist/$slug"
            params={{ slug }}
            className="text-sm text-gray-500 hover:text-[var(--accent)] hover:underline block break-words line-clamp-2"
          >
            {kind === "artist" ? "View Artist Page" : entry.artist}
          </Link>
          {kind === "song" && chartId !== "songs" && chartId !== "streamingSongs" && entry.album && (
            <div className="text-[11px] text-gray-500 break-words">{entry.album}</div>
          )}
          <ChartMetrics entry={entry} showDiff={showDiff} />
        </div>
        <div className="flex flex-row items-center gap-4 flex-shrink-0 justify-end">
          {metric && (
            <div className="text-right text-2xl font-bold text-white tracking-tight">{formatValue(metric, chartId)}</div>
          )}
          <div className="flex flex-row gap-2">
            <button type="button" onClick={handleCopy} className="w-8 h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--accent)] transition-all duration-200 flex items-center justify-center" aria-label="Copy info">
              <i className="fas fa-copy" />
            </button>
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="w-8 h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--foreground)] transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
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
              {entry.name}
              {entry.position !== 1 && (entry.weeksAt1 ?? 0) > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD600] text-black text-[8px] font-bold rounded whitespace-nowrap uppercase">
                  {entry.weeksAt1} {entry.weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT #1
                </span>
              )}
            </div>
            <Link
              to="/artist/$slug"
              params={{ slug }}
              className="text-[10px] text-gray-500 hover:text-[var(--accent)] hover:underline block break-words line-clamp-2"
            >
              {kind === "artist" ? "View Artist Page" : entry.artist}
            </Link>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {metric && (
              <div className="text-right text-sm font-bold text-white tracking-tight">{formatValue(metric, chartId)}</div>
            )}
            <div className="flex flex-row gap-1.5">
              <button type="button" onClick={handleCopy} className="w-8 h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--accent)] active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Copy info">
                <i className="fas fa-copy" />
              </button>
              <button type="button" onClick={() => setShowDetails((v) => !v)} className="w-8 h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--foreground)] active:scale-95 transition-all duration-200 flex items-center justify-center" aria-label="Toggle details">
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
                      {run.points && <span>Points: {formatValue(run.points, chartId)}</span>}
                      {run.totalUnits && <span>Total Units: {formatValue(run.totalUnits, chartId)}</span>}
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
