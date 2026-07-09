## Objetivo

Transformar o `index.html` monolítico do **daegon charts** em um app React (TanStack Start) com **URLs próprias por chart e por semana**, além de rotas dedicadas para artistas, chart beat, stats e blog. Os dados continuam vindo das planilhas Google Sheets que o HTML original já usa — o que muda é a estrutura: cada visão passa a ter sua rota, indexável, compartilhável e navegável com back/forward.

Não vou usar Lovable Cloud nesta primeira versão: os dados já são "dinâmicos" (planilhas remotas atualizadas fora do site). Se depois você quiser um painel para editar sem mexer no Sheets, aí ativamos Cloud.

## Rotas

```
/                                   → Home: Hot 100 na semana mais recente
/chart/$chartId                     → Semana mais recente do chart escolhido
/chart/$chartId/$date               → Semana específica (ex: /chart/songs/2025-01-15)
/year-end/$chartId/$year            → Year-end de um chart em um ano
/goat/$chartId                      → Charts GOAT
/artist/$slug                       → Perfil do artista com histórico
/artists                            → All Artists Entries
/chart-beat/$blog                   → Chart Beat (hot100 / artists / top100Albums)
/stats                              → Página de Stats
/stats/$category                    → Categoria de stat específica
```

- `$chartId` = `songs | artists | albums | radioSongs | topStreamingAlbums | topAlbumSales | streamingSongs | digitalSongsSales`.
- `$date` no formato `YYYY-MM-DD`. Se ausente, redireciona para a semana mais recente disponível.
- Toda rota tem `head()` próprio: título, description, og:title/description dinâmicos (ex.: "Hot 100 — 15 Jan 2025 | daegon charts").

## Camada de dados

- `src/lib/charts-config.ts`: mapa `chartsConfig` migrado do HTML (URLs das planilhas, títulos, ícones).
- `src/lib/charts.functions.ts`: `createServerFn` para baixar e parsear cada CSV no servidor (evita CORS, cacheado por chartId). Retorna `{ dates: string[], entriesByDate: Record<string, ChartEntry[]> }`.
- `src/lib/spotify.functions.ts`: server fn que busca imagens do Spotify usando client credentials guardados em `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` (secrets do projeto — vou pedir no fim). Cache em memória por deploy.
- TanStack Query com `queryOptions` por chart; loader faz `ensureQueryData`, componente usa `useSuspenseQuery`.

## UI

- Design system em `src/styles.css` reproduzindo tokens do original (preto, dourado `#FFD700`, cards brancos, badges "run-up/down/new/peak").
- Componentes: `ChartCardItem`, `RankNumber`, `WeekNavigator` (‹ prev / date-picker / next ›), `ChartNav` (troca de tipo de chart), `ArtistLink`, `StatsTable`, `BlogCard`, `BackToTop`, modal substituído por rota de detalhe.
- Layout root: header sticky com nav (All Artists / Chart Beat / Stats), footer, notas musicais decorativas.
- `WeekNavigator` navega com `<Link to="/chart/$chartId/$date">` — trocar de semana muda a URL, não só o estado.

## Detalhes técnicos

- Fontes: `@fontsource/inter` importado em `src/start.ts`; Font Awesome via `@fortawesome/fontawesome-free` importado no CSS.
- Datepicker: `react-day-picker` (já presente no shadcn) em vez do flatpickr.
- Parser CSV: `papaparse`.
- Segredos Spotify vão via `secrets--add_secret` (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) — as chaves que apareciam no HTML ficam fora do bundle do cliente.
- SEO: `sitemap.xml` lista uma URL por chart + últimas 12 semanas de cada; `robots.txt` liberado.
- Sem admin, sem login.

## Fora deste escopo (posso fazer depois se quiser)

- Painel admin para editar dados sem mexer no Sheets (requer Lovable Cloud).
- Blog CMS com posts próprios (o "Chart Beat" atual é derivado das planilhas, mantenho igual).
- Cache persistente das respostas Spotify (hoje fica em memória do worker).
