import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getWeeklyChart } from "@/lib/charts.functions";
import { chartsConfig, weeklyChartIds, slugifyArtist } from "@/lib/charts-config";
import { ChartTypeNav, WeekNavigator } from "@/components/chart-nav";
import { ChartRow } from "@/components/chart-row";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/chart/$chartId/$date")({
  loader: async ({ params }) => {
    if (!weeklyChartIds.includes(params.chartId)) throw notFound();
    const data = await getWeeklyChart({ data: { chartId: params.chartId } });
    // normalize incoming date to the Saturday of that week (charts publish on Saturdays)
    function toSaturdayIso(dStr: string) {
      try {
        const d = new Date(dStr + "T00:00:00");
        const diff = 6 - d.getDay();
        const sat = new Date(d);
        sat.setDate(d.getDate() + diff);
        return sat.toISOString().slice(0, 10);
      } catch { return dStr; }
    }
    const normalized = toSaturdayIso(params.date);
    if (data.entriesByDate[params.date]) {
      return { data, date: params.date, chartId: params.chartId };
    }
    if (data.entriesByDate[normalized]) {
      // return normalized date so the page can render correct data; component may replace URL
      return { data, date: normalized, chartId: params.chartId, originalRequestedDate: params.date };
    }
    throw notFound();
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
  const loader = Route.useLoaderData() as any;
  const { data, date, chartId, originalRequestedDate } = loader;
  const cfg = chartsConfig[chartId];
  // if loader normalized the date, replace the URL so it always shows the Saturday
  useEffect(() => {
    if (originalRequestedDate && originalRequestedDate !== date) {
      // client-side replace
      try {
        const nav = (window as any).history;
        const newPath = window.location.pathname.replace(originalRequestedDate, date);
        nav.replaceState(nav.state, nav.title, newPath + window.location.search);
      } catch { /* ignore */ }
    }
  }, [originalRequestedDate, date]);
  const entries = data.entriesByDate[date];
  const currentIndex = data.dates.indexOf(date);
  const previousDate = currentIndex > 0 ? data.dates[currentIndex - 1] : null;
  const dropouts = previousDate
    ? (data.entriesByDate[previousDate] || []).filter((prevEntry: any) =>
        !entries.some((curr: any) => curr.name === prevEntry.name && curr.artist === prevEntry.artist)
      )
    : [];
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-7xl mx-auto w-full grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
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
        {dropouts.length > 0 && (
          <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">DROP-OUTS</div>
            <div className="space-y-2">
              {dropouts.map((out: any) => (
                <DropoutChip key={`${out.name}-${out.artist}`} dropout={out} chartKind={cfg.kind} />
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <WeekNavigator chartId={chartId} dates={data.dates} currentDate={date} />
        </div>
      </main>
    </div>
  );
}

function DropoutChip({ dropout, chartKind }: { dropout: any; chartKind: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const query = chartKind === "album"
    ? `album:"${dropout.name}" artist:"${dropout.artist}"`
    : `artist:"${dropout.artist}"`;
  const type = chartKind === "album" ? "album" : "artist";

  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query, type } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => {
      active = false;
    };
  }, [query, type]);

  return (
    <Link
      to="/artist/$slug"
      params={{ slug: slugifyArtist(dropout.artist) }}
      className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[#111827] p-3 text-xs text-muted-foreground transition hover:border-[var(--accent)] w-full"
    >
      <div className="w-14 h-14 overflow-hidden rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={dropout.artist} className="w-full h-full object-cover" />
        ) : (
          <i className="fas fa-user text-xl text-gray-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-white break-words">{dropout.name}</div>
        <div className="text-[11px] text-gray-400 break-words">{dropout.artist}</div>
        <div className="mt-1 text-[10px] text-gray-400 flex flex-wrap gap-x-2">
          <span>LW: <span className="font-semibold">#{dropout.position}</span></span>
          {dropout.peak && <span>Peak: <span className="font-semibold">#{dropout.peak}</span></span>}
          {dropout.weeks && <span>Weeks: <span className="font-semibold">{dropout.weeks}</span></span>}
        </div>
      </div>
    </Link>
  );
}
