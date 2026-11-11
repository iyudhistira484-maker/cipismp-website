package id.cipismp.companion;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Mengirim `/verify <kode>` ke website. Request ditandatangani HMAC dengan secret
 * yang sama sehingga website tahu permintaan benar-benar berasal dari server ini.
 */
public final class VerifyService {
    private final JavaPlugin plugin;
    private final String websiteUrl;
    private final String secret;
    private final int timeoutSeconds;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public VerifyService(JavaPlugin plugin, String websiteUrl, String secret, int timeoutSeconds) {
        this.plugin = plugin;
        this.websiteUrl = websiteUrl.endsWith("/") ? websiteUrl.substring(0, websiteUrl.length() - 1) : websiteUrl;
        this.secret = secret;
        this.timeoutSeconds = timeoutSeconds;
    }

    public record Outcome(boolean ok, String message) {}

    public Outcome verify(Player player, String code) {
        JsonObject payload = new JsonObject();
        payload.addProperty("code", code);
        payload.addProperty("uuid", player.getUniqueId().toString());
        payload.addProperty("player", player.getName());
        payload.addProperty("edition", isBedrock(player.getUniqueId()) ? "BEDROCK" : "JAVA");
        String body = payload.toString();

        String timestamp = Long.toString(System.currentTimeMillis() / 1000L);
        String nonce = UUID.randomUUID().toString();
        String signature = Signatures.sign(secret, timestamp, nonce, body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(websiteUrl + "/api/plugin/verify"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("X-Cipi-Timestamp", timestamp)
                .header("X-Cipi-Nonce", nonce)
                .header("X-Cipi-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            String message = json.has("message") ? json.get("message").getAsString() : "Tidak ada pesan dari website";
            return new Outcome(response.statusCode() == 200 && json.has("ok") && json.get("ok").getAsBoolean(), message);
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Verifikasi akun gagal menghubungi website", e);
            return new Outcome(false, "Tidak bisa menghubungi website toko. Coba lagi beberapa saat lagi.");
        }
    }

    /** Floodgate menandai pemain Bedrock dengan awalan titik pada nama. */
    private static boolean isBedrock(UUID uuid) {
        return uuid.version() == 3;
    }
}
