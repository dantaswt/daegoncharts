import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getSpotifyTrackArtists } from "@/lib/spotify.functions";

export function stripFeatFromTitle(name: string): string {
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

interface TrackArtistsProps {
  song: string;
  artist: string;
  className?: string;
}

export function TrackArtists({ song, artist, className = "" }: TrackArtistsProps) {
  const [artists, setArtists] = useState<{ name: string; slug: string }[] | null>(null);

  useEffect(() => {
    let active = true;
    getSpotifyTrackArtists({ data: { song, artist } }).then((result) => {
      if (active) setArtists(result);
    });
    return () => { active = false; };
  }, [song, artist]);

  if (!artists || artists.length <= 1) return null;

  const mainSlug = artist.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const featArtists = artists.filter((a) => a.slug !== mainSlug);

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
