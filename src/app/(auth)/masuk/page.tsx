import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/store/auth-forms";
import { Alert } from "@/components/ui/feedback";
import { getViewer } from "@/server/auth/guard";
import { getCurrentSession } from "@/server/auth/session";
import { discordLoginAvailable } from "@/server/auth/discord";
import { safeNext, safeNextForRole } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };

const DISCORD_MESSAGE: Record<string, { tone: "info" | "warning" | "danger"; text: string }> = {
  unavailable: { tone: "warning", text: "Login Discord belum aktif. Gunakan email dan password." },
  unlinked: {
    tone: "info",
    text: "Akun Discord itu belum tertaut. Masuk dulu dengan password, lalu hubungkan Discord dari menu Keamanan.",
  },
  denied: { tone: "info", text: "Kamu membatalkan izin Discord. Tidak ada yang berubah." },
  invalid: { tone: "danger", text: "Sesi login Discord kedaluwarsa. Coba lagi." },
  failed: { tone: "danger", text: "Login Discord gagal. Coba lagi atau gunakan email dan password." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; discord?: string }> }) {
  const { next, discord } = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(safeNextForRole(next, viewer.user.role));
  const current = await getCurrentSession();
  if (current?.user.totpEnabledAt && !current.session.mfaSatisfiedAt) {
    redirect(`/masuk/2fa?next=${encodeURIComponent(safeNextForRole(next, current.user.role))}`);
  }
  const discordReady = await discordLoginAvailable();
  const message = discord ? DISCORD_MESSAGE[discord] : undefined;

  return (
    <div>
      <p className="eyebrow">Akun</p>
      <h1 className="mt-2 font-display text-[30px] leading-tight text-ink">Masuk ke CipiSMP</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        Email atau username toko, lalu password. Kalau 2FA aktif, kamu akan diminta kode 6 digit.
      </p>
      {message ? (
        <div className="mt-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      ) : null}
      <div className="mt-7">
        <LoginForm next={safeNext(next)} />
      </div>
      {discordReady ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-3 text-2xs uppercase tracking-wider text-muted-2">
            <span className="h-px flex-1 bg-line" aria-hidden />
            atau
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
          <a
            href={`/api/auth/discord?next=${encodeURIComponent(safeNext(next))}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-[#5865F2] text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.4 0 12.6 12.6 0 0 0-.62-1.25.07.07 0 0 0-.08-.04 19.7 19.7 0 0 0-4.93 1.52.06.06 0 0 0-.03.03C.59 9.27-.34 13.99.11 18.66a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6.05 3.06.08.08 0 0 0 .08-.03c.47-.64.88-1.32 1.23-2.03a.08.08 0 0 0-.04-.11 13.2 13.2 0 0 1-1.87-.89.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08 0 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.29a.08.08 0 0 1 0 .13 12.4 12.4 0 0 1-1.87.89.08.08 0 0 0-.04.11c.36.71.77 1.39 1.23 2.03a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.06-3.06.08.08 0 0 0 .03-.05c.54-5.4-.89-10.08-3.76-14.26a.06.06 0 0 0-.03-.03ZM8.02 15.73c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.41 0-1.33.95-2.41 2.15-2.41 1.21 0 2.17 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41Z" />
            </svg>
            Masuk dengan Discord
          </a>
          <p className="mt-2 text-center text-2xs text-muted-2">
            Hanya untuk akun yang sudah menautkan Discord. Belum menautkan? Masuk dengan password lalu buka menu Keamanan.
          </p>
        </div>
      ) : null}
    </div>
  );
}
