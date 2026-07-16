export type ChartKind = "song" | "album" | "artist";

export interface ChartConfig {
  id: string;
  url: string;
  title: string;
  icon: string;
  kind: ChartKind;
  group: "weekly" | "yearEnd" | "goat";
}

const SHEET = "https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/export?format=csv&gid=";

export const chartsConfig: Record<string, ChartConfig> = {
  songs: { id: "songs", url: SHEET + "904867620", title: "Hot 100", icon: "fa-music", kind: "song", group: "weekly" },
  artists: { id: "artists", url: SHEET + "1568177610", title: "Artist 50", icon: "fa-user", kind: "artist", group: "weekly" },
  albums: { id: "albums", url: SHEET + "1940039611", title: "Top 100 Albums", icon: "fa-compact-disc", kind: "album", group: "weekly" },
  radioSongs: { id: "radioSongs", url: SHEET + "1681272096", title: "Radio Songs", icon: "fa-broadcast-tower", kind: "song", group: "weekly" },
  topStreamingAlbums: { id: "topStreamingAlbums", url: SHEET + "1028545573", title: "Top Streaming Albums", icon: "fa-headphones", kind: "album", group: "weekly" },
  topAlbumSales: { id: "topAlbumSales", url: SHEET + "1111633725", title: "Top Album Sales", icon: "fa-chart-simple", kind: "album", group: "weekly" },
  streamingSongs: { id: "streamingSongs", url: SHEET + "626144821", title: "Streaming Songs", icon: "fa-cloud", kind: "song", group: "weekly" },
  digitalSongsSales: { id: "digitalSongsSales", url: SHEET + "302176914", title: "Digital Songs Sales", icon: "fa-download", kind: "song", group: "weekly" },
  yearEndSongs: { id: "yearEndSongs", url: SHEET + "530686468", title: "Year-End Songs", icon: "fa-calendar", kind: "song", group: "yearEnd" },
  yearEndArtists: { id: "yearEndArtists", url: SHEET + "1597569311", title: "Year-End Artists", icon: "fa-calendar", kind: "artist", group: "yearEnd" },
  yearEndAlbums: { id: "yearEndAlbums", url: SHEET + "897935603", title: "Year-End Albums", icon: "fa-calendar", kind: "album", group: "yearEnd" },
  yearEndRadio: { id: "yearEndRadio", url: SHEET + "982271206", title: "Year-End Radio", icon: "fa-broadcast-tower", kind: "song", group: "yearEnd" },
  goatSongs: { id: "goatSongs", url: SHEET + "1157278896", title: "GOAT Songs", icon: "fa-trophy", kind: "song", group: "goat" },
  goatArtists: { id: "goatArtists", url: SHEET + "222299678", title: "GOAT Artists", icon: "fa-trophy", kind: "artist", group: "goat" },
  goatAlbums: { id: "goatAlbums", url: SHEET + "1548244755", title: "GOAT Albums", icon: "fa-trophy", kind: "album", group: "goat" },
  goatRadio: { id: "goatRadio", url: SHEET + "1447340097", title: "GOAT Radio", icon: "fa-broadcast-tower", kind: "song", group: "goat" },
  artistStats: { id: "artistStats", url: SHEET + "1519606558", title: "Artist Statistics", icon: "fa-chart-bar", kind: "artist", group: "weekly" },
  statsData: { id: "statsData", url: SHEET + "193788146", title: "Stats", icon: "fa-chart-line", kind: "artist", group: "weekly" },
};

export const chartBeatConfig = {
  hot100: { url: SHEET + "1019123057", title: "Hot 100 Songs" },
  artists: { url: SHEET + "157219648", title: "Top 50 Artists" },
  top100Albums: { url: SHEET + "677909186", title: "Top 100 Albums" },
} as const;

export const weeklyChartIds = ["songs", "artists", "albums", "radioSongs", "topStreamingAlbums", "topAlbumSales", "streamingSongs", "digitalSongsSales"];
export const yearEndChartIds = ["yearEndSongs", "yearEndArtists", "yearEndAlbums", "yearEndRadio"];
export const goatChartIds = ["goatSongs", "goatArtists", "goatAlbums", "goatRadio"];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const slugifyArtist = slugify;
