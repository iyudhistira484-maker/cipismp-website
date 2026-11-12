import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { profilesForUser } from "@/server/minecraft";
import { env } from "@/server/env";
import { MinecraftPanel } from "@/components/store/account-forms";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTimeWIB } from "@/lib/dates";
import { unlinkMinecraftAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Akun Minecraft", robots: { index: false, follow: false } };

export default async function MinecraftPage() {
  const viewer = await requireCustomer("/dashboard/minecraft");
  const profiles = await profilesForUser(viewer.user.id);

  return (
    <div>
      <p className="eyebrow">Akun Minecraft</p>
      <h1 className="mt-2 font-display text-h1 text-ink">Hubungkan akun Minecraft</h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
        Rank dan kit terikat ke UUID yang digunakan server. Login melalui LoginSecurity sebelum verifikasi.
        Pada server offline, perubahan nama dapat mengubah UUID dan memerlukan bantuan staf; jangan menganggap akses berpindah otomatis.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <MinecraftPanel />

        <div>
          <h2 className="font-display text-[16px] text-ink">Terhubung</h2>
          {profiles.length === 0 ? (
            <EmptyState
              className="mt-3"
              title="Belum ada akun"
              description="Mulai verifikasi untuk menghubungkan akun Minecraft pertamamu."
            />
          ) : (
            <ul className="dashboard-scroll mt-3 max-h-[30rem] space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Daftar akun Minecraft terhubung">
              {profiles.map((profile) => (
                <li key={profile.id} className="rounded-lg border border-line bg-surface/60 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-ink">{profile.displayName}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-muted-2">{profile.uuid}</p>
                      <p className="mt-1 text-2xs text-muted-2">
                        {profile.edition === "BEDROCK" ? "Bedrock" : "Java"}
                        {profile.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || profile.identityVerifiedVersion === 2)
                          ? ` · terverifikasi ${formatDateTimeWIB(profile.verifiedAt)} WIB`
                          : " · perlu verifikasi ulang"}
                      </p>
                    </div>
                    <Badge tone={profile.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || profile.identityVerifiedVersion === 2) ? "success" : "neutral"}>
                      {profile.verifiedAt && (env.MINECRAFT_LOOKUP_MODE !== "offline" || profile.identityVerifiedVersion === 2) ? "Aktif" : "Perlu verifikasi"}
                    </Badge>
                  </div>
                  <form action={unlinkMinecraftAction} className="mt-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Lepas tautan
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-lg border border-line bg-surface/40 p-4 text-2xs leading-relaxed text-muted-2">
            <p className="text-[12px] font-medium text-ink">Cara verifikasi</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Masukkan username Minecraft, lalu tekan Buat kode.</li>
              <li>Masuk ke server, selesaikan /login, lalu ketik <span className="font-mono text-[10px] text-ink">/verify KODE</span>.</li>
              <li>Server mengirim konfirmasi ke toko; halaman ini berubah otomatis setelah diperbarui.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
