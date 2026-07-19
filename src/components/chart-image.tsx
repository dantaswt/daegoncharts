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

function ordinal(n: number): string {
  if (n <= 0) return String(n);
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDiff(entry: ChartEntry): string {
  if (entry.diff === "NEW") return "NEW";
  if (entry.diff === "RE") return "RE";
  if (entry.diff === "=" || entry.diff === "") return "—";
  const num = parseInt(entry.diff.replace(/[▲▼]/g, ""), 10);
  if (isNaN(num)) return "—";
  return entry.diff.includes("▲") ? `+${num}` : `-${num}`;
}

function lastWeekNumber(entry: ChartEntry): string {
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
        height: 1350,
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
            height: 1350,
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
              padding: "48px 60px 40px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#000",
                    letterSpacing: "-0.02em",
                    textTransform: "uppercase",
                    opacity: 0.6,
                  }}
                >
                  daegon charts
                </div>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#000",
                  textAlign: "right",
                  opacity: 0.7,
                }}
              >
                CHART DATED<br />
                <span style={{ fontSize: 22, opacity: 1 }}>{dateLabel}</span>
              </div>
            </div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                marginTop: 8,
              }}
            >
              {chartTitle.toUpperCase()}
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: "32px 60px 40px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {/* Weeks at #1 badge */}
            {weeksAt1 && (
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  background: theme.accent,
                  color: "#000",
                  fontSize: 16,
                  fontWeight: 800,
                  padding: "8px 20px",
                  borderRadius: 6,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 24,
                }}
              >
                {weeksAt1} {weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT NO. 1
              </div>
            )}

            {/* Column headers */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 0 12px",
                borderBottom: `2px solid ${theme.accent}`,
                marginBottom: 4,
              }}
            >
              <div style={{ width: 60, fontSize: 14, fontWeight: 800, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
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
                    padding: "16px 0",
                    borderBottom: i < topEntries.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none",
                    gap: 20,
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      width: 60,
                      fontSize: isNumberOne ? 52 : 44,
                      fontWeight: 900,
                      color: isNumberOne ? theme.accent : "#fff",
                      lineHeight: 1,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {entry.position}
                  </div>

                  {/* Song/Artist info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: isNumberOne ? 30 : 26,
                        fontWeight: 900,
                        color: "#fff",
                        textTransform: "uppercase",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.name}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        color: "rgba(255,255,255,0.55)",
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.artist}
                    </div>
                  </div>

                  {/* Last Week */}
                  <div
                    style={{
                      width: 80,
                      fontSize: 22,
                      fontWeight: 800,
                      color: theme.accent,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {lastWeekNumber(entry)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "20px 60px",
              borderTop: `1px solid rgba(255,255,255,0.06)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
              daegoncharts.com
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
              {topEntries.length} / {entries.length} ENTRIES SHOWN
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
