import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndChart } from "@/lib/charts.functions";
import { chartsConfig, yearEndChartIds } from "@/lib/charts-config";
import { ChartRow } from "@/components/chart-row";

export const Route = createFileRoute("/year-end/$chartId")({
  loader: async ({ params }) => {
    if (!yearEndChartIds.includes(params.chartId)) throw notFound();
    const data = await getYearEndChart({ data: { chartId: params.chartId } });
    return { data, chartId: params.chartId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId].title : "Year-End";
    return { meta: [{ title: `${t} | daegon charts` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: YearEndChartPage,
});

function YearEndChartPage() {
  const { data, chartId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/year-end" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> Year-End</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {data.years.map((y: string) => (
          <Link key={y} to="/year-end/$chartId/$year" params={{ chartId, year: y }} className="btn-nav">{y}</Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Select a year to view only that year&apos;s chart entries.</p>
    </div>
  );
}
