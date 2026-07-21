import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getSpotifyTrackArtists } from "@/lib/spotify.functions";

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

  return (
    <span className={className}>
      {featArtists.map((fa, i) => (
        <span key={fa.slug}>
          {i === 0 ? " feat. " : ", "}
          <Link to="/artist/$slug" params={{ slug: fa.slug }} className="hover:text-[var(--accent)] hover:underline font-medium">
            {fa.name}
          </Link>
        </span>
      ))}
    </span>
  );
}
