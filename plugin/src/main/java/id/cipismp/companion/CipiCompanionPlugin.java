package id.cipismp.companion;

import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.util.List;

/** Companion plugin: polls the store over HTTPS, delivers rank/kit commands, and handles /verify. */
public final class CipiCompanionPlugin extends JavaPlugin {
    private static final List<String> PLACEHOLDER_SECRETS = List.of(
            "", "ganti-dengan-PLUGIN_SHARED_SECRET", "changeme");

    private DeliveryPoller poller;
    private QueueStore queue;
    private DeliveryService deliveries;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        reloadConfig();

        String secret = getConfig().getString("shared-secret", "").trim();
        String websiteUrl = getConfig().getString("website-url", "https://cipismp.my.id").trim();

        queue = new QueueStore(this,
                getConfig().getString("queue.file", "pending-deliveries.yml"),
                getConfig().getInt("queue.max-per-player", 20));
        LuckPermsHook luckPerms = getConfig().getBoolean("luckperms.use-api", true) ? LuckPermsHook.tryHook(getLogger()) : null;
        deliveries = new DeliveryService(this, queue, luckPerms);
        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this, deliveries), this);

        boolean secretValid = secret.length() >= 16 && !PLACEHOLDER_SECRETS.contains(secret);
        if (!secretValid) {
            getLogger().severe("shared-secret belum diisi (minimal 16 karakter). Polling pengiriman dan "
                    + "/verify dinonaktifkan sampai config.yml diperbaiki. Nilai ini harus sama dengan "
                    + "PLUGIN_SHARED_SECRET di environment website.");
            disableManagementCommands();
            return;
        }
        if (!isSecureWebsiteUrl(websiteUrl)) {
            getLogger().severe("website-url harus HTTPS untuk host publik (HTTP hanya diizinkan ke localhost). "
                    + "Polling dinonaktifkan untuk melindungi shared-secret.");
            disableManagementCommands();
            return;
        }

        VerifyService verifyService = new VerifyService(this, websiteUrl, secret, getConfig().getInt("verify.timeout-seconds", 10));
        registerCommand("verify", new VerifyCommand(this, verifyService));
        registerCommand("cipistore", new AdminCommand(this, queue, deliveries));

        if (getConfig().getBoolean("polling.enabled", true)) {
            poller = new DeliveryPoller(
                    this,
                    websiteUrl,
                    secret,
                    deliveries,
                    getConfig().getBoolean("live-status.enabled", false)
                            ? new PlayerStatusSnapshot(this, luckPerms, getConfig().getStringList("live-status.kit-names"))
                            : null,
                    getConfig().getInt("polling.interval-seconds", 10),
                    getConfig().getInt("polling.batch-size", 5),
                    getConfig().getInt("polling.timeout-seconds", 15));
            poller.start();
        } else {
            getLogger().warning("polling.enabled=false; pengiriman dari toko tidak akan diambil plugin.");
        }

        if (luckPerms != null) getLogger().info("LuckPerms terhubung lewat API.");
        else getLogger().info("LuckPerms tidak terdeteksi; perintah rank dijalankan sebagai perintah konsol.");
        getLogger().info("CipiSMP Store Companion aktif. Website: " + websiteUrl
                + ", antrean pemain offline: " + queue.totalPending());
    }

    @Override
    public void onDisable() {
        if (poller != null) poller.stop();
        getLogger().info("CipiSMP Store Companion berhenti.");
    }

    private static boolean isSecureWebsiteUrl(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (host == null) return false;
            if ("https".equalsIgnoreCase(scheme)) return true;
            return "http".equalsIgnoreCase(scheme)
                    && ("localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host)
                    || "::1".equalsIgnoreCase(host)
                    || "[::1]".equalsIgnoreCase(host));
        } catch (IllegalArgumentException e) {
            return false;
        }
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
                sender.sendMessage("Verifikasi akun belum aktif: admin server harus mengatur website-url dan shared-secret plugin.");
                return true;
            });
        }
        registerCommand("cipistore", new AdminCommand(this, queue, deliveries));
    }
}
