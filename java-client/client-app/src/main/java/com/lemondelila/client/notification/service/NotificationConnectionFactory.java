package com.lemondelila.client.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.notification.transport.NotificationConnection;
import com.lemondelila.client.user.model.ClientSession;

import java.net.http.HttpClient;

public final class NotificationConnectionFactory {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;

    @Inject
    public NotificationConnectionFactory(HttpClient httpClient,
                                         ObjectMapper mapper,
                                         NetworkEndpoints endpoints,
                                         ClientSession session) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoints = endpoints;
        this.session = session;
    }

    public NotificationConnection open() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Vous devez etre connecte pour recevoir des notifications."));
        return new NotificationConnection(httpClient, mapper, endpoints.notifyGateway(auth.token()));
    }
}

