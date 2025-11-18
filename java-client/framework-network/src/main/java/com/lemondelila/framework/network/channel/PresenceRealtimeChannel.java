package com.lemondelila.framework.network.channel;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

public final class PresenceRealtimeChannel implements RealtimeChannel {

    private final ConfigurationService configuration;

    public PresenceRealtimeChannel(ConfigurationService configuration) {
        this.configuration = Objects.requireNonNull(configuration, "configuration");
    }

    @Override
    public URI resolve(String token, Integer contextId) {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Token requis pour le canal de présence.");
        }
        URI base = resolveBasePresenceUri();
        return appendQuery(base, token, null);
    }

    private URI resolveBasePresenceUri() {
        String presenceUrl = configuration.get("network.ws.presence", "").trim();
        if (!presenceUrl.isEmpty()) {
            return URI.create(presenceUrl);
        }
        String fallback = configuration.get("network.ws.url", "wss://hociatec.fr/ws").trim();
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

    private URI appendQuery(URI base, String token, Integer room) {
        String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
        String query = base.getQuery();
        StringBuilder builder = new StringBuilder();
        if (query != null && !query.isBlank()) {
            builder.append(query).append('&');
        }
        builder.append("token=").append(encoded);
        if (room != null) {
            builder.append("&room=").append(room);
        }
        return URI.create(base.getScheme() + "://" + base.getAuthority()
                + (base.getPath() == null ? "" : base.getPath())
                + "?" + builder);
    }
}
