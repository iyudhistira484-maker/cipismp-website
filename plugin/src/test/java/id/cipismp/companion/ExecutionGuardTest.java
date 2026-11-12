package id.cipismp.companion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionGuardTest {
    @TempDir Path root;

    @Test void markerSurvivesNewInstanceAndDifferentDeliveriesAreIndependent() throws Exception {
        assertTrue(new ExecutionGuard(root).begin("delivery-1"));
        assertFalse(new ExecutionGuard(root).begin("delivery-1"));
        assertTrue(new ExecutionGuard(root).begin("delivery-2"));
        assertTrue(Files.exists(root.resolve("delivery-intents").resolve(ExecutionGuard.markerName("delivery-1"))));
    }

    @Test void exactlyOneConcurrentCallerCanBegin() throws Exception {
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { start.await(); return new ExecutionGuard(root).begin("same"); });
            var second = pool.submit(() -> { start.await(); return new ExecutionGuard(root).begin("same"); });
            start.countDown();
            assertNotEquals(first.get(), second.get());
        }
    }

    @Test void storageFailureDoesNotPermitExecution() throws Exception {
        Files.writeString(root.resolve("delivery-intents"), "not a directory");
        assertThrows(IOException.class, () -> new ExecutionGuard(root).begin("blocked"));
    }
}
