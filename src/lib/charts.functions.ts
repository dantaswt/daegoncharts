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
  let s = (v ?? "").trim();
  if (!s || s === "-") return 0;
  // Remove non-numeric chars except dots, commas, minus
  s = s.replace(/[^0-9.,\-]/g, "");
  if (!s) return 0;
  // European format: dots as thousand separators (e.g. "3.648.500" or "56.000")
  if (s.includes(".") && (s.match(/\./g) || []).length >= 1) {
    // Multiple dots → definitely thousand separators
    // Single dot followed by exactly 3 digits at end → thousand separator
    if ((s.match(/\./g) || []).length > 1 || /^\d+\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }
  // Remove commas (thousand separator in US format)
  s = s.replace(/,/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

const mbCharts = new Set(["radioSongs", "topStreamingAlbums", "streamingSongs"]);
const usFormatCharts = new Set(["songs", "digitalSongsSales", "topAlbumSales", "albums", "artists"]);

function formatMetric(value: number, chartId: string): string {
  if (value <= 0) return "0";
  if (mbCharts.has(chartId)) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}B`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}M`;
    return String(value);
  }
  return value.toLocaleString("en-US");
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
    streams: findIdx(header, ["streams", "sea", "streaming"]),
    airplay: findIdx(header, ["airplay"]),
    audience: findIdx(header, ["audience"]),
    certification: findIdx(header, ["certification"]),
    units: findIdx(header, ["units", "spins", "sales", "streams", "audience"]),
    totalUnits: findIdx(header, ["total units", "total"]),
    totalStreams: findIdx(header, ["total streams", "total streaming"]),
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
    units: findIdx(header, ["units", "spins", "sales", "streams", "audience", "total audience"]),
    totalUnits: findIdx(header, ["total units", "total", "total audience"]),
    totalStreams: findIdx(header, ["total streams", "total streaming"]),
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
    position: findIdx(header, ["position", "rank", "pos", "all-time rank"]),
    song: findIdx(header, ["song", "title", "track"]),
    album: findIdx(header, ["album"]),
    artist: findIdx(header, ["artist", "artists"]),
    peak: findIdx(header, ["peak"]),
    weeks: findIdx(header, ["weeks", "wks", "total weeks"]),
    totalUnits: findIdx(header, ["total units", "total", "total audience"]),
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
  chartsByKind: Record<string, { item: string; peak: number; weeks: number; weeksAt1?: number; unitsSold?: string | null; totalUnits?: string | null; firstEntry?: string | null; peakDate?: string | null }[]>;
}

export const getAllArtistNames = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistNames", async () => {
    const names = new Set<string>();

    const artistsChart = await getWeeklyChart({ data: { chartId: "artists" } }).catch(() => null);
    if (artistsChart) {
      for (const date of artistsChart.dates) {
        for (const e of artistsChart.entriesByDate[date]) {
          if (e.artist) names.add(e.artist);
        }
      }
    }

    const songsChart = await getWeeklyChart({ data: { chartId: "songs" } }).catch(() => null);
    if (songsChart) {
      for (const date of songsChart.dates) {
        for (const e of songsChart.entriesByDate[date]) {
          if (e.artist) names.add(e.artist);
        }
      }
    }

    return Array.from(names);
  });
});

