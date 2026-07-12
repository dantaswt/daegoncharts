import { createServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { chartsConfig, chartBeatConfig, slugify, weeklyChartIds } from "./charts-config";

export interface ChartEntry {
  position: number;
  diff: string; // '▲n' '▼n' '=' 'NEW' 'RE' ''
  name: string; // song / album / artist name (item label)
  artist: string;
  album?: string;
  peak: number;
  weeks: number;
  weeksAt1?: number;
  lastWeek?: string;
  points?: string;
  sales?: string;
  streams?: string;
  airplay?: string;
  audience?: string;
  certification?: string;
  units?: string;
  totalUnits?: string;
  totalStreams?: string;
  totalSales?: string;
}

export interface WeeklyChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  dates: string[]; // sorted asc YYYY-MM-DD
  entriesByDate: Record<string, ChartEntry[]>;
}

export interface YearEndChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  years: string[]; // desc
  entriesByYear: Record<string, ChartEntry[]>;
}

export interface AlbumDetails {
  name: string;
  artist: string;
  chartRuns: {
    chartId: string;
    chartTitle: string;
    date: string;
    position: number;
    peak: number;
    weeks: number;
    points?: string;
    certification?: string;
    totalUnits?: string;
  }[];
  songs: Array<{
    name: string;
    artist: string;
    peak: number;
    weeks: number;
    points?: string;
    totalUnits?: string;
  }>;
  peak: number;
  weeks: number;
  totalUnits?: string;
  certification?: string;
}

export interface GoatChartData {
  chartId: string;
  title: string;
  kind: "song" | "album" | "artist";
  entries: ChartEntry[];
}

export interface ChartBeatPost {
  slug: string;
  title: string;
  publicationDate: string;
  artist: string | null;
  fullText: string;
  chartLink: string | null;
  image?: string | null;
}

// simple in-memory cache with TTL
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60 * 1000;

