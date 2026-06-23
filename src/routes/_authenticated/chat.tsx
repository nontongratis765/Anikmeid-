import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Trash2, Gift, X, Reply, Pencil, Check, Sparkles, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser, useMyProfile, useMyRole, useMyBan, xpToLevel, isPremium } from "@/hooks/use-auth";
import { Avatar, UserName } from "@/components/user-badge";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Msg = {
  id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
};

type GiftRow = {
  id: string;
  sender_id: string;
  days: number;
  message: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

function ChatPage() {
  const { user } = useSessionUser();
  const { data: me } = useMyProfile();
  const { data: role } = useMyRole();
  const { data: ban } = useMyBan();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: messages = [] } = useQuery({
    queryKey: ["chat"],
    queryFn: async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200);
      return (data ?? []) as Msg[];
    },
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("premium_gifts").select("*").order("created_at", { ascending: true }).limit(100);
      return (data ?? []) as GiftRow[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    messages.forEach(m => s.add(m.user_id));
    gifts.forEach(g => { s.add(g.sender_id); if (g.claimed_by) s.add(g.claimed_by); });
    return Array.from(s);
  }, [messages, gifts]);

  const { data: profiles = {} } = useQuery({
    queryKey: ["chat-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,display_name,avatar_url,user_number,tag,premium_until,xp").in("id", userIds);
      const { data: roles } = await supabase.from("user_roles").select("user_id,role").in("user_id", userIds);
      const roleMap: Record<string, "owner" | "admin" | "member"> = {};
      (roles ?? []).forEach(r => {
        const cur = roleMap[r.user_id];
        if (!cur || r.role === "owner" || (r.role === "admin" && cur === "member")) roleMap[r.user_id] = r.role;
      });
      const map: Record<string, any> = {};
      (data ?? []).forEach(p => {
        const premium = !!p.premium_until && new Date(p.premium_until).getTime() > Date.now();
        map[p.id] = { ...p, role: roleMap[p.id] ?? "member", premium };
      });
      return map;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("chat-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => qc.invalidateQueries({ queryKey: ["chat"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "premium_gifts" }, () => qc.invalidateQueries({ queryKey: ["gifts"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, gifts.length]);

  async function send() {
    if (!text.trim() || !user) return;
    if (ban) { toast.error("Kamu sedang dibanned: " + ban.reason); return; }
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, content, reply_to: replyTo?.id ?? null });
    if (error) { toast.error(error.message); setText(content); return; }
    setReplyTo(null);
    await supabase.from("profiles").update({ xp: (me?.xp ?? 0) + 2 }).eq("id", user.id);
  }

  async function deleteMsg(id: string) {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  async function saveEdit(id: string) {
    const t = editText.trim();
    if (!t) return;
    const { error } = await supabase.rpc("edit_chat_message", { _msg_id: id, _new_content: t });
    if (error) { toast.error(error.message); return; }
    setEditingId(null); setEditText("");
    qc.invalidateQueries({ queryKey: ["chat"] });
  }

  // Merge messages + gifts as a single timeline
  const timeline = useMemo(() => {
    const items: Array<{ kind: "msg"; data: Msg } | { kind: "gift"; data: GiftRow }> = [
      ...messages.map(m => ({ kind: "msg" as const, data: m })),
      ...gifts.map(g => ({ kind: "gift" as const, data: g })),
    ];
    items.sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());
    return items;
  }, [messages, gifts]);

  async function claimGift(giftId: string) {
    const { error } = await supabase.rpc("claim_premium_gift", { _gift_id: giftId });
    if (error) { toast.error(error.message); return; }
    toast.success("Gift premium diklaim! 🎉");
    qc.invalidateQueries({ queryKey: ["gifts"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  const myPremium = isPremium(me);
  const myRole = role ?? "member";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">Chat Public</h1>
        <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Online</span>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-6">
        {timeline.map((item) => {
          if (item.kind === "gift") {
            const g = item.data;
            const sender = profiles[g.sender_id];
            const claimer = g.claimed_by ? profiles[g.claimed_by] : null;
            const isClaimed = !!g.claimed_by;
            const isMine = g.sender_id === user?.id;
            return (
              <div key={"g" + g.id} className="mx-auto max-w-sm rounded-2xl border border-premium/40 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 p-3 text-center">
                <div className="mb-1 flex items-center justify-center gap-2 text-xs text-premium">
                  <Gift className="h-4 w-4" />
                  <span className="font-bold">GIFT PREMIUM</span>
                </div>
                {sender && (
                  <div className="text-xs text-muted-foreground">
                    Dari <UserName name={sender.display_name} tag={sender.tag} userNumber={sender.user_number} role={sender.role} premium={sender.premium} />
                  </div>
                )}
                {g.message && <p className="mt-1 text-sm italic">"{g.message}"</p>}
                <div className="mt-2 text-lg font-black shiny-gold">{g.days} hari premium</div>
                {isClaimed ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    ✅ Sudah diklaim oleh{" "}
                    {claimer ? (
                      <span className="font-bold">{claimer.display_name}</span>
                    ) : "seseorang"}
                  </div>
                ) : isMine ? (
                  <div className="mt-2 text-xs text-muted-foreground">Menunggu yang beruntung mengklaim...</div>
                ) : (
                  <button onClick={() => claimGift(g.id)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-premium px-4 py-1.5 text-xs font-bold text-background">
                    <Ticket className="h-3.5 w-3.5" /> KLAIM
                  </button>
                )}
              </div>
            );
          }

          const m = item.data;
          const p = profiles[m.user_id];
          if (!p) return null;
          const replied = m.reply_to ? messages.find(x => x.id === m.reply_to) : null;
          const repliedP = replied ? profiles[replied.user_id] : null;
          const isMe = m.user_id === user?.id;
          const lvl = p.role === "owner" ? "∞" : xpToLevel(p.xp ?? 0);
          const roleLabel = p.role === "owner" ? "DEV" : p.role === "admin" ? "ADMIN" : p.premium ? "PREMIUM" : "MEMBER";

          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <Link to="/profile/$num" params={{ num: String(p.user_number) }}>
                <Avatar url={p.avatar_url} name={p.display_name} size={32} />
              </Link>
              <div className={`max-w-[78%] rounded-2xl p-3 ${isMe ? "rounded-br-sm bg-brand/15" : "rounded-bl-sm bg-card"}`}>
                {replied && repliedP && (
                  <div className="mb-2 border-l-2 border-brand pl-2 text-xs">
                    <div className="font-bold text-brand">{repliedP.display_name}</div>
                    <div className="truncate text-muted-foreground">{replied.content}</div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <UserName name={p.display_name} tag={p.tag} userNumber={p.user_number} role={p.role} premium={p.premium} />
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold">Lv.{lvl}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    p.role === "owner" ? "bg-purple-500/30 text-purple-300"
                    : p.role === "admin" ? "bg-purple-500/30 text-purple-300"
                    : p.premium ? "bg-yellow-500/25 text-yellow-300"
                    : "bg-accent text-muted-foreground"
                  }`}>{roleLabel}</span>
                </div>

                {editingId === m.id ? (
                  <div className="mt-1 flex gap-1">
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveEdit(m.id)}
                      autoFocus
                      className="flex-1 rounded bg-background px-2 py-1 text-sm outline-none"
                    />
                    <button onClick={() => saveEdit(m.id)} className="rounded bg-brand p-1 text-background"><Check className="h-4 w-4" /></button>
                    <button onClick={() => { setEditingId(null); setEditText(""); }} className="rounded bg-accent p-1"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.content}</p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                  <span>{timeAgo(m.created_at)}{m.edited_at && " · diedit"}</span>
                  <button onClick={() => setReplyTo(m)} className="hover:text-foreground"><Reply className="h-3 w-3" /></button>
                  {isMe && editingId !== m.id && (
                    <button onClick={() => { setEditingId(m.id); setEditText(m.content); }} className="hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  )}
                  {(isMe || myRole === "owner" || myRole === "admin") && (
                    <button onClick={() => deleteMsg(m.id)} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {timeline.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Chat kosong. Mulai obrolan! (auto reset tiap 24 jam)</div>}
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-accent/50 px-4 py-2 text-xs">
          <Reply className="h-3 w-3 text-brand" />
          <span className="flex-1 truncate">Membalas: {replyTo.content}</span>
          <button onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-3">
        {me && <Avatar url={me.avatar_url} name={me.display_name} size={36} />}
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={ban ? "Kamu di-ban" : "Ketik pesan..."}
          disabled={!!ban}
          className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          onClick={() => setGiftOpen(true)}
          title="Gift Premium"
          className="grid h-10 w-10 place-items-center rounded-full bg-premium text-background"
        >
          <Gift className="h-5 w-5" />
        </button>
        <button onClick={send} disabled={!text.trim() || !!ban} className="grid h-10 w-10 place-items-center rounded-full bg-brand text-background disabled:opacity-50">
          <Send className="h-5 w-5" />
        </button>
      </div>

      {giftOpen && (
        <GiftModal
          onClose={() => setGiftOpen(false)}
          canSend={myPremium || myRole === "owner"}
          isDev={myRole === "owner"}
        />
      )}
    </div>
  );
}

function GiftModal({ onClose, canSend, isDev }: { onClose: () => void; canSend: boolean; isDev: boolean }) {
  const [days, setDays] = useState<number>(5);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  async function submit() {
    if (!canSend) { toast.error("Kamu belum premium, tidak bisa gift premium"); return; }
    if (days <= 0) { toast.error("Jumlah hari harus > 0"); return; }
    setSending(true);
    const { error } = await supabase.rpc("send_premium_gift", { _days: days, _message: msg });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Gift ${days} hari premium terkirim! 🎁`);
    qc.invalidateQueries({ queryKey: ["gifts"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    onClose();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[280px] rounded-2xl border border-yellow-500/40 bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold shiny-gold"><Gift className="h-4 w-4" /> Gift Premium</h3>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {!canSend ? (
          <div className="space-y-3 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Kamu harus premium dulu untuk bisa kirim gift premium ke member beruntung.</p>
            <Link to="/premium" onClick={onClose} className="inline-block rounded-full bg-premium px-5 py-2 text-sm font-bold text-background">Beli Premium</Link>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {isDev ? "Sebagai developer, kamu unlimited — hari premium tidak dikurangi." : "Hari yang kamu kirim akan dikurangi dari sisa premium-mu."}
            </p>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Jumlah hari</label>
            <div className="mt-1 mb-3 flex flex-wrap gap-2">
              {[5, 10, 15, 30].map(d => (
                <button key={d} onClick={() => setDays(d)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${days === d ? "bg-premium text-background" : "bg-accent"}`}>{d}h</button>
              ))}
              <input
                type="number"
                min={1}
                value={days}
                onChange={e => setDays(Math.max(1, parseInt(e.target.value || "0")))}
                className="w-24 rounded-full bg-accent px-3 py-1.5 text-sm outline-none"
              />
            </div>

            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pesan</label>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value.slice(0, 200))}
              placeholder="Untuk yang beruntung..."
              className="mt-1 mb-3 h-20 w-full resize-none rounded-xl bg-accent px-3 py-2 text-sm outline-none"
            />

            <button onClick={submit} disabled={sending} className="w-full rounded-full bg-premium py-2.5 text-sm font-bold text-background disabled:opacity-50">
              {sending ? "Mengirim..." : `Kirim Gift ${days} Hari`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
