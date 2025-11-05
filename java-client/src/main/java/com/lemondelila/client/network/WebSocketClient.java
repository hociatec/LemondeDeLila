package com.lemondelila.client.network;

public interface WebSocketClient {
    void connect(String uri);
    void disconnect();
    void sendMessage(String message);
    void setMessageHandler(MessageHandler handler);

    interface MessageHandler {
        void onMessage(String message);
    }
}
