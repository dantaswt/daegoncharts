# Daegon Charts Codebase Exploration

## Executive Summary
This document provides a detailed overview of the current data fields, components, and mobile layouts used in the daegon charts application.

---

## 1. Hot 100 Details Page/Component

**Route:** `/chart/$chartId/$date` ([chart.$chartId.$date.tsx](src/routes/chart.$chartId.$date.tsx))

### Current Data Fields Displayed

**Main Entry Fields (displayed in ChartRow):**
- **Position** - Chart rank (e.g., #1, #2)
- **Diff** - Movement indicator (▲ up, ▼ down, = steady, NEW, RE)
- **Name** - Song/Album/Artist name
- **Artist** - Artist name (with link to artist page)
- **Album** - Album name (hidden on mobile, shown on desktop for songs)
- **Metric** - Points (songs) or Units (albums/artists)

**Detail Fields (expandable section with + button):**
- **Points** - For songs (when available)
- **Units** - For songs on Hot 100 chart
- Units field shown for albums/artists EXCEPT: topStreamingAlbums, topAlbumSales, streamingSongs, digitalSongsSales
- **Audience** - Radio metrics
- **Airplay** - Radio airplay data
- **Sales/Pure Sales** - (Pure Sales for albums, Sales otherwise)
- **SEA (Streaming)** - For albums and topStreamingAlbums; Streams for streamingSongs
- **Total Streams** - Total streaming count
- **Total Sales** - Total sales count
- **Total Units** - Total units (when separate from totalStreams/totalSales)
- **Certification** - Certification status
- **Chart Run History** - Historic entries with date, position, peak, weeks, points, totalUnits

---

## 2. Top 100 Albums Component

**Route:** Landing page (`index.tsx`) - displayed as `top100Albums` in Chart Beat section
**Sheet Config:** URL GID `677909186`

### SEA (Streaming) Data Display

**Current Status:** ✅ SEA data IS being displayed

**Where it appears:**
1. **In ChartRow detail fields** - When `chartId === "albums"` or `chartId === "topStreamingAlbums"`:
   ```tsx
   if (chartId === "albums" || chartId === "topStreamingAlbums") label = "SEA";
   ```
   This displays the `entry.streams` field as "SEA"

2. **Data parsing from spreadsheet** - The `streams` column is searched with keywords including "sea":
   ```tsx
   streams: findIdx(header, ["streams", "sea"]),
   ```

3. **Album details page** - When viewing individual album ([album.$slug.tsx](src/routes/album.$slug.tsx)):
   - Displays: Peak, Weeks, Peak Position in chart runs
   - Album chart runs from multiple albums charts are aggregated

**Conditional display rules:**
- Only shown when expandable details are opened (+ button)
- Not displayed for GOAT charts
- Available when the spreadsheet contains "streams" or "sea" column header

---

## 3. Chart-row Mobile Display (LW, PEAK, WEEKS)

**Component:** [src/components/chart-row.tsx](src/components/chart-row.tsx)

### Current Mobile Layout

**Desktop Layout (md: breakpoint and up):**
```
[Position] [Image] [Name + Artist + Album] [LW: Peak: Weeks: @#1] [Metric] [Buttons]
```
- **Visible MD+ fields:**
  - LW (Last Week) - Only if lastWeek is defined and not empty
  - Peak - Only if peak > 0
  - Weeks - Only if weeks > 0
  - Weeks at #1 badge - If weeksAt1 > 0 (shown in blue pill)
- **Layout:** Flexbox row with `gap-x-3 gap-y-1` for wrapping
- **Typography:** `text-[10px] md:text-[11px]`
- **Lines 188-200:**
```tsx
<div className="hidden md:flex mt-1 md:mt-2 text-[10px] md:text-[11px] text-muted-foreground flex-wrap gap-x-3 gap-y-1">
  {entry.lastWeek !== undefined && entry.lastWeek !== "" && <div>LW: <span className="font-semibold">{entry.lastWeek === "0" ? "-" : entry.lastWeek}</span></div>}
  {entry.peak > 0 && <div>Peak: <span className="font-semibold">#{entry.peak}</span></div>}
  {entry.weeks > 0 && <div>Weeks: <span className="font-semibold">{entry.weeks}</span></div>}
  {(entry.weeksAt1 ?? 0) > 0 && (
    <div className="inline-flex items-center rounded-full bg-blue-500/10 px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold text-blue-500">
      {entry.weeksAt1} {entry.weeksAt1 === 1 ? "Wk" : "Wks"} at 1
    </div>
  )}
</div>
```

**Mobile Layout (below md breakpoint):**
```
Shown in a compact horizontal layout below the name/artist
```
- **Visible fields:** LW, Peak, Weeks only (no weeks at #1 badge)
- **Hidden elements:** Album name, weeks at #1 badge
- **Typography:** `text-[9px]` (smaller than desktop)
- **Gap:** `gap-x-3 gap-y-1`
- **Lines 201-206:**
```tsx
<div className="flex md:hidden mt-1 text-[9px] text-muted-foreground gap-x-3 gap-y-1">
  {entry.lastWeek !== undefined && entry.lastWeek !== "" && <span>LW: <span className="font-semibold">{entry.lastWeek === "0" ? "-" : entry.lastWeek}</span></span>}
  {entry.peak > 0 && <span>Peak: <span className="font-semibold">#{entry.peak}</span></span>}
  {entry.weeks > 0 && <span>Weeks: <span className="font-semibold">{entry.weeks}</span></span>}
</div>
```

### Key Mobile Behavior:
- **Smaller text:** 9px vs 11px on desktop
- **Reduced elements:** No album name, no weeks at #1 badge
- **Compact spacing:** `gap-x-3` instead of wrapping grid
- **Space-efficient:** Position stays visible, metric stays on right side

---

## 4. Charts Functions - Data Columns Parsing

**File:** [src/lib/charts.functions.ts](src/lib/charts.functions.ts)

### Column Indexes Parsed from Spreadsheet Headers (Lines 145-172)

```typescript
const idx = {
  date: findIdx(header, ["date", "chart date"]),
  position: findIdx(header, ["position", "rank", "pos"]),
  diff: findIdx(header, ["dif", "diff", "▲▼"]),
  song: findIdx(header, ["song", "title", "track"]),
  album: findIdx(header, ["album"]),
  artist: findIdx(header, ["artist", "artists"]),
  lastWeek: findIdx(header, ["last week", "lw"]),
  peak: findIdx(header, ["peak"]),
  weeks: findIdx(header, ["weeks", "wks"]),
  weeksAt1: findIdx(header, ["weeks at 1", "wks at 1", "week at #1", "week at 1", "weeks at #1"]),
  points: findIdx(header, ["points"]),
  sales: findIdx(header, ["sales", "sales/streams", "sales/streaming", "pure sales"]),
  streams: findIdx(header, ["streams", "sea"]),
  airplay: findIdx(header, ["airplay"]),
  audience: findIdx(header, ["audience"]),
  certification: findIdx(header, ["certification"]),
  units: findIdx(header, ["units", "spins", "sales", "streams", "audience"]),
  totalUnits: findIdx(header, ["total units", "total"]),
  totalStreams: findIdx(header, ["total streams"]),
  totalSales: findIdx(header, ["total sales"]),
};
```

### Special Handling:
- **Radio Songs (radioSongs):** The `units` column is overridden to use "audience" instead (line 172-174)
- **Sales vs Pure Sales:** Detected from column names "sales/streams", "sales/streaming", "pure sales"
- **Streams/SEA:** Both keywords detected in same index

### ChartEntry Interface (Lines 5-24):
```typescript
export interface ChartEntry {
  position: number;
  diff: string; // '▲n' '▼n' '=' 'NEW' 'RE' ''
  name: string; // song / album / artist name
  artist: string;
  album?: string;
  peak: number;
  weeks: number;
  weeksAt1?: number;
  lastWeek?: string;
  points?: string;
  sales?: string;
  streams?: string;
  airplay?: string;
  audience?: string;
  certification?: string;
  units?: string;
  totalUnits?: string;
  totalStreams?: string;
  totalSales?: string;
}
```

### Data Processing Pipeline:
1. **Fetch CSV** from Google Sheets
2. **Parse header row** (case-insensitive, trimmed)
3. **Find column indexes** using flexible keyword matching
4. **Extract rows** and populate ChartEntry objects
5. **Group by date** into `entriesByDate` map
6. **Calculate diffs** (up/down/steady movements)
7. **Cache result** (5-minute TTL)

---

## Files Requiring Modification

### If Adding New Data Fields:
1. **[src/lib/charts.functions.ts](src/lib/charts.functions.ts)** - Add to `idx` object (lines 145-172)
2. **[src/components/chart-row.tsx](src/components/chart-row.tsx)** - Add to `detailFields` useMemo (lines 72-111)
3. **Update ChartEntry interface** if adding new property

### If Modifying Mobile Layout:
1. **[src/components/chart-row.tsx](src/components/chart-row.tsx)** - Modify mobile view sections:
   - Lines 201-206 for mobile stat display
   - Grid layout (line 160): `grid-cols-[auto_auto_minmax(0,1fr)_auto]`

### If Updating Album Streaming/Album Pages:
1. **[src/routes/album.$slug.tsx](src/routes/album.$slug.tsx)** - Album details display
2. **[src/lib/charts.functions.ts](src/lib/charts.functions.ts)** - `loadAlbumDetails()` function (lines 290+)

---

## Summary Table

| Component | Current Fields | Mobile Display | SEA Support |
|-----------|-----------------|-----------------|------------|
| **Hot 100 Chart** | Position, Diff, Name, Artist, Album (detail), Points, Units, Audience, Airplay, Sales, SEA, Total Streams, Total Sales, Certification | LW, Peak, Weeks (9px text) | ✅ Yes (streams) |
| **Album Chart** | All above + Chart runs history | Same as Hot 100 | ✅ Yes (SEA label) |
| **Artist Chart** | Same as above | Same as Hot 100 | ✅ Yes (streams) |
| **Detail Drawer** | All data fields + Chart run history | Expandable section | ✅ Yes |

---

## Notes

- **Hot 100 = Hot 100 Songs chart** - The songs chart is the primary "Hot 100"
- **SEA** = Streaming Equivalent Albums (only for album charts)
- **Mobile field reduction** is intentional for space efficiency
- All dates are in ISO format (YYYY-MM-DD)
- Archive functionality shows historical chart runs for each entry