export const getAllArtistList = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artistList", async () => {
    const map: Record<string, { name: string; slug: string; entries: number }> = {};
    const slugify = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const charts = ["artists", "songs", "digitalSongsSales", "streamingSongs", "radioSongs", "albums", "topAlbumSales", "topStreamingAlbums"];
    const allCharts = await Promise.all(
      charts.map(async (chartId) => {
        try { return await getWeeklyChart({ data: { chartId } }); } catch { return null; }
      })
    );

    for (const chart of allCharts) {
      if (!chart) continue;
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (!e.artist) continue;
          const slug = slugify(e.artist);
          if (!map[slug]) map[slug] = { name: e.artist, slug, entries: 0 };
          map[slug].entries++;
        }
      }
    }

    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  });
});

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
      weeksAt1: findIdx(header, ["weeks at 1", "wks at 1", "week at #1", "weeks at #1"]),
      unitsSold: findIdx(header, ["units sold", "sales", "total sales", "units/sales"]),
      totalUnits: findIdx(header, ["total units", "total", "units"]),
      firstEntry: findIdx(header, ["first entry"]),
      peakDate: findIdx(header, ["peak date"]),
    };
    const map: Record<string, ArtistDetails> = {};

    const allRows: { artist: string; chart: string; entry: any }[] = [];
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist) continue;
      const chart = (r[idx.chart] ?? "").trim() || "Other";
      const entry = {
        item: (r[idx.item] ?? "").trim(),
        peak: toInt(r[idx.peak]),
        weeks: toInt(r[idx.weeks]),
        weeksAt1: idx.weeksAt1 >= 0 ? toInt(r[idx.weeksAt1]) : undefined,
        unitsSold: idx.unitsSold >= 0 ? r[idx.unitsSold] || null : null,
      totalUnits: idx.totalUnits >= 0 ? r[idx.totalUnits] || null : null,
      firstEntry: idx.firstEntry >= 0 ? normalizeDate(r[idx.firstEntry] || "") || null : null,
      peakDate: idx.peakDate >= 0 ? normalizeDate(r[idx.peakDate] || "") || null : null,
    };
    (map[artist] ||= { name: artist, chartsByKind: {} });
    (map[artist].chartsByKind[chart] ||= []).push(entry);
    allRows.push({ artist, chart, entry });
    }

    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

    const featVerifyCache = new Map<string, string[]>();
    async function verifyFeatViaApi(song: string, mainArtist: string): Promise<string[]> {
      const key = `${song}|${mainArtist}`;
      if (featVerifyCache.has(key)) return featVerifyCache.get(key)!;
      try {
        const q = encodeURIComponent(`${song} ${mainArtist}`);
        const resp = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`);
        const data = await resp.json();
        for (const r of data.results ?? []) {
          const nameMatch = normalize(r.trackName ?? "") === normalize(song);
          const artistMatch = normalize(r.artistName ?? "").includes(normalize(mainArtist));
          if (nameMatch && artistMatch) {
            const raw = (r.artistName ?? "").trim();
            const parts = raw.split(/\s*(?:feat\.|ft\.|featuring|&)\s*/i).map((s: string) => s.trim()).filter(Boolean);
            if (parts.length > 1) {
              featVerifyCache.set(key, parts.slice(1));
              return parts.slice(1);
            }
          }
        }
        featVerifyCache.set(key, []);
        return [];
      } catch {
        featVerifyCache.set(key, []);
        return [];
      }
    }

    for (const { artist, chart, entry } of allRows) {
      const featMatch = entry.item.match(/\(feat\.?\s+([^)]+)\)/i)
        || entry.item.match(/\(ft\.?\s+([^)]+)\)/i)
        || entry.item.match(/\(featuring\s+([^)]+)\)/i)
        || entry.item.match(/\(with\s+([^)]+)\)/i);
      if (!featMatch) continue;
      const apiFeats = await verifyFeatViaApi(entry.item, artist);
      for (const apiFeat of apiFeats) {
        const existingKey = Object.keys(map).find(k => normalize(k) === normalize(apiFeat));
        if (!existingKey) continue;
        const alreadyExists = map[existingKey].chartsByKind[chart]?.some(
          (e: any) => e.item === entry.item && e.peak === entry.peak && e.weeks === entry.weeks
        );
        if (!alreadyExists) {
          (map[existingKey].chartsByKind[chart] ||= []).push(entry);
        }
      }
    }
    for (const a of Object.values(map)) {
      for (const list of Object.values(a.chartsByKind)) list.sort((x, y) => x.peak - y.peak || y.weeks - x.weeks);
    }
    return map;
  });
});

const artistChartMapping: { chartId: string; label: string }[] = [
  { chartId: "artists", label: "Artist 50" },
  { chartId: "songs", label: "Hot 100 Songs" },
  { chartId: "digitalSongsSales", label: "Digital Songs Sales" },
  { chartId: "streamingSongs", label: "Streaming Songs" },
  { chartId: "radioSongs", label: "Top 40 Radio" },
  { chartId: "albums", label: "Top 100 Albums" },
  { chartId: "topAlbumSales", label: "Top Album Sales" },
  { chartId: "topStreamingAlbums", label: "Top Streaming Albums" },
];

function matchesArtist(entryArtist: string, artistName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const target = normalize(artistName);
  const parts = entryArtist.split(/[,&+]/).map((p) => normalize(p.trim())).filter(Boolean);
  return parts.some((p) => p === target);
}

export const getArtistChartHistory = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    const { artistName } = data;

    const results = await Promise.all(
      artistChartMapping.map(async ({ chartId, label }) => {
        try {
          const chart = await getWeeklyChart({ data: { chartId } });
          const dates = chart.dates;
          const entriesByDate = chart.entriesByDate;
          const seen: Record<string, {
            item: string;
            bestPos: number;
            weeks: number;
            weeksAt1: number;
            totalUnits: number;
            firstDate: string | null;
            peakDate: string | null;
          }> = {};

          for (const date of dates) {
            for (const e of entriesByDate[date]) {
              if (!matchesArtist(e.artist, artistName)) continue;
              const key = e.name.toLowerCase();
              if (!seen[key]) {
                seen[key] = {
                  item: e.name,
                  bestPos: e.position,
                  weeks: 0,
                  weeksAt1: 0,
                  totalUnits: 0,
                  firstDate: null,
                  peakDate: null,
                };
              }
              const s = seen[key];
              s.weeks++;
              if (e.position <= s.bestPos) {
                s.bestPos = e.position;
                s.peakDate = date;
              }
              if (e.position === 1) s.weeksAt1++;
              if (e.units) s.totalUnits += parseEuropeanFloat(e.units);
              if (!s.firstDate) s.firstDate = date;
            }
          }

          const isSalesChart = label.includes("Sales");
          const isStreamsChart = label.includes("Streaming");
          const entries = Object.values(seen).map((s) => ({
            item: s.item,
            peak: s.bestPos,
            weeks: s.weeks,
            weeksAt1: s.weeksAt1,
            unitsSold: isSalesChart ? formatNumber(s.totalUnits) : null as string | null,
            totalUnits: isStreamsChart ? formatNumber(s.totalUnits) : s.totalUnits.toLocaleString("en-US"),
            firstEntry: s.firstDate,
            peakDate: s.peakDate,
          }));

          entries.sort((a, b) => a.peak - b.peak || b.weeks - a.weeks);
          return { label, entries };
        } catch {
          return { label, entries: [] };
        }
      })
    );

    const map: Record<string, { item: string; peak: number; weeks: number; weeksAt1?: number; unitsSold?: string | null; totalUnits?: string | null; firstEntry?: string | null; peakDate?: string | null }[]> = {};
    for (const r of results) {
      if (r.entries.length > 0) map[r.label] = r.entries;
    }
    return map;
  });

export const getArtist50TotalUnits = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artist50TotalUnits", async () => {
    const cfg = chartsConfig.artists;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      date: findIdx(header, ["chart date", "date"]),
      totalUnits: findIdx(header, ["total units", "total", "total audience"]),
    };
    const map: Record<string, string> = {};
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist || idx.totalUnits < 0) continue;
      const date = normalizeDate(r[idx.date]);
      const totalUnits = r[idx.totalUnits] ?? "";
      if (!date || !totalUnits) continue;
      const existing = map[artist];
      if (!existing || date > existing.split("||")[0]) {
        map[artist] = `${date}||${totalUnits}`;
      }
    }
    const result: Record<string, string> = {};
    for (const [artist, val] of Object.entries(map)) {
      result[artist] = val.split("||")[1];
    }
    return result;
  });
});

export const getArtist50Totals = createServerFn({ method: "GET" }).handler(async () => {
  return cached("artist50Totals", async () => {
    const cfg = chartsConfig.artists;
    const rows = await fetchCsv(cfg.url);
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      artist: findIdx(header, ["artist", "artists"]),
      date: findIdx(header, ["chart date", "date"]),
      totalUnits: findIdx(header, ["total units", "total", "total audience"]),
      totalSales: findIdx(header, ["total sales", "sales"]),
      totalStreams: findIdx(header, ["total streams", "total streaming"]),
    };
    const map: Record<string, { date: string; totalUnits: string; totalSales: string; totalStreams: string }> = {};
    for (const r of rows.slice(1)) {
      const artist = (r[idx.artist] ?? "").trim();
      if (!artist) continue;
      const date = normalizeDate(r[idx.date]);
      if (!date) continue;
      const totalUnits = idx.totalUnits >= 0 ? (r[idx.totalUnits] ?? "") : "";
      const totalSales = idx.totalSales >= 0 ? (r[idx.totalSales] ?? "") : "";
      const totalStreams = idx.totalStreams >= 0 ? (r[idx.totalStreams] ?? "") : "";
      const existing = map[artist];
      if (!existing || date > existing.date) {
        map[artist] = { date, totalUnits, totalSales, totalStreams };
      }
    }
    return map;
  });
});

/* ────── Year-End Charts (generated from weekly data) ────── */
export interface YECEntry {
  position: number;
  name: string;
  artist: string;
  peak: number;
  weeks: number;
  weeksAt1: number;
  totalUnits: number;
  kind: "song" | "album" | "artist";
}

export const getYearEndGenerated = createServerFn({ method: "GET" })
  .validator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    return cached(`yec_gen_${data.chartId}`, async () => {
      const chartData = await getWeeklyChart({ data: { chartId: data.chartId } });
      const years: Record<string, Record<string, YECEntry>> = {};

      const metricKey = data.chartId === "songs" ? "points" : data.chartId === "streamingSongs" || data.chartId === "topStreamingAlbums" ? "streams" : data.chartId === "radioSongs" ? "audience" : data.chartId === "topAlbumSales" || data.chartId === "digitalSongsSales" ? "sales" : "units";

      for (const date of chartData.dates) {
        const year = date.slice(0, 4);
        const entries = chartData.entriesByDate[date] || [];
        if (!years[year]) years[year] = {};

        for (const e of entries) {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          if (!years[year][key]) {
            years[year][key] = {
              position: 0,
              name: e.name,
              artist: e.artist,
              peak: e.peak,
              weeks: 0,
              weeksAt1: 0,
              totalUnits: 0,
              kind: chartData.kind,
            };
          }
          const entry = years[year][key];
          entry.weeks += 1;
          if (e.peak < entry.peak) entry.peak = e.peak;
          entry.weeksAt1 += (e.weeksAt1 ?? 0);
          const unitsRaw = String(e[metricKey as keyof ChartEntry] ?? e.units ?? "0");
          entry.totalUnits += toInt(unitsRaw);
        }
      }

      const result: Record<string, YECEntry[]> = {};
      for (const [year, items] of Object.entries(years)) {
        result[year] = Object.values(items)
          .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
          .slice(0, 100)
          .map((e, i) => ({ ...e, position: i + 1 }));
      }

      const sortedYears = Object.keys(result).sort().reverse();
      return { years: sortedYears, entriesByYear: result, kind: chartData.kind, title: chartsConfig[data.chartId]?.title ?? data.chartId };
    });
  });

/* ────── Year-End New Artists (generated from artist chart data) ────── */
export const getYearEndNewArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    return cached("yec_new_artists", async () => {
      const chartData = await getWeeklyChart({ data: { chartId: "artists" } });

      // Step 1: find each artist's first-ever appearance date
      const firstSeen: Record<string, string> = {};
      for (const date of chartData.dates) {
        const entries = chartData.entriesByDate[date] || [];
        for (const e of entries) {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          if (e.diff === "NEW" && !firstSeen[key]) {
            firstSeen[key] = date;
          }
        }
      }

      // Step 2: for each year, accumulate ALL units for artists whose first appearance is in that year
      const years: Record<string, Record<string, YECEntry>> = {};
      for (const date of chartData.dates) {
        const year = date.slice(0, 4);
        const entries = chartData.entriesByDate[date] || [];
        if (!years[year]) years[year] = {};

        for (const e of entries) {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          // Only include artists whose first appearance is in this year
          if (!firstSeen[key] || firstSeen[key].slice(0, 4) !== year) continue;

          if (!years[year][key]) {
            years[year][key] = {
              position: 0,
              name: e.name,
              artist: e.artist,
              peak: e.peak,
              weeks: 0,
              weeksAt1: 0,
              totalUnits: 0,
              kind: "artist" as const,
            };
          }
          const entry = years[year][key];
          entry.weeks += 1;
          if (e.peak < entry.peak) entry.peak = e.peak;
          entry.weeksAt1 += (e.weeksAt1 ?? 0);
          entry.totalUnits += toInt(String(e.units ?? "0"));
        }
      }

      const result: Record<string, YECEntry[]> = {};
      for (const [year, items] of Object.entries(years)) {
        result[year] = Object.values(items)
          .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
          .slice(0, 100)
          .map((e, i) => ({ ...e, position: i + 1 }));
      }

      const sortedYears = Object.keys(result).sort().reverse();
      return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Year-End New Artists" };
    });
  });

/* ────── Greatest of All Time Charts (generated from weekly data, top 500) ────── */
export interface GOATEntry {
  position: number;
  name: string;
  artist: string;
  peak: number;
  weeks: number;
  weeksAt1: number;
  weeksAt1Hot100: number;
  weeksAt1Artists: number;
  weeksAt1Albums: number;
  totalUnits: number;
  totalStreams: number;
  totalSales: number;
  totalAudience: number;
  kind: "song" | "album" | "artist";
}

export const getGoatGenerated = createServerFn({ method: "GET" })
  .validator((d: { chartId: string }) => d)
  .handler(async ({ data }) => {
    return cached(`goat_gen_${data.chartId}`, async () => {
      const cfg = chartsConfig[data.chartId];
      const kind = cfg?.kind ?? "song";
      const weeklyIds = data.chartId === "goatArtists" ? ["artists"] : data.chartId === "goatAlbums" ? ["albums"] : data.chartId === "goatRadio" ? ["radioSongs"] : ["songs"];

      // Fetch all three main charts for weeksAt1 breakdown
      const [songsData, artistsData, albumsData] = await Promise.all([
        getWeeklyChart({ data: { chartId: "songs" } }).catch(() => null),
        getWeeklyChart({ data: { chartId: "artists" } }).catch(() => null),
        getWeeklyChart({ data: { chartId: "albums" } }).catch(() => null),
      ]);

      // Build per-chart weeksAt1 maps: key → total weeksAt1 for that chart
      function buildWeeksAt1Map(chartData: { dates: string[]; entriesByDate: Record<string, ChartEntry[]> } | null): Record<string, number> {
        if (!chartData) return {};
        const map: Record<string, number> = {};
        for (const date of chartData.dates) {
          for (const e of chartData.entriesByDate[date] || []) {
            if (e.weeksAt1 && e.weeksAt1 > 0) {
              const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
              map[key] = (map[key] || 0) + e.weeksAt1;
            }
          }
        }
        return map;
      }

      const hot100Map = buildWeeksAt1Map(songsData);
      const artistsMap = buildWeeksAt1Map(artistsData);
      const albumsMap = buildWeeksAt1Map(albumsData);

      const aggregated: Record<string, GOATEntry> = {};

      // Aggregate from the relevant chart(s)
      const relevantData = data.chartId === "goatArtists" ? [artistsData] : data.chartId === "goatAlbums" ? [albumsData] : data.chartId === "goatRadio" ? [songsData] : [songsData];

      for (const chartData of relevantData) {
        if (!chartData) continue;
        for (const date of chartData.dates) {
          const entries = chartData.entriesByDate[date] || [];
          for (const e of entries) {
            const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
            if (!aggregated[key]) {
              aggregated[key] = {
                position: 0,
                name: e.name,
                artist: e.artist,
                peak: e.peak,
                weeks: 0,
                weeksAt1: 0,
                weeksAt1Hot100: 0,
                weeksAt1Artists: 0,
                weeksAt1Albums: 0,
                totalUnits: 0,
                totalStreams: 0,
                totalSales: 0,
                totalAudience: 0,
                kind,
              };
            }
            const entry = aggregated[key];
            entry.weeks += 1;
            if (e.peak < entry.peak) entry.peak = e.peak;
            entry.weeksAt1 += (e.weeksAt1 ?? 0);
            entry.totalUnits += toInt(e.units || "0");
            entry.totalStreams += toInt(e.streams || "0");
            entry.totalSales += toInt(e.sales || "0");
            entry.totalAudience += toInt(e.audience || "0");
          }
        }
      }

      // Assign per-chart weeksAt1 from the pre-built maps
      for (const key of Object.keys(aggregated)) {
        aggregated[key].weeksAt1Hot100 = hot100Map[key] || 0;
        aggregated[key].weeksAt1Artists = artistsMap[key] || 0;
        aggregated[key].weeksAt1Albums = albumsMap[key] || 0;
      }

      const sorted = Object.values(aggregated)
        .sort((a, b) => b.weeks - a.weeks || a.peak - b.peak)
        .slice(0, 500)
        .map((e, i) => ({ ...e, position: i + 1 }));

      return { entries: sorted, kind, title: cfg?.title ?? data.chartId };
    });
  });

export interface Stats2Record {
  name: string;
  artist: string;
  value: number;
  valueLabel: string;
  peak?: number;
  firstDate?: string;
  chartId?: string;
  details?: string;
  metricLabel?: string;
}

export interface Stats2Category {
  id: string;
  title: string;
  icon: string;
  description: string;
  records: Stats2Record[];
}

export interface Stats2Data {
  chartStats: Record<string, Stats2Category[]>;
  availableYears: string[];
  chartIds: string[];
}

export const getStats2 = createServerFn({ method: "GET" }).handler(async () => {
  return cached("stats2", async () => {
    const chartIds = ["songs", "streamingSongs", "radioSongs", "digitalSongsSales", "albums", "topStreamingAlbums", "topAlbumSales", "artists"];
    const allData = await Promise.all(
      chartIds.map(async (id) => {
        const cfg = chartsConfig[id];
        const rows = await fetchCsv(cfg.url);
        const header = rows[0].map((h) => h.toLowerCase().trim());
        const idx = {
          date: findIdx(header, ["date", "chart date"]),
          position: findIdx(header, ["position", "rank", "pos"]),
          song: findIdx(header, ["song", "title", "track"]),
          album: findIdx(header, ["album"]),
          artist: findIdx(header, ["artist", "artists"]),
          diff: findIdx(header, ["dif", "diff", "▲▼"]),
          peak: findIdx(header, ["peak"]),
          weeks: findIdx(header, ["weeks", "wks"]),
          units: findIdx(header, ["units"]),
          sales: findIdx(header, ["sales", "pure sales", "sales/streams", "sales/streaming"]),
          streams: findIdx(header, ["streams", "sea", "streaming"]),
          audience: findIdx(header, ["audience"]),
        };
        if (cfg.id === "radioSongs") {
          const a = header.indexOf("audience");
          if (a !== -1) idx.units = a;
        }
        const nameIdx = cfg.kind === "artist" ? idx.artist : cfg.kind === "album" ? idx.album : idx.song;
        const entriesByDate: Record<string, { position: number; name: string; artist: string; diff: string; peak: number; weeks: number; metric: number; metricLabel: string }[]> = {};
        for (const r of rows.slice(1)) {
          const date = normalizeDate(r[idx.date]);
          if (!date) continue;
          const position = toInt(r[idx.position]);
          const name = (r[nameIdx] ?? "").trim();
          const artist = (r[idx.artist] ?? "").trim();
          if (!name || !position) continue;
          const metricValue = toInt(r[idx.units]) || toInt(r[idx.sales]) || toInt(r[idx.streams]) || toInt(r[idx.audience]);
          let metricLabel = "units";
          if (idx.units >= 0 && r[idx.units]) metricLabel = "units";
          else if (idx.sales >= 0 && r[idx.sales]) metricLabel = "sales";
          else if (idx.streams >= 0 && r[idx.streams]) metricLabel = "streams";
          else if (idx.audience >= 0 && r[idx.audience]) metricLabel = "audience";
          (entriesByDate[date] ||= []).push({
            position,
            name,
            artist,
            diff: idx.diff >= 0 ? (r[idx.diff] ?? "") : "",
            peak: toInt(r[idx.peak]),
            weeks: toInt(r[idx.weeks]),
            metric: metricValue,
            metricLabel,
          });
        }
        const dates = Object.keys(entriesByDate).sort();
        for (const d of dates) entriesByDate[d].sort((a, b) => a.position - b.position);
        return { id, title: cfg.title, kind: cfg.kind, dates, entriesByDate, metricLabel: entriesByDate[Object.keys(entriesByDate)[0]]?.[0]?.metricLabel ?? "units" };
      })
    );

    const allYears = new Set<string>();
    for (const chart of allData) {
      for (const date of chart.dates) allYears.add(date.slice(0, 4));
    }
    const availableYears = [...allYears].sort().reverse();

    const chartStats: Record<string, Stats2Category[]> = {};

    for (const chart of allData) {
      const categories: Stats2Category[] = [];

      // 1. Biggest Debuts (entries with diff=NEW, ranked by metric value — highest metric = biggest debut)
      const debutMap = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.diff === "NEW") {
            const key = `${e.name}||${e.artist}`;
            const existing = debutMap.get(key);
            if (!existing || e.metric > existing.value) {
              debutMap.set(key, {
                name: e.name,
                artist: e.artist,
                value: e.metric,
                valueLabel: e.metric > 0 ? `${formatMetric(e.metric, chart.id)} ${e.metricLabel}` : `#${e.position} debut`,
                peak: e.peak,
                firstDate: date,
                chartId: chart.id,
                details: `#${e.position} debut · ${e.metric > 0 ? `${formatMetric(e.metric, chart.id)} ${e.metricLabel}` : "N/A"} on ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "debuts",
        title: "Biggest Debuts",
        icon: "fa-rocket",
        description: "Debuts ranked by metric volume",
        records: [...debutMap.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 2. Most Weeks at #1
      const weeksAt1Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position === 1) {
            const key = `${e.name}||${e.artist}`;
            const existing = weeksAt1Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              weeksAt1Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: 1,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "weeksAt1",
        title: "Most Weeks at #1",
        icon: "fa-crown",
        description: "Longest reigns at the top",
        records: [...weeksAt1Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 3. Most Weeks in Top 5
      const top5Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 5) {
            const key = `${e.name}||${e.artist}`;
            const existing = top5Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top5Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top5",
        title: "Most Weeks in Top 5",
        icon: "fa-star",
        description: "Longest runs in the top 5",
        records: [...top5Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 4. Most Weeks in Top 10
      const top10Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 10) {
            const key = `${e.name}||${e.artist}`;
            const existing = top10Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top10Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top10",
        title: "Most Weeks in Top 10",
        icon: "fa-arrow-up",
        description: "Longest runs in the top 10",
        records: [...top10Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 5. Most Weeks in Top 50
      const top50Map = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          if (e.position <= 50) {
            const key = `${e.name}||${e.artist}`;
            const existing = top50Map.get(key);
            if (existing) {
              existing.value++;
              existing.valueLabel = `${existing.value} weeks`;
            } else {
              top50Map.set(key, {
                name: e.name,
                artist: e.artist,
                value: 1,
                valueLabel: "1 week",
                peak: e.peak || e.position,
                firstDate: date,
                chartId: chart.id,
              });
            }
          }
        }
      }
      categories.push({
        id: "top50",
        title: "Most Weeks in Top 50",
        icon: "fa-chart-line",
        description: "Longest runs in the top 50",
        records: [...top50Map.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 6. Most Weeks on Chart (Top 100)
      const totalWeeksMap = new Map<string, Stats2Record>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          const key = `${e.name}||${e.artist}`;
          const existing = totalWeeksMap.get(key);
          if (existing) {
            existing.value++;
            existing.valueLabel = `${existing.value} weeks`;
          } else {
            totalWeeksMap.set(key, {
              name: e.name,
              artist: e.artist,
              value: 1,
              valueLabel: "1 week",
              peak: e.peak || e.position,
              firstDate: date,
              chartId: chart.id,
            });
          }
        }
      }
      categories.push({
        id: "totalWeeks",
        title: "Most Weeks on Chart",
        icon: "fa-calendar-check",
        description: "Longest chart presence",
        records: [...totalWeeksMap.values()].sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 7. Most Simultaneous Entries (artist with most entries on a single week)
      const maxSimulMap = new Map<string, { count: number; date: string; names: string[] }>();
      for (const date of chart.dates) {
        const artistCount = new Map<string, string[]>();
        for (const e of chart.entriesByDate[date]) {
          const list = artistCount.get(e.artist) || [];
          list.push(e.name);
          artistCount.set(e.artist, list);
        }
        for (const [artist, names] of artistCount) {
          if (names.length >= 2) {
            const existing = maxSimulMap.get(artist);
            if (!existing || names.length > existing.count) {
              maxSimulMap.set(artist, { count: names.length, date, names });
            }
          }
        }
      }
      const simulRecords: Stats2Record[] = [];
      for (const [artist, info] of maxSimulMap) {
        simulRecords.push({
          name: info.names.join(", "),
          artist,
          value: info.count,
          valueLabel: `${info.count} entries`,
          firstDate: info.date,
          chartId: chart.id,
          details: `Peak simultaneous: ${info.count} entries on ${new Date(info.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        });
      }
      categories.push({
        id: "simultaneous",
        title: "Most Simultaneous Entries",
        icon: "fa-layer-group",
        description: "Artists with most concurrent chart entries",
        records: simulRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 8. Artists with Most Total Entries (unique items)
      const artistEntriesMap = new Map<string, Set<string>>();
      for (const date of chart.dates) {
        for (const e of chart.entriesByDate[date]) {
          const set = artistEntriesMap.get(e.artist) || new Set();
          set.add(e.name);
          artistEntriesMap.set(e.artist, set);
        }
      }
      const artistEntryRecords: Stats2Record[] = [];
      for (const [artist, items] of artistEntriesMap) {
        artistEntryRecords.push({
          name: artist,
          artist,
          value: items.size,
          valueLabel: `${items.size} entries`,
          chartId: chart.id,
          details: [...items].slice(0, 5).join(", ") + (items.size > 5 ? ` +${items.size - 5} more` : ""),
        });
      }
      categories.push({
        id: "artistEntries",
        title: "Artists with Most Entries",
        icon: "fa-users",
        description: "Artists with the most different chart entries",
        records: artistEntryRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 9. Biggest Drops (position fell the most in one week)
      const dropRecords: Stats2Record[] = [];
      for (let di = 1; di < chart.dates.length; di++) {
        const prevDate = chart.dates[di - 1];
        const currDate = chart.dates[di];
        const prevMap = new Map<string, number>();
        for (const e of chart.entriesByDate[prevDate]) prevMap.set(`${e.name}||${e.artist}`, e.position);
        for (const e of chart.entriesByDate[currDate]) {
          const key = `${e.name}||${e.artist}`;
          const prevPos = prevMap.get(key);
          if (prevPos != null && e.position > prevPos) {
            const drop = e.position - prevPos;
            if (drop >= 5) {
              dropRecords.push({
                name: e.name,
                artist: e.artist,
                value: drop,
                valueLabel: `▼${drop}`,
                peak: e.peak,
                firstDate: currDate,
                chartId: chart.id,
                details: `Dropped ${drop} spots: #${prevPos} → #${e.position} on ${new Date(currDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "biggestDrops",
        title: "Biggest Drops",
        icon: "fa-arrow-down",
        description: "Largest single-week drops",
        records: dropRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      // 10. Biggest Gainers (position rose the most in one week)
      const gainerRecords: Stats2Record[] = [];
      for (let di = 1; di < chart.dates.length; di++) {
        const prevDate = chart.dates[di - 1];
        const currDate = chart.dates[di];
        const prevMap = new Map<string, number>();
        for (const e of chart.entriesByDate[prevDate]) prevMap.set(`${e.name}||${e.artist}`, e.position);
        for (const e of chart.entriesByDate[currDate]) {
          const key = `${e.name}||${e.artist}`;
          const prevPos = prevMap.get(key);
          if (prevPos != null && e.position < prevPos) {
            const gain = prevPos - e.position;
            if (gain >= 5) {
              gainerRecords.push({
                name: e.name,
                artist: e.artist,
                value: gain,
                valueLabel: `▲${gain}`,
                peak: e.peak,
                firstDate: currDate,
                chartId: chart.id,
                details: `Gained ${gain} spots: #${prevPos} → #${e.position} on ${new Date(currDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
              });
            }
          }
        }
      }
      categories.push({
        id: "biggestGainers",
        title: "Biggest Gainers",
        icon: "fa-arrow-up",
        description: "Largest single-week gains",
        records: gainerRecords.sort((a, b) => b.value - a.value).slice(0, 1000),
      });

      chartStats[chart.id] = categories;
    }

    return { chartStats, availableYears, chartIds };
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
