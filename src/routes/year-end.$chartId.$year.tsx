import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <Link to="/year-end/$chartId" params={{ chartId }} className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> {cfg.title}</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title} — {year}</h1>
      <div className="mb-6">
        <select
          value={year}
          onChange={(e) => {
            if (e.target.value) {
              navigate({ to: "/year-end/$chartId/$year", params: { chartId, year: e.target.value } });
            }
          }}
          className="bg-[var(--muted)] border border-[var(--border)] text-sm font-bold text-foreground px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          {years.map((y: string) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2 md:space-y-3">
        {entries.map((e: ChartEntry) => (
          <ChartRow key={`${e.position}-${e.name}`} entry={e} kind={cfg.kind} chartId={chartId} showDiff={false} />
        ))}
      </div>
    </div>
  );
}
