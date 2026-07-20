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
      <div className="relative text-center py-10 md:py-14 mb-8 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[6rem] md:text-[10rem] font-black text-[rgba(0,0,0,0.04)] uppercase tracking-tighter leading-none">#1'S</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black gold tracking-tight relative z-10">#1's History</h1>
        <p className="text-muted-foreground text-sm md:text-base mt-3 relative z-10">A complete history of every #1 hit across the weekly charts</p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {weeklyChartIds.map(id => {
          const c = chartsConfig[id];
          return (
            <button
              key={id}
              onClick={() => setActiveChartId(id)}
              className={`tab-pill ${activeChartId === id ? "active" : ""}`}
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
