import { createFileRoute, Link } from "@tanstack/react-router";
import { chartsConfig, goatChartIds } from "@/lib/charts-config";

export const Route = createFileRoute("/goat/")({
  head: () => ({ meta: [{ title: "GOAT Charts | daegon charts" }] }),
  component: () => (
    <div className="max-w-3xl mx-auto">
      <h1 className="section-title">GOAT — Greatest of All Time</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {goatChartIds.map((id) => {
          const cfg = chartsConfig[id];
          return (
            <Link
              key={id}
              to="/goat/$chartId"
              params={{ chartId: id }}
              className="bg-[var(--muted)] hover:border-[var(--accent)] border border-transparent rounded-lg p-6 text-center transition-all"
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
