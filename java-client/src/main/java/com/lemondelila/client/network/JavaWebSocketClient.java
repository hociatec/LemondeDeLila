package com.lemondelila.client.network;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.URISyntaxException;

public class JavaWebSocketClient implements com.lemondelila.client.network.WebSocketClient {

    private WebSocketClient client;
    private MessageHandler messageHandler;

    @Override
    public void connect(String uri) {
        try {
            client = new org.java_websocket.client.WebSocketClient(new URI(uri)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    System.out.println("Connected to WebSocket server");
                }

                @Override
                public void onMessage(String message) {
                    if (messageHandler != null) {
                        messageHandler.onMessage(message);
                    }
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    System.out.println("Disconnected from WebSocket server");
                }

                @Override
                public void onError(Exception ex) {
                    ex.printStackTrace();
                }
            };
            client.connect();
        } catch (URISyntaxException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void disconnect() {
        if (client != null) {
            client.close();
        }
    }

    @Override
    public void sendMessage(String message) {
        if (client != null) {
            client.send(message);
        }
    }

    @Override
    public void setMessageHandler(MessageHandler handler) {
        this.messageHandler = handler;
    }
}
