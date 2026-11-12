package id.cipismp.companion;

import java.util.List;

/** Satu paket perintah dari website untuk dieksekusi di server. */
public record Delivery(String deliveryId, String uuid, String player, List<String> commands, String reason) {
    public Delivery {
        commands = List.copyOf(commands);
    }
}
