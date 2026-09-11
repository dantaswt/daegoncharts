import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { getAllArtistList, getAllSongList, getAllAlbumList } from "@/lib/charts.functions";

interface SearchItem {
  name: string;
  artist?: string;
  slug: string;
  kind: "artist" | "song" | "album";
  entries: number;
}
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl K");
  const navigate = useNavigate();
  const { data: items = [], isPending: loading, isError, refetch } = useQuery({
    queryKey: ["site-search"],
    queryFn: async (): Promise<SearchItem[]> => {
      const [artists, songs, albums] = await Promise.all([getAllArtistList(), getAllSongList(), getAllAlbumList()]);
      return [
        ...artists.map((item) => ({ ...item, kind: "artist" as const })),
        ...songs.map((item) => ({ ...item, kind: "song" as const })),
        ...albums.map((item) => ({ ...item, kind: "album" as const })),
      ];
    },
    enabled: open, staleTime: 10 * 60_000, retry: false, refetchOnWindowFocus: false,
  });
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const search = normalize(query);
  const filtered = items.filter((item) => !search || normalize(`${item.name} ${item.artist ?? ""}`).includes(search));
  const groups = (["artist", "song", "album"] as const).map((kind) => ({
    kind, items: filtered.filter((item) => item.kind === kind).slice(0, 5),
  }));
  const select = (item: SearchItem) => {
    setOpen(false);
    const to = item.kind === "artist" ? "/artist/$slug" : item.kind === "song" ? "/song/$slug" : "/album/$slug";
    void navigate({ to, params: { slug: item.slug } });
  };
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <button aria-label="Search artists, songs and albums" className="flex min-h-11 min-w-11 items-center justify-center gap-2 border border-[#444] px-3 text-xs font-semibold text-[#f5f5f5] hover:border-[var(--accent)]">
        <i aria-hidden="true" className="fas fa-search" /><span className="hidden sm:inline">Search</span>
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
      <Dialog.Content className="fixed z-[101] left-1/2 top-[10dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-xl overflow-hidden">
        <Dialog.Title className="sr-only">Search the charts</Dialog.Title>
        <Dialog.Description className="sr-only">Find an artist, song or album. Use arrow keys to navigate results and Escape to close.</Dialog.Description>
        <Command shouldFilter={false}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <i aria-hidden="true" className="fas fa-search text-muted-foreground" />
            <Command.Input value={query} onValueChange={setQuery} aria-label="Search artists, songs, albums" placeholder="Search artists, songs, albums…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <Dialog.Close aria-label="Close search" className="min-w-11 min-h-11 text-lg">×</Dialog.Close>
          </div>
          <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
            {loading && <div role="status" className="p-6 text-center text-sm text-muted-foreground">Loading search…</div>}
            {isError && <div role="alert" className="p-6 text-center text-sm"><p>Search could not load. Please try again.</p><button onClick={() => void refetch()} className="mt-3 underline min-h-11">Try again</button></div>}
            {!loading && !isError && filtered.length === 0 && <Command.Empty className="p-6 text-center text-sm">No results found.</Command.Empty>}
            {groups.map(({ kind, items: group }) => group.length > 0 && <Command.Group key={kind} heading={kind === "artist" ? "Artists" : kind === "song" ? "Songs" : "Albums"}>
              {group.map((item) => <Command.Item key={`${kind}-${item.slug}`} value={`${kind}-${item.slug}`} onSelect={() => select(item)} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer text-sm data-[selected=true]:bg-[var(--muted)]">
                <i aria-hidden="true" className={`fas ${kind === "artist" ? "fa-user" : kind === "album" ? "fa-compact-disc" : "fa-music"} w-5 text-[var(--accent)]`} />
                <div className="min-w-0"><div className="font-semibold truncate">{item.name}</div><div className="text-xs text-muted-foreground truncate">{item.artist ?? `${item.entries} entries`}</div></div>
              </Command.Item>)}
            </Command.Group>)}
          </Command.List>
        </Command>
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-muted-foreground">{shortcut} to search · Esc to close</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
