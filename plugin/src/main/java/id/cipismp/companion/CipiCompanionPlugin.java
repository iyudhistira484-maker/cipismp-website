package id.cipismp.companion;

import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.util.List;
import java.util.logging.Level;

/**
 * Titik masuk plugin companion CipiSMP Store.
 *
 * Plugin ini punya dua peran:
 * 1. Menerima pengiriman rank/kit dari website (HMAC + timestamp + nonce) dan
 *    mengeksekusinya lewat LuckPerms/ konsol, dengan antrean lokal untuk pemain offline.
 * 2. Meneruskan `/verify <kode>` ke website agar akun Minecraft bisa dihubungkan.
 */
public final class CipiCompanionPlugin extends JavaPlugin {
    private static final List<String> PLACEHOLDER_SECRETS = List.of(
            "", "ganti-dengan-PLUGIN_SHARED_SECRET", "changeme");

    private HttpApi api;
    private QueueStore queue;
    private DeliveryService deliveries;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        reloadConfig();

        String secret = getConfig().getString("shared-secret", "").trim();
        String websiteUrl = getConfig().getString("website-url", "http://127.0.0.1:3000");
        int maxSkew = getConfig().getInt("http.max-skew-seconds", 300);
        String host = getConfig().getString("http.host", "127.0.0.1");
        int port = getConfig().getInt("http.port", 8081);

        queue = new QueueStore(this,
                getConfig().getString("queue.file", "pending-deliveries.yml"),
                getConfig().getInt("queue.max-per-player", 20));
        LuckPermsHook luckPerms = getConfig().getBoolean("luckperms.use-api", true) ? LuckPermsHook.tryHook(getLogger()) : null;
        deliveries = new DeliveryService(this, queue, luckPerms);

        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this, deliveries), this);

        boolean secretValid = secret.length() >= 16 && !PLACEHOLDER_SECRETS.contains(secret);
        if (!secretValid) {
            getLogger().severe("shared-secret belum diisi (minimal 16 karakter). Endpoint pengiriman dan "
                    + "/verify dinonaktifkan sampai config.yml diperbaiki. Nilai ini harus sama dengan "
                    + "PLUGIN_SHARED_SECRET di .env website.");
            disableManagementCommands();
            return;
        }

        VerifyService verifyService = new VerifyService(this, websiteUrl, secret, getConfig().getInt("verify.timeout-seconds", 10));
        registerCommand("verify", new VerifyCommand(this, verifyService));
        registerCommand("cipistore", new AdminCommand(this, queue, deliveries));

        if (port <= 0) {
            getLogger().severe("http.port tidak valid; endpoint pengiriman tidak dijalankan.");
            return;
        }
        api = new HttpApi(this, secret, maxSkew, new NonceCache(maxSkew * 1000L), deliveries);
        try {
            api.start(host, port);
        } catch (IOException e) {
            getLogger().log(Level.SEVERE, "Gagal membuka port " + host + ":" + port
                    + " — kemungkinan dipakai plugin lain atau firewall.", e);
        }

        if (luckPerms != null) getLogger().info("LuckPerms terhubung lewat API.");
        else getLogger().info("LuckPerms tidak terdeteksi; perintah rank dijalankan sebagai perintah konsol.");
        getLogger().info("CipiSMP Store Companion aktif. Website: " + websiteUrl
                + ", antrean tertunda: " + queue.totalPending());
    }

    @Override
    public void onDisable() {
        if (api != null) api.stop();
        getLogger().info("CipiSMP Store Companion berhenti.");
    }

    private void registerCommand(String name, org.bukkit.command.CommandExecutor executor) {
        PluginCommand command = getCommand(name);
        if (command == null) {
            getLogger().warning("Perintah '" + name + "' tidak ada di plugin.yml.");
            return;
        }
        command.setExecutor(executor);
    }

    private void disableManagementCommands() {
        PluginCommand verify = getCommand("verify");
        if (verify != null) {
            verify.setExecutor((sender, command, label, args) -> {
                sender.sendMessage("Verifikasi akun belum aktif: admin server harus mengisi shared-secret plugin.");
                return true;
            });
        }
        registerCommand("cipistore", new AdminCommand(this, queue, deliveries));
    }
}
