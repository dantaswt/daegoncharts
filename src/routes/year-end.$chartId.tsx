import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getYearEndChart, type ChartEntry } from "@/lib/charts.functions";
import { chartsConfig, yearEndChartIds } from "@/lib/charts-config";
import { ChartRow } from "@/components/chart-row";
import { useState } from "react";

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
  const [selectedYear, setSelectedYear] = useState<string>(data.years[0] || "");

  const entries = selectedYear ? data.entriesByYear[selectedYear] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      <Link to="/year-end" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> Year-End</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title} {selectedYear && `— ${selectedYear}`}</h1>
      
      {data.years.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-[var(--muted)] border border-[var(--border)] text-sm font-bold text-foreground px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            {data.years.map((y: string) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {selectedYear && entries && (
        <div className="space-y-2 md:space-y-3">
          {entries.map((e: ChartEntry) => (
            <ChartRow key={`${e.position}-${e.name}`} entry={e} kind={cfg.kind} chartId={chartId} showDiff={false} />
          ))}
        </div>
      )}
    </div>
  );
}