async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(`${url}&_=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`CSV fetch failed ${res.status}`);
  let text = await res.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return parsed.data as string[][];
}

function normalizeDate(d: string): string {
  if (!d) return "";
  d = d.trim();
  if (d.includes("/")) {
    const p = d.split("/");
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return d;
}

function findIdx(header: string[], keys: string[]): number {
  for (const k of keys) {
    const i = header.indexOf(k);
    if (i !== -1) return i;
  }
  return -1;
}

function toInt(v: string | undefined): number {
  const n = parseInt(v ?? "");
  return isNaN(n) ? 0 : n;
}

function computeDiffs(dates: string[], entriesByDate: Record<string, ChartEntry[]>) {
  const seenBefore = new Map<string, string>(); // key -> first date
  for (const date of dates) {
    const prev = dates[dates.indexOf(date) - 1];
    const prevMap = new Map<string, number>();
    if (prev) for (const e of entriesByDate[prev]) prevMap.set(`${e.name.toLowerCase()}|${e.artist.toLowerCase()}`, e.position);
    for (const e of entriesByDate[date]) {
      const key = `${e.name.toLowerCase()}|${e.artist.toLowerCase()}`;
      const p = prevMap.get(key);
      if (p == null) {
        e.diff = seenBefore.has(key) ? "RE" : "NEW";
      } else {
        const d = p - e.position;
        e.diff = d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : "=";
      }
      if (!seenBefore.has(key)) seenBefore.set(key, date);
    }
  }
}

async function loadWeekly(chartId: string): Promise<WeeklyChartData> {
  const cfg = chartsConfig[chartId];
  const rows = await fetchCsv(cfg.url);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    date: findIdx(header, ["date", "chart date"]),
    position: findIdx(header, ["position", "rank", "pos"]),
    diff: findIdx(header, ["dif", "diff", "▲▼"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    lastWeek: findIdx(header, ["last week", "lw"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks"]),
    weeksAt1: findIdx(header, ["weeks at 1", "wks at 1", "week at #1", "week at 1", "weeks at #1"]),
    points: findIdx(header, ["points"]),
    sales: findIdx(header, ["sales", "sales/streams", "sales/streaming", "pure sales"]),
    streams: findIdx(header, ["streams", "sea"]),
    airplay: findIdx(header, ["airplay"]),
    audience: findIdx(header, ["audience"]),
    certification: findIdx(header, ["certification"]),
    units: findIdx(header, ["units", "spins", "sales", "streams", "audience"]),
    totalUnits: findIdx(header, ["total units", "total"]),
    totalStreams: findIdx(header, ["total streams"]),
    totalSales: findIdx(header, ["total sales"]),
  };
  if (cfg.id === "radioSongs") {
    const a = header.indexOf("audience");
    if (a !== -1) idx.units = a;
  }
  const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
  const entriesByDate: Record<string, ChartEntry[]> = {};
  for (const r of rows.slice(1)) {
    const date = normalizeDate(r[idx.date]);
    if (!date) continue;
    const entry: ChartEntry = {
      position: toInt(r[idx.position]),
      diff: idx.diff >= 0 ? (r[idx.diff] ?? "") : "",
      name: (r[nameIdx] ?? "").trim(),
      artist: (r[idx.artist] ?? "").trim(),
      album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
      peak: toInt(r[idx.peak]),
      weeks: toInt(r[idx.weeks]),
      weeksAt1: idx.weeksAt1 >= 0 ? toInt(r[idx.weeksAt1]) : undefined,
      lastWeek: idx.lastWeek >= 0 ? r[idx.lastWeek] : undefined,
      points: idx.points >= 0 ? r[idx.points] : undefined,
      sales: idx.sales >= 0 ? r[idx.sales] : undefined,
      streams: idx.streams >= 0 ? r[idx.streams] : undefined,
      airplay: idx.airplay >= 0 ? r[idx.airplay] : undefined,
      audience: idx.audience >= 0 ? r[idx.audience] : undefined,
      certification: idx.certification >= 0 ? r[idx.certification] : undefined,
      units: idx.units >= 0 ? r[idx.units] : undefined,
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
      totalStreams: idx.totalStreams >= 0 ? r[idx.totalStreams] : undefined,
      totalSales: idx.totalSales >= 0 ? r[idx.totalSales] : undefined,
    };
    if (!entry.name || !entry.position) continue;
    (entriesByDate[date] ||= []).push(entry);
  }
  const dates = Object.keys(entriesByDate).sort();
  for (const d of dates) entriesByDate[d].sort((a, b) => a.position - b.position);
  computeDiffs(dates, entriesByDate);
  return { chartId, title: cfg.title, kind: cfg.kind, dates, entriesByDate };
}

async function loadYearEnd(chartId: string): Promise<YearEndChartData> {
  const cfg = chartsConfig[chartId];
  const rows = await fetchCsv(cfg.url);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    year: findIdx(header, ["year", "ano"]),
    position: findIdx(header, ["position", "rank", "pos"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks"]),
    points: findIdx(header, ["points"]),
    units: findIdx(header, ["units", "spins", "sales", "streams", "audience"]),
    totalUnits: findIdx(header, ["total units", "total"]),
    totalStreams: findIdx(header, ["total streams"]),
    totalSales: findIdx(header, ["total sales"]),
    certification: findIdx(header, ["certification"]),
  };
  const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
  const entriesByYear: Record<string, ChartEntry[]> = {};
  for (const r of rows.slice(1)) {
    const year = (r[idx.year] ?? "").trim();
    if (!year) continue;
    const entry: ChartEntry = {
      position: toInt(r[idx.position]),
      diff: "",
      name: (r[nameIdx] ?? "").trim(),
      artist: (r[idx.artist] ?? "").trim(),
      album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
      peak: toInt(r[idx.peak]),
      weeks: toInt(r[idx.weeks]),
      points: idx.points >= 0 ? r[idx.points] : undefined,
      units: idx.units >= 0 ? r[idx.units] : undefined,
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
      certification: idx.certification >= 0 ? r[idx.certification] : undefined,
      totalStreams: idx.totalStreams >= 0 ? r[idx.totalStreams] : undefined,
      totalSales: idx.totalSales >= 0 ? r[idx.totalSales] : undefined,
    };
    if (!entry.name || !entry.position) continue;
    (entriesByYear[year] ||= []).push(entry);
  }
  const years = Object.keys(entriesByYear).sort((a, b) => Number(b) - Number(a));
  for (const y of years) entriesByYear[y].sort((a, b) => a.position - b.position);
  return { chartId, title: cfg.title, kind: cfg.kind, years, entriesByYear };
}

async function loadGoat(chartId: string): Promise<GoatChartData> {
  const cfg = chartsConfig[chartId];
  const rows = await fetchCsv(cfg.url);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    position: findIdx(header, ["position", "rank", "pos"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks"]),
    totalUnits: findIdx(header, ["total units", "total"]),
  };
  const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
  const entries: ChartEntry[] = [];
  for (const r of rows.slice(1)) {
    const entry: ChartEntry = {
      position: toInt(r[idx.position]),
      diff: "",
      name: (r[nameIdx] ?? "").trim(),
      artist: (r[idx.artist] ?? "").trim(),
      album: idx.album >= 0 ? (r[idx.album] ?? "").trim() : undefined,
      peak: toInt(r[idx.peak]),
      weeks: toInt(r[idx.weeks]),
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] : undefined,
    };
    if (!entry.name || !entry.position) continue;
    entries.push(entry);
  }
  entries.sort((a, b) => a.position - b.position);
  return { chartId, title: cfg.title, kind: cfg.kind, entries };
}

async function loadAlbumDetails(slug: string): Promise<AlbumDetails | null> {
  const albumChartIds = ["albums", "topStreamingAlbums", "topAlbumSales"];
  const albumRuns: AlbumDetails["chartRuns"] = [];
  const songMap = new Map<string, { name: string; artist: string; peak: number; weeks: number; points?: string; totalUnits?: string }>();
  let albumName = "";
  let albumArtist = "";
  let bestPeak = Number.MAX_SAFE_INTEGER;
  let bestWeeks = 0;
  let totalUnits: string | undefined;
  let certification: string | undefined;

  for (const chartId of albumChartIds) {
    const chartData = await loadWeekly(chartId);
    for (const date of chartData.dates) {
      for (const entry of chartData.entriesByDate[date]) {
        if (slugify(entry.name) !== slug) continue;
        albumName ||= entry.name;
        albumArtist ||= entry.artist;
        if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
        bestWeeks = Math.max(bestWeeks, entry.weeks);
        totalUnits ||= entry.totalUnits;
        certification ||= entry.certification;
        albumRuns.push({
          chartId,
          chartTitle: chartsConfig[chartId].title,
          date,
          position: entry.position,
          peak: entry.peak,
          weeks: entry.weeks,
          points: entry.points,
          certification: entry.certification,
          totalUnits: entry.totalUnits,
        });
      }
    }
  }

  if (!albumName) {
    return null;
  }

  const songData = await loadWeekly("songs");
  for (const date of songData.dates) {
    for (const entry of songData.entriesByDate[date]) {
      if (entry.album && slugify(entry.album) === slug) {
        const key = `${entry.name}||${entry.artist}`;
        const existing = songMap.get(key);
        if (!existing || entry.peak < existing.peak) {
          songMap.set(key, {
            name: entry.name,
            artist: entry.artist,
            peak: entry.peak,
            weeks: entry.weeks,
            points: entry.points,
            totalUnits: entry.totalUnits,
          });
        }
      }
    }
  }

  const yearEndAlbums = await loadYearEnd("yearEndAlbums");
  for (const year of yearEndAlbums.years) {
    for (const entry of yearEndAlbums.entriesByYear[year]) {
      if (slugify(entry.name) === slug) {
        totalUnits ||= entry.totalUnits;
        certification ||= entry.certification;
        if (entry.peak > 0 && entry.peak < bestPeak) bestPeak = entry.peak;
        bestWeeks = Math.max(bestWeeks, entry.weeks);
      }
    }
  }

  return {
    name: albumName,
    artist: albumArtist,
    peak: bestPeak === Number.MAX_SAFE_INTEGER ? 0 : bestPeak,
    weeks: bestWeeks,
    totalUnits,
    certification,
    chartRuns: albumRuns.sort((a, b) => a.date.localeCompare(b.date)),
    songs: Array.from(songMap.values()).sort((a, b) => a.peak - b.peak || b.weeks - a.weeks),
  };
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

export const getWeeklyChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    if (!weeklyChartIds.includes(data.chartId)) throw new Error("Unknown chart");
    return cached(`weekly:${data.chartId}`, () => loadWeekly(data.chartId));
  });

export const getYearEndChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => cached(`ye:${data.chartId}`, () => loadYearEnd(data.chartId)));

export const getGoatChart = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string }) => d)
  .handler(async ({ data }) => cached(`goat:${data.chartId}`, () => loadGoat(data.chartId)));

export const getAlbumDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => cached(`album:${data.slug}`, () => loadAlbumDetails(data.slug)));

export const getChartBeat = createServerFn({ method: "GET" })
  .inputValidator((d: { blog: keyof typeof chartBeatConfig }) => d)
  .handler(async ({ data }) => {
    return cached(`beat:${data.blog}`, async () => {
      const cfg = chartBeatConfig[data.blog];
      const rows = await fetchCsv(cfg.url);
      const header = rows[0].map((h) => h.toLowerCase().trim());
      const idx = {
        date: findIdx(header, ["date", "data"]),
        title: findIdx(header, ["title", "título"]),
        text: findIdx(header, ["text", "conteúdo"]),
        artist: findIdx(header, ["artist", "artista"]),
        link: findIdx(header, ["chartlink"]),
        image: findIdx(header, ["image", "imagem", "photo", "foto"]),
      };
      const posts: ChartBeatPost[] = rows.slice(1).map((r, i) => ({
        slug: `${i + 1}-${slugify(r[idx.title] ?? "untitled")}`,
        title: r[idx.title] ?? "Untitled",
        publicationDate: r[idx.date] ?? "",
        artist: idx.artist >= 0 ? r[idx.artist] || null : null,
        fullText: r[idx.text] ?? "",
        chartLink: idx.link >= 0 ? r[idx.link] || null : null,
        image: idx.image >= 0 ? r[idx.image] || null : null,
      }));
      return { title: cfg.title, posts: posts.reverse() };
    });
  });

export interface ArtistDetails {
  name: string;
  chartsByKind: Record<string, { item: string; peak: number; weeks: number; unitsSold?: string | null; totalUnits?: string | null; firstEntry?: string | null; peakDate?: string | null }[]>;
}

export const getAllArtistStats = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistStats", async () => {
    const cfg = chartsConfig.artistStats;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      chart: findIdx(header, ["chart"]),
      item: findIdx(header, ["item"]),
      peak: findIdx(header, ["peak"]),
      weeks: findIdx(header, ["weeks", "wks"]),
      unitsSold: findIdx(header, ["units sold", "sales", "total sales", "units/sales"]),
      totalUnits: findIdx(header, ["total units", "total"]),
      firstEntry: findIdx(header, ["first entry"]),
      peakDate: findIdx(header, ["peak date"]),
    };
    const map: Record<string, ArtistDetails> = {};
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist) continue;
      const chart = (r[idx.chart] ?? "").trim() || "Other";
      const entry = {
        item: (r[idx.item] ?? "").trim(),
        peak: toInt(r[idx.peak]),
        weeks: toInt(r[idx.weeks]),
        unitsSold: idx.unitsSold >= 0 ? r[idx.unitsSold] || null : null,
        totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] || null : null,
        firstEntry: idx.firstEntry >= 0 ? r[idx.firstEntry] || null : null,
        peakDate: idx.peakDate >= 0 ? r[idx.peakDate] || null : null,
      };
      (map[artist] ||= { name: artist, chartsByKind: {} });
      (map[artist].chartsByKind[chart] ||= []).push(entry);
    }
    for (const a of Object.values(map)) {
      for (const list of Object.values(a.chartsByKind)) list.sort((x, y) => x.peak - y.peak || y.weeks - x.weeks);
    }
    return map;
  });
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  return cached("stats", async () => {
    const cfg = chartsConfig.statsData;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const rankIdx = findIdx(header, ["rank", "pos", "position"]);
    const catIdx = findIdx(header, ["stats", "category"]);
    const itemIdx = findIdx(header, ["artist/song", "item", "title", "name"]);
    const numIdx = findIdx(header, ["number", "value", "total", "count"]);
    const byCategory: Record<string, { rank: number; item: string; number: string }[]> = {};
    for (const r of rows.slice(1)) {
      const cat = (r[catIdx] ?? "").trim();
      if (!cat) continue;
      (byCategory[cat] ||= []).push({
        rank: toInt(r[rankIdx]),
        item: (r[itemIdx] ?? "").trim(),
        number: (r[numIdx] ?? "").trim(),
      });
    }
    for (const list of Object.values(byCategory)) {
      list.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const numA = parseFloat(a.number.replace(/[^\d.-]/g, '')) || 0;
        const numB = parseFloat(b.number.replace(/[^\d.-]/g, '')) || 0;
        return numB - numA;
      });
    }
    return { categories: Object.keys(byCategory), byCategory };
  });
});
