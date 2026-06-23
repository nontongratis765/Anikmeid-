import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/jadwal")({
  component: () => (
    <AppShell>
      <header className="px-4 py-4"><h1 className="text-2xl font-black">Jadwal Anime</h1></header>
      <div className="space-y-3 px-4">
        {["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(d => (
          <div key={d} className="rounded-2xl bg-card p-4">
            <div className="font-bold">{d}</div>
            <div className="mt-1 text-xs text-muted-foreground">Jadwal dimuat dari sumber API.</div>
          </div>
        ))}
      </div>
    </AppShell>
  ),
});
