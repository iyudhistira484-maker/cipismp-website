import { requireStaff } from "@/server/auth/guard";
import { defaultServerRow } from "@/server/admin/queries";
import { getSettings } from "@/server/settings";
import { AdminPageHeader, Card } from "@/components/admin/shell";
import { ServerSettingsForm, TestServerButton } from "@/components/admin/admin-forms";

export const metadata = { title: "Server & plugin" };

export default async function AdminServerPage() {
  await requireStaff("settings.read");
  const [server, settings] = await Promise.all([defaultServerRow(), getSettings()]);

  return (
    <>
      <AdminPageHeader
        title="Server & plugin"
        description="Plugin companion menerima perintah bertanda tangan HMAC. RCON dipakai sebagai cadangan bila plugin tidak merespons."
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
                    pluginBaseUrl: server.pluginBaseUrl,
                    pluginSecretSet: Boolean(server.pluginSecret),
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
          <Card title="Uji koneksi">
            <div className="flex flex-wrap gap-2">
              <TestServerButton target="plugin" label="Uji plugin" />
              <TestServerButton target="rcon" label="Uji RCON (list)" />
            </div>
            <p className="mt-3 text-2xs leading-relaxed text-muted-2">
              Uji plugin memanggil <span className="font-mono">/cipismp/health</span> dengan signature. Uji RCON menjalankan
              perintah <span className="font-mono">list</span> untuk memastikan kredensial benar.
            </p>
          </Card>

          <Card title="Pemasangan plugin">
            <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-muted">
              <li>Build plugin: <span className="font-mono text-2xs">cd plugin &amp;&amp; ./gradlew build</span>.</li>
              <li>Salin JAR dari <span className="font-mono text-2xs">plugin/build/libs</span> ke <span className="font-mono text-2xs">plugins/</span>.</li>
              <li>Isi <span className="font-mono text-2xs">plugins/CipiStoreCompanion/config.yml</span>: website-url, shared-secret (sama dengan PLUGIN_SHARED_SECRET), http.port.</li>
              <li>Restart server, lalu uji koneksi di panel ini.</li>
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
