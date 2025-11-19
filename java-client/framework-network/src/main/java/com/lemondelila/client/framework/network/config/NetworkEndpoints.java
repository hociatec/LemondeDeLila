package com.lemondelila.client.framework.network.config;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.net.URI;
import java.util.Objects;

/**
 * Fournit les points d'entrée HTTP/WS normalisés du client.
 */
public final class NetworkEndpoints {

    private static final String DEFAULT_HTTP = "https://hociatec.fr/api/";
    private static final String DEFAULT_WS = "wss://hociatec.fr/ws";

    private final URI httpBase;
    private final URI realtimeGateway;
    private final URI presenceGateway;

    public NetworkEndpoints(ConfigurationService configurationService) {
        Objects.requireNonNull(configurationService, "configurationService");
        this.httpBase = URI.create(normalizeHttp(configurationService.get("network.http.base", DEFAULT_HTTP)));
        this.realtimeGateway = URI.create(normalizeWs(configurationService.get("network.ws.url", DEFAULT_WS)));
        this.presenceGateway = resolvePresence(
                configurationService.get("network.ws.presence", "").trim(),
                realtimeGateway
        );
    }

    public URI httpBase() {
        return httpBase;
    }

    public URI realtimeGateway() {
        return realtimeGateway;
    }

    public URI presenceGateway() {
        return presenceGateway;
    }

    private static String normalizeHttp(String candidate) {
        String value = candidate == null || candidate.isBlank() ? DEFAULT_HTTP : candidate.trim();
        return value;
    }

    private static String normalizeWs(String candidate) {
        String value = candidate == null || candidate.isBlank() ? DEFAULT_WS : candidate.trim();
        return value;
    }

    private static URI resolvePresence(String override, URI realtimeBase) {
        if (override != null && !override.isBlank()) {
            return URI.create(override.trim());
        }
        String fallback = realtimeBase.toString();
        if (!fallback.endsWith("/presence")) {
            if (fallback.endsWith("/ws")) {
                fallback = fallback.substring(0, fallback.length() - 3);
            }
            if (!fallback.endsWith("/")) {
                fallback = fallback + "/";
            }
            fallback = fallback + "presence";
        }
        return URI.create(fallback);
    }
}
