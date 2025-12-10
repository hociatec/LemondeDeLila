package com.lemondelila.client.framework.network.config;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.net.URI;
import java.util.Objects;

/**
 * Fournit les points d'entrée HTTP/WS normalisés du client.
 */
public final class NetworkEndpoints {

    // Par défaut on reste en HTTP/WS pour éviter tout basculement implicite en HTTPS
    private static final String DEFAULT_HTTP = "http://127.0.0.1:3001/api/";
    private static final String DEFAULT_WS = "ws://127.0.0.1:3001/ws";
    private static final String DEFAULT_WS_API = "ws://127.0.0.1:3001/ws/api";

    private final URI httpBase;
    private final URI realtimeGateway;
    private final URI presenceGateway;
    private final URI apiGatewayBase;

    public NetworkEndpoints(ConfigurationService configurationService) {
        Objects.requireNonNull(configurationService, "configurationService");
        this.httpBase = URI.create(normalizeHttp(configurationService.get("network.http.base", DEFAULT_HTTP)));
        this.realtimeGateway = URI.create(normalizeWs(configurationService.get("network.ws.url", DEFAULT_WS), "/ws"));
        this.apiGatewayBase = URI.create(normalizeWs(configurationService.get("network.ws.api", DEFAULT_WS_API), "/ws/api"));
        this.presenceGateway = resolvePresence(
                configurationService.get("network.ws.presence", "").trim(),
                realtimeGateway
        );
    }

    public URI realtimeGateway() {
        return realtimeGateway;
    }

    public URI presenceGateway() {
        return presenceGateway;
    }

    public URI httpBase() {
        return httpBase;
    }

    public URI apiGateway(String token) {
        String base = apiGatewayBase.toString();
        if (token == null || token.isBlank()) {
            return URI.create(base);
        }
        String sep = base.contains("?") ? "&" : "?";
        return URI.create(base + sep + "token=" + urlEncode(token));
    }

    private static String normalizeHttp(String candidate) {
        String value = candidate == null || candidate.isBlank() ? DEFAULT_HTTP : candidate.trim();
        if (!value.endsWith("/")) {
            value = value + "/";
        }
        return value;
    }

    private static String normalizeWs(String candidate, String suffix) {
        String value = candidate == null || candidate.isBlank() ? DEFAULT_WS : candidate.trim();
        if (!value.endsWith(suffix) && !value.endsWith(suffix + "/")) {
            if (!value.endsWith("/")) {
                value = value + "/";
            }
            value = value + suffix.replaceFirst("^/", "");
        }
        if (!value.contains("://")) {
            value = DEFAULT_WS;
        }
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

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
