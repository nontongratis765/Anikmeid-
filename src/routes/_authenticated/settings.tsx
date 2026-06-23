import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, LogOut, Lock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRole, xpToLevel, isPremium } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me, refetch } = useMyProfile();
  const { data: role } = useMyRole();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [banner, setBanner] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [tag, setTag] = useState("");
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.display_name); setBanner(me.banner_url ?? ""); setAvatar(me.avatar_url ?? "");
      setBio(me.bio ?? ""); setTag(me.tag ?? ""); setPriv(me.is_private);
    }
  }, [me]);

  if (!me) return <div className="flex min-h-screen items-center justify-center">Memuat...</div>;
  const isDev = role === "owner" || role === "admin";
  const premium = isPremium(me) || isDev;
  const canEditPremium = premium; // banner / name / privasi = fitur premium
  const level = isDev ? "∞" : xpToLevel(me.xp);
  const nextLevelXp = (Number(level) || 1) * (Number(level) || 1) * 10;
  const lvl = Number(level) || 1;
  const progress = isDev ? 100 : Math.min(100, Math.round(((me.xp - (lvl - 1) ** 2 * 10) / Math.max(1, nextLevelXp - (lvl - 1) ** 2 * 10)) * 100));

  // Premium remaining
  let premiumLabel = "Belum premium";
  if (isDev) premiumLabel = "Unlimited (Developer)";
  else if (me.premium_until) {
    const ms = new Date(me.premium_until).getTime() - Date.now();
    if (ms > 0) {
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const yrs = new Date(me.premium_until).getFullYear();
      premiumLabel = yrs >= 9000 ? "Unlimited" : `${days} hari ${hours} jam lagi`;
    }
  }

  async function save() {
    if (!me) return;
    if (/lordbye/i.test(name) && !isDev) {
      toast.error("⚠️ Nama 'Lordbye' adalah nama developer. Tidak boleh dipakai.");
      return;
    }
    const update: any = { bio };
    if (canEditPremium) {
      update.display_name = name;
      update.banner_url = banner || null;
      update.avatar_url = avatar || null;
      update.tag = tag || null;
      update.is_private = priv;
    } else {
      update.avatar_url = avatar || null; // foto profil tetap boleh
    }
    const { error } = await supabase.from("profiles").update(update).eq("id", me.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tersimpan");
    refetch();
  }

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-2xl font-bold">Pengaturan</h1>
        <button onClick={signOut} className="text-destructive"><LogOut className="h-5 w-5" /></button>
      </header>

      <div className="space-y-4 px-4">
        <div className="rounded-3xl bg-card p-4">
          <div className="flex items-center gap-3">
            {avatar ? <img src={avatar} className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-accent" />}
            <div>
              <div className="font-bold">{me.display_name} {tag && <span className="text-brand text-xs">[{tag}]</span>}</div>
              <div className="text-xs text-muted-foreground">{me.email}</div>
            </div>
          </div>
        </div>

        {/* Premium status */}
        <div className={`rounded-3xl p-4 ${premium ? "bg-gradient-to-br from-yellow-900/30 to-amber-700/20" : "bg-card"}`}>
          <div className="flex items-center gap-3">
            <Crown className={`h-6 w-6 ${premium ? "shiny-gold-icon" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <div className={`font-bold ${premium ? "shiny-gold" : ""}`}>Status Premium</div>
              <div className="text-xs text-muted-foreground">{premiumLabel}</div>
            </div>
            {!premium && <Link to="/premium" className="rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-bold text-background">Beli</Link>}
          </div>
        </div>

        <div className="rounded-3xl bg-card p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-xl bg-emerald-900/40 px-3 py-1.5 text-sm font-bold text-emerald-300">XP {isDev ? "∞" : me.xp}</span>
            <span className="rounded-xl bg-accent px-3 py-1.5 text-sm font-bold">📦 Lvl. {level}</span>
          </div>
          {!isDev && <div className="text-xs text-muted-foreground">{nextLevelXp - me.xp} XP ke level berikutnya — {progress}%</div>}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent">
            <div className="h-full bg-brand" style={{ width: progress + "%" }} />
          </div>
        </div>

        <h2 className="px-2 text-xs uppercase tracking-wide text-muted-foreground">Profil</h2>
        <div className="space-y-3 rounded-3xl bg-card p-4">
          <Field label="Nama profil" v={name} on={setName} locked={!canEditPremium} />
          <Field label="Tag (mis. LYL)" v={tag} on={setTag} locked={!canEditPremium} />
          <Field label="Avatar URL" v={avatar} on={setAvatar} />
          <Field label="Banner URL (gif ≤50MB OK)" v={banner} on={setBanner} locked={!canEditPremium} />
          <Field label="Bio" v={bio} on={setBio} />
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-bold flex items-center gap-1">Profil private {!canEditPremium && <Lock className="h-3 w-3 text-muted-foreground" />}</div>
              <div className="text-xs text-muted-foreground">Hanya kamu yang bisa lihat detail.</div>
            </div>
            <button
              onClick={() => canEditPremium ? setPriv(p => !p) : toast.error("Fitur Premium")}
              className={`h-7 w-12 rounded-full transition ${priv ? "bg-brand" : "bg-accent"} ${!canEditPremium ? "opacity-50" : ""}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white transition ${priv ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {!canEditPremium && (
            <p className="rounded-xl bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
              🔒 Ubah <b>nama</b>, <b>tag</b>, <b>banner</b>, dan <b>privasi</b> adalah fitur Premium.
              <Link to="/premium" className="ml-1 underline">Upgrade →</Link>
            </p>
          )}
        </div>

        <button onClick={save} className="w-full rounded-full bg-brand py-3 font-bold text-background">Simpan</button>
      </div>
    </div>
  );
}

function Field({ label, v, on, locked }: { label: string; v: string; on: (x: string) => void; locked?: boolean }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{label} {locked && <Lock className="h-3 w-3" />}</div>
      <input
        value={v}
        onChange={e => on(e.target.value)}
        disabled={locked}
        className="mt-1 w-full rounded-xl bg-accent px-3 py-2 text-sm outline-none disabled:opacity-50"
      />
    </label>
  );
}
