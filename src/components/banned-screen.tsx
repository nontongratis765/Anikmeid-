import { LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export function BannedScreen({ ban }: { ban: { reason?: string | null; expires_at?: string | null } }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function out() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const sampai = ban.expires_at ? new Date(ban.expires_at).toLocaleString("id-ID") : "permanen";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <h1 className="mt-4 text-2xl font-black text-destructive">Akun Dibanned</h1>
      <p className="mt-4 max-w-sm rounded-2xl bg-card p-4 text-sm">
        <span className="font-bold">Alasan:</span><br />
        <span className="text-muted-foreground">{ban.reason || "(tanpa alasan)"}</span>
      </p>
      <p className="mt-3 text-xs text-muted-foreground">Berlaku sampai: {sampai}</p>
      <p className="mt-2 max-w-xs text-xs text-muted-foreground">Kamu tidak bisa menggunakan akun ini. Pilih keluar lalu pakai akun lain.</p>
      <button onClick={out} className="mt-6 inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-destructive-foreground">
        <LogOut className="h-4 w-4" /> Keluar
      </button>
    </div>
  );
}
