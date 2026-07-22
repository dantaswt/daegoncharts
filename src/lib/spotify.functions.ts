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

function exactMatch(actual: string, expected: string): boolean {
  return comparable(actual) === comparable(expected);
}

function extractYear(name: string): { year: string | null; stripped: string } {
  const match = name.match(/\b(19|20)\d{2}\b/);
  return { year: match ? match[0] : null, stripped: match ? name.replace(match[0], "").trim() : name };
}

function albumVariants(name: string): string[] {
  const { year, stripped } = extractYear(name);
  const variants = [name];
  if (year && stripped.trim()) variants.push(stripped.trim());
  return variants;
}

function artistMatch(album: any, expectedArtist: string): boolean {
  if (!expectedArtist) return true;
  const artists = (album.artists ?? []).map((a: any) => comparable(a.name ?? ""));
  const expected = comparable(expectedArtist);
  return artists.some((n: string) => n === expected);
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function spotifySearch(token: string, query: string, type: "album" | "artist" | "track" | "playlist", limit = 10) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  try {
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function searchDeviantArt(albumName: string, artistName: string): Promise<string | null> {
  try {
    const q = `${albumName} ${artistName} fan art album cover`;
    const url = `https://backend.deviantart.com/rss.xml?q=${encodeURIComponent(q)}&type=deviation`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const text = await response.text();
    const matches = [...text.matchAll(/<media:thumbnail[^>]*url="([^"]+)"/g)];
    return matches[0]?.[1] ?? null;
  } catch {
    return null;
  }
}

export const getSpotifyImage = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; type: "album" | "artist" | "track" }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.type}:${data.query.trim()}`;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
    const token = await getAccessToken();

    try {
      let imageUrl: string | null = null;

      if (data.type === "album") {
        const albumName = fieldValue(data.query, "album") || data.query;
        const artistName = fieldValue(data.query, "artist");

        const isAnitta = comparable(artistName ?? "") === "anitta";
        const searchArtist = isAnitta ? `${artistName} cantora` : artistName;

        // 1. Spotify album/EP (exact)
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `album:"${variant}" artist:"${searchArtist}"` : `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 10);
            for (const a of r?.albums?.items ?? []) {
              const isAlbumOrEp = a.album_type === "album" || a.album_type === "ep";
              if (!isAlbumOrEp) continue;
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (!artistMatch(a, artistName)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 2. Wikipedia
        if (!imageUrl) {
          const yearMatch = albumName.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? yearMatch[0] : null;
          const titles = artistName
            ? [
                `${albumName} (${artistName} album)`,
                `${albumName} (${artistName} ${year} album)`,
                year ? `${albumName.replace(year, "").trim()} (${artistName} ${year} album)` : null,
                `${albumName} (${artistName} álbüm)`,
                `${albumName} (álbum)`,
                `${albumName} (${year} album)`,
                year ? `${albumName.replace(year, "").trim()} (${year} album)` : null,
                `${albumName} album`,
                `${albumName}`,
              ].filter(Boolean) as string[]
            : [
                `${albumName} (album)`,
                year ? `${albumName} (${year} album)` : null,
                year ? `${albumName.replace(year, "").trim()} (${year} album)` : null,
                `${albumName} (álbum)`,
                `${albumName} álbüm`,
                `${albumName} album`,
                `${albumName}`,
              ].filter(Boolean) as string[];
          for (const title of titles) {
            const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            if (data?.thumbnail?.source) { imageUrl = data.thumbnail.source; break; }
          }
        }

        // 3. Last.fm
        if (!imageUrl && artistName) {
          for (const variant of albumVariants(albumName)) {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(searchArtist)}&album=${encodeURIComponent(variant)}&format=json`);
            if (data?.album?.name && exactMatch(data.album.name, variant)) {
              const images = data.album.image ?? [];
              for (const img of [...images].reverse()) {
                if (img["#text"] && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                  imageUrl = img["#text"];
                  break;
                }
              }
            }
            if (imageUrl) break;
          }
        }

        // 4. iTunes (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `${variant} ${searchArtist}` : variant;
            const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=10`);
            for (const r of data?.results ?? []) {
              if (!r.artworkUrl100) continue;
              if (!exactMatch(r.collectionName ?? "", variant)) continue;
              if (artistName && !exactMatch(r.artistName ?? "", artistName)) continue;
              imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
              break;
            }
            if (imageUrl) break;
          }
        }

        // 5. Cover Art Archive
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            try {
              const q = artistName ? `release:${variant} AND artist:${artistName}` : `release:${variant}`;
              const mbData = await fetchJson(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`, { headers: { "User-Agent": "DaegonCharts/1.0 (contact@daegoncharts.com)" } });
              for (const release of mbData?.releases ?? []) {
                if (!exactMatch(release.title ?? "", variant)) continue;
                try {
                  const controller = new AbortController();
                  const timeout = setTimeout(() => controller.abort(), 3000);
                  const caaResponse = await fetch(`https://coverartarchive.org/release/${release.id}/front-500`, { method: "HEAD", signal: controller.signal });
                  clearTimeout(timeout);
                  if (caaResponse.ok) { imageUrl = `https://coverartarchive.org/release/${release.id}/front-500`; break; }
                } catch {}
              }
            } catch {}
            if (imageUrl) break;
          }
        }

        // 6. Discogs (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            try {
            const q = artistName ? `${variant} ${searchArtist}` : variant;
              const data = await fetchJson(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=10`, { headers: { "User-Agent": "DaegonCharts/1.0 (contact@daegoncharts.com)" } });
              for (const r of data?.results ?? []) {
                if (!r.cover_image) continue;
                const title = comparable(r.title ?? "");
                if (!title.includes(comparable(variant))) continue;
                if (artistName && !title.includes(comparable(artistName))) continue;
                imageUrl = r.cover_image;
                break;
              }
            } catch {}
            if (imageUrl) break;
          }
        }

        // 7. Deezer (exact)
        if (!imageUrl) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `${variant} ${searchArtist}` : variant;
            const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=10`);
            for (const a of data?.data ?? []) {
              if (!exactMatch(a.title ?? "", variant)) continue;
              if (artistName && !exactMatch(a.artist?.name ?? "", artistName)) continue;
              if (a.cover_xl || a.cover_big || a.cover_medium) {
                imageUrl = a.cover_xl || a.cover_big || a.cover_medium;
                break;
              }
            }
            if (imageUrl) break;
          }
        }

        // 8. Spotify broader (exact)
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = artistName ? `album:"${variant}" artist:"${artistName}"` : `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 20);
            for (const a of r?.albums?.items ?? []) {
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (!artistMatch(a, artistName)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 9. DeviantArt
        if (!imageUrl) {
          imageUrl = await searchDeviantArt(albumName, artistName);
        }

        // 10. Spotify album without artist
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const q = `album:"${variant}"`;
            const r = await spotifySearch(token, q, "album", 5);
            for (const a of r?.albums?.items ?? []) {
              if (!exactMatch(a.name ?? "", variant)) continue;
              if (a.images?.[0]?.url) { imageUrl = a.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 11. Spotify playlist cover
        if (!imageUrl && token) {
          for (const variant of albumVariants(albumName)) {
            const r = await spotifySearch(token, `"${variant}"`, "playlist", 5);
            for (const p of r?.playlists?.items ?? []) {
              if (!exactMatch(p.name ?? "", variant)) continue;
              if (p.images?.[0]?.url) { imageUrl = p.images[0].url; break; }
            }
            if (imageUrl) break;
          }
        }

        // 12. Artist image (last resort — Spotify)
        if (!imageUrl && token && artistName) {
          const ra = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (ra?.artists?.items ?? []).filter((a: any) => a.images?.[0]?.url);
          const exact = artists.find((a: any) => exactMatch(a.name ?? "", artistName));
          imageUrl = (exact ?? artists[0])?.images?.[0]?.url ?? null;
        }
        if (!imageUrl && token) {
          const rb = await spotifySearch(token, artistName || albumName, "artist");
          imageUrl = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url)?.images?.[0]?.url ?? null;
        }
      } else if (data.type === "track") {
        const trackName = fieldValue(data.query, "track") || data.query;
        const artistName = fieldValue(data.query, "artist");

        // Anitta special case: always add "cantora" to searches
        const isAnitta = comparable(artistName ?? "") === "anitta";
        const searchArtist = isAnitta ? `${artistName} cantora` : artistName;

        // 1. Wikipedia single
        if (!imageUrl && artistName) {
          const titles = isAnitta
            ? [`${trackName} (${artistName} cantora single)`, `${trackName} (${artistName} singer song)`, `${trackName} (${artistName} single)`, `${trackName} (${artistName} song)`]
            : [`${trackName} (${artistName} single)`, `${trackName} (${artistName} song)`, `${trackName} (song)`, `${trackName} (single)`];
          for (const title of titles) {
            const wd = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            if (wd?.thumbnail?.source) { imageUrl = wd.thumbnail.source; break; }
          }
        }

        // 2. iTunes single (trackCount === 1)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${searchArtist}`)}&entity=song&limit=20`);
          for (const r of data?.results ?? []) {
            if (!r.artworkUrl100) continue;
            if (!exactMatch(r.trackName ?? "", trackName)) continue;
            if (!exactMatch(r.artistName ?? "", artistName)) continue;
            if (r.trackCount === 1) { imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb"); break; }
          }
        }

        // 3. Deezer single (album_type === "single")
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(`${trackName} ${searchArtist}`)}&limit=20`);
          for (const r of data?.data ?? []) {
            if (!r.album?.cover_xl && !r.album?.cover_big) continue;
            if (!exactMatch(r.title ?? "", trackName)) continue;
            if (!exactMatch(r.artist?.name ?? "", artistName)) continue;
            if (r.album?.album_type === "single") { imageUrl = r.album.cover_xl || r.album.cover_big; break; }
          }
        }

        // 4. iTunes any result (track + artist)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${searchArtist}`)}&entity=song&limit=20`);
          for (const r of data?.results ?? []) {
            if (!r.artworkUrl100) continue;
            if (!exactMatch(r.trackName ?? "", trackName)) continue;
            if (!exactMatch(r.artistName ?? "", artistName)) continue;
            imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
            break;
          }
        }

        // 5. Deezer any result (track + artist)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(`${trackName} ${searchArtist}`)}&limit=20`);
          for (const r of data?.data ?? []) {
            if (!r.album?.cover_xl && !r.album?.cover_big) continue;
            if (!exactMatch(r.title ?? "", trackName)) continue;
            if (!exactMatch(r.artist?.name ?? "", artistName)) continue;
            imageUrl = r.album.cover_xl || r.album.cover_big;
            break;
          }
        }

        // 6. EPs by artist containing the track (Deezer)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(searchArtist)}&limit=50`);
          const eps = (data?.data ?? []).filter((a: any) => a.record_type === "EP");
          for (const ep of eps) {
            if (!ep.cover_xl && !ep.cover_big) continue;
            try {
              const albumData = await fetchJson(`https://api.deezer.com/album/${ep.id}/tracks`);
              const found = (albumData?.data ?? []).find((t: any) => exactMatch(t.title ?? "", trackName));
              if (found) { imageUrl = ep.cover_xl || ep.cover_big; break; }
            } catch {}
          }
        }

        // 7. Albums by artist containing the track (Deezer)
        if (!imageUrl && artistName) {
          const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(searchArtist)}&limit=50`);
          const albums = (data?.data ?? []).filter((a: any) => a.record_type === "album");
          for (const album of albums) {
            if (!album.cover_xl && !album.cover_big) continue;
            try {
              const albumData = await fetchJson(`https://api.deezer.com/album/${album.id}/tracks`);
              const found = (albumData?.data ?? []).find((t: any) => exactMatch(t.title ?? "", trackName));
              if (found) { imageUrl = album.cover_xl || album.cover_big; break; }
            } catch {}
          }
        }

        // 8. Artist image (last resort — Spotify)
        if (!imageUrl && token && artistName) {
          const result = await spotifySearch(token, `artist:"${artistName}"`, "artist");
          const artists = (result?.artists?.items ?? [])
            .filter((a: any) => a.images?.[0]?.url)
            .sort((a: any, b: any) => {
              const nameMatch = Number(exactMatch(b.name ?? "", artistName)) - Number(exactMatch(a.name ?? "", artistName));
              if (nameMatch !== 0) return nameMatch;
              return (b.popularity ?? 0) - (a.popularity ?? 0);
            });
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
        }

        // 9. Last.fm track image
        if (!imageUrl && artistName) {
          try {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&format=json`);
            const images = data?.track?.album?.image ?? [];
            for (const img of [...images].reverse()) {
              if (img["#text"] && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                imageUrl = img["#text"];
                break;
              }
            }
          } catch {}
        }

        // 10. Absolute fallback
        if (!imageUrl) {
          imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
        }
      } else {
        const artistName = fieldValue(data.query, "artist") || data.query;
        const title = fieldValue(data.query, "track") || fieldValue(data.query, "album");

        const isAnitta = comparable(artistName ?? "") === "anitta";
        const searchArtist = isAnitta ? `${artistName} cantora` : artistName;

        // 1. Spotify (Jão hardcode)
        if (comparable(artistName) === "jao" && !title && token) {
          const response = await fetch("https://api.spotify.com/v1/artists/59FrDXDVJz0EKqYg39dnT2", { headers: { Authorization: `Bearer ${token}` } });
          if (response.ok) imageUrl = (await response.json()).images?.[0]?.url ?? null;
        }

        // 2. Last.fm artist image (no auth needed)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(searchArtist)}&format=json`);
            const images = data?.artist?.image ?? [];
            for (const img of [...images].reverse()) {
              if (img["#text"] && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
                imageUrl = img["#text"];
                break;
              }
            }
          } catch {}
        }

        // 3. iTunes artist image (no auth needed)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(searchArtist)}&entity=musicArtist&limit=5`);
            for (const r of data?.results ?? []) {
              if (r.artistViewUrl && r.artworkUrl100) {
                imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
                break;
              }
            }
          } catch {}
        }

        // 4. Deezer artist image (no auth needed)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(searchArtist)}&limit=5`);
            for (const a of data?.data ?? []) {
              if ((exactMatch(a.name ?? "", artistName) || exactMatch(a.name ?? "", searchArtist)) && (a.picture_xl || a.picture_big)) {
                imageUrl = a.picture_xl || a.picture_big;
                break;
              }
            }
          } catch {}
        }

        // 5. Wikipedia artist image (no auth needed)
        if (!imageUrl) {
          try {
            const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchArtist)}`);
            if (data?.thumbnail?.source) imageUrl = data.thumbnail.source;
          } catch {}
        }

        // 5. Spotify via track → artist
        if (!imageUrl && title && token) {
          const tracks = (await spotifySearch(token, `track:"${title}" artist:"${searchArtist}"`, "track"))?.tracks?.items ?? [];
          const track = tracks.find((item: any) => item.artists?.some((artist: any) => exactMatch(artist.name ?? "", artistName)));
          const artist = track?.artists?.find((item: any) => exactMatch(item.name ?? "", artistName));
          if (artist?.id) {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artist.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (response.ok) imageUrl = (await response.json()).images?.[0]?.url ?? null;
          }
        }

        // 6. Spotify artist search (exact)
        if (!imageUrl && token) {
          const result = await spotifySearch(token, `artist:"${searchArtist}"`, "artist");
          const artists = (result?.artists?.items ?? [])
            .filter((artist: any) => artist.images?.[0]?.url)
            .sort((a: any, b: any) => {
              const nameMatch = Number(exactMatch(b.name ?? "", artistName)) - Number(exactMatch(a.name ?? "", artistName));
              if (nameMatch !== 0) return nameMatch;
              return (b.popularity ?? 0) - (a.popularity ?? 0);
            });
          imageUrl = artists[0]?.images?.[0]?.url ?? null;
        }

        // 7. Spotify broader fallback
        if (!imageUrl && token) {
          const rb = await spotifySearch(token, searchArtist, "artist");
          const fallback = (rb?.artists?.items ?? []).find((a: any) => a.images?.[0]?.url);
          imageUrl = fallback?.images?.[0]?.url ?? null;
        }

        // 8. Absolute fallback — generic music note
        if (!imageUrl) {
          imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
        }
      }
      if (imageUrl) imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("Image search failed", error);
      return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    }
  });

interface TrackArtist {
  name: string;
  slug: string;
}

const trackArtistsCache = new Map<string, TrackArtist[] | null>();
const slugify = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function parseItunesArtist(artistName: string): TrackArtist[] {
  const parts = artistName.split(/\s*(?:feat\.|ft\.|featuring)\s*/i).map(s => s.trim()).filter(Boolean);
  return parts.map(name => ({ name, slug: slugify(name) }));
}

async function fetchTrackArtistsFromItunes(song: string, artist: string): Promise<TrackArtist[] | null> {
  try {
    const q = `${song} ${artist}`;
    const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=5`);
    for (const r of data?.results ?? []) {
      const nameMatch = exactMatch(r.trackName ?? "", song);
      const artistMatch = exactMatch(r.artistName ?? "", artist);
      if (nameMatch && artistMatch) {
        const allArtists = parseItunesArtist(r.artistName ?? "");
        if (allArtists.length > 1) return allArtists;
      }
    }
    for (const r of data?.results ?? []) {
      const nameMatch = exactMatch(r.trackName ?? "", song);
      if (nameMatch) {
        const allArtists = parseItunesArtist(r.artistName ?? "");
        if (allArtists.length > 1) return allArtists;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const getSpotifyTrackArtists = createServerFn({ method: "GET" })
  .validator((d: { song: string; artist: string }) => d)
  .handler(async ({ data }) => {
    const cacheKey = `${data.song.trim().toLowerCase()}|${data.artist.trim().toLowerCase()}`;
    if (trackArtistsCache.has(cacheKey)) return trackArtistsCache.get(cacheKey);

    let result: TrackArtist[] | null = null;

    try {
      const token = await getAccessToken();
      if (token) {
        const tracks = (await spotifySearch(token, `track:"${data.song}" artist:"${data.artist}"`, "track"))?.tracks?.items ?? [];
        const track = tracks.find((t: any) =>
          t.artists?.some((a: any) => exactMatch(a.name ?? "", data.artist))
        );
        if (track?.artists && track.artists.length > 1) {
          result = track.artists.map((a: any) => ({
            name: a.name,
            slug: slugify(a.name),
          }));
        }
      }
    } catch {}

    if (!result) {
      result = await fetchTrackArtistsFromItunes(data.song, data.artist);
    }

    if (result) {
      trackArtistsCache.set(cacheKey, result);
    }
    return result;
  });

interface FeaturedOnTrack {
  name: string;
  artist: string;
  slug: string;
  imageUrl: string | null;
}

const featuredOnCache = new Map<string, FeaturedOnTrack[] | null>();

export const getSpotifyFeaturedOn = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    if (featuredOnCache.has(data.artistName)) return featuredOnCache.get(data.artistName);

    const token = await getAccessToken();
    if (!token) { featuredOnCache.set(data.artistName, null); return null; }

    try {
      const results: FeaturedOnTrack[] = [];

      const searchResult = await spotifySearch(token, `artist:"${data.artistName}"`, "track", 50);
      const tracks = searchResult?.tracks?.items ?? [];

      for (const track of tracks) {
        const allArtists = track.artists ?? [];
        const isFeatured = allArtists.length > 1 && allArtists.some((a: any) => exactMatch(a.name ?? "", data.artistName));
        if (!isFeatured) continue;

        const mainArtist = allArtists.find((a: any) => !exactMatch(a.name ?? "", data.artistName));
        if (!mainArtist) continue;

        const albumImg = track.album?.images?.[0]?.url ?? null;
        results.push({
          name: track.name,
          artist: mainArtist.name,
          slug: slugify(mainArtist.name),
          imageUrl: albumImg,
        });
      }

      const unique = results.slice(0, 20);
      if (unique.length > 0) {
        featuredOnCache.set(data.artistName, unique);
      }
      return unique.length > 0 ? unique : null;
    } catch {
      featuredOnCache.set(data.artistName, null);
      return null;
    }
  });

