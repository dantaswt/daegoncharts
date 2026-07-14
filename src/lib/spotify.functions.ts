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
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isDeluxeEdition(value: string) {
  return /\b(deluxe|expanded|anniversary|anniversario|edition|edicao|version|versao|bonus)\b/i.test(value);
}

function scoreAlbum(album: any, albumName: string, artistName: string) {
  const expectedAlbum = comparable(albumName);
  const expectedArtist = comparable(artistName);
  const actualAlbum = comparable(album.name ?? "");
  const artists = (album.artists ?? []).map((artist: any) => comparable(artist.name ?? ""));
  let score = actualAlbum === expectedAlbum ? 100 : actualAlbum.includes(expectedAlbum) || expectedAlbum.includes(actualAlbum) ? 25 : 0;
  score += artists.some((name: string) => name === expectedArtist) ? 80 : artists.some((name: string) => name.includes(expectedArtist) || expectedArtist.includes(name)) ? 20 : 0;
  if (!isDeluxeEdition(albumName) && isDeluxeEdition(album.name ?? "")) score -= 60;
  if (album.album_type === "album") score += 5;
  return score;
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
        const query = artistName ? `album:"${albumName}" artist:"${artistName}"` : `album:"${albumName}"`;
        const result = await spotifySearch(token, query, "album");
        const albums = (result?.albums?.items ?? [])
          .filter((album: any) => album.images?.[0]?.url)
          .sort((a: any, b: any) => scoreAlbum(b, albumName, artistName) - scoreAlbum(a, albumName, artistName));
        imageUrl = albums[0]?.images?.[0]?.url ?? null;
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
            .sort((a: any, b: any) => Number(comparable(b.name) === comparable(artistName)) - Number(comparable(a.name) === comparable(artistName)));
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
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
