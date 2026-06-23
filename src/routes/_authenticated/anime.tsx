import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { animeApi, pickPoster, pickId } from "@/lib/anime-api";

export const Route = createFileRoute("/_authenticated/anime")({
  component: AnimePage,
});

function AnimePage() {
  const [q, setQ] = useState("");
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["anime-list", q],
    queryFn: async () => {
      const j = q ? await animeApi.search(q) : await animeApi.ongoing(1);
      return (j?.data?.animeList || j?.data || []) as any[];
    },
  });

  return (
    <AppShell>
      <header className="space-y-3 px-4 py-4">
        <h1 className="text-2xl font-black">Anime</h1>
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari anime..." className="flex-1 bg-transparent text-sm outline-none" />
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 px-4">
        {isLoading && <div className="col-span-2 py-12 text-center text-muted-foreground">Memuat...</div>}
        {list.map((a: any) => {
          const id = pickId(a); const poster = pickPoster(a);
          return (
            <Link key={id || a.title} to="/watch/$id" params={{ id }} className="overflow-hidden rounded-2xl bg-card">
              {poster ? <img src={poster} referrerPolicy="no-referrer" className="h-48 w-full object-cover" /> : <div className="grid h-48 place-items-center bg-accent">🎬</div>}
              <div className="p-2 text-xs"><div className="line-clamp-2 font-bold">{a.title}</div>
                {a.status && <div className="text-muted-foreground">{a.status}</div>}
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
