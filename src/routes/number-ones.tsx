import { createFileRoute } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { weeklyChartIds, chartsConfig } from "@/lib/charts-config";
import { ChartRow } from "@/components/chart-row";
import { useState } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/number-ones")({
  loader: async () => {
    const allData = await Promise.all(
      weeklyChartIds.map(id => getWeeklyChart({ data: { chartId: id } }))
    );
    return { charts: allData };
  },
  head: () => ({
    meta: [
      { title: "#1's History | daegon charts" },
      { name: "description", content: "Explore the history of #1 hits across all weekly charts." }
    ]
  }),
  component: NumberOnesPage,
});

function NumberOnesPage() {
  const { charts } = Route.useLoaderData();
  const [activeChartId, setActiveChartId] = useState<string>("songs");

  const activeChart = charts.find(c => c.chartId === activeChartId);
  const cfg = chartsConfig[activeChartId];

  // Extract all #1s chronologically
  const numberOnes = activeChart ? activeChart.dates.map(date => {
    const entries = activeChart.entriesByDate[date] || [];
    const no1 = entries.find(e => e.position === 1);
    return no1 ? { date, entry: no1 } : null;
  }).filter(Boolean) as Array<{ date: string; entry: any }> : [];

  // Group consecutive weeks at #1
  const groupedOnes: Array<{ entry: any; startDate: string; endDate: string; weeksAt1: number }> = [];
  for (const item of numberOnes) {
    const last = groupedOnes[groupedOnes.length - 1];
    if (last && last.entry.name === item.entry.name && last.entry.artist === item.entry.artist) {
      last.endDate = item.date;
      last.weeksAt1 += 1;
    } else {
      groupedOnes.push({
        entry: item.entry,
        startDate: item.date,
        endDate: item.date,
        weeksAt1: 1
      });
    }
  }

  // Reverse so newest is first
  groupedOnes.reverse();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-6xl font-black gold mb-4">#1's History</h1>
        <p className="text-muted-foreground text-sm md:text-base">A complete history of every #1 hit across the weekly charts.</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {weeklyChartIds.map(id => {
          const c = chartsConfig[id];
          return (
            <button
              key={id}
              onClick={() => setActiveChartId(id)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${
                activeChartId === id
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--muted)] text-muted-foreground hover:text-white border border-[var(--border)]"
              }`}
            >
              <i className={`fas ${c.icon} mr-2`} />
              {c.title}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {groupedOnes.map((group, i) => {
          const start = new Date(group.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const end = new Date(group.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const dateLabel = group.startDate === group.endDate ? start : `${start} — ${end}`;

          return (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: (i % 10) * 0.05 }} key={`${group.startDate}-${group.entry.name}`}>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-2">
                {dateLabel} <span className="gold ml-2">({group.weeksAt1} week{group.weeksAt1 > 1 ? "s" : ""})</span>
              </div>
              <ChartRow entry={{...group.entry, position: 1, diff: ""}} kind={cfg.kind} chartId={activeChartId} showDiff={false} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
