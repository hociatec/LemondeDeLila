package com.lemondelila.client.game.service;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Objects;

/**
 * Produit une signature HMAC pour sécuriser les connexions WebSocket.
 */
public final class RealtimeSignatureService {

    private static final String HMAC_ALGO = "HmacSHA256";
    private final SecretKeySpec keySpec;

    public RealtimeSignatureService(ConfigurationService configurationService) {
        String secret = configurationService.get("network.ws.signature.secret", "lemondelila");
        this.keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGO);
    }

    public String sign(String token, Integer roomId, long timestamp) {
        Objects.requireNonNull(token, "token");
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(keySpec);
            String payload = buildPayload(token, roomId, timestamp);
            byte[] hmac = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac);
        } catch (Exception ex) {
            throw new IllegalStateException("Impossible de signer la connexion realtime", ex);
        }
    }

    private static String buildPayload(String token, Integer roomId, long timestamp) {
        StringBuilder builder = new StringBuilder();
        builder.append(token).append('|').append(timestamp);
        if (roomId != null) {
            builder.append('|').append(roomId);
        }
        return builder.toString();
    }
}
