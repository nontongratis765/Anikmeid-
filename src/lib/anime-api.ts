// Wrapper for the free anime API used by the original HTML (sankavollerei).
export const ANIME_API = "https://www.sankavollerei.web.id/anime";

async function call<T = any>(path: string): Promise<T> {
  const r = await fetch(ANIME_API + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export type AnimeItem = {
  title?: string;
  poster?: string;
  animeId?: string;
  slug?: string;
  score?: string | number;
  episodes?: number | string;
  status?: string;
  releaseDay?: string;
};

export function pickPoster(a: any): string {
  return a?.poster || a?.image || a?.cover || a?.thumbnail || a?.img || a?.coverImage || a?.poster_url || a?.imageUrl || "";
}
export function pickId(a: any): string {
  return a?.animeId || a?.anime_slug || a?.slug || a?.id || "";
}

export const animeApi = {
  ongoing: (page = 1) => call(`/ongoing-anime?page=${page}`),
  complete: (page = 1) => call(`/complete-anime?page=${page}`),
  search: (q: string) => call(`/search/${encodeURIComponent(q)}`),
  detail: (slug: string) => call(`/anime/${slug}`),
  episode: (episodeId: string) => call(`/episode/${episodeId}`),
  server: (serverId: string) => call(`/server/${serverId}`),
};
