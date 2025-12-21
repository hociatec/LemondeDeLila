package com.lemondelila.client.framework.network.realtime;

import com.lemondelila.client.framework.core.config.ConfigurationService;

/**
 * Fournit une signature simple pour les connexions temps réel (WS/SSE).
 * Par défaut, renvoie un secret statique optionnel lu dans la configuration.
 */
public final class RealtimeSignatureService {

    private final String staticSecret;

    public RealtimeSignatureService(ConfigurationService config) {
        String configured = sanitize(config.get("network.ws.secret", ""));
        if (configured.isEmpty()) {
            configured = sanitize(firstNonBlank(
                    System.getenv("NETWORK_WS_SECRET"),
                    System.getenv("WS_SHARED_SECRET")
            ));
        }
        this.staticSecret = configured;
    }

    /**
     * Retourne une signature éventuelle à ajouter aux headers/params.
     * S'il n'y a pas de secret configuré, renvoie une chaîne vide.
     */
    public String signature() {
        return staticSecret == null ? "" : staticSecret;
    }

    private static String sanitize(String candidate) {
        if (candidate == null) {
            return "";
        }
        String trimmed = candidate.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private static String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return "";
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return "";
    }
}
