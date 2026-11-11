import { requireStaff } from "@/server/auth/guard";
import { defaultServerRow } from "@/server/admin/queries";
import { getSettings } from "@/server/settings";
import { AdminPageHeader, Card } from "@/components/admin/shell";
import { ServerSettingsForm, TestServerButton } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeWIB } from "@/lib/dates";

export const metadata = { title: "Server & plugin" };

export default async function AdminServerPage() {
  await requireStaff("settings.read");
  const [server, settings] = await Promise.all([defaultServerRow(), getSettings()]);
  const pluginOnline = Boolean(server?.pluginLastSeenAt && Date.now() - server.pluginLastSeenAt.getTime() <= 60_000);

  return (
    <>
      <AdminPageHeader
        title="Server & plugin"
        description="Plugin companion mengambil pengiriman dari website melalui polling HTTPS keluar. RCON tetap tersedia sebagai alternatif."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Pengaturan server default">
          <ServerSettingsForm
            server={
              server
                ? {
                    name: server.name,
                    javaHost: server.javaHost,
                    javaPort: server.javaPort,
                    bedrockHost: server.bedrockHost,
                    bedrockPort: server.bedrockPort,
                    deliveryMode: server.deliveryMode,
                    rconHost: server.rconHost,
                    rconPort: server.rconPort,
                    rconPasswordSet: Boolean(server.rconPassword),
                    statusApiUrl: server.statusApiUrl,
                  }
                : undefined
            }
          />
        </Card>

        <div className="space-y-4">
          <Card title="Status plugin">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={pluginOnline ? "success" : "warning"}>
                {pluginOnline ? "Terhubung" : "Belum terhubung"}
              </Badge>
              {server?.pluginVersion ? <span className="text-2xs text-muted">v{server.pluginVersion}</span> : null}
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-muted-2">
              {server?.pluginLastSeenAt
                ? `Check-in terakhir ${formatDateTimeWIB(server.pluginLastSeenAt)} WIB.`
                : "Belum ada check-in. Pastikan plugin terpasang, website-url benar, dan shared-secret cocok."}
              {" "}Plugin dianggap offline bila tidak check-in selama 60 detik.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <TestServerButton target="plugin" label="Cek status plugin" />
              <TestServerButton target="rcon" label="Uji RCON (list)" />
            </div>
          </Card>

          <Card title="Pemasangan plugin">
            <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-muted">
              <li>Build plugin: <span className="font-mono text-2xs">cd plugin &amp;&amp; ./gradlew build</span>.</li>
              <li>Salin JAR dari <span className="font-mono text-2xs">plugin/build/libs</span> ke folder <span className="font-mono text-2xs">plugins/</span>.</li>
              <li>Atur <span className="font-mono text-2xs">website-url</span> ke URL publik HTTPS toko dan <span className="font-mono text-2xs">shared-secret</span> sama dengan <span className="font-mono text-2xs">PLUGIN_SHARED_SECRET</span>.</li>
              <li>Plugin membuat koneksi keluar ke website; tidak perlu membuka port HTTP masuk di hosting Minecraft.</li>
              <li>Restart server, tunggu check-in, lalu periksa status plugin di panel ini.</li>
              <li>Pemain menghubungkan akun dengan <span className="font-mono text-2xs">/verify KODE</span> dari dashboard.</li>
            </ol>
          </Card>

          <Card title="Template perintah">
            <p className="text-2xs leading-relaxed text-muted-2">
              Placeholder yang didukung: <span className="font-mono">{"{player}"}</span>, <span className="font-mono">{"{uuid}"}</span>,{" "}
              <span className="font-mono">{"{season}"}</span>, <span className="font-mono">{"{rank}"}</span>,{" "}
              <span className="font-mono">{"{kitname}"}</span>. Freeze pembelian default: {settings.store.defaultFreezeDays} hari
              terakhir season.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
