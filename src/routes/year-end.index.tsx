import { createFileRoute, Link } from "@tanstack/react-router";
import { yearEndChartIds } from "@/lib/charts-config";
import { chartsConfig } from "@/lib/charts-config";

export const Route = createFileRoute("/year-end/")({
  head: () => ({ meta: [{ title: "Year-End Charts | daegon charts" }] }),
  component: () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">YEC</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10">Year-End Charts</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The definitive year-end rankings across every chart</p>
      </div>
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
