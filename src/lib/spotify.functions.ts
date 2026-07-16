import { createServerFn } from "@tanstack/react-start";

const SPOTIFY_CLIENT_ID = "08a6cea61aaa4828b173bf2b40e14134";
const SPOTIFY_CLIENT_SECRET = "24da1ad56cf34cd8b6731a2bda503fdb";

let accessToken: string | null = null;
let tokenExpiresAt = 0;
const imageCache = new Map<string, string | null>();

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) return null;
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;
  return accessToken;
}

function fieldValue(query: string, field: string) {
  return query.match(new RegExp(`${field}:"([^"]+)"`, "i"))?.[1]?.trim() ?? "";
}

function comparable(value: string) {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAlbum(album: any, albumName: string, artistName: string) {
  const expectedAlbum = comparable(albumName);
  const expectedArtist = comparable(artistName);
  const actualAlbum = comparable(album.name ?? "");
  const artists = (album.artists ?? []).map((artist: any) => comparable(artist.name ?? ""));

  if (actualAlbum !== expectedAlbum) return 0;
  if (artists.some((n) => n === expectedArtist)) return 300;
  if (artists.some((n) => n.includes(expectedArtist) || expectedArtist.includes(n))) return 150;
  return 0;
}

function scoreVariant(album: any, albumName: string, artistName: string) {
  const expectedArtist = comparable(artistName);
  const actualName = (album.name ?? "").trim();
  const actualNorm = comparable(actualName);
  const expectedNorm = comparable(albumName);

  // Must start with the album name (normalized)
  if (!actualNorm.startsWith(expectedNorm)) return 0;

  // Must have extra content after the album name
  const suffix = actualNorm.slice(expectedNorm.length).trim();
  if (!suffix) return 0;

  // Extra content must start with ( or [
  if (!/^[\(\[]/.test(suffix)) return 0;

  const artists = (album.artists ?? []).map((artist: any) => comparable(artist.name ?? ""));
  if (artists.some((n) => n === expectedArtist)) return 300;
  if (artists.some((n) => n.includes(expectedArtist) || expectedArtist.includes(n))) return 150;
  return 0;
}

function findBest(albums: any[], albumName: string, artistName: string, variant = false): string | null {
  const scorer = variant ? scoreVariant : scoreAlbum;
  const scored = albums
    .filter((a: any) => a.images?.[0]?.url)
    .map((a: any) => ({ url: a.images[0].url, s: scorer(a, albumName, artistName) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored[0]?.url ?? null;
}

async function spotifySearch(token: string, query: string, type: "album" | "artist" | "track", limit = 10) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

export const getSpotifyImage = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; type: "album" | "artist" }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.type}:${data.query.trim()}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
    const token = await getAccessToken();
    if (!token) return null;

    try {
      let imageUrl: string | null = null;
      if (data.type === "album") {
        const albumName = fieldValue(data.query, "album") || data.query;
        const artistName = fieldValue(data.query, "artist");

        // 1. Exact search
        const q1 = artistName ? `album:"${albumName}" artist:"${artistName}"` : `album:"${albumName}"`;
        const r1 = await spotifySearch(token, q1, "album");
        imageUrl = findBest(r1?.albums?.items ?? [], albumName, artistName);

        // 2. Anything in parentheses/brackets: "Dua Lipa (anything)" or "Dua Lipa [anything]"
        if (!imageUrl) {
          const q2 = artistName
            ? `album:"${albumName}" artist:"${artistName}"`
            : `album:"${albumName}"`;
          const r2 = await spotifySearch(token, q2, "album", 50);
          imageUrl = findBest(r2?.albums?.items ?? [], albumName, artistName, true);
        }

        // 3. Artist image (never leave empty)
        if (!imageUrl && artistName) {
          const ra = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (ra?.artists?.items ?? []).filter((a: any) => a.images?.[0]?.url);
          const exact = artists.find((a: any) => comparable(a.name) === comparable(artistName));
          imageUrl = (exact ?? artists[0])?.images?.[0]?.url ?? null;
        }
        if (!imageUrl) {
          const rb = await spotifySearch(token, artistName || albumName, "artist");
          imageUrl = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url)?.images?.[0]?.url ?? null;
        }
      } else {
        const artistName = fieldValue(data.query, "artist") || data.query;
        const title = fieldValue(data.query, "track") || fieldValue(data.query, "album");
        if (comparable(artistName) === "jao" && !title) {
          const response = await fetch("https://api.spotify.com/v1/artists/59FrDXDVJz0EKqYg39dnT2", { headers: { Authorization: `Bearer ${token}` } });
          if (response.ok) imageUrl = (await response.json()).images?.[0]?.url ?? null;
        }
        if (title) {
          const tracks = (await spotifySearch(token, `track:"${title}" artist:"${artistName}"`, "track"))?.tracks?.items ?? [];
          const track = tracks.find((item: any) => item.artists?.some((artist: any) => comparable(artist.name) === comparable(artistName)));
          const artist = track?.artists?.find((item: any) => comparable(item.name) === comparable(artistName));
          if (artist?.id) {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artist.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (response.ok) imageUrl = (await response.json()).images?.[0]?.url ?? null;
          }
        }
        if (!imageUrl) {
          const result = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (result?.artists?.items ?? [])
            .filter((artist: any) => artist.images?.[0]?.url)
            .sort((a: any, b: any) => {
              const nameMatch = Number(comparable(b.name) === comparable(artistName)) - Number(comparable(a.name) === comparable(artistName));
              if (nameMatch !== 0) return nameMatch;
              return (b.popularity ?? 0) - (a.popularity ?? 0);
            });
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
        }
        // Ultra-fallback: search without quotes
        if (!imageUrl) {
          const rb = await spotifySearch(token, artistName, "artist");
          const fallback = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url);
          imageUrl = fallback?.images?.[0]?.url ?? null;
        }
      }
      imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("Spotify image search failed", error);
      return null;
    }
  });

const profileCache = new Map<string, { imageUrl: string | null; followers: number; genres: string[] } | null>();

export const getSpotifyArtistProfile = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    if (profileCache.has(data.artistName)) return profileCache.get(data.artistName);
    const token = await getAccessToken();
    if (!token) return null;
    try {
      const artist = comparable(data.artistName) === "jao"
        ? await fetch("https://api.spotify.com/v1/artists/59FrDXDVJz0EKqYg39dnT2", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null)
        : (await spotifySearch(token, `artist:"${data.artistName}"`, "artist"))?.artists?.items?.sort((a: any, b: any) => Number(comparable(b.name) === comparable(data.artistName)) - Number(comparable(a.name) === comparable(data.artistName)))[0];
      if (!artist) return null;
      const profile = { imageUrl: artist.images?.[0]?.url ?? null, followers: artist.followers?.total ?? 0, genres: artist.genres ?? [] };
      profileCache.set(data.artistName, profile);
      return profile;
    } catch {
      return null;
    }
  });
