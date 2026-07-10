import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
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

  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <Link to="/year-end" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> Year-End</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title}</h1>
      <div className="mb-6">
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              navigate({ to: "/year-end/$chartId/$year", params: { chartId, year: e.target.value } });
            }
          }}
          className="bg-[var(--muted)] border border-[var(--border)] text-sm font-bold text-foreground px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          <option value="" disabled>Select a year</option>
          {data.years.map((y: string) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted-foreground">Select a year to view only that year&apos;s chart entries.</p>
    </div>
  );
}
