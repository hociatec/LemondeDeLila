package com.lemondelila.client.framework.network.channel;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.function.Supplier;

public final class GameRealtimeChannel implements RealtimeChannel {

    private final Supplier<URI> baseSupplier;

    public GameRealtimeChannel(ConfigurationService configuration) {
        Objects.requireNonNull(configuration, "configuration");
        this.baseSupplier = () -> URI.create(configuration.get("network.ws.url", "ws://127.0.0.1:8080/ws"));
    }

    public GameRealtimeChannel(Supplier<URI> baseSupplier) {
        this.baseSupplier = Objects.requireNonNull(baseSupplier, "baseSupplier");
    }

    @Override
    public URI resolve(String token, Integer roomId) {
        URI base = baseSupplier.get();
        if (token == null || token.isBlank()) {
            return base;
        }
        String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
        StringBuilder builder = new StringBuilder();
        String query = base.getQuery();
        if (query != null && !query.isBlank()) {
            builder.append(query).append('&');
        }
        builder.append("token=").append(encoded);
        if (roomId != null) {
            builder.append("&room=").append(roomId);
        }
        return URI.create(base.getScheme() + "://" + base.getAuthority()
                + (base.getPath() == null ? "" : base.getPath())
                + "?" + builder);
    }
}
