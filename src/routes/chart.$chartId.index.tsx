import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { weeklyChartIds } from "@/lib/charts-config";

export const Route = createFileRoute("/chart/$chartId/")({
  loader: async ({ params }) => {
    if (!weeklyChartIds.includes(params.chartId)) throw notFound();
    throw redirect({ to: "/chart/$chartId/$date", params: { chartId: params.chartId, date: "latest" } });
  },
  component: () => null,
});
