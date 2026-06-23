import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Shield, Megaphone, Hammer, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, useSessionUser } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const { data: role, isLoading } = useMyRole();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
        <Shield className="h-10 w-10 text-destructive" />
        <p>Akses ditolak.</p>
        <button onClick={() => navigate({ to: "/" })} className="rounded-full bg-accent px-4 py-2">Kembali</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold">Panel {role === "owner" ? "Owner" : "Admin"}</h1>
      </header>

      <div className="space-y-4 px-4">
        <BanCard />
        <GiftPremiumCard />
        <NotifCard userId={user!.id} />
      </div>
    </div>
  );
}

function GiftPremiumCard() {
  const [num, setNum] = useState("");
  const [days, setDays] = useState("30");
  const [months, setMonths] = useState("0");
  const [years, setYears] = useState("0");

  async function gift() {
    const totalDays = Number(days || 0) + Number(months || 0) * 30 + Number(years || 0) * 365;
    if (!num || totalDays <= 0) return toast.error("Isi ID dan durasi");
    const { data: prof } = await supabase.from("profiles").select("id,display_name").eq("user_number", Number(num)).maybeSingle();
    if (!prof) return toast.error("ID tidak ditemukan");
    const { data, error } = await supabase.rpc("grant_premium", { _target_user: prof.id, _days: totalDays });
    if (error) return toast.error(error.message);
    toast.success(`Premium ${prof.display_name} aktif sampai ${new Date(data as string).toLocaleDateString("id-ID")}`);
    setNum(""); setDays("30"); setMonths("0"); setYears("0");
  }

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><Gift className="h-5 w-5 shiny-purple-icon" /> Gift Premium</div>
      <input value={num} onChange={e => setNum(e.target.value.replace(/\D/g, ""))} placeholder="ID user (nomor)" className="mb-2 w-full rounded-xl bg-accent px-3 py-2 text-sm" />
      <div className="mb-2 grid grid-cols-3 gap-2">
        <label className="text-xs">Hari<input type="number" min="0" value={days} onChange={e => setDays(e.target.value)} className="mt-1 w-full rounded-xl bg-accent px-3 py-2 text-sm" /></label>
        <label className="text-xs">Bulan<input type="number" min="0" value={months} onChange={e => setMonths(e.target.value)} className="mt-1 w-full rounded-xl bg-accent px-3 py-2 text-sm" /></label>
        <label className="text-xs">Tahun<input type="number" min="0" value={years} onChange={e => setYears(e.target.value)} className="mt-1 w-full rounded-xl bg-accent px-3 py-2 text-sm" /></label>
      </div>
      <button onClick={gift} className="w-full rounded-full bg-purple-500 py-2 font-bold text-background">Beri Premium</button>
    </div>
  );
}


function BanCard() {
  const [num, setNum] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("permanent");
  const [amount, setAmount] = useState("1");

  async function doBan() {
    if (!num || !reason) return toast.error("Isi ID dan alasan");
    const { data: prof } = await supabase.from("profiles").select("id,display_name").eq("user_number", Number(num)).maybeSingle();
    if (!prof) return toast.error("ID tidak ditemukan");
    let expires: string | null = null;
    if (duration !== "permanent") {
      const n = Number(amount);
      const ms = { minute: 60e3, hour: 3600e3, day: 86400e3, month: 2592000e3, year: 31536000e3 }[duration as "minute"] ?? 0;
      expires = new Date(Date.now() + n * ms).toISOString();
    }
    const { error } = await supabase.from("bans").insert({ user_id: prof.id, reason, expires_at: expires });
    if (error) return toast.error(error.message);
    toast.success(`User ${prof.display_name} di-ban`);
    setNum(""); setReason("");
  }

  async function unban() {
    if (!num) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("user_number", Number(num)).maybeSingle();
    if (!prof) return toast.error("ID tidak ditemukan");
    const { error } = await supabase.from("bans").delete().eq("user_id", prof.id);
    if (error) return toast.error(error.message);
    toast.success("Unban berhasil");
  }

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><Hammer className="h-5 w-5 text-destructive" /> Ban User</div>
      <input value={num} onChange={e => setNum(e.target.value.replace(/\D/g, ""))} placeholder="ID user (nomor)" className="mb-2 w-full rounded-xl bg-accent px-3 py-2 text-sm" />
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan ban" className="mb-2 w-full rounded-xl bg-accent px-3 py-2 text-sm" />
      <div className="mb-2 flex gap-2">
        <select value={duration} onChange={e => setDuration(e.target.value)} className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm">
          <option value="minute">Menit</option><option value="hour">Jam</option><option value="day">Hari</option>
          <option value="month">Bulan</option><option value="year">Tahun</option><option value="permanent">Permanen</option>
        </select>
        {duration !== "permanent" && (
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-24 rounded-xl bg-accent px-3 py-2 text-sm" />
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={doBan} className="flex-1 rounded-full bg-destructive py-2 font-bold text-destructive-foreground">Ban</button>
        <button onClick={unban} className="rounded-full bg-accent px-4 py-2 font-bold">Unban</button>
      </div>
    </div>
  );
}

function NotifCard({ userId }: { userId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  async function send() {
    if (!title || !body) return toast.error("Isi judul dan isi");
    const { error } = await supabase.from("notifications").insert({ title, body, created_by: userId });
    if (error) return toast.error(error.message);
    toast.success("Notifikasi dikirim ke semua user");
    setTitle(""); setBody("");
  }
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><Megaphone className="h-5 w-5 text-brand" /> Kirim Notifikasi Global</div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul (cth: Maintenance)" className="mb-2 w-full rounded-xl bg-accent px-3 py-2 text-sm" />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Isi pesan" rows={3} className="mb-2 w-full rounded-xl bg-accent px-3 py-2 text-sm" />
      <button onClick={send} className="w-full rounded-full bg-brand py-2 font-bold text-background">Kirim ke semua</button>
    </div>
  );
}
