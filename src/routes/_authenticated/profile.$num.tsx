import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Users, Lock, Infinity as InfinityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, UserName, isPremiumActive } from "@/components/user-badge";
import { useSessionUser, xpToLevel } from "@/hooks/use-auth";
import { toast } from "sonner";
import { timeAgo } from "@/lib/time";
import goldenApple from "@/assets/golden-apple.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/profile/$num")({
  component: ProfilePage,
});

function ProfilePage() {
  const { num } = useParams({ from: "/_authenticated/profile/$num" });
  const { user } = useSessionUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"comments" | "favorite" | "history">("comments");

  const { data: profile } = useQuery({
    queryKey: ["profile", num],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_number", Number(num)).maybeSingle();
      if (!data) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.id);
      const rs = (roles ?? []).map(r => r.role as string);
      const role = rs.includes("owner") ? "owner" : rs.includes("admin") ? "admin" : "member";
      return { ...data, role: role as "owner" | "admin" | "member" };
    },
  });

  const isOwner = profile?.role === "owner";

  const { data: history } = useQuery({
    queryKey: ["p-history", profile?.id, tab],
    enabled: !!profile && tab === "history" && !isOwner,
    queryFn: async () => {
      const { data } = await supabase.from("watch_history").select("*").eq("user_id", profile!.id).order("watched_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ["p-fav", profile?.id, tab],
    enabled: !!profile && tab === "favorite" && !isOwner,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  if (!profile) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat profil...</div>;

  const isMe = user?.id === profile.id;
  const isPrivate = profile.is_private && !isMe;
  const premium = isPremiumActive(profile.premium_until);
  const level = isOwner ? "∞" : xpToLevel(profile.xp);
  const daysJoined = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);

  function copy(text: string | null, label: string) {
    if (isOwner && !isMe) {
      toast.error("⚠️ Foto / banner Developer tidak bisa disalin.");
      return;
    }
    if (!text) return toast.error("Belum ada " + label);
    navigator.clipboard.writeText(text); toast.success(label + " disalin");
  }

  const InfOr = ({ n }: { n: number }) => (isOwner ? <span className="inline-flex items-center"><InfinityIcon className="h-6 w-6" /></span> : <>{n}</>);
  const LevelIcon = () => isOwner
    ? <img src={goldenApple.url} alt="∞" className="inline-block h-4 w-4 rounded-sm" style={{ imageRendering: "pixelated" }} />
    : <span>📦</span>;

  return (
    <div className="min-h-screen pb-12">
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/" })} className="grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
        {isMe && <Link to="/settings" className="rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur">Edit</Link>}
      </header>

      <div className="relative h-48 w-full bg-accent">
        {profile.banner_url && <img src={profile.banner_url} alt="banner" className="h-full w-full object-cover" />}
        {profile.tag && (
          <div className="absolute left-3 top-16 rounded-xl bg-black/40 px-3 py-1.5 text-sm backdrop-blur">
            👑 <span className="text-brand">[{profile.tag}]</span> {profile.display_name}
          </div>
        )}
        {/* Avatar pushed to the right so it doesn't cover the banner */}
        <div className="absolute -bottom-12 right-4">
          <Avatar url={profile.avatar_url} name={profile.display_name} size={100} />
        </div>
      </div>

      <div className="mt-16 px-4 text-center">
        <div className="flex items-center justify-center">
          <UserName name={profile.display_name} tag={profile.tag} role={profile.role} premium={premium} link={false} />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1.5 text-sm">#{profile.user_number}</span>
          <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm"><LevelIcon /> Lvl. {level}</span>
          <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm"><Users className="h-3.5 w-3.5" /> {isOwner ? "∞" : 0}</span>
          {premium && !isOwner && (
            <span className="rounded-full bg-yellow-500/20 px-3 py-1.5 text-sm shiny-gold">★ Premium</span>
          )}
        </div>
        {profile.bio && <p className="mt-3 text-sm text-muted-foreground">{profile.bio}</p>}

        {!isOwner && (
          <div className="mt-4 flex justify-center gap-2 text-xs">
            {profile.avatar_url && <button onClick={() => copy(profile.avatar_url, "URL foto profil")} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5"><Copy className="h-3 w-3" /> Salin Foto</button>}
            {profile.banner_url && <button onClick={() => copy(profile.banner_url, "URL banner")} className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5"><Copy className="h-3 w-3" /> Salin Banner</button>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-4 gap-1 text-center">
          <Stat value={isOwner ? <InfinityIcon className="mx-auto h-6 w-6" /> : <>{daysJoined}</>} label="hari bergabung" />
          <Stat value={<InfOr n={0} />} label="jumlah komentar" />
          <Stat value={<InfOr n={profile.watch_minutes ? Math.max(1, Math.floor(profile.watch_minutes / 23)) : 0} />} label="jumlah riwayat" />
          <Stat value={<InfOr n={profile.watch_minutes} />} label="menit tontonan" />
        </div>
      </div>

      {isOwner && !isMe ? (
        <div className="mt-10 flex flex-col items-center gap-3 px-4 text-center">
          <InfinityIcon className="h-10 w-10 text-premium" />
          <p className="shiny-gold text-lg font-bold">Developer Akses Penuh</p>
          <p className="text-sm text-muted-foreground">Komentar, favorit, dan history Developer bersifat unlimited & privat.</p>
          <div className="mt-2 grid w-full max-w-sm grid-cols-3 gap-2">
            <UnlimitedCard label="Komentar" />
            <UnlimitedCard label="Favorit" />
            <UnlimitedCard label="History" />
          </div>
        </div>
      ) : isPrivate ? (
        <div className="mt-10 flex flex-col items-center gap-3 px-4 text-center text-muted-foreground">
          <Lock className="h-8 w-8" />
          <p>Profil ini private.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex border-b border-border">
            {(["comments", "favorite", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm capitalize ${tab === t ? "border-b-2 border-brand font-bold text-brand" : "text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
          <div className="px-4 py-4">
            {tab === "history" && (history ?? []).map(h => (
              <div key={h.id} className="border-b border-border py-3">
                <div className="text-sm font-bold">{h.anime_title}</div>
                {h.episode && <div className="text-xs text-muted-foreground">{h.episode}</div>}
                <div className="text-[10px] text-muted-foreground">{timeAgo(h.watched_at)}</div>
              </div>
            ))}
            {tab === "favorite" && (favorites ?? []).map(f => (
              <div key={f.id} className="border-b border-border py-3 text-sm">{f.anime_title}</div>
            ))}
            {tab === "comments" && <div className="py-8 text-center text-sm text-muted-foreground">Belum ada komentar.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function UnlimitedCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3">
      <InfinityIcon className="h-5 w-5 shiny-gold-icon" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="shiny-gold text-sm font-bold">Unlimited</div>
    </div>
  );
}
