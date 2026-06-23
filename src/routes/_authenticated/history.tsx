import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { useSessionUser } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useSessionUser();
  const { data: history = [] } = useQuery({
    queryKey: ["history-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("watch_history").select("*").eq("user_id", user!.id).order("watched_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <header className="px-4 py-4"><h1 className="text-2xl font-black">History</h1></header>
      <div className="grid grid-cols-2 gap-3 px-4">
        {history.map(h => (
          <div key={h.id} className="overflow-hidden rounded-2xl bg-card">
            {h.cover_url ? <img src={h.cover_url} className="h-32 w-full object-cover" /> : <div className="h-32 bg-accent" />}
            <div className="p-2 text-xs">
              <div className="truncate font-bold">{h.anime_title}</div>
              {h.episode && <div className="text-muted-foreground">{h.episode}</div>}
              <div className="text-[10px] text-muted-foreground">{timeAgo(h.watched_at)}</div>
            </div>
          </div>
        ))}
        {history.length === 0 && <div className="col-span-2 py-12 text-center text-muted-foreground">Belum ada history.</div>}
      </div>
    </AppShell>
  );
}
