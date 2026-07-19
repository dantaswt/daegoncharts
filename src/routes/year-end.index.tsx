import { createFileRoute, Link } from "@tanstack/react-router";
import { yearEndChartIds } from "@/lib/charts-config";
import { chartsConfig } from "@/lib/charts-config";

export const Route = createFileRoute("/year-end/")({
  head: () => ({ meta: [{ title: "Year-End Charts | daegon charts" }] }),
  component: () => (
    <div className="max-w-3xl mx-auto">
      <h1 className="section-title">Year-End Charts</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {yearEndChartIds.map((id) => {
          const cfg = chartsConfig[id];
          return (
            <Link
              key={id}
              to="/year-end/$chartId"
              params={{ chartId: id }}
              className="bg-[var(--card)] hover:border-[var(--accent)] border border-[var(--border)] rounded-lg p-6 text-center transition-all shadow-sm"
            >
              <i className={`fas ${cfg.icon} gold text-3xl mb-2`} />
              <div className="font-bold">{cfg.title}</div>
            </Link>
          );
        })}
      </div>
    </div>
  ),
});
