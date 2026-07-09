import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndChart, type ChartEntry } from "@/lib/charts.functions";
import { chartsConfig, yearEndChartIds } from "@/lib/charts-config";
import { ChartRow } from "@/components/chart-row";

export const Route = createFileRoute("/year-end/$chartId/$year")({
  loader: async ({ params }) => {
    if (!yearEndChartIds.includes(params.chartId)) throw notFound();
    const data = await getYearEndChart({ data: { chartId: params.chartId } });
    const entries = data.entriesByYear[params.year];
    if (!entries) throw notFound();
    return { entries, chartId: params.chartId, year: params.year, years: data.years };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Year-End not found" }] };
    const cfg = chartsConfig[loaderData.chartId];
    const title = `${cfg.title} — ${loaderData.year} | daegon charts`;
    return {
      meta: [
        { title },
        { name: "description", content: `${cfg.title} year-end ranking for ${loaderData.year}.` },
        { property: "og:title", content: title },
      ],
    };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: YearEndYearPage,
});

function YearEndYearPage() {
  const { entries, chartId, year, years } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/year-end/$chartId" params={{ chartId }} className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> {cfg.title}</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title} — {year}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {years.map((y: string) => (
          <Link key={y} to="/year-end/$chartId/$year" params={{ chartId, year: y }} className={`btn-nav ${y === year ? "active" : ""}`}>{y}</Link>
        ))}
      </div>
      <div className="space-y-2 md:space-y-3">
        {entries.map((e: ChartEntry) => (
          <ChartRow key={`${e.position}-${e.name}`} entry={e} kind={cfg.kind} chartId={chartId} showDiff={false} />
        ))}
      </div>
    </div>
  );
}
