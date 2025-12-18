package com.lemondelila.client.framework.network.channel;

import com.lemondelila.client.framework.network.config.NetworkEndpoints;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Supplier;

public final class GameRealtimeChannel implements RealtimeChannel {

    private final Supplier<URI> baseSupplier;

    public GameRealtimeChannel(NetworkEndpoints endpoints) {
        Objects.requireNonNull(endpoints, "endpoints");
        this.baseSupplier = endpoints::realtimeGateway;
    }

    public GameRealtimeChannel(Supplier<URI> baseSupplier) {
        this.baseSupplier = Objects.requireNonNull(baseSupplier, "baseSupplier");
    }

    @Override
    public URI resolve(String token, Integer roomId) {
        return resolveWithParams(token, roomId, Map.of());
    }

    @Override
    public URI resolve(String token, Integer roomId, Map<String, String> additionalParams) {
        Map<String, String> params = new TreeMap<>(additionalParams == null ? Map.of() : additionalParams);
        return resolveWithParams(token, roomId, params);
    }

    private URI resolveWithParams(String token, Integer roomId, Map<String, String> params) {
        URI base = baseSupplier.get();
        if (token == null || token.isBlank()) {
            return base;
        }
        StringBuilder builder = new StringBuilder();
        String query = base.getQuery();
        if (query != null && !query.isBlank()) {
            builder.append(query).append('&');
        }
        builder.append("token=").append(encode(token));
        if (roomId != null) {
            builder.append("&room=").append(roomId);
        }
        params.forEach((key, value) -> {
            if (key == null || key.isBlank() || value == null) {
                return;
            }
            builder.append('&').append(encode(key)).append('=').append(encode(value));
        });
        return URI.create(base.getScheme() + "://" + base.getAuthority()
                + (base.getPath() == null ? "" : base.getPath())
                + "?" + builder);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
