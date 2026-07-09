import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getGoatChart, type ChartEntry } from "@/lib/charts.functions";
import { chartsConfig, goatChartIds } from "@/lib/charts-config";
import { ChartRow } from "@/components/chart-row";

export const Route = createFileRoute("/goat/$chartId")({
  loader: async ({ params }) => {
    if (!goatChartIds.includes(params.chartId)) throw notFound();
    const data = await getGoatChart({ data: { chartId: params.chartId } });
    return { data, chartId: params.chartId };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? chartsConfig[loaderData.chartId].title : "GOAT";
    return { meta: [{ title: `${t} | daegon charts` }, { name: "description", content: `${t} — greatest of all time.` }] };
  },
  notFoundComponent: () => <div className="text-center py-16 gold font-bold">Not found</div>,
  component: GoatPage,
});

function GoatPage() {
  const { data, chartId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/goat" className="text-sm text-muted-foreground hover:text-[var(--accent)]"><i className="fas fa-arrow-left" /> GOAT</Link>
      <h1 className="text-3xl md:text-4xl font-extrabold gold my-4"><i className={`fas ${cfg.icon} mr-2`} />{cfg.title}</h1>
      <div className="space-y-2 md:space-y-3">
        {data.entries.map((e: ChartEntry) => (
          <ChartRow key={`${e.position}-${e.name}`} entry={e} kind={cfg.kind} showDiff={false} />
        ))}
      </div>
    </div>
  );
}
