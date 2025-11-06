package com.lemondelila.framework.network.ws;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.function.Consumer;

public interface RealtimeGateway extends AutoCloseable {

    void connect();

    void disconnect(int statusCode, String reason);

    void send(JsonNode payload);

    void onMessage(Consumer<JsonNode> handler);

    void onConnectionState(Consumer<ConnectionState> handler);

    @Override
    void close();

    enum ConnectionState {
        CONNECTING,
        CONNECTED,
        CLOSING,
        CLOSED,
        FAILED
    }
}

