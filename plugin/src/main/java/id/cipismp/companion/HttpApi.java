package id.cipismp.companion;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.logging.Level;

/**
 * Endpoint lokal yang dipanggil website: POST /cipismp/deliver dan GET /cipismp/health.
 * Hanya mendengarkan di 127.0.0.1 secara default dan setiap request wajib bertanda
 * tangan HMAC (timestamp + nonce + body) agar tidak bisa dipalsukan.
 */
public final class HttpApi {
    private static final Gson GSON = new Gson();

    private final JavaPlugin plugin;
    private final String secret;
    private final int maxSkewSeconds;
    private final NonceCache nonces;
    private final DeliveryService deliveries;
    private HttpServer server;

    public HttpApi(JavaPlugin plugin, String secret, int maxSkewSeconds, NonceCache nonces, DeliveryService deliveries) {
        this.plugin = plugin;
        this.secret = secret;
        this.maxSkewSeconds = maxSkewSeconds;
        this.nonces = nonces;
        this.deliveries = deliveries;
    }

    public void start(String host, int port) throws IOException {
        server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.setExecutor(Executors.newFixedThreadPool(2));
        server.createContext("/cipismp/deliver", this::handleDeliver);
        server.createContext("/cipismp/health", this::handleHealth);
        server.start();
        plugin.getLogger().info("CipiSMP Store API mendengarkan di http://" + host + ":" + port + "/cipismp");
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
    }

    private void handleDeliver(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            respond(exchange, 405, Map.of("ok", false, "message", "Gunakan POST"));
            return;
        }
        String body = readBody(exchange);
        String rejection = verify(exchange.getRequestHeaders(), body);
        if (rejection != null) {
            respond(exchange, 401, Map.of("ok", false, "message", rejection));
            return;
        }

        JsonObject payload;
        try {
            payload = JsonParser.parseString(body).getAsJsonObject();
        } catch (Exception e) {
            respond(exchange, 400, Map.of("ok", false, "message", "JSON tidak valid"));
            return;
        }

        String deliveryId = stringOrNull(payload, "deliveryId");
        String uuidRaw = stringOrNull(payload, "uuid");
        String playerName = stringOrNull(payload, "player");
        String reason = payload.has("reason") ? payload.get("reason").getAsString() : "PURCHASE";
        List<String> commands = new ArrayList<>();
        if (payload.has("commands") && payload.get("commands").isJsonArray()) {
            payload.getAsJsonArray("commands").forEach(el -> commands.add(el.getAsString()));
        }

        if (deliveryId == null || uuidRaw == null || playerName == null || commands.isEmpty()) {
            respond(exchange, 400, Map.of("ok", false, "message", "Payload tidak lengkap"));
            return;
        }

        UUID uuid;
        try {
            uuid = UUID.fromString(uuidRaw);
        } catch (IllegalArgumentException e) {
            respond(exchange, 400, Map.of("ok", false, "message", "UUID tidak valid"));
            return;
        }

        DeliveryService.Result result;
        try {
            result = deliveries.deliver(new Delivery(deliveryId, uuid.toString(), playerName, commands, reason));
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Gagal memproses pengiriman " + deliveryId, e);
            respond(exchange, 500, Map.of("ok", false, "message", "Kesalahan internal plugin"));
            return;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", result.ok());
        response.put("applied", result.applied());
        response.put("failed", result.failed());
        if (result.message() != null) response.put("message", result.message());
        respond(exchange, result.ok() ? 200 : 502, response);
        plugin.getLogger().info("Pengiriman " + deliveryId + " untuk " + playerName + ": applied="
                + result.applied() + " ok=" + result.ok());
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        String body = readBody(exchange);
        String rejection = verify(exchange.getRequestHeaders(), body);
        if (rejection != null) {
            respond(exchange, 401, Map.of("ok", false, "message", rejection));
            return;
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", true);
        response.put("version", plugin.getDescription().getVersion());
        response.put("playersOnline", Bukkit.getOnlinePlayers().size());
        response.put("pendingDeliveries", deliveries.pendingCount());
        response.put("luckperms", deliveries.luckPermsActive());
        respond(exchange, 200, response);
    }

    /** @return pesan penolakan, atau null bila signature valid. */
    private String verify(Headers headers, String body) {
        String timestamp = headers.getFirst("X-Cipi-Timestamp");
        String nonce = headers.getFirst("X-Cipi-Nonce");
        String signature = headers.getFirst("X-Cipi-Signature");
        if (timestamp == null || nonce == null || signature == null) return "Header signature tidak lengkap";

        long ts;
        try {
            ts = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            return "Timestamp tidak valid";
        }
        long skew = Math.abs(System.currentTimeMillis() / 1000L - ts);
        if (skew > maxSkewSeconds) return "Timestamp kedaluwarsa";
        if (!Signatures.matches(Signatures.sign(secret, timestamp, nonce, body), signature)) {
            return "Signature tidak cocok";
        }
        if (!nonces.accept(nonce)) return "Nonce sudah dipakai";
        return null;
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream in = exchange.getRequestBody()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static String stringOrNull(JsonObject object, String key) {
        return object.has(key) && !object.get(key).isJsonNull() ? object.get(key).getAsString() : null;
    }

    private static void respond(HttpExchange exchange, int status, Map<String, ?> payload) throws IOException {
        byte[] body = GSON.toJson(payload).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }
}
