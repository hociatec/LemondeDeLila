package com.lemondelila.client.game.exchange.model;

public record ExchangeTarget(String id, String username, boolean bot) {

    public ExchangeTarget {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("id");
        }
    }
}
