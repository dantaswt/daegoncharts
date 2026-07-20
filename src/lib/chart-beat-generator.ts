import { createServerFn } from "@tanstack/react-start";
import { getWeeklyChart, getAllArtistStats, type ChartEntry, type WeeklyChartData } from "./charts.functions";
import { chartsConfig } from "./charts-config";

export interface GeneratedBeatArticle {
  chartId: string;
  chartTitle: string;
  date: string;
  headline: string;
  subtitle: string;
  sections: BeatSection[];
  methodology: string;
  image: string | null;
  artist: string | null;
}

export interface BeatSection {
  heading?: string;
  paragraphs: string[];
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

function formatUnits(v: string | undefined): string {
  const num = parseEuropeanNumber(v);
  if (num === 0) return "0";
  return num.toLocaleString("en-US");
}

function formatDateLong(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function diffLabel(diff: string): string {
  if (diff === "NEW") return "debuts";
  if (diff === "RE") return "re-enters";
  if (diff.startsWith("▲")) return "rises";
  if (diff.startsWith("▼")) return "falls";
  return "holds";
}

function diffDirection(diff: string): "up" | "down" | "steady" | "new" {
  if (diff === "NEW" || diff === "RE") return "new";
  if (diff.startsWith("▲")) return "up";
  if (diff.startsWith("▼")) return "down";
  return "steady";
}

function buildHeadline(artist: string, entry: ChartEntry, chartTitle: string, stats: { totalNo1s: number } | null): string {
  const chartName = chartTitle.toUpperCase();
  const itemName = entry.name;

  if (entry.position === 1) {
    if (entry.diff === "NEW") {
      const no1Count = (stats?.totalNo1s ?? 0) + 1;
      const ordinalStr = wordOrdinal(no1Count);
      return `${artist} Achieves ${ordinalStr} No. 1 on ${chartName} with '${itemName}'`;
    }
    if (entry.diff === "RE") {
      return `${artist} Returns to No. 1 on ${chartName} with '${itemName}'`;
    }
    if ((entry.weeksAt1 ?? 0) > 1) {
      return `${artist}'s '${itemName}' Rules ${chartName} for ${wordOrdinal(entry.weeksAt1!)} Week`;
    }
    return `${artist}'s '${itemName}' Holds at No. 1 on ${chartName}`;
  }

  if (entry.diff === "NEW") {
    return `${artist}'s '${itemName}' Debuts at No. ${entry.position} on ${chartName}`;
  }
  if (entry.diff === "RE") {
    return `${artist}'s '${itemName}' Re-Enters ${chartName} at No. ${entry.position}`;
  }
  return `${artist}'s '${itemName}' at No. ${entry.position} on ${chartName}`;
}

function buildSubtitle(topEntries: ChartEntry[], chartTitle: string): string {
  const parts: string[] = [];
  const debuts = topEntries.filter((e) => e.diff === "NEW" && e.position !== 1);
  if (debuts.length > 0) {
    const names = debuts.slice(0, 3).map((e) => `'${e.name}'`);
    parts.push(`Plus, ${names.join(", ")} ${debuts.length === 1 ? "debuts" : "debut"} in the top 10`);
  }
  const reEntries = topEntries.filter((e) => e.diff === "RE" && e.position !== 1);
  if (reEntries.length > 0 && parts.length === 0) {
    const names = reEntries.slice(0, 2).map((e) => `'${e.name}'`);
    parts.push(`${names.join(" and ")} ${reEntries.length === 1 ? "re-enters" : "re-enter"} the top 10`);
  }
  if (parts.length === 0) {
    const movers = topEntries.filter((e) => e.position !== 1 && e.diff.startsWith("▲"));
    if (movers.length > 0) {
      parts.push(`${movers[0].name} moves up to No. ${movers[0].position}`);
    }
  }
  return parts.join(". ") || "A look at the biggest moves on this week's chart.";
}

function buildNumberOneSection(entry: ChartEntry, artist: string, chartTitle: string, chartId: string, stats: { totalNo1s: number; items: string[] } | null): BeatSection {
  const paragraphs: string[] = [];

  const diffWord = entry.diff === "NEW" ? "debuts" : entry.diff === "RE" ? "re-enters" : "holds";

  let metricLine = "";
  if (chartId === "songs") {
    const parts: string[] = [];
    if (entry.points) parts.push(`${formatUnits(entry.points)} points`);
    if (entry.streams) parts.push(`${formatUnits(entry.streams)} streams`);
    if (entry.sales) parts.push(`${formatUnits(entry.sales)} in sales`);
    if (entry.airplay) parts.push(`${formatUnits(entry.airplay)} in audience`);
    if (parts.length > 0) metricLine = ` earned ${parts.join(", ")}`;
  } else if (chartId === "albums") {
    const parts: string[] = [];
    if (entry.units) parts.push(`${formatUnits(entry.units)} equivalent album units`);
    if (entry.streams) parts.push(`${formatUnits(entry.streams)} streaming equivalent album (SEA) units`);
    if (entry.sales) parts.push(`${formatUnits(entry.sales)} pure album sales`);
    if (parts.length > 0) metricLine = ` earned ${parts.join(", ")}`;
  } else if (chartId === "artists") {
    if (entry.units) metricLine = ` with ${formatUnits(entry.units)} equivalent units`;
  }

  if (entry.diff === "NEW" && stats && stats.totalNo1s > 0) {
    const ordinalStr = wordOrdinal(stats.totalNo1s + 1);
    paragraphs.push(
      `${artist} lands its ${ordinalStr} No. 1 on the ${chartTitle} chart as '${entry.name}' ${diffWord} atop the chart.${metricLine}. With ${stats.totalNo1s + 1} chart-toppers, ${artist.split(" ")[0]} now stands among the acts with the most No. 1s on the ${chartTitle} chart.`
    );
  } else if (entry.diff === "NEW") {
    paragraphs.push(
      `${artist}'s '${entry.name}' ${diffWord} at No. 1 on the ${chartTitle} chart${metricLine}.`
    );
  } else if ((entry.weeksAt1 ?? 0) > 1) {
    paragraphs.push(
      `${artist}'s '${entry.name}' rules the ${chartTitle} chart for the ${wordOrdinal(entry.weeksAt1!)} week, as it ${diffWord} at No. 1.${metricLine}.`
    );
  } else {
    paragraphs.push(
      `${artist}'s '${entry.name}' ${diffWord} at No. 1 on the ${chartTitle} chart.${metricLine}.`
    );
  }

  if (stats && stats.items.length > 1) {
    const otherItems = stats.items.filter((i) => i !== entry.name).slice(0, 3);
    if (otherItems.length > 0) {
      paragraphs.push(
        `Previously, ${artist} topped the ${chartTitle} with ${otherItems.map((i) => `'${i}'`).join(", ")}.`
      );
    }
  }

  return { heading: "No. 1 Spotlight", paragraphs };
}

function buildTop10Rundown(entries: ChartEntry[], chartTitle: string, chartId: string, artistStats: Record<string, any>): BeatSection {
  const paragraphs: string[] = [];
  const rest = entries.filter((e) => e.position >= 2 && e.position <= 10);

  if (rest.length === 0) return { paragraphs: [] };

  const lines: string[] = [];
  for (const e of rest) {
    const name = e.name;
    const artist = e.artist;
    let detail = "";

    if (e.diff === "NEW") {
      detail = `debuts at No. ${e.position}`;
    } else if (e.diff === "RE") {
      detail = `re-enters at No. ${e.position}`;
    } else if (e.diff.startsWith("▲")) {
      const spots = e.diff.slice(1);
      detail = `rises ${spots === "1" ? "one spot" : `${spots} spots`} to No. ${e.position}`;
    } else if (e.diff.startsWith("▼")) {
      const spots = e.diff.slice(1);
      detail = `falls ${spots === "1" ? "one spot" : `${spots} spots`} to No. ${e.position}`;
    } else {
      detail = `holds at No. ${e.position}`;
    }

    let metricStr = "";
    if (chartId === "songs" && e.points) metricStr = ` (${formatUnits(e.points)} points)`;
    else if (chartId === "albums" && e.units) metricStr = ` (${formatUnits(e.units)} equivalent units)`;
    else if (chartId === "artists" && e.units) metricStr = ` (${formatUnits(e.units)} units)`;

    lines.push(`${artist}'s '${name}' ${detail}${metricStr}`);
  }

  if (lines.length <= 3) {
    paragraphs.push(lines.join(". ") + ".");
  } else {
    paragraphs.push(lines.slice(0, Math.ceil(lines.length / 2)).join(". ") + ".");
    paragraphs.push(lines.slice(Math.ceil(lines.length / 2)).join(". ") + ".");
  }

  return { heading: "The Rest of the Top 10", paragraphs };
}

function buildNotableMovers(entries: ChartEntry[], allEntries: ChartEntry[], chartTitle: string, chartId: string): BeatSection {
  const paragraphs: string[] = [];

  const newEntries = entries.filter((e) => e.diff === "NEW" && e.position > 10);
  const reEntries = entries.filter((e) => e.diff === "RE" && e.position > 10);
  const bigGainers = entries
    .filter((e) => e.diff.startsWith("▲") && e.position > 10)
    .sort((a, b) => {
      const aSpots = parseInt(a.diff.slice(1)) || 0;
      const bSpots = parseInt(b.diff.slice(1)) || 0;
      return bSpots - aSpots;
    })
    .slice(0, 3);
  const bigDrops = entries
    .filter((e) => e.diff.startsWith("▼") && e.position > 10)
    .sort((a, b) => {
      const aSpots = parseInt(a.diff.slice(1)) || 0;
      const bSpots = parseInt(b.diff.slice(1)) || 0;
      return bSpots - aSpots;
    })
    .slice(0, 3);

  if (newEntries.length > 0) {
    const names = newEntries.slice(0, 5).map((e) => `${e.artist}'s '${e.name}' (No. ${e.position})`);
    paragraphs.push(`Beyond the top 10, ${names.join(", ")} ${names.length === 1 ? "debuts" : "debut"} on the ${chartTitle}.`);
  }

  if (reEntries.length > 0) {
    const names = reEntries.slice(0, 3).map((e) => `${e.artist}'s '${e.name}' (No. ${e.position})`);
    paragraphs.push(`Re-entries include ${names.join(", ")}.`);
  }

  if (bigGainers.length > 0) {
    const lines = bigGainers.map((e) => {
      const spots = parseInt(e.diff.slice(1)) || 0;
      return `${e.artist}'s '${e.name}' surges ${spots} spots to No. ${e.position}`;
    });
    paragraphs.push(`Among the week's biggest gainers: ${lines.join("; ")}.`);
  }

  if (bigDrops.length > 0) {
    const lines = bigDrops.map((e) => {
      const spots = parseInt(e.diff.slice(1)) || 0;
      return `${e.artist}'s '${e.name}' drops ${spots} spots to No. ${e.position}`;
    });
    paragraphs.push(`The steepest declines include ${lines.join("; ")}.`);
  }

  return { heading: "Notable Movers", paragraphs };
}

function buildMethodology(chartTitle: string, chartId: string): string {
  if (chartId === "songs") {
    return `The ${chartTitle} ranks the most popular songs of the week in the U.S. based on streaming, sales, and airplay data, compiled by Luminate. The chart combines streaming equivalent songs (SES), track equivalent songs (TES) and sales equivalent songs (SES). Streaming data accounts for the majority of the chart's methodology, reflecting on-demand audio and video streams from leading platforms. The new chart is posted on Billboard's website each Tuesday. For all chart news, follow @billboard and @billboardcharts on X and Instagram.`;
  }
  if (chartId === "albums") {
    return `The ${chartTitle} ranks the most popular albums of the week in the U.S. based on multi-metric consumption as measured in equivalent album units, compiled by Luminate. Units comprise album sales, track equivalent albums (TEA) and streaming equivalent albums (SEA). Each unit equals one album sale, or 10 individual tracks sold from an album, or 2,500 ad-supported or 1,000 paid/subscription on-demand official audio and video streams generated by songs from an album. The new chart is posted on Billboard's website each Tuesday. For all chart news, follow @billboard and @billboardcharts on X and Instagram.`;
  }
  if (chartId === "artists") {
    return `The ${chartTitle} ranks the most popular musical artists in the U.S. based on multi-metric consumption, including streaming, sales, and radio airplay, as measured by Luminate. The chart uses the same methodology as the Billboard 200, combining album sales, track equivalent albums, and streaming equivalent albums for each artist's catalog. The new chart is posted on Billboard's website each Tuesday. For all chart news, follow @billboard and @billboardcharts on X and Instagram.`;
  }
  return `The ${chartTitle} ranks the most popular entries based on data compiled by Luminate. The new chart is posted on Billboard's website each Tuesday.`;
}

function countNo1sForArtist(artistName: string, chartId: string, data: WeeklyChartData): { totalNo1s: number; items: string[] } {
  const items: Set<string> = new Set();
  for (const date of data.dates) {
    for (const entry of data.entriesByDate[date]) {
      if (entry.artist.toLowerCase() === artistName.toLowerCase() && entry.position === 1) {
        items.add(entry.name);
      }
    }
  }
  return { totalNo1s: items.size, items: Array.from(items) };
}

function findBestImage(entries: ChartEntry[], artistStats: Record<string, any>): { image: string | null; artist: string | null } {
  for (const e of entries) {
    if (e.position === 1) return { image: null, artist: e.artist };
  }
  if (entries.length > 0) return { image: null, artist: entries[0].artist };
  return { image: null, artist: null };
}

export const generateChartBeat2 = createServerFn({ method: "GET" })
  .inputValidator((d: { chartId: string; date: string }) => d)
  .handler(async ({ data }) => {
    const { chartId, date } = data;
    const cfg = chartsConfig[chartId];
    if (!cfg) throw new Error("Unknown chart");

    const chartData = await getWeeklyChart({ data: { chartId } });
    const entries = chartData.entriesByDate[date];

    if (!entries || entries.length === 0) {
      return {
        chartId,
        chartTitle: cfg.title,
        date,
        headline: `No Chart Data Available for ${formatDateLong(date)}`,
        subtitle: "",
        sections: [],
        methodology: buildMethodology(cfg.title, chartId),
        image: null,
        artist: null,
      } satisfies GeneratedBeatArticle;
    }

    const topEntry = entries[0];
    const top10 = entries.filter((e) => e.position <= 10);

    const artistStatsData = await getAllArtistStats();
    const artistEntry = artistStatsData[topEntry.artist];
    const artistChartEntries = artistEntry?.chartsByKind?.[chartId === "artists" ? cfg.title : chartId === "songs" ? "Hot 100" : "Billboard 200"] ?? [];
    const no1Count = countNo1sForArtist(topEntry.artist, chartId, chartData);

    const headline = buildHeadline(topEntry.artist, topEntry, cfg.title, { totalNo1s: no1Count.totalNo1s });
    const subtitle = buildSubtitle(top10, cfg.title);

    const sections: BeatSection[] = [];

    sections.push(buildNumberOneSection(topEntry, topEntry.artist, cfg.title, chartId, { totalNo1s: no1Count.totalNo1s, items: no1Count.items }));

    sections.push(buildTop10Rundown(top10, cfg.title, chartId, artistStatsData));

    sections.push(buildNotableMovers(entries, entries, cfg.title, chartId));

    const { artist } = findBestImage(entries, artistStatsData);

    return {
      chartId,
      chartTitle: cfg.title,
      date,
      headline,
      subtitle,
      sections,
      methodology: buildMethodology(cfg.title, chartId),
      image: null,
      artist: artist ?? topEntry.artist,
    } satisfies GeneratedBeatArticle;
  });
