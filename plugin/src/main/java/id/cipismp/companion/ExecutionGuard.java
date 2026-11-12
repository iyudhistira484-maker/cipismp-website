package id.cipismp.companion;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Fail closed after an uncertain execution. A marker is created before any
 * command; an existing marker must never be automatically executed again.
 * Completion markers in QueueStore still allow safe ACK replay. Intent files
 * are retained until an operator has a reviewed retention/reconciliation plan.
 */
final class ExecutionGuard {
    private final Path directory;

    ExecutionGuard(Path dataDirectory) {
        this.directory = dataDirectory.resolve("delivery-intents");
    }

    boolean begin(String deliveryId) throws IOException {
        Files.createDirectories(directory);
        try (FileChannel parent = FileChannel.open(directory.getParent(), StandardOpenOption.READ)) {
            parent.force(true);
        }
        Path marker = directory.resolve(markerName(deliveryId));
        try (FileChannel file = FileChannel.open(marker, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            file.write(StandardCharsets.UTF_8.encode(deliveryId + "\n"));
            file.force(true);
            // Ensure the directory entry is committed where the platform permits it.
            // If not supported, refuse execution instead of silently weakening the guard.
            try (FileChannel dir = FileChannel.open(directory, StandardOpenOption.READ)) {
                dir.force(true);
            }
            return true;
        } catch (java.nio.file.FileAlreadyExistsException e) {
            return false;
        }
    }

    static String markerName(String deliveryId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(deliveryId.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest) + ".intent";
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 tidak tersedia", e);
        }
    }
}
