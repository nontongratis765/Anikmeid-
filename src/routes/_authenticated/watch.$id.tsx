import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser, isPremium, useMyProfile } from "@/hooks/use-auth";
import { animeApi } from "@/lib/anime-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/watch/$id")({
  component: WatchPage,
});

function WatchPage() {
  const { id } = useParams({ from: "/_authenticated/watch/$id" });
  const { user } = useSessionUser();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [historySaved, setHistorySaved] = useState(false);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["anime-detail", id],
    queryFn: async () => {
      const j = await animeApi.detail(id);
      return j?.data;
    },
  });

  const { data: episode } = useQuery({
    queryKey: ["episode", episodeId],
    enabled: !!episodeId,
    queryFn: async () => {
      const j = await animeApi.episode(episodeId!);
      return j?.data;
    },
  });

  // Auto-select first episode
  useEffect(() => {
    if (detail && !episodeId) {
      const first = detail.episodeList?.[0]?.episodeId;
      if (first) setEpisodeId(first);
    }
  }, [detail, episodeId]);

  // Set default iframe & save history
  useEffect(() => {
    if (episode?.defaultStreamingUrl) setIframeUrl(episode.defaultStreamingUrl);
    if (episode && user && detail && !historySaved) {
      setHistorySaved(true);
      const epNum = episode.title?.match(/episode\s*(\d+)/i)?.[1] ?? "";
      supabase.from("watch_history").insert({
        user_id: user.id, anime_id: id, anime_title: detail.title,
        cover_url: detail.poster, episode: epNum ? `Episode ${epNum}` : "Episode",
      });
    }
  }, [episode, user, detail, id, historySaved]);

  // Track watch minutes — increment every 60s the page is open with an iframe.
  // Premium = 2x XP boost. Owner = unlimited (display only).
  useEffect(() => {
    if (!user || !iframeUrl) return;
    const boost = isPremium(me) ? 2 : 1;
    const tick = async () => {
      await supabase.rpc("increment_watch_minutes", { _minutes: boost });
      qc.invalidateQueries({ queryKey: ["me"] });
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [user, iframeUrl, me, qc]);


  async function addFavorite() {
    if (!user || !detail) return;
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, anime_id: id, anime_title: detail.title, cover_url: detail.poster });
    if (error) toast.error(error.message); else toast.success("Ditambahkan ke favorit");
  }

  async function loadServer(serverId: string) {
    try {
      const j = await animeApi.server(serverId);
      if (j?.data?.url) setIframeUrl(j.data.url); else toast.error("URL server tidak tersedia");
    } catch (e: any) { toast.error("Gagal server: " + e.message); }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (error || !detail) return <div className="p-8 text-center text-destructive">Gagal memuat anime</div>;

  return (
    <div className="min-h-screen pb-12">
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/anime" })} className="grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={addFavorite} className="grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur"><Heart className="h-5 w-5" /></button>
      </header>

      {iframeUrl ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe src={iframeUrl} className="absolute inset-0 h-full w-full" allow="autoplay;fullscreen;picture-in-picture" allowFullScreen />
        </div>
      ) : detail.poster ? (
        <img src={detail.poster} referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />
      ) : <div className="aspect-video bg-accent" />}

      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-black">{detail.title}</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {(detail.genreList ?? []).slice(0, 6).map((g: any) => <span key={g.title} className="rounded-full bg-accent px-3 py-1">{g.title}</span>)}
        </div>
        <div className="text-xs text-muted-foreground">
          {detail.score && <>⭐ {detail.score} · </>}{detail.episodes ?? "?"} eps · {detail.status} {detail.studios && <>· {detail.studios}</>}
        </div>
        {detail.synopsis?.paragraphs?.map((p: string, i: number) => (
          <p key={i} className="text-sm text-muted-foreground">{p}</p>
        ))}

        {/* Server picker */}
        {episode?.server?.qualities?.length > 0 && (
          <div className="rounded-2xl bg-card p-3">
            <div className="mb-2 text-sm font-bold">Server Streaming</div>
            <p className="mb-2 text-[11px] text-yellow-300">⭐ Rekomendasi: server <b>720p ondemand</b></p>
            {episode.server.qualities.map((q: any) => (
              <div key={q.title} className="mb-2">
                <div className="mb-1 text-xs text-muted-foreground">{q.title}</div>
                <div className="flex flex-wrap gap-2">
                  {(q.serverList ?? []).filter((s: any) => s.serverId).map((s: any) => (
                    <button key={s.serverId} onClick={() => loadServer(s.serverId)} className="rounded-full bg-accent px-3 py-1.5 text-xs hover:bg-brand hover:text-background">{s.title.trim()}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Episode list */}
        {detail.episodeList?.length > 0 && (
          <div>
            <h2 className="mb-2 text-lg font-bold">Daftar Episode ({detail.episodeList.length})</h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {detail.episodeList.map((ep: any) => (
                <button key={ep.episodeId} onClick={() => { setEpisodeId(ep.episodeId); setIframeUrl(null); setHistorySaved(false); }}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs ${episodeId === ep.episodeId ? "bg-brand text-background" : "bg-card"}`}>
                  <Play className="h-3 w-3" />
                  <span className="font-bold">EP {ep.eps}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
