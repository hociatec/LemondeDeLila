package com.lemondelila.client.session.listener;

public interface SessionListener {

    void onSessionOpened(String username, String token);

    default void onSessionClosed() {
        // optional
    }
}
