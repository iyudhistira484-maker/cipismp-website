package id.cipismp.companion;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SignaturesTest {
    private static final String SECRET = "test-plugin-secret-0123456789abcdef";
    private static final String TIMESTAMP = "1762900000";
    private static final String NONCE = "abc123";
    private static final String BODY = "{\"deliveryId\":\"del_1\",\"uuid\":\"33333333-3333-4333-8333-333333333333\",\"player\":\"CipiTest\",\"commands\":[\"lp user CipiTest parent add iron\"],\"reason\":\"PURCHASE\"}";
    // Wire-format fixture untuk kontrak HMAC website ↔ plugin polling.
    private static final String EXPECTED = "0082f0749dfa5108e9f2b4a3ee9c07942cd3d5c713687c5b2dcfa40456654264";

    @Test
    void signsTheSameWirePayloadAsTheWebsite() {
        assertTrue(Signatures.matches(EXPECTED, Signatures.sign(SECRET, TIMESTAMP, NONCE, BODY)));
    }

    @Test
    void rejectsModifiedBodyAndMissingSignature() {
        assertFalse(Signatures.matches(EXPECTED, Signatures.sign(SECRET, TIMESTAMP, NONCE, BODY + " ")));
        assertFalse(Signatures.matches(EXPECTED, null));
    }
}
