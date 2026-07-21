import { createFileRoute, Link } from "@tanstack/react-router";
import { chartsConfig, goatChartIds } from "@/lib/charts-config";

export const Route = createFileRoute("/goat/")({
  head: () => ({ meta: [{ title: "Greatest of All Time | daegon charts" }] }),
  component: () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[4rem] md:text-[7rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">Greatest of All Time</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black gold tracking-tight relative z-10">Greatest of All Time</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">The definitive all-time rankings</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goatChartIds.map((id) => {
          const cfg = chartsConfig[id];
          return (
            <Link
              key={id}
              to="/goat/$chartId"
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
