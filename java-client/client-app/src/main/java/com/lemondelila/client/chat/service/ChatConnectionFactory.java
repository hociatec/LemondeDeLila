package com.lemondelila.client.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.chat.model.ChatConnection;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.network.channel.PresenceRealtimeChannel;
import com.lemondelila.client.framework.network.channel.RealtimeChannel;
import com.lemondelila.client.user.model.ClientSession;

import java.net.URI;
import java.net.http.HttpClient;

public final class ChatConnectionFactory {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final ConfigurationService configuration;
    private final ClientSession session;
    private final RealtimeChannel presenceChannel;

    @Inject
    public ChatConnectionFactory(HttpClient httpClient,
                                 ObjectMapper mapper,
                                 ConfigurationService configuration,
                                 ClientSession session) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.configuration = configuration;
        this.session = session;
        this.presenceChannel = new PresenceRealtimeChannel(configuration);
    }

    public ChatConnection open() {
        ClientSession.AuthState auth = session.authenticated()
                .orElseThrow(() -> new IllegalStateException("Vous devez etre connecte pour ouvrir le tchat."));
        URI endpoint = presenceChannel.resolve(auth.token(), null);
        return new ChatConnection(httpClient, mapper, endpoint);
    }
}


