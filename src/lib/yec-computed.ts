import { createServerFn } from "@tanstack/react-start";
import { getWeeklyChart, getYearEndGenerated, type YECEntry } from "./charts.functions";
import { getTopLatinAlbums } from "./latin-albums-chart";
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

const CURATED_FEMALE_50: Record<string, { name: string; artist: string }[]> = {
  "1999": [
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Jennifer Lopez", artist: "Jennifer Lopez" },
    { name: "Roberta Miranda", artist: "Roberta Miranda" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Celine Dion", artist: "Celine Dion" },
    { name: "Leci Brandão", artist: "Leci Brandão" },
    { name: "Joanna", artist: "Joanna" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Cher", artist: "Cher" },
  ],
  "2000": [
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Hannah Lima", artist: "Hannah Lima" },
    { name: "Madonna", artist: "Madonna" },
    { name: "Marisa Monte", artist: "Marisa Monte" },
    { name: "Lara Fabian", artist: "Lara Fabian" },
    { name: "Jennifer Lopez", artist: "Jennifer Lopez" },
    { name: "Rita Lee", artist: "Rita Lee" },
    { name: "Faith Hill", artist: "Faith Hill" },
  ],
  "2001": [
    { name: "Lara Fabian", artist: "Lara Fabian" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Madonna", artist: "Madonna" },
    { name: "Marisa Monte", artist: "Marisa Monte" },
    { name: "Adriana Calcanhotto", artist: "Adriana Calcanhotto" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Janet Jackson", artist: "Janet Jackson" },
    { name: "Dido", artist: "Dido" },
    { name: "Nelly Furtado", artist: "Nelly Furtado" },
  ],
  "2002": [
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Kelly Key", artist: "Kelly Key" },
    { name: "Marisa Monte", artist: "Marisa Monte" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Cássia Eller", artist: "Cássia Eller" },
    { name: "Dido", artist: "Dido" },
    { name: "Nelly Furtado", artist: "Nelly Furtado" },
    { name: "Kylie Minogue", artist: "Kylie Minogue" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
  ],
  "2003": [
    { name: "Avril Lavigne", artist: "Avril Lavigne" },
    { name: "Kelly Key", artist: "Kelly Key" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Madonna", artist: "Madonna" },
    { name: "Cássia Eller", artist: "Cássia Eller" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Luka", artist: "Luka" },
    { name: "Thalia", artist: "Thalia" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
  ],
  "2004": [
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
    { name: "Luka", artist: "Luka" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Kelly Key", artist: "Kelly Key" },
    { name: "Cássia Eller", artist: "Cássia Eller" },
    { name: "Alcione", artist: "Alcione" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Avril Lavigne", artist: "Avril Lavigne" },
    { name: "Adriana Calcanhotto", artist: "Adriana Calcanhotto" },
  ],
  "2005": [
    { name: "Marjorie Estiano", artist: "Marjorie Estiano" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Alcione", artist: "Alcione" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Avril Lavigne", artist: "Avril Lavigne" },
    { name: "Kelly Key", artist: "Kelly Key" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
  ],
  "2006": [
    { name: "Ana Carolina", artist: "Ana Carolina" },
    { name: "Kelly Clarkson", artist: "Kelly Clarkson" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Madonna", artist: "Madonna" },
    { name: "Alcione", artist: "Alcione" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Marjorie Estiano", artist: "Marjorie Estiano" },
    { name: "Beyoncé", artist: "Beyoncé" },
    { name: "Shakira", artist: "Shakira" },
  ],
  "2007": [
    { name: "Beyoncé", artist: "Beyoncé" },
    { name: "Fergie", artist: "Fergie" },
    { name: "Nelly Furtado", artist: "Nelly Furtado" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Marina Elali", artist: "Marina Elali" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Avril Lavigne", artist: "Avril Lavigne" },
    { name: "Janet Jackson", artist: "Janet Jackson" },
  ],
  "2008": [
    { name: "Danni Carlos", artist: "Danni Carlos" },
    { name: "Colbie Caillat", artist: "Colbie Caillat" },
    { name: "Rihanna", artist: "Rihanna" },
    { name: "Fergie", artist: "Fergie" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Avril Lavigne", artist: "Avril Lavigne" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Marina Elali", artist: "Marina Elali" },
    { name: "Madonna", artist: "Madonna" },
  ],
  "2009": [
    { name: "Beyoncé", artist: "Beyoncé" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Rihanna", artist: "Rihanna" },
    { name: "Madonna", artist: "Madonna" },
    { name: "Lady Gaga", artist: "Lady Gaga" },
    { name: "Katy Perry", artist: "Katy Perry" },
    { name: "Marisa Monte", artist: "Marisa Monte" },
    { name: "Colbie Caillat", artist: "Colbie Caillat" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
  ],
  "2010": [
    { name: "Lady Gaga", artist: "Lady Gaga" },
    { name: "Rihanna", artist: "Rihanna" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Beyoncé", artist: "Beyoncé" },
    { name: "Kesha", artist: "Kesha" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Mariah Carey", artist: "Mariah Carey" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
  ],
  "2011": [
    { name: "Rihanna", artist: "Rihanna" },
    { name: "Katy Perry", artist: "Katy Perry" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Kesha", artist: "Kesha" },
    { name: "Lady Gaga", artist: "Lady Gaga" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Claudia Leitte", artist: "Claudia Leitte" },
    { name: "Pitty", artist: "Pitty" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Beyoncé", artist: "Beyoncé" },
  ],
  "2012": [
    { name: "Katy Perry", artist: "Katy Perry" },
    { name: "Paula Fernandes", artist: "Paula Fernandes" },
    { name: "Adele", artist: "Adele" },
    { name: "Rihanna", artist: "Rihanna" },
    { name: "Britney Spears", artist: "Britney Spears" },
    { name: "Lady Gaga", artist: "Lady Gaga" },
    { name: "Shakira", artist: "Shakira" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Marisa Monte", artist: "Marisa Monte" },
    { name: "Ana Carolina", artist: "Ana Carolina" },
  ],
  "2013": [
    { name: "Taylor Swift", artist: "Taylor Swift" },
    { name: "Paula Fernandes", artist: "Paula Fernandes" },
    { name: "Carly Rae Jepsen", artist: "Carly Rae Jepsen" },
    { name: "Katy Perry", artist: "Katy Perry" },
    { name: "Kesha", artist: "Kesha" },
    { name: "Ivete Sangalo", artist: "Ivete Sangalo" },
    { name: "Christina Aguilera", artist: "Christina Aguilera" },
    { name: "Adele", artist: "Adele" },
    { name: "Claudia Leitte", artist: "Claudia Leitte" },
    { name: "Rihanna", artist: "Rihanna" },
  ],
};

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
      const curated = CURATED_FEMALE_50[year];
      if (curated) {
        result[year] = curated.map((e, i) => ({
          position: i + 1,
          name: e.name,
          artist: e.artist,
          peak: i + 1,
          weeks: 0,
          weeksAt1: 0,
          totalUnits: 0,
          kind: "artist" as const,
        }));
      } else {
        result[year] = filterSolo(yec.entriesByYear[year] || [], false);
      }
    }
    for (const year of Object.keys(CURATED_FEMALE_50)) {
      if (!result[year]) {
        result[year] = CURATED_FEMALE_50[year].map((e, i) => ({
          position: i + 1,
          name: e.name,
          artist: e.artist,
          peak: i + 1,
          weeks: 0,
          weeksAt1: 0,
          totalUnits: 0,
          kind: "artist" as const,
        }));
      }
    }
    const allYears = Object.keys(result).sort((a, b) => Number(b) - Number(a));
    return { years: allYears, entriesByYear: result, kind: "artist" as const, title: "Artist 50 — Female" };
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

/* ────── Year-End Top Latin Albums (mirrors YEC Top 100 Albums, filtered to Latin) ────── */
export const getYearEndTopLatinAlbums = createServerFn({ method: "GET" })
  .handler(async () => {
    const [latinData, yecAlbums] = await Promise.all([
      getTopLatinAlbums(),
      getYearEndGenerated({ data: { chartId: "albums" } }),
    ]);

    // Build Latin album keys from weekly Latin chart (all albums that ever appeared)
    const latinAlbumKeys = new Set<string>();
    for (const date of latinData.dates) {
      for (const e of latinData.entriesByDate[date] ?? []) {
        latinAlbumKeys.add(`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`);
      }
    }

    // Also build peak/weeks from Latin chart for display
    const latinStats: Record<string, { peak: number; weeks: number; weeksAt1: number }> = {};
    for (const date of latinData.dates) {
      for (const e of latinData.entriesByDate[date] ?? []) {
        const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
        const existing = latinStats[key];
        if (existing) {
          existing.weeks += 1;
          if (e.peak < existing.peak) existing.peak = e.peak;
          existing.weeksAt1 += (e.weeksAt1 ?? 0);
        } else {
          latinStats[key] = { peak: e.peak, weeks: 1, weeksAt1: e.weeksAt1 ?? 0 };
        }
      }
    }

    const result: Record<string, YECEntry[]> = {};
    for (const year of yecAlbums.years) {
      const yecEntries = yecAlbums.entriesByYear[year] ?? [];

      // First: Latin albums in YEC Top 100 Albums order
      const latinInYec = yecEntries.filter((e) => {
        const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
        return latinAlbumKeys.has(key);
      });

      // If >= 25, just take top 25
      if (latinInYec.length >= 25) {
        result[year] = latinInYec.slice(0, 25).map((e, i) => {
          const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
          const stats = latinStats[key];
          return {
            position: i + 1,
            name: e.name,
            artist: e.artist,
            peak: stats?.peak ?? e.peak,
            weeks: stats?.weeks ?? e.weeks,
            weeksAt1: stats?.weeksAt1 ?? e.weeksAt1,
            totalUnits: e.totalUnits,
            kind: "album" as const,
          };
        });
      } else {
        // Fill remaining slots with Latin chart points logic
        const latinPtsByAlbum: Record<string, { name: string; artist: string; peak: number; weeks: number; weeksAt1: number; points: number }> = {};
        for (const date of latinData.dates) {
          if (date.slice(0, 4) !== year) continue;
          for (const e of latinData.entriesByDate[date] ?? []) {
            const key = `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`;
            const pts = Math.max(0, 26 - e.position);
            const existing = latinPtsByAlbum[key];
            if (existing) {
              existing.weeks += 1;
              existing.points += pts;
              if (e.peak < existing.peak) existing.peak = e.peak;
              existing.weeksAt1 += (e.weeksAt1 ?? 0);
            } else {
              latinPtsByAlbum[key] = {
                name: e.name,
                artist: e.artist,
                peak: e.peak,
                weeks: 1,
                weeksAt1: e.weeksAt1 ?? 0,
                points: pts,
              };
            }
          }
        }

        // Already placed from YEC
        const placed = new Set(latinInYec.map((e) => `${e.name.toLowerCase()}||${e.artist.toLowerCase()}`));

        const extra = Object.values(latinPtsByAlbum)
          .filter((e) => !placed.has(`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`))
          .sort((a, b) => b.points - a.points || a.peak - b.peak);

        const combined = [
          ...latinInYec.map((e) => ({
            position: 0,
            name: e.name,
            artist: e.artist,
            peak: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.peak ?? e.peak,
            weeks: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.weeks ?? e.weeks,
            weeksAt1: latinStats[`${e.name.toLowerCase()}||${e.artist.toLowerCase()}`]?.weeksAt1 ?? e.weeksAt1,
            totalUnits: e.totalUnits,
          })),
          ...extra.map((e) => ({
            position: 0,
            name: e.name,
            artist: e.artist,
            peak: e.peak,
            weeks: e.weeks,
            weeksAt1: e.weeksAt1,
            totalUnits: e.points,
          })),
        ];

        result[year] = combined.slice(0, 25).map((e, i) => ({
          ...e,
          position: i + 1,
          kind: "album" as const,
        }));
      }
    }

    const sortedYears = Object.keys(result).sort().reverse();
    return { years: sortedYears, entriesByYear: result, kind: "album" as const, title: "Top Latin Albums" };
  });
