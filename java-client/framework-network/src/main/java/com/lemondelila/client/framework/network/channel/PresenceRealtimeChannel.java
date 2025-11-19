package com.lemondelila.client.framework.network.channel;

import com.lemondelila.client.framework.network.config.NetworkEndpoints;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

public final class PresenceRealtimeChannel implements RealtimeChannel {

    private final NetworkEndpoints endpoints;

    public PresenceRealtimeChannel(NetworkEndpoints endpoints) {
        this.endpoints = Objects.requireNonNull(endpoints, "endpoints");
    }

    @Override
    public URI resolve(String token, Integer contextId) {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Token requis pour le canal de présence.");
        }
        URI base = endpoints.presenceGateway();
        return appendQuery(base, token, null);
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
