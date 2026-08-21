import { createServerFn } from "@tanstack/react-start";
import { getWeeklyChart, getYearEndGenerated, type YECEntry } from "./charts.functions";
import { MALE_ARTISTS } from "./male-artists";
import { GROUP_ARTISTS } from "./group-artists";

/* ────── Hot 100 — Artists (total points per artist across all Hot 100 entries) ────── */
export const getYearEndHot100Artists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "songs" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.points ?? e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Hot 100 — Artists" };
  });

/* ────── Top 100 Albums — Artists (total units per artist across all album entries) ────── */
export const getYearEndTop100AlbumsArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "albums" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Top 100 Albums — Artists" };
  });

/* ────── Artist 50 — Male / Female / Duo+Group ────── */
function isMale(name: string): boolean {
  return MALE_ARTISTS.has(name.toLowerCase().trim());
}

function isGroup(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (GROUP_ARTISTS.has(n)) return true;
  if (/\b&\b/.test(n)) return true;
  if (/\bx\s/.test(n)) return true;
  return false;
}

function filterSolo(source: YECEntry[], male: boolean): YECEntry[] {
  return source.filter((e) => {
    if (isGroup(e.name)) return false;
    return male ? isMale(e.name) : !isMale(e.name);
  }).slice(0, 20).map((e, i) => ({ ...e, position: i + 1 }));
}

function filterGroups(source: YECEntry[]): YECEntry[] {
  return source.filter((e) => isGroup(e.name))
    .slice(0, 10).map((e, i) => ({ ...e, position: i + 1 }));
}

export const getYearEndArtist50Male = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await getYearEndGenerated({ data: { chartId: "artists" } });
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterSolo(yec.entriesByYear[year] || [], true);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Artist 50 — Male" };
  });

export const getYearEndArtist50Female = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await getYearEndGenerated({ data: { chartId: "artists" } });
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterSolo(yec.entriesByYear[year] || [], false);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Artist 50 — Female" };
  });

export const getYearEndArtist50DuoGroup = createServerFn({ method: "GET" })
  .handler(async () => {
    const yec = await getYearEndGenerated({ data: { chartId: "artists" } });
    const result: Record<string, YECEntry[]> = {};
    for (const year of yec.years) {
      result[year] = filterGroups(yec.entriesByYear[year] || []);
    }
    return { years: yec.years, entriesByYear: result, kind: "artist" as const, title: "Artist 50 — Duo/Group" };
  });

/* ────── Radio Songs — Artists (total audience per artist across all radio entries) ────── */
export const getYearEndRadioSongsArtists = createServerFn({ method: "GET" })
  .handler(async () => {
    const chartData = await getWeeklyChart({ data: { chartId: "radioSongs" } });
    const years: Record<string, Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; totalUnits: number; items: Set<string> }>> = {};

    for (const date of chartData.dates) {
      const year = date.slice(0, 4);
      const entries = chartData.entriesByDate[date] || [];
      if (!years[year]) years[year] = {};

      for (const e of entries) {
        const key = e.artist.toLowerCase();
        if (!years[year][key]) {
          years[year][key] = { name: e.artist, artist: e.artist, peak: 100, weeks: 0, weeksAt1: 0, totalUnits: 0, items: new Set() };
        }
        const a = years[year][key];
        a.weeks += 1;
        a.items.add(e.name.toLowerCase());
        if (e.peak < a.peak) a.peak = e.peak;
        a.weeksAt1 += (e.weeksAt1 ?? 0);
        const v = String(e.audience ?? e.units ?? "0");
        a.totalUnits += parseInt(v.replace(/[^0-9]/g, "")) || 0;
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const [year, items] of Object.entries(years)) {
      result[year] = Object.values(items)
        .sort((a, b) => b.totalUnits - a.totalUnits || a.peak - b.peak)
        .slice(0, 20)
        .map((e, i) => ({ position: i + 1, name: e.name, artist: e.artist, peak: e.peak, weeks: e.weeks, weeksAt1: e.weeksAt1, totalUnits: e.totalUnits, entries: e.items.size, kind: "artist" as const }));
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "artist" as const, title: "Radio Songs — Artists" };
  });
