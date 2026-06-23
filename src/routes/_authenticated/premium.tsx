import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Crown, Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useMyProfile, isPremium } from "@/hooks/use-auth";
import { isPremiumActive } from "@/components/user-badge";

export const Route = createFileRoute("/_authenticated/premium")({
  component: PremiumPage,
});

const DANA_NUMBER = "087769840134";
const PRICE = 5000;

function PremiumPage() {
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const active = isPremium(me);

  const waText = encodeURIComponent(
    `Halo Developer Anikme!\n\nSaya mau beli PREMIUM Rp${PRICE.toLocaleString("id-ID")}.\n\nID saya: #${me?.user_number}\nNama: ${me?.display_name}\n\nSudah transfer ke DANA ${DANA_NUMBER}. Mohon aktifkan premium saya 🙏`,
  );

  return (
    <div className="min-h-screen pb-12">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-bold">Beli Premium</h1>
      </header>

      <div className="space-y-4 px-4">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/60 via-purple-700/40 to-fuchsia-900/60 p-6 text-center">
          <Crown className="mx-auto h-12 w-12 shiny-purple-icon" />
          <h2 className="mt-2 text-2xl shiny-purple font-black">ANIKME PREMIUM</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nama & centang berkilau ungu di chat global</p>
          <div className="mt-4 text-4xl font-black">Rp{PRICE.toLocaleString("id-ID")}</div>
          <div className="text-xs text-muted-foreground">/ 30 hari</div>
          {active && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
              <Check className="h-3 w-3" /> Aktif sampai {new Date(me!.premium_until!).toLocaleDateString("id-ID")}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-card p-4">
          <h3 className="mb-2 font-bold">Keuntungan Premium</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-brand mt-0.5" /> Nama & centang ungu berkilau di chat</li>
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-brand mt-0.5" /> Badge ★ Premium di profil</li>
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-brand mt-0.5" /> Dukung server agar tetap gratis untuk semua</li>
          </ul>
        </div>

        <div className="rounded-3xl bg-card p-4">
          <h3 className="mb-3 font-bold">Cara Pembayaran</h3>
          <ol className="space-y-3 text-sm">
            <li>
              <div className="text-muted-foreground">1. Transfer Rp{PRICE.toLocaleString("id-ID")} ke DANA:</div>
              <div className="mt-1 flex items-center gap-2 rounded-2xl bg-accent px-3 py-2">
                <span className="flex-1 font-mono text-base font-bold">{DANA_NUMBER}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(DANA_NUMBER); toast.success("Nomor DANA disalin"); }}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-background"
                >
                  <Copy className="inline h-3 w-3" /> Salin
                </button>
              </div>
            </li>
            <li>
              <div className="text-muted-foreground">2. Kirim bukti + ID kamu (#{me?.user_number}) lewat WhatsApp ke Developer:</div>
              <a
                href={`https://wa.me/62${DANA_NUMBER.replace(/^0/, "")}?text=${waText}`}
                target="_blank" rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-emerald-500 py-3 font-bold text-background"
              >
                <MessageCircle className="h-4 w-4" /> Hubungi via WhatsApp
              </a>
            </li>
            <li className="text-muted-foreground">3. Premium otomatis aktif setelah Developer konfirmasi (biasanya {"<"} 5 menit).</li>
          </ol>
        </div>

        <p className="px-2 text-center text-xs text-muted-foreground">
          ID kamu: <span className="font-bold text-foreground">#{me?.user_number}</span> · Jangan kirim ke nomor lain selain {DANA_NUMBER}.
        </p>
      </div>
    </div>
  );
}

export { isPremiumActive };
