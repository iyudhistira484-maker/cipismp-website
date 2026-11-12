import type { Viewer } from "@/server/auth/guard";
import { listSessions, deviceLabel } from "@/server/auth/session";
import { formatDateTimeWIB } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { AccountSecurityForms, TotpPanel, DeleteAccountPanel } from "@/components/store/account-forms";
import { revokeSessionAction, revokeAllOtherSessionsAction, unlinkDiscordAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { discordLoginAvailable } from "@/server/auth/discord";

export async function AccountSecurityContent({ viewer, params, basePath }: { viewer: Viewer; params: { "email-berubah"?: string; discord?: string }; basePath: "/admin/keamanan" | "/dashboard/keamanan" }) {
  if (viewer.user.role !== "CUSTOMER" && !viewer.user.totpEnabledAt) {
    return (
      <div className="space-y-6">
        <header><p className="eyebrow">Keamanan admin</p><h1 className="mt-2 font-display text-h1 text-ink">Aktifkan 2FA</h1></header>
        <Alert tone="warning">Demi keamanan, aktifkan 2FA sebelum menggunakan panel admin.</Alert>
        <TotpPanel enabled={false} isStaff />
      </div>
    );
  }
  const [sessions, discordRow, discordReady] = await Promise.all([
    listSessions(viewer.user.id, viewer.sessionId),
    db
      .select({ discordId: users.discordId, discordUsername: users.discordUsername })
      .from(users)
      .where(eq(users.id, viewer.user.id))
      .limit(1),
    discordLoginAvailable(),
  ]);
  const discord = discordRow[0] ?? { discordId: null, discordUsername: null };

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Keamanan</p>
        <h1 className="mt-2 font-display text-h1 text-ink">Akun dan sesi</h1>
        <p className="mt-2 text-[14px] text-muted">Ubah password, kelola sesi aktif, dan aktifkan 2FA.</p>
      </header>

      {params["email-berubah"] ? (
        <Alert tone="success" title="Email diperbarui">
          Alamat email baru sudah aktif. Verifikasi ulang diperlukan sebelum checkout dengan akun.
        </Alert>
      ) : null}

      {params.discord === "linked" ? (
        <Alert tone="success" title="Discord tertaut">
          Sekarang kamu bisa masuk memakai tombol Discord. 2FA (bila aktif) tetap diminta.
        </Alert>
      ) : null}
      {params.discord === "mfa-required" ? (
        <Alert tone="warning" title="Aktifkan 2FA lebih dulu">
          Staf wajib memakai 2FA sebelum bisa menautkan Discord. Aktifkan 2FA di bawah, lalu ulangi penautan.
        </Alert>
      ) : null}

      <AccountSecurityForms email={viewer.user.email} verified={Boolean(viewer.user.emailVerifiedAt)} />

      <section aria-labelledby="discord" className="rounded-lg border border-line p-4">
        <h2 id="discord" className="font-display text-h3 text-ink">Discord</h2>
        {discord.discordId ? (
          <div className="mt-2 space-y-3">
            <p className="text-[13.5px] text-muted">
              Tertaut sebagai <span className="text-ink">@{discord.discordUsername}</span>. Kamu bisa masuk dengan tombol
              Discord di halaman masuk.
            </p>
            <form action={unlinkDiscordAction}>
              <Button type="submit" variant="secondary" size="sm">Lepas tautan Discord</Button>
            </form>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-[13.5px] text-muted">
              {discordReady
                ? "Tautkan Discord agar bisa masuk tanpa password. Password tetap bisa dipakai kapan saja."
                : "Fitur login Discord belum dinyalakan admin, jadi penautan belum tersedia."}
            </p>
            {discordReady ? (
              <a
                href={`/api/auth/discord?next=${encodeURIComponent(basePath)}`}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#5865F2] px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Hubungkan Discord
              </a>
            ) : null}
          </div>
        )}
      </section>

      <TotpPanel enabled={Boolean(viewer.user.totpEnabledAt)} isStaff={viewer.user.role !== "CUSTOMER"} />

      <section aria-labelledby="sesi">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="sesi" className="font-display text-h3 text-ink">Sesi aktif</h2>
          <form action={revokeAllOtherSessionsAction}>
            <Button type="submit" variant="secondary" size="sm">Keluarkan semua sesi lain</Button>
          </form>
        </div>
        <ul className="dashboard-scroll mt-3 max-h-[30rem] divide-y divide-line overflow-y-auto rounded-lg border border-line" tabIndex={0} aria-label="Daftar sesi aktif">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[13.5px] text-ink">
                  {deviceLabel(session.userAgent)}
                  {session.current ? <Badge tone="accent" className="ml-2">Sesi ini</Badge> : null}
                </p>
                <p className="mt-0.5 text-2xs text-muted-2">
                  IP {session.ip ?? "—"} · terakhir aktif {formatDateTimeWIB(session.lastSeenAt)} WIB
                </p>
              </div>
              {!session.current ? (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Button type="submit" variant="ghost" size="sm">Keluarkan</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-2xs text-muted-2">
          Sesi otomatis berakhir setelah 120 menit tidak aktif. Login "ingat saya" berlaku hingga 30 hari.
        </p>
      </section>

      {viewer.user.role === "CUSTOMER" ? <DeleteAccountPanel /> : null}
    </div>
  );
}
