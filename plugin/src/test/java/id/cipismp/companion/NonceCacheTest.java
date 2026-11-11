package id.cipismp.companion;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NonceCacheTest {
    @Test
    void acceptsNonceOnceWithinItsReplayWindow() {
        NonceCache cache = new NonceCache(5 * 60 * 1000L);

        assertTrue(cache.accept("nonce-once"));
        assertFalse(cache.accept("nonce-once"));
        assertTrue(cache.accept("nonce-two"));
        assertEquals(2, cache.size());
    }
}
