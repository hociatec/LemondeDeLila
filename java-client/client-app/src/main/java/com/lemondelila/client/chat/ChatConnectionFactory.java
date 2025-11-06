package com.lemondelila.client.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.session.ClientSession;
import com.lemondelila.framework.core.config.ConfigurationService;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;

public final class ChatConnectionFactory {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final ConfigurationService configuration;
    private final ClientSession session;

    public ChatConnectionFactory(HttpClient httpClient,
                                 ObjectMapper mapper,
                                 ConfigurationService configuration,
                                 ClientSession session) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.configuration = configuration;
        this.session = session;
    }

    public ChatConnection open() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Vous devez être connecté pour ouvrir le tchat."));
        URI endpoint = appendToken(resolvePresenceEndpoint(), auth.token());
        return new ChatConnection(httpClient, mapper, endpoint);
    }

    private URI resolvePresenceEndpoint() {
        String presenceUrl = configuration.get("network.ws.presence", "").trim();
        if (!presenceUrl.isEmpty()) {
            return URI.create(presenceUrl);
        }
        String fallback = configuration.get("network.ws.url", "ws://127.0.0.1:8081/presence").trim();
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

    private URI appendToken(URI base, String token) {
        String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
        String query = base.getQuery();
        String newQuery = (query == null || query.isBlank()) ? "token=" + encoded : query + "&token=" + encoded;
        return URI.create(base.getScheme() + "://" + base.getAuthority()
                + (base.getPath() == null ? "" : base.getPath())
                + "?" + newQuery);
    }
}
