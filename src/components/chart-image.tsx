import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { ChartEntry } from "@/lib/charts.functions";
import { stripFeatFromTitle, getFeatArtistsFromTitle } from "@/components/track-artists";
import { stripAlbumEdition } from "@/lib/charts-config";

const COLOR_THEMES: Record<string, { accent: string; accentDark: string }> = {
  songs:          { accent: "#FF1744", accentDark: "#D50000" },
  streamingSongs: { accent: "#AA00FF", accentDark: "#7C4DFF" },
  radioSongs:     { accent: "#00BFA5", accentDark: "#00897B" },
  digitalSongsSales: { accent: "#2979FF", accentDark: "#1565C0" },
  albums:         { accent: "#00E676", accentDark: "#00C853" },
  topStreamingAlbums: { accent: "#7C4DFF", accentDark: "#651FFF" },
  topAlbumSales:  { accent: "#FF9100", accentDark: "#FF6D00" },
  artists:        { accent: "#FFD600", accentDark: "#FFC400" },
  goatSongs:      { accent: "#FFD700", accentDark: "#FFC107" },
  goatArtists:    { accent: "#FFD700", accentDark: "#FFC107" },
  goatAlbums:     { accent: "#FFD700", accentDark: "#FFC107" },
  goatRadio:      { accent: "#FFD700", accentDark: "#FFC107" },
  yearEndSongs:   { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndArtists: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndAlbums:  { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndRadio:   { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndStreamingSongs: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndTopStreamingAlbums: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndTopAlbumSales: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndDigitalSongsSales: { accent: "#FF6D00", accentDark: "#E65100" },
  yearEndNewArtists: { accent: "#FF6D00", accentDark: "#E65100" },
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
  hideWeeksAt1?: boolean;
  hideLastWeek?: boolean;
  displayTitle?: string;
}

export function ChartImage({ entries, chartTitle, chartId, date, kind, hideWeeksAt1 = false, hideLastWeek = false, displayTitle }: ChartImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const theme = COLOR_THEMES[chartId] ?? COLOR_THEMES.songs;
  const topEntries = entries.slice(0, 10);
  const topEntry = topEntries[0];
  const weeksAt1 = hideWeeksAt1 ? null : (topEntry?.weeksAt1 && topEntry.position === 1 ? topEntry.weeksAt1 : null);
  const isArtist = kind === "artist";
  const titleText = displayTitle ?? chartTitle.toUpperCase();

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
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const file = new File([blob], `daegon-${chartId}-${date}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `daegon ${chartId}` });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `daegon-${chartId}-${date}.png`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);
      }
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
        className="btn-gold text-xs whitespace-nowrap"
      >
        <i className={`fas ${generating ? "fa-spinner fa-spin" : "fa-download"}`} />
        {generating ? "Generating..." : "Download Image"}
      </button>

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={ref}
          style={{
            width: 1080,
            background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0d0d0d 100%)",
            backgroundImage: `
              linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0d0d0d 100%),
              radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 40%),
              radial-gradient(ellipse at 60% 80%, rgba(255,255,255,0.02) 0%, transparent 50%)
            `,
            fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Metallic shimmer overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `
                linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.02) 25%, transparent 50%, rgba(255,255,255,0.03) 75%, transparent 100%)
              `,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Header */}
          <div
            style={{
              background: theme.accent,
              padding: "50px 60px 42px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: "#000",
                  letterSpacing: "-0.02em",
                  textTransform: "lowercase",
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
              {titleText}
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              padding: "32px 60px 36px",
              display: "flex",
              flexDirection: "column",
              gap: 0,
              position: "relative",
              zIndex: 1,
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
              <div style={{ width: 70, flexShrink: 0 }} />
               <div style={{ flex: 1 }} />
              </div>

            {/* Entries */}
            {topEntries.map((entry, i) => {
              const isNumberOne = entry.position === 1;
              return (
                <div key={`${entry.position}-${entry.name}-${entry.artist}`}>
                  {/* Weeks at #1 badge + Last Week header - same line (only at #1 entry) */}
                  {isNumberOne && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      {weeksAt1 ? (
                        <div
                          style={{
                            background: theme.accent,
                            color: "#000",
                            fontSize: 15,
                            fontWeight: 800,
                            padding: "6px 18px",
                            borderRadius: 4,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            width: "fit-content",
                            marginLeft: 70,
                          }}
                        >
                          {weeksAt1} {weeksAt1 === 1 ? "WEEK" : "WEEKS"} AT NO. 1
                        </div>
                      ) : <div style={{ marginLeft: 70 }} />}
                      <div style={{ flex: 1 }} />
                      {!hideLastWeek && (
                        <div
                          style={{
                            width: 70,
                            fontSize: 13,
                            fontWeight: 800,
                            color: theme.accent,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            textAlign: "center",
                            flexShrink: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          LAST<br />WEEK
                        </div>
                      )}
                    </div>
                  )}

                  {/* Entry row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: isNumberOne ? "20px 0" : "14px 0",
                      borderBottom: `1px solid ${theme.accent}`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Background number for #1 */}
                    {isNumberOne && (
                      <div
                        style={{
                          position: "absolute",
                          left: -10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 160,
                          fontWeight: 900,
                          color: theme.accent,
                          opacity: 0.12,
                          lineHeight: 1,
                          pointerEvents: "none",
                          zIndex: 0,
                        }}
                      >
                        1
                      </div>
                    )}

                    {/* Rank */}
                    <div
                      style={{
                        width: isNumberOne ? 90 : 70,
                        fontSize: isNumberOne ? 64 : 44,
                        fontWeight: 900,
                        color: isNumberOne ? theme.accent : "#fff",
                        lineHeight: 1,
                        textAlign: "center",
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {entry.position}
                    </div>

                    {/* Name - left side */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: isNumberOne ? 34 : 26,
                          fontWeight: 900,
                          color: "#fff",
                          textTransform: "uppercase",
                          letterSpacing: "-0.01em",
                          lineHeight: 1.2,
                          textAlign: "left",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {isArtist ? entry.name : kind === "album" ? stripAlbumEdition(stripFeatFromTitle(entry.name)) : stripFeatFromTitle(entry.name)}
                      </div>
                    </div>

                    {/* Artist name + feat credit (only for songs/albums) */}
                    {!isArtist && (() => {
                      const featInfo = getFeatArtistsFromTitle(entry.name);
                      return (
                        <div
                          style={{
                            flexShrink: 0,
                            textAlign: "right",
                            marginLeft: 16,
                            marginRight: 24,
                            maxWidth: 340,
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize: isNumberOne ? 28 : 26,
                              color: "rgba(255,255,255,0.45)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {entry.artist}
                          </div>
                          {featInfo && (
                            <div
                              style={{
                                fontSize: isNumberOne ? 28 : 26,
                                color: "rgba(255,255,255,0.45)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {featInfo.prefix === "&" ? "&" : "feat."}{" "}
                              {featInfo.artists}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Spacer for artist chart (to push LAST WEEK to right) */}
                    {isArtist && <div style={{ flex: 1 }} />}

                    {/* Last Week */}
                    {!hideLastWeek && (
                      <div
                        style={{
                          width: 70,
                          fontSize: isNumberOne ? 26 : 22,
                          fontWeight: 800,
                          color: theme.accent,
                          textAlign: "center",
                          flexShrink: 0,
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {lastWeekDisplay(entry)}
                      </div>
                    )}
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
              position: "relative",
              zIndex: 1,
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
