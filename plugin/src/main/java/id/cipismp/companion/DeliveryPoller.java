package id.cipismp.companion;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

/**
 * Plugin-initiated delivery polling. The Minecraft host only needs outbound HTTPS;
 * the website never opens a connection to the game host.
 */
public final class DeliveryPoller {
    private static final Gson GSON = new Gson();
    private static final String POLL_PATH = "/api/plugin/deliveries/poll";
    private static final String ACK_PATH = "/api/plugin/deliveries/ack";

    private final JavaPlugin plugin;
    private final String websiteUrl;
    private final String secret;
    private final DeliveryService deliveries;
    private final int intervalSeconds;
    private final int batchSize;
    private final int timeoutSeconds;
    private final HttpClient client;
    private final AtomicBoolean polling = new AtomicBoolean(false);
    private volatile long lastWarningAt;
    private BukkitTask task;

    public DeliveryPoller(
            JavaPlugin plugin,
            String websiteUrl,
            String secret,
            DeliveryService deliveries,
            int intervalSeconds,
            int batchSize,
            int timeoutSeconds) {
        this.plugin = plugin;
        this.websiteUrl = trimTrailingSlash(websiteUrl);
        this.secret = secret;
        this.deliveries = deliveries;
        this.intervalSeconds = Math.max(5, Math.min(60, intervalSeconds));
        this.batchSize = Math.max(1, Math.min(10, batchSize));
        this.timeoutSeconds = Math.max(5, Math.min(60, timeoutSeconds));
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(this.timeoutSeconds))
                .build();
    }

    public void start() {
        long periodTicks = intervalSeconds * 20L;
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::pollSafely, 20L, periodTicks);
        plugin.getLogger().info("Delivery polling HTTPS aktif: " + websiteUrl + POLL_PATH
                + " (setiap " + intervalSeconds + " detik).");
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void pollSafely() {
        if (!polling.compareAndSet(false, true)) return;
        try {
            pollOnce();
        } catch (Exception e) {
            warnThrottled("Polling website gagal: " + safeMessage(e), e);
        } finally {
            polling.set(false);
        }
    }

    private void pollOnce() throws Exception {
        JsonObject payload = new JsonObject();
        payload.addProperty("version", plugin.getDescription().getVersion());
        payload.addProperty("limit", batchSize);
        JsonObject response = post(POLL_PATH, payload);
        if (!response.has("ok") || !response.get("ok").getAsBoolean()) {
            throw new IOException(response.has("message") ? response.get("message").getAsString() : "Respons polling tidak valid");
        }
        if (response.has("enabled") && !response.get("enabled").getAsBoolean()) return;
        if (!response.has("deliveries") || !response.get("deliveries").isJsonArray()) return;

        JsonArray pending = response.getAsJsonArray("deliveries");
        for (JsonElement element : pending) {
            if (!element.isJsonObject()) continue;
            try {
                processDelivery(element.getAsJsonObject());
            } catch (Exception e) {
                warnThrottled("Delivery poll/ACK gagal: " + safeMessage(e), e);
            }
        }
    }

    private void processDelivery(JsonObject row) throws Exception {
        String deliveryId = requiredString(row, "deliveryId");
        String leaseToken = requiredString(row, "leaseToken");
        String uuid = requiredString(row, "uuid");
        String player = requiredString(row, "player");
        String reason = row.has("reason") ? row.get("reason").getAsString() : "PURCHASE";
        int attempt = row.has("attempt") ? row.get("attempt").getAsInt() : 0;
        if (attempt < 1) throw new IOException("Attempt pengiriman tidak valid untuk " + deliveryId);

        JsonArray commandArray = row.getAsJsonArray("commands");
        if (commandArray == null || commandArray.isEmpty()) throw new IOException("Tidak ada perintah untuk " + deliveryId);
        List<String> commands = new ArrayList<>();
        for (JsonElement command : commandArray) commands.add(command.getAsString());

        long startedAt = System.nanoTime();
        DeliveryService.Result result;
        try {
            result = deliveries.deliver(new Delivery(deliveryId, uuid, player, commands, reason));
        } catch (Exception e) {
            result = DeliveryService.Result.error(safeMessage(e));
        }
        long durationMs = Math.max(0, (System.nanoTime() - startedAt) / 1_000_000L);
        boolean queuedOffline = result.ok() && result.applied() == 0;

        JsonObject ack = new JsonObject();
        ack.addProperty("deliveryId", deliveryId);
        ack.addProperty("leaseToken", leaseToken);
        ack.addProperty("attempt", attempt);
        ack.addProperty("ok", result.ok());
        ack.addProperty("applied", result.applied());
        ack.addProperty("queuedOffline", queuedOffline);
        ack.addProperty("durationMs", Math.min(durationMs, 180_000));
        if (!result.ok()) {
            String error = result.message() == null ? "Perintah gagal" : result.message();
            ack.addProperty("error", error.length() > 1000 ? error.substring(0, 1000) : error);
        }

        JsonObject ackResponse = post(ACK_PATH, ack);
        if (!ackResponse.has("ok") || !ackResponse.get("ok").getAsBoolean()) {
            String message = ackResponse.has("message") ? ackResponse.get("message").getAsString() : "ACK ditolak";
            throw new IOException("ACK " + deliveryId + " gagal: " + message);
        }
    }

    private JsonObject post(String path, JsonObject payload) throws Exception {
        String body = GSON.toJson(payload);
        String timestamp = Long.toString(System.currentTimeMillis() / 1000L);
        String nonce = UUID.randomUUID().toString();
        String signature = Signatures.sign(secret, timestamp, nonce, body);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(websiteUrl + path))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("X-Cipi-Timestamp", timestamp)
                .header("X-Cipi-Nonce", nonce)
                .header("X-Cipi-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonObject json;
        try {
            json = JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (Exception e) {
            throw new IOException("Website mengirim JSON tidak valid (HTTP " + response.statusCode() + ")", e);
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = json.has("message") ? json.get("message").getAsString() : "HTTP " + response.statusCode();
            throw new IOException("Website menolak request: " + message);
        }
        return json;
    }

    private void warnThrottled(String message, Exception error) {
        long now = System.currentTimeMillis();
        if (now - lastWarningAt < 60_000) return;
        lastWarningAt = now;
        plugin.getLogger().log(Level.WARNING, message, error);
    }

    private static String requiredString(JsonObject object, String key) throws IOException {
        if (!object.has(key) || object.get(key).isJsonNull()) throw new IOException("Field " + key + " kosong");
        return object.get(key).getAsString();
    }

    private static String trimTrailingSlash(String url) {
        String value = url.trim();
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }

    private static String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    }
}
