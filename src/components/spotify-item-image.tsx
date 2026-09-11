import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { useNearViewport } from "@/hooks/use-near-viewport";

interface SpotifyItemImageProps {
  name: string;
  artist: string;
  kind: "song" | "album" | "artist";
  size?: number;
  className?: string;
  rounded?: "lg" | "full";
}

let active = 0;
const waiting: (() => void)[] = [];
async function loadArtwork(query: string, type: "album" | "artist" | "track") {
  await new Promise<void>((resolve) => {
    const start = () => { active++; resolve(); };
    if (active < 4) start(); else waiting.push(start);
  });
  try {
    return await getSpotifyImage({ data: { query, type } });
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function SpotifyItemImage({ name, artist, kind, size = 40, className = "", rounded = "lg" }: SpotifyItemImageProps) {
  const { ref, visible } = useNearViewport<HTMLSpanElement>();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const type = kind === "song" ? "track" : kind;
  const query = kind === "artist" ? `artist:"${name}"` : kind === "album" ? `album:"${name}" artist:"${artist}"` : `artist:"${artist}" track:"${name}"`;
  const { data: url } = useQuery({
    queryKey: ["artwork", query, type],
    queryFn: () => loadArtwork(query, type),
    enabled: visible,
    staleTime: 30 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return (
    <span ref={ref} style={{ width: size, height: size, borderRadius: rounded === "full" ? "50%" : undefined }} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[var(--muted)] ${className}`}>
      <i aria-hidden="true" className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} text-xs opacity-30`} />
      {url && url !== failedUrl && <img src={url} alt={name} loading="lazy" decoding="async" width={size} height={size} onError={() => setFailedUrl(url)} className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}
