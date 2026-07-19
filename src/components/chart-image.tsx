import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { ChartEntry } from "@/lib/charts.functions";

const COLOR_THEMES: Record<string, { accent: string; accentDark: string }> = {
  songs:          { accent: "#00E676", accentDark: "#00C853" },
  streamingSongs: { accent: "#00E676", accentDark: "#00C853" },
  radioSongs:     { accent: "#00E676", accentDark: "#00C853" },
  digitalSongsSales: { accent: "#00E676", accentDark: "#00C853" },
  albums:         { accent: "#38BDF8", accentDark: "#0EA5E9" },
  topStreamingAlbums: { accent: "#38BDF8", accentDark: "#0EA5E9" },
  topAlbumSales:  { accent: "#38BDF8", accentDark: "#0EA5E9" },
  artists:        { accent: "#F87171", accentDark: "#EF4444" },
};

function lastWeekDisplay(entry: ChartEntry): string {
  if (entry.diff === "NEW") return "NEW";
  if (entry.diff === "RE") return "RE";
  if (!entry.lastWeek) return "—";
  return entry.lastWeek;
}

interface ChartImageProps {
  entries: ChartEntry[];
  chartTitle: string;
  chartId: string;
  date: string;
  kind: "song" | "album" | "artist";
}

export function ChartImage({ entries, chartTitle, chartId, date, kind }: ChartImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const theme = COLOR_THEMES[chartId] ?? COLOR_THEMES.songs;
  const topEntries = entries.slice(0, 10);
  const topEntry = topEntries[0];
  const weeksAt1 = topEntry?.weeksAt1 && topEntry.position === 1 ? topEntry.weeksAt1 : null;

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  const handleDownload = async () => {
    if (!ref.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(ref.current, {
        width: 1080,
        height: 0,
        pixelRatio: 2,
        backgroundColor: "#1a1a1a",
      });
      const link = document.createElement("a");
      link.download = `daegon-${chartId}-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={generating}
        className="btn-gold text-xs"
      >
        <i className={`fas ${generating ? "fa-spinner fa-spin" : "fa-download"}`} />
        {generating ? "Generating..." : "Download Image"}
      </button>

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={ref}
          style={{
            width: 1080,
            background: "#1a1a1a",
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: theme.accent,
              padding: "44px 56px 36px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#000",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  opacity: 0.5,
                }}
              >
                daegon charts
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#000",
                  textAlign: "right",
                  opacity: 0.6,
                  lineHeight: 1.3,
                }}
              >
                CHART DATED
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#000",
                  textAlign: "right",
                }}
              >
                {dateLabel}
              </div>
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                marginTop: 4,
              }}
            >
              {chartTitle.toUpperCase()}
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              padding: "28px 56px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {/* Weeks at #1 badge - close to the entry */}
            {weeksAt1 && (
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  background: theme.accent,
                  color: "#000",
                  fontSize: 14,
                  fontWeight: 800,
                  padding: "6px 16px",
                  borderRadius: 4,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {weeksAt1} {weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT NO. 1
              </div>
            )}

            {/* Column headers - LAST WEEK on the right */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 0 10px",
                borderBottom: `2px solid ${theme.accent}`,
                marginBottom: 2,
              }}
            >
              <div style={{ width: 70, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
              <div
                style={{
                  width: 120,
                  fontSize: 13,
                  fontWeight: 800,
                  color: theme.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                LAST WEEK
              </div>
            </div>

            {/* Entries */}
            {topEntries.map((entry, i) => {
              const isNumberOne = entry.position === 1;
              return (
                <div
                  key={`${entry.position}-${entry.name}-${entry.artist}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: i < topEntries.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none",
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      width: 70,
                      fontSize: isNumberOne ? 48 : 40,
                      fontWeight: 900,
                      color: isNumberOne ? theme.accent : "#fff",
                      lineHeight: 1,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {entry.position}
                  </div>

                  {/* Song name + Artist on same line */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        fontSize: isNumberOne ? 26 : 22,
                        fontWeight: 900,
                        color: "#fff",
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      {entry.name}
                    </span>
                    <span
                      style={{
                        fontSize: isNumberOne ? 20 : 18,
                        color: "rgba(255,255,255,0.5)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.artist}
                    </span>
                  </div>

                  {/* Last Week */}
                  <div
                    style={{
                      width: 120,
                      fontSize: 20,
                      fontWeight: 800,
                      color: theme.accent,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {lastWeekDisplay(entry)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 56px 24px",
              borderTop: `1px solid rgba(255,255,255,0.06)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              daegoncharts.com
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              {topEntries.length} / {entries.length} ENTRIES SHOWN
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
