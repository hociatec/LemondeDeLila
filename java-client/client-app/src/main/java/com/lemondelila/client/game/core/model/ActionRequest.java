package com.lemondelila.client.game.core.model;

import java.util.Map;

public record ActionRequest(String type, Map<String, Object> payload) {
    public static ActionRequest of(String type) {
        return new ActionRequest(type, Map.of());
    }
    public static ActionRequest of(String type, Map<String, Object> payload) {
        return new ActionRequest(type, payload);
    }
}