const profileCache = new Map<string, { imageUrl: string | null; followers: number; genres: string[] } | null>();

export const getSpotifyArtistProfile = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    if (profileCache.has(data.artistName)) return profileCache.get(data.artistName);

    const isAnitta = comparable(data.artistName ?? "") === "anitta";
    const searchArtist = isAnitta ? `${data.artistName} cantora` : data.artistName;

    let imageUrl: string | null = null;
    let followers = 0;
    let genres: string[] = [];
    const token = await getAccessToken();

    // 1. Last.fm (no auth)
    try {
      const d = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=8fc896e5a34e6491b19710f4f1212a34&artist=${encodeURIComponent(searchArtist)}&format=json`);
      const images = d?.artist?.image ?? [];
      for (const img of [...images].reverse()) {
        if (img["#text"] && (img.size === "extralarge" || img.size === "large" || img.size === "mega")) {
          imageUrl = img["#text"];
          break;
        }
      }
    } catch {}

    // 2. iTunes (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(searchArtist)}&entity=musicArtist&limit=5`);
        for (const r of d?.results ?? []) {
          if (r.artistViewUrl && r.artworkUrl100) {
            imageUrl = r.artworkUrl100.replace("100x100bb", "600x600bb");
            break;
          }
        }
      } catch {}
    }

    // 3. Deezer (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(searchArtist)}&limit=5`);
        for (const a of d?.data ?? []) {
          if ((exactMatch(a.name ?? "", data.artistName) || exactMatch(a.name ?? "", searchArtist)) && (a.picture_xl || a.picture_big)) {
            imageUrl = a.picture_xl || a.picture_big;
            break;
          }
        }
      } catch {}
    }

    // 4. Wikipedia (no auth)
    if (!imageUrl) {
      try {
        const d = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchArtist)}`);
        if (d?.thumbnail?.source) imageUrl = d.thumbnail.source;
      } catch {}
    }

    // 5. Spotify (needs token)
    if (token) {
      try {
        const artist = comparable(data.artistName) === "jao"
          ? await fetch("https://api.spotify.com/v1/artists/59FrDXDVJz0EKqYg39dnT2", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null)
          : (await spotifySearch(token, `artist:"${searchArtist}"`, "artist"))?.artists?.items?.sort((a: any, b: any) => Number(exactMatch(b.name ?? "", data.artistName)) - Number(exactMatch(a.name ?? "", data.artistName)))[0];
        if (artist) {
          if (!imageUrl && artist.images?.[0]?.url) imageUrl = artist.images[0].url;
          followers = artist.followers?.total ?? 0;
          genres = artist.genres ?? [];
        }
      } catch {}
    }

    if (!imageUrl) {
      imageUrl = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23e5e7eb"/><text x="150" y="170" text-anchor="middle" font-size="120" fill="%239ca3af">♪</text></svg>`);
    }

    const profile = { imageUrl, followers, genres };
    profileCache.set(data.artistName, profile);
    return profile;
  });
