package com.lemondelila.client.presence.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.presence.transport.PresenceConnection;
import com.lemondelila.client.user.model.ClientSession;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;

public final class PresenceConnectionFactory {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;

    @Inject
    public PresenceConnectionFactory(HttpClient httpClient,
                                     ObjectMapper mapper,
                                     NetworkEndpoints endpoints,
                                     ClientSession session) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoints = endpoints;
        this.session = session;
    }

    public PresenceConnection open() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Vous devez etre connecte pour consulter la presence."));
        URI endpoint = appendToken(endpoints.presenceGateway(), auth.token());
        return new PresenceConnection(httpClient, mapper, endpoint);
    }

    private URI appendToken(URI base, String token) {
        String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
        String query = base.getQuery();
        StringBuilder builder = new StringBuilder();
        if (query != null && !query.isBlank()) {
            builder.append(query).append("&");
        }
        builder.append("token=").append(encoded).append("&context=home");
        return URI.create(base.getScheme() + "://" + base.getAuthority()
                + (base.getPath() == null ? "" : base.getPath())
                + "?" + builder);
    }
}
