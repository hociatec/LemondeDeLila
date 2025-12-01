package com.lemondelila.client.framework.network.realtime;

import com.lemondelila.client.framework.core.config.ConfigurationService;

/**
 * Fournit une signature simple pour les connexions temps réel (WS/SSE).
 * Par défaut, renvoie un secret statique optionnel lu dans la configuration.
 */
public final class RealtimeSignatureService {

    private final String staticSecret;

    public RealtimeSignatureService(ConfigurationService config) {
        this.staticSecret = config.get("network.ws.secret", "");
    }

    /**
     * Retourne une signature éventuelle à ajouter aux headers/params.
     * S'il n'y a pas de secret configuré, renvoie une chaîne vide.
     */
    public String signature() {
        return staticSecret == null ? "" : staticSecret;
    }
}
