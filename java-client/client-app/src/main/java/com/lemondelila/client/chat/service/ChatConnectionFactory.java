package com.lemondelila.client.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.user.model.ClientSession;

import java.net.URI;
import java.net.http.HttpClient;

public final class ChatConnectionFactory {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final ConfigurationService configuration;
    private final ClientSession session;
    private final TaskScheduler scheduler;

    @Inject
    public ChatConnectionFactory(HttpClient httpClient,
                                 ObjectMapper mapper,
                                 ConfigurationService configuration,
                                 ClientSession session,
                                 TaskScheduler scheduler) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.configuration = configuration;
        this.session = session;
        this.scheduler = scheduler;
    }

    public ChatConnection open() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Vous devez etre connecte pour ouvrir le tchat."));
        URI endpoint = resolvePresenceEndpoint();
        String authorization = "Bearer " + auth.token();
        return new ChatConnection(httpClient, mapper, endpoint, authorization, scheduler);
    }

    private URI resolvePresenceEndpoint() {
        String presenceUrl = configuration.get("network.ws.presence", "").trim();
        if (!presenceUrl.isEmpty()) {
            return URI.create(presenceUrl);
        }
        String fallback = configuration.get("network.ws.url", "wss://ws.lilas.hociatec.fr/ws").trim();
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
