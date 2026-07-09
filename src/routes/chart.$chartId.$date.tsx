import { createFileRoute, notFound } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { chartsConfig, weeklyChartIds } from "@/lib/charts-config";
import { ChartTypeNav, WeekNavigator } from "@/components/chart-nav";
import { ChartRow } from "@/components/chart-row";

export const Route = createFileRoute("/chart/$chartId/$date")({
  loader: async ({ params }) => {
    if (!weeklyChartIds.includes(params.chartId)) throw notFound();
    const data = await getWeeklyChart({ data: { chartId: params.chartId } });
    if (!data.entriesByDate[params.date]) throw notFound();
    return { data, date: params.date, chartId: params.chartId };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Chart not found | daegon charts" }] };
    const cfg = chartsConfig[loaderData.chartId];
    const label = new Date(loaderData.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const title = `${cfg.title} — ${label} | daegon charts`;
    const desc = `${cfg.title} chart for the week of ${label}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="text-center py-16">
      <h2 className="text-2xl font-bold gold">Chart week not found</h2>
      <p className="text-muted-foreground mt-2">That chart or date has no data.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="text-center py-16">
      <h2 className="text-xl font-bold gold">Something broke</h2>
      <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
    </div>
  ),
  component: WeeklyChartPage,
});

function WeeklyChartPage() {
  const { data, date, chartId } = Route.useLoaderData();
  const cfg = chartsConfig[chartId];
  const entries = data.entriesByDate[date];
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <ChartTypeNav activeId={chartId} date={date} />
      </aside>
      <main>
        <div className="text-center mb-2 md:text-left">
          <h1 className="text-2xl md:text-4xl font-extrabold gold inline-flex items-center gap-2 justify-center md:justify-start">
            <i className={`fas ${cfg.icon}`} /> {cfg.title}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Chart week of {dateLabel}</p>
        </div>
        <WeekNavigator chartId={chartId} dates={data.dates} currentDate={date} />
        <div className="space-y-2 md:space-y-3 max-w-4xl mx-auto">
          {entries.map((e: typeof entries[number]) => (
            <ChartRow
              key={`${e.position}-${e.name}-${e.artist}`}
              entry={e}
              kind={cfg.kind}
              chartId={chartId}
              date={date}
              chartDates={data.dates}
              chartEntriesByDate={data.entriesByDate}
            />
          ))}
        </div>
        <div className="mt-8">
          <WeekNavigator chartId={chartId} dates={data.dates} currentDate={date} />
        </div>
      </main>
    </div>
  );
}
