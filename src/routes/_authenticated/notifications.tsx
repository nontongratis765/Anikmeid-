import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotifPage,
});

function NotifPage() {
  const { user } = useSessionUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifs"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("notifs-rt").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => qc.invalidateQueries({ queryKey: ["notifs"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => {
    if (!user || notifs.length === 0) return;
    const rows = notifs.map(n => ({ user_id: user.id, notification_id: n.id }));
    supabase.from("notification_reads").upsert(rows, { onConflict: "user_id,notification_id" }).then(() => {
      qc.invalidateQueries({ queryKey: ["unread-notif"] });
    });
  }, [notifs, user, qc]);

  return (
    <div className="min-h-screen pb-12">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold">Notifikasi</h1>
      </header>
      <div className="space-y-3 px-4">
        {notifs.map(n => (
          <div key={n.id} className="rounded-2xl bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-premium text-background"><Bell className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-bold">{n.title}</div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          </div>
        ))}
        {notifs.length === 0 && <div className="py-12 text-center text-muted-foreground">Belum ada notifikasi.</div>}
      </div>
    </div>
  );
}
