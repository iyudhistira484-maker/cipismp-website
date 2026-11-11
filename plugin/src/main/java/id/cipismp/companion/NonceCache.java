package id.cipismp.companion;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/** Menyimpan nonce yang sudah dipakai selama jendela waktu tertentu. */
public final class NonceCache {
    private final long ttlMillis;
    private final Map<String, Long> seen = new HashMap<>();

    public NonceCache(long ttlMillis) {
        this.ttlMillis = ttlMillis;
    }

    /** @return true bila nonce belum pernah dipakai (dan langsung menandainya terpakai). */
    public synchronized boolean accept(String nonce) {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> it = seen.entrySet().iterator();
        while (it.hasNext()) {
            if (now - it.next().getValue() > ttlMillis) it.remove();
        }
        if (seen.containsKey(nonce)) return false;
        seen.put(nonce, now);
        return true;
    }

    public synchronized int size() {
        return seen.size();
    }
}
