package com.lemondelila.client.framework.network.channel;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Map;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameRealtimeChannelTest {

    @Test
    void should_build_url_with_token_room_and_extra_params() {
        Supplier<URI> base = () -> URI.create("ws://example.com/ws?existing=1");
        GameRealtimeChannel channel = new GameRealtimeChannel(base);

        URI resolved = channel.resolve("abc def", 42, Map.of("signature", "sig", "x", "1"));

        String url = resolved.toString();
        assertTrue(url.startsWith("ws://example.com/ws?"), "URL should keep base path");
        assertEquals("ws://example.com/ws?existing=1&token=abc+def&room=42&signature=sig&x=1", url);
    }

    @Test
    void should_omit_room_when_null() {
        Supplier<URI> base = () -> URI.create("wss://api.test/ws");
        GameRealtimeChannel channel = new GameRealtimeChannel(base);

        URI resolved = channel.resolve("token123", null, Map.of());

        assertEquals("wss://api.test/ws?token=token123", resolved.toString());
    }
}
