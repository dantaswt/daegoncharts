import { useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import type { ChartEntry } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";

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

function ArtistImage({ name, size }: { name: string; size: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query: `artist:"${name}"`, type: "artist" } }).then((u) => {
      if (active && u) setUrl(u);
    });
    return () => { active = false; };
  }, [name]);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "linear-gradient(135deg, #333 0%, #1a1a1a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {url ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <i className="fas fa-user" style={{ fontSize: size * 0.4, color: "#666" }} />
      )}
    </div>
  );
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
  const isArtist = kind === "artist";

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
              padding: "50px 60px 42px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#000",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  opacity: 0.5,
                }}
              >
                daegon charts
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#000",
                    opacity: 0.6,
                    lineHeight: 1.3,
                  }}
                >
                  CHART DATED
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#000",
                  }}
                >
                  {dateLabel}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 100,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
                marginTop: 6,
              }}
            >
              {chartTitle.toUpperCase()}
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              padding: "32px 60px 36px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
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
              <div style={{ width: isArtist ? 80 : 70, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: theme.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  textAlign: "right",
                  flexShrink: 0,
                  marginRight: 24,
                }}
              >
                LAST WEEK
              </div>
            </div>

            {/* Entries */}
            {topEntries.map((entry, i) => {
              const isNumberOne = entry.position === 1;
              return (
                <div key={`${entry.position}-${entry.name}-${entry.artist}`}>
                  {/* Weeks at #1 badge - directly above the #1 entry */}
                  {isNumberOne && weeksAt1 && (
                    <div
                      style={{
                        display: "inline-flex",
                        background: theme.accent,
                        color: "#000",
                        fontSize: 15,
                        fontWeight: 800,
                        padding: "6px 18px",
                        borderRadius: 4,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      {weeksAt1} {weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT NO. 1
                    </div>
                  )}

                  {/* Entry row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: isArtist ? "10px 0" : "14px 0",
                      borderBottom: i < topEntries.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none",
                      gap: isArtist ? 16 : 0,
                    }}
                  >
                    {/* Rank */}
                    <div
                      style={{
                        width: isArtist ? 80 : 70,
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

                    {/* Artist image (only for artist chart) */}
                    {isArtist && (
                      <ArtistImage name={entry.name} size={56} />
                    )}

                    {/* Song/Artist name - left side */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
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
                    </div>

                    {/* Artist name (only for songs/albums) */}
                    {!isArtist && (
                      <div
                        style={{
                          flexShrink: 0,
                          textAlign: "right",
                          marginLeft: 16,
                          marginRight: 24,
                          maxWidth: 340,
                        }}
                      >
                        <div
                          style={{
                            fontSize: isNumberOne ? 22 : 20,
                            color: "rgba(255,255,255,0.45)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.artist}
                        </div>
                      </div>
                    )}

                    {/* Spacer for artist chart (to push LAST WEEK to right) */}
                    {isArtist && <div style={{ flex: 1 }} />}

                    {/* Last Week */}
                    <div
                      style={{
                        width: 70,
                        fontSize: 22,
                        fontWeight: 800,
                        color: theme.accent,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {lastWeekDisplay(entry)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "18px 60px 28px",
              borderTop: `1px solid rgba(255,255,255,0.06)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              daegoncharts.com
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              {topEntries.length} / {entries.length} ENTRIES SHOWN
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
