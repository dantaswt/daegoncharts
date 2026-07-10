import { createServerFn } from "@tanstack/react-start";

const SPOTIFY_CLIENT_ID = "08a6cea61aaa4828b173bf2b40e14134";
const SPOTIFY_CLIENT_SECRET = "24da1ad56cf34cd8b6731a2bda503fdb";

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials",
  });
  
  if (!response.ok) {
    console.error("Failed to fetch Spotify token", await response.text());
    return null;
  }
  
  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000; // buffer of 1 min
  return accessToken;
}

const imageCache = new Map<string, string | null>();

function normalizeSpotifyQuery(query: string) {
  const normalized = query.trim();
  if (/^ja[oã]$/i.test(normalized) || /^anitta$/i.test(normalized)) {
    return `${normalized} cantora singer`;
  }
  return normalized;
}

export const getSpotifyImage = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string; type: "album" | "artist" }) => d)
  .handler(async ({ data }) => {
    const { query, type } = data;
    
    if (type === "artist") {
      const q = query.trim().replace(/^artist:"|"/g, '');
      if (/^ja[oã]$/i.test(q)) {
        return "https://i.scdn.co/image/7d6c097127ab57ce074878afcea8bdab483dac22";
      }
    }

    const normalizedQuery = normalizeSpotifyQuery(query);
    const cacheKey = `${type}:${normalizedQuery}`;
    
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }

    const token = await getAccessToken();
    if (!token) return null;

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", normalizedQuery);
    url.searchParams.set("type", type);
    url.searchParams.set("limit", "1");

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
         if (response.status === 429) {
           console.warn("Spotify rate limit exceeded");
         }
         return null;
      }

      const resData = await response.json();

      // Helper to detect João Gomes false positives
      const isJoaoGomes = (name: string | undefined) => /joã?o\s+gomes/i.test(name || "");

      let imageUrl: string | null = null;

      if (type === "album") {
        const albums = resData.albums?.items || [];
        // pick first album whose first artist is NOT João Gomes
        const nonJoaoAlbum = albums.find((al: any) => !isJoaoGomes(al.artists?.[0]?.name) && al.images?.[0]?.url);
        if (nonJoaoAlbum) {
          imageUrl = nonJoaoAlbum.images[0].url;
        }
      } else if (type === "artist") {
        const artists = resData.artists?.items || [];
        // choose a non-João Gomes artist if present; DO NOT fall back to João Gomes
        const nonJoao = artists.find((a: any) => !isJoaoGomes(a.name) && a.images?.[0]?.url);
        if (nonJoao) {
          imageUrl = nonJoao.images[0].url;
        }
      }

      // If we detected João Gomes or no suitable image, and the original query was Jão,
      // try a more specific fallback search including albums/tracks to disambiguate.
      const originalIsJao = /\bja[oã]\b/i.test(normalizedQuery);
      if (!imageUrl && originalIsJao) {
        const fallbackQ = 'artist:"Jão" OR album:Lobos OR album:PIRATA OR album:SUPER OR track:Idiota OR track:Pilantra';
        const retryUrl = new URL("https://api.spotify.com/v1/search");
        retryUrl.searchParams.set("q", fallbackQ);
        retryUrl.searchParams.set("type", type);
        retryUrl.searchParams.set("limit", "3");

        try {
          const r2 = await fetch(retryUrl.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r2.ok) {
            const d2 = await r2.json();
            if (type === "album" && d2.albums?.items?.length) {
              const album = d2.albums.items.find((al: any) => !isJoaoGomes(al.artists?.[0]?.name) && al.images?.[0]?.url);
              imageUrl = album?.images?.[0]?.url || null;
            } else if (type === "artist" && d2.artists?.items?.length) {
              const artist = d2.artists.items.find((a: any) => !isJoaoGomes(a.name) && a.images?.[0]?.url);
              imageUrl = artist?.images?.[0]?.url || null;
            }
          }
        } catch (e) {
          // ignore fallback failure
        }
      }

      // Fallback for album without image: try to find the artist image
      if (!imageUrl && type === "album") {
         const artistMatch = query.match(/artist:"([^"]+)"/);
         const fallbackArtist = artistMatch ? artistMatch[1] : query;
         
         if (/^ja[oã]$/i.test(fallbackArtist.trim())) {
           imageUrl = "https://i.scdn.co/image/7d6c097127ab57ce074878afcea8bdab483dac22";
         } else {
           const fallbackUrl = new URL("https://api.spotify.com/v1/search");
           fallbackUrl.searchParams.set("q", normalizeSpotifyQuery(fallbackArtist));
           fallbackUrl.searchParams.set("type", "artist");
           fallbackUrl.searchParams.set("limit", "1");
           try {
             const rFallback = await fetch(fallbackUrl.toString(), {
               headers: { Authorization: `Bearer ${token}` }
             });
             if (rFallback.ok) {
               const dFallback = await rFallback.json();
               const artists = dFallback.artists?.items || [];
               const nonJoao = artists.find((a: any) => !isJoaoGomes(a.name) && a.images?.[0]?.url);
               if (nonJoao) imageUrl = nonJoao.images[0].url;
             }
           } catch (e) { }
         }
      }

      imageCache.set(cacheKey, imageUrl);
      return imageUrl;
    } catch (e) {
      console.error("Spotify search error", e);
      return null;
    }
  });

const profileCache = new Map<string, { imageUrl: string | null; followers: number; genres: string[] } | null>();

export const getSpotifyArtistProfile = createServerFn({ method: "GET" })
  .validator((d: { artistName: string }) => d)
  .handler(async ({ data }) => {
    const { artistName } = data;
    if (profileCache.has(artistName)) {
      return profileCache.get(artistName);
    }

    const token = await getAccessToken();
    if (!token) return null;

    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", normalizeSpotifyQuery(artistName));
    url.searchParams.set("type", "artist");
    url.searchParams.set("limit", "1");

    try {
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) return null;

      const resData = await response.json();
      const artist = resData.artists?.items?.[0];
      if (!artist) return null;

      const profile = {
        imageUrl: artist.images?.[0]?.url || null,
        followers: artist.followers?.total || 0,
        genres: artist.genres || [],
      };

      profileCache.set(artistName, profile);
      return profile;
    } catch (e) {
      return null;
    }
  });
