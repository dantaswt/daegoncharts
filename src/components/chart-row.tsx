import { Link } from "@tanstack/react-router";
import type { ChartEntry } from "@/lib/charts.functions";
import { slugifyArtist } from "@/lib/charts-config";
import { useEffect, useMemo, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";

function DiffIndicator({ diff }: { diff: string }) {
  if (!diff) return null;
  if (diff === "NEW") return <span className="diff-new text-xs">NEW</span>;
  if (diff === "RE") return <span className="diff-new text-xs">RE</span>;
  if (diff === "=") return <span className="diff-steady text-xs">=</span>;
  if (diff.startsWith("▲")) return <span className="diff-up text-xs">{diff}</span>;
  if (diff.startsWith("▼")) return <span className="diff-down text-xs">{diff}</span>;
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
    const base = kind === "album" ? `${entry.name} ${entry.artist}` : kind === "artist" ? entry.name : entry.artist;
    const normalized = base.trim();
    if (/^ja[oã]$/i.test(normalized)) {
      // Use well-known album and song keywords for Jão to improve Spotify search accuracy
      return "Jão Lobos PIRATA SUPER Idiota Pilantra cantor brasileiro";
    }
    if (/^anitta$/i.test(normalized)) {
      return `${normalized} cantora singer`;
    }
    return normalized;
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

export function ChartRow({ entry, kind, chartId, date, chartDates, chartEntriesByDate, showDiff = true }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const slug = slugifyArtist(entry.artist);
  const isGoat = chartId?.startsWith("goat");

  const detailFields = useMemo(() => {
    const items: Array<{ label: string; value: string | undefined }> = [];
    if (kind === "song" && entry.points) items.push({ label: "Points", value: entry.points });
    if ((kind === "album" || kind === "artist") && entry.units) items.push({ label: "Units", value: entry.units });
    if (!isGoat && entry.sales) items.push({ label: "Sales", value: entry.sales });
    if (!isGoat && entry.streams) items.push({ label: "Streaming", value: entry.streams });
    if (!isGoat && entry.airplay) items.push({ label: "Airplay", value: entry.airplay });
    if (entry.totalUnits) items.push({ label: "Total Units", value: entry.totalUnits });
    if (entry.certification) items.push({ label: "Certification", value: entry.certification });
    return items;
  }, [chartId, entry.airplay, entry.certification, entry.points, entry.sales, entry.streams, entry.totalUnits, entry.units, isGoat, kind]);

  const metric = kind === "song" ? entry.points ?? entry.units : entry.units ?? entry.points;

  const runEntries = useMemo(() => {
    if (!chartDates || !chartEntriesByDate || !chartId || isGoat) return [];
    const key = `${entry.name.toLowerCase()}|${entry.artist.toLowerCase()}`;
    return chartDates
      .flatMap((date) => (chartEntriesByDate[date] || [])
        .filter((e) => `${e.name.toLowerCase()}|${e.artist.toLowerCase()}` === key)
        .map((e) => ({ date, position: e.position, peak: e.peak, weeks: e.weeks, points: e.points, totalUnits: e.totalUnits }))
      );
  }, [chartDates, chartEntriesByDate, chartId, entry.artist, entry.name, isGoat]);

  return (
    <div id={`entry-${entry.position}`} className={`chart-card flex items-start gap-4 ${entry.position === 1 ? "rank-1" : ""}`}>
      <div className="flex items-start gap-3 md:gap-4 w-auto">
        <div className="rank-num flex items-center justify-center gap-2">
          <div className="text-3xl font-black">{entry.position}</div>
          {showDiff && <DiffIndicator diff={entry.diff} />}
        </div>
        <div className="placeholder-art flex items-center justify-center overflow-hidden bg-gray-100 rounded-none w-20 h-20 md:w-24 md:h-24">
          <SpotifyImage entry={entry} kind={kind} />
        </div>
      </div>

      <div className="flex-grow min-w-0">
        <div className="font-bold text-sm md:text-base truncate">{entry.name}</div>
        <Link
          to="/artist/$slug"
          params={{ slug }}
          className="text-xs md:text-sm text-gray-500 hover:text-[var(--accent-foreground)] hover:underline block truncate"
        >
          {kind === "artist" ? "View Artist Page" : entry.artist}
        </Link>
        {kind === "song" && chartId !== "songs" && entry.album && (
          <div className="text-[11px] text-gray-500 truncate">{entry.album}</div>
        )}
        <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
          {entry.peak > 0 && <div>Peak: <span className="font-semibold">#{entry.peak}</span></div>}
          {entry.weeks > 0 && <div>Weeks: <span className="font-semibold">{entry.weeks}</span></div>}
          {(entry.weeksAt1 ?? 0) > 0 && (
            <div className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--accent)]">
              Weeks at 1: {entry.weeksAt1}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 w-auto flex-shrink-0">
        <div className="flex items-center gap-2">
          {metric && (
            <div className="text-right text-2xl font-bold text-foreground tracking-tight">{metric}</div>
          )}
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="w-8 h-8 rounded-md bg-[var(--muted)] text-sm text-muted-foreground hover:text-[var(--foreground)] transition-all duration-200"
            aria-label="Toggle details"
          >
            {showDetails ? "−" : "+"}
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="mt-3 w-full rounded-xl bg-[var(--muted)] p-3 border border-[var(--border)] text-sm text-muted-foreground animate-fade-in">
          {detailFields.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {detailFields.map((item) => (
                <div key={item.label} className="rounded-3xl bg-[#111827] p-4">
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
                    className="block rounded-3xl border border-[var(--border)] bg-[#111827] p-3 transition hover:border-[var(--accent)] hover:bg-[rgba(255,255,255,0.03)]"
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
    </div>
  );
}
