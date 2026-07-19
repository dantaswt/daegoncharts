import { Link, useNavigate } from "@tanstack/react-router";
import React from "react";
import { chartsConfig, weeklyChartIds } from "@/lib/charts-config";

export function ChartTypeNav({ activeId, date }: { activeId: string; date?: string }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {weeklyChartIds.map((id) => {
        const cfg = chartsConfig[id];
        return (
          <Link
            key={id}
            to={date ? "/chart/$chartId/$date" : "/chart/$chartId"}
            params={date ? { chartId: id, date } : { chartId: id }}
            className={`btn-nav ${activeId === id ? "active" : ""}`}
          >
            <i className={`fas ${cfg.icon} mr-1`} />
            {cfg.title}
          </Link>
        );
      })}
    </div>
  );
}

interface WeekNavProps {
  chartId: string;
  dates: string[];
  currentDate: string;
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

export function WeekNavigator({ chartId, dates, currentDate }: WeekNavProps) {
  const navigate = useNavigate();
  const i = dates.indexOf(currentDate);
  const prev = i > 0 ? dates[i - 1] : null;
  const next = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;
  const datesSet = React.useMemo(() => new Set(dates), [dates]);
  const dateLabel = formatDate(currentDate);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-4">
      {prev ? (
        <Link to="/chart/$chartId/$date" params={{ chartId, date: prev }} className="btn-gold">
          <i className="fas fa-chevron-left" /> Prev
        </Link>
      ) : (
        <button className="btn-gold" disabled><i className="fas fa-chevron-left" /> Prev</button>
      )}
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-1">Chart week</div>
        <select
          value={currentDate}
          onChange={(e) => {
            const iso = e.target.value;
            if (datesSet.has(iso)) {
              navigate({ to: "/chart/$chartId/$date", params: { chartId, date: iso } });
            }
          }}
          className="bg-[var(--card)] border border-[var(--border)] text-sm font-bold text-[var(--foreground)] px-3 py-1.5 rounded-md focus:outline-none focus:border-[var(--accent)] cursor-pointer"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
      </div>
      {next ? (
        <Link to="/chart/$chartId/$date" params={{ chartId, date: next }} className="btn-gold">
          Next <i className="fas fa-chevron-right" />
        </Link>
      ) : (
        <button className="btn-gold" disabled>Next <i className="fas fa-chevron-right" /></button>
      )}
    </div>
  );
}

export function BackToTop() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const handleScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  if (!show) return null;
  
  return (
    <button 
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:brightness-95 transition-all z-50 cursor-pointer"
      aria-label="Back to top"
    >
      <i className="fas fa-arrow-up text-xl" />
    </button>
  );
}
