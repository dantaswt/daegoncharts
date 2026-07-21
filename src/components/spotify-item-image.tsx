import { useEffect, useState } from "react";
import { getSpotifyImage } from "@/lib/spotify.functions";

interface SpotifyItemImageProps {
  name: string;
  artist: string;
  kind: "song" | "album" | "artist";
  size?: number;
  className?: string;
}

export function SpotifyItemImage({ name, artist, kind, size = 40, className = "" }: SpotifyItemImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let query: string;
    let type: "album" | "artist";
    if (kind === "artist") {
      query = `artist:"${name}"`;
      type = "artist";
    } else {
      query = `artist:"${artist}" track:"${name}"`;
      type = "artist";
    }
    getSpotifyImage({ data: { query, type } }).then((u) => {
      if (active && u) setUrl(u);
    });
    return () => { active = false; };
  }, [name, artist, kind]);

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={`object-cover rounded-lg shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-lg shrink-0 bg-[var(--muted)] flex items-center justify-center ${className}`}
    >
      <i className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} text-xs opacity-50`} />
    </div>
  );
}
