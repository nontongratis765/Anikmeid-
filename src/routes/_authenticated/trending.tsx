import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { animeApi, pickPoster, pickId } from "@/lib/anime-api";

export const Route = createFileRoute("/_authenticated/trending")({
  component: TrendingPage,
});

function TrendingPage() {
  const { data: list = [] } = useQuery({
    queryKey: ["trending"],
    queryFn: async () => {
      const j = await animeApi.complete(1);
      return (j?.data?.animeList || j?.data || []) as any[];
    },
  });
  return (
    <AppShell>
      <header className="px-4 py-4"><h1 className="text-2xl font-black">Trending / Tamat</h1></header>
      <div className="grid grid-cols-2 gap-3 px-4">
        {list.map((a: any) => {
          const id = pickId(a); const poster = pickPoster(a);
          return (
            <Link key={id || a.title} to="/watch/$id" params={{ id }} className="overflow-hidden rounded-2xl bg-card">
              {poster ? <img src={poster} referrerPolicy="no-referrer" className="h-48 w-full object-cover" /> : <div className="grid h-48 place-items-center bg-accent">🎬</div>}
              <div className="p-2 text-xs"><div className="line-clamp-2 font-bold">{a.title}</div></div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
