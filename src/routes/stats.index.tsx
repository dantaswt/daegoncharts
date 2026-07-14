import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getWeeklyChart, type ChartEntry } from "@/lib/charts.functions";
import { chartsConfig, slugifyArtist, weeklyChartIds } from "@/lib/charts-config";
import { useMemo, useState } from "react";

type Metric = "numberOnes" | "accumulated" | "positionWeeks" | "consecutive" | "debuts" | "debutEntries" | "simultaneous";
const metricLabels: Record<Metric, string> = { numberOnes: "Most #1 weeks", accumulated: "Most accumulated weeks", positionWeeks: "Most weeks at position", consecutive: "Most consecutive #1 weeks", debuts: "Biggest debuts", debutEntries: "Most chart debuts", simultaneous: "Most simultaneous items" };
const thresholds = [1, 3, 5, 10, 20, 50, 100];

export const Route = createFileRoute("/stats/")({
  validateSearch: (search: Record<string, unknown>) => ({ chart: weeklyChartIds.includes(search.chart as string) ? search.chart as string : "songs" }),
  loader: ({ search }) => getWeeklyChart({ data: { chartId: search.chart } }),
  head: () => ({ meta: [{ title: "Chart Statistics | daegon charts" }, { name: "description", content: "Deep, filterable statistics built from weekly chart history." }] }),
  component: StatsPage,
});

function numeric(value?: string) { return Number((value ?? "").replace(/[^\d.-]/g, "")) || 0; }
function key(entry: ChartEntry) { return entry.artist.trim(); }

function StatsPage() {
  const data = Route.useLoaderData(); const { chart } = Route.useSearch(); const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>("numberOnes"); const [threshold, setThreshold] = useState(1); const [debutField, setDebutField] = useState<"points" | "units" | "sales" | "streams" | "audience">("points");
  const rankings = useMemo(() => {
    const totals = new Map<string, number>(); const add = (artist: string, value = 1) => totals.set(artist, (totals.get(artist) ?? 0) + value);
    if (metric === "consecutive") {
      const streaks = new Map<string, number>(); const best = new Map<string, number>();
      data.dates.forEach((date) => { const current = new Set((data.entriesByDate[date] ?? []).filter((entry) => entry.position === 1).map(key)); [...streaks.keys()].forEach((artist) => { if (!current.has(artist)) streaks.set(artist, 0); }); current.forEach((artist) => { const next = (streaks.get(artist) ?? 0) + 1; streaks.set(artist, next); best.set(artist, Math.max(best.get(artist) ?? 0, next)); }); });
      best.forEach((value, artist) => totals.set(artist, value));
    } else if (metric === "simultaneous") {
      data.dates.forEach((date) => { const perWeek = new Map<string, number>(); (data.entriesByDate[date] ?? []).forEach((entry) => perWeek.set(key(entry), (perWeek.get(key(entry)) ?? 0) + 1)); perWeek.forEach((value, artist) => totals.set(artist, Math.max(totals.get(artist) ?? 0, value))); });
    } else {
      data.dates.forEach((date) => (data.entriesByDate[date] ?? []).forEach((entry) => {
        if (metric === "numberOnes" && entry.position === 1) add(key(entry));
        if (metric === "accumulated" && entry.position <= threshold) add(key(entry));
        if (metric === "positionWeeks" && (threshold === 1 ? entry.position === 1 : entry.position <= threshold)) add(key(entry));
        if (metric === "debutEntries" && entry.diff === "NEW" && entry.position <= threshold) add(key(entry));
        if (metric === "debuts" && entry.diff === "NEW") totals.set(key(entry), Math.max(totals.get(key(entry)) ?? 0, numeric(entry[debutField])));
      }));
    }
    return [...totals.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 100);
  }, [data, debutField, metric, threshold]);
  const suffix = metric === "debuts" ? debutField : metric === "simultaneous" ? "items" : "weeks";

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 animate-fade-in"><div className="mb-7"><h1 className="section-title">Stats</h1><p className="text-sm text-muted-foreground">Historical performance calculated from every week of the selected chart.</p></div><div className="grid gap-3 md:grid-cols-3 bg-[var(--muted)] border border-[var(--border)] rounded-xl p-4 mb-6"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chart<select value={chart} onChange={(event) => navigate({ to: "/stats", search: { chart: event.target.value } })} className="mt-2 w-full bg-black border border-[var(--border)] rounded-lg p-2 text-sm text-white">{weeklyChartIds.map((id) => <option key={id} value={id}>{chartsConfig[id].title}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Analysis<select value={metric} onChange={(event) => setMetric(event.target.value as Metric)} className="mt-2 w-full bg-black border border-[var(--border)] rounded-lg p-2 text-sm text-white">{(Object.keys(metricLabels) as Metric[]).map((id) => <option key={id} value={id}>{metricLabels[id]}</option>)}</select></label>{["accumulated", "positionWeeks", "debutEntries"].includes(metric) ? <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Position range<select value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-2 w-full bg-black border border-[var(--border)] rounded-lg p-2 text-sm text-white">{thresholds.map((value) => <option key={value} value={value}>{value === 1 ? "#1" : `Top ${value}`}</option>)}</select></label> : metric === "debuts" ? <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Debut measure<select value={debutField} onChange={(event) => setDebutField(event.target.value as typeof debutField)} className="mt-2 w-full bg-black border border-[var(--border)] rounded-lg p-2 text-sm text-white"><option value="points">Points</option><option value="units">Units</option><option value="sales">Sales</option><option value="streams">Streams</option><option value="audience">Audience</option></select></label> : <div className="flex items-end text-xs text-muted-foreground">{data.dates.length} chart weeks analysed</div>}</div><div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-bold">{metricLabels[metric]}</h2><span className="text-sm gold">{chartsConfig[chart].title}</span></div><div className="space-y-2">{rankings.map(([artist, value], index) => <Link key={artist} to="/artist/$slug" params={{ slug: slugifyArtist(artist) }} className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]"><span className="w-8 text-center font-black gold">{index + 1}</span><span className="min-w-0 flex-1 font-semibold group-hover:text-[var(--accent)]">{artist}</span><span className="font-black text-lg">{value.toLocaleString()} <small className="text-xs text-muted-foreground font-medium">{suffix}</small></span></Link>)}{!rankings.length && <p className="text-muted-foreground">No matching entries are available for this filter.</p>}</div></div>;
}
