import { useQuery } from "@tanstack/react-query";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { Link } from "@tanstack/react-router";
import { getSpotifyTrackArtists } from "@/lib/spotify.functions";
import { getAllArtistList } from "@/lib/charts.functions";



export function stripFeatFromTitle(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === "u + me = <3") return name;
  return name
    .replace(/\s*[\(\[]feat\.\s+[^)\]]+[\)\]]/gi, "")
    .replace(/\s*[\(\[]ft\.\s+[^)\]]+[\)\]]/gi, "")
    .replace(/\s*[\(\[]featuring\s+[^)\]]+[\)\]]/gi, "")
    .replace(/\s*[\(\[]with\s+[^)\]]+[\)\]]/gi, "")
    .replace(/\s*[\(\[]duet\s+with\s+[^)\]]+[\)\]]/gi, "")
    .replace(/\s+\+\s+.*$/, "")
    .trim();
}

export function getFeatArtistsFromTitle(name: string): { artists: string; prefix: string } | null {
  if (name.toLowerCase().trim() === "u + me = <3") return null;

  let match = name.match(/\(?feat\.\s+([^)]+)\)?/i)
    || name.match(/\(?ft\.\s+([^)]+)\)?/i)
    || name.match(/\(?featuring\s+([^)]+)\)?/i);
  if (match) return { artists: match[1].trim(), prefix: "feat." };

  match = name.match(/\(?with\s+([^)]+)\)?/i);
  if (match) return { artists: match[1].trim(), prefix: "&" };

  match = name.match(/\+\s+(.+)$/);
  if (match) return { artists: match[1].trim(), prefix: "&" };

  return null;
}

function isBandName(name: string, knownArtists: { slug: string }[]): boolean {
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return knownArtists.some((a) => a.slug === slug);
}

interface TrackArtistsProps {
  song: string;
  artist: string;
  className?: string;
}

export function TrackArtists({ song, artist, className = "" }: TrackArtistsProps) {
  const { ref, visible } = useNearViewport<HTMLSpanElement>();
  return <span ref={ref}>{visible && <TrackArtistNames song={song} artist={artist} className={className} />}</span>;
}

function TrackArtistNames({ song, artist, className = "" }: TrackArtistsProps) {
  const { data: artists } = useQuery({
    queryKey: ["track-artists", song, artist],
    queryFn: () => getSpotifyTrackArtists({ data: { song, artist } }),
    staleTime: 30 * 60_000, retry: false, refetchOnWindowFocus: false,
  });
  const { data: knownArtists = [] } = useQuery({
    queryKey: ["artist-list"], queryFn: () => getAllArtistList(),
    enabled: artist.includes("&"), staleTime: 30 * 60_000, retry: false,
    refetchOnWindowFocus: false,
  });

  if (!artists || artists.length <= 1) return null;

  const mainSlug = artist.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // If main artist contains & and full name is a known band, don't split
  let isBand = false;
  if (artist.includes("&") && knownArtists.length > 0) {
    isBand = isBandName(artist, knownArtists);
  }

  let featArtists = artists.filter((a) => a.slug !== mainSlug);

  // If it's a band name, also check if any "feat" artist is actually part of the band
  if (isBand && featArtists.length > 0) {
    const bandParts = artist.split(/\s*&\s*/).map(s => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    featArtists = featArtists.filter((a) => !bandParts.includes(a.slug));
  }

  if (featArtists.length === 0) return null;

  const prefix = getFeatArtistsFromTitle(song)?.prefix ?? "feat.";

  return (
    <span className={className}>
      {prefix === "&" ? " & " : " feat. "}
      {featArtists.map((fa, i) => (
        <span key={fa.slug}>
          {i > 0 && ", "}
          <Link to="/artist/$slug" params={{ slug: fa.slug }} className="hover:text-[var(--accent)] hover:underline font-medium">
            {fa.name}
          </Link>
        </span>
      ))}
    </span>
  );
}
