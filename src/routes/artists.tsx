import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllArtistStats } from "@/lib/charts.functions";
import { getSpotifyImage } from "@/lib/spotify.functions";
import { slugifyArtist } from "@/lib/charts-config";
import React, { useMemo, useState } from "react";

export const Route = createFileRoute("/artists")({
  loader: async () => {
    const all = await getAllArtistStats();
    const list: { name: string; slug: string; entries: number }[] = Object.values(all)
      .map((a) => ({
        name: a.name,
        slug: slugifyArtist(a.name),
        entries: Object.values(a.chartsByKind).reduce<number>((s, arr) => s + (arr as unknown[]).length, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { list };
  },
  head: () => ({
    meta: [
      { title: "All Artists — daegon charts" },
      { name: "description", content: "Every artist that has ever appeared on daegon charts." },
    ],
  }),
  component: AllArtistsPage,
});

function ArtistThumbnail({ name }: { name: string }) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    getSpotifyImage({ data: { query: name, type: "artist" } }).then((url) => {
      if (active && url) setImageUrl(url);
    });
    return () => { active = false; };
  }, [name]);

  return (
    <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--card)] flex items-center justify-center text-sm font-semibold text-[var(--foreground)] uppercase border border-[var(--border)]">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{name.charAt(0)}</span>
      )}
    </div>
  );
}

function AllArtistsPage() {
  const { list } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const letters = useMemo(() => {
    return Array.from(new Set(list.map((a) => a.name[0].toUpperCase()))).sort();
  }, [list]);
  const [selectedLetter, setSelectedLetter] = useState<string>(() => letters[0] ?? "");

  React.useEffect(() => {
    if (!selectedLetter && letters.length) setSelectedLetter(letters[0]);
  }, [letters]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.filter((a) => {
      const matchesLetter = !selectedLetter || a.name[0].toUpperCase() === selectedLetter;
      const matchesSearch = !query || a.name.toLowerCase().includes(query);
      return matchesLetter && matchesSearch;
    });
  }, [list, search, selectedLetter]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, typeof list>>((groups, artist) => {
      const letter = artist.name[0].toUpperCase();
      (groups[letter] ||= []).push(artist);
      return groups;
    }, {});
  }, [filtered]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <h1 className="section-title">All Artists Entries</h1>
      <p className="text-sm text-muted-foreground mb-6">{list.length} artists tracked.</p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {letters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setSelectedLetter(letter)}
              className={`btn-nav ${selectedLetter === letter ? "active" : ""}`}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="search"
            placeholder="Search artists"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-72 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-gray-500 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No artists found for that filter.</div>
      ) : (
        Object.keys(grouped).sort().map((letter) => (
          <section key={letter} className="mb-8">
            <h2 className="text-xl font-bold mb-3">{letter}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[letter].map((artist) => (
                <Link
                  key={artist.slug}
                  to="/artist/$slug"
                  params={{ slug: artist.slug }}
                  className="group bg-[var(--card)] border border-[var(--border)] rounded-3xl p-4 flex items-center gap-3 hover:border-[var(--accent)] transition-colors shadow-sm"
                >
                  <ArtistThumbnail name={artist.name} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate group-hover:text-[var(--accent)]">{artist.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{artist.entries} entries</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
