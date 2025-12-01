package com.lemondelila.client.game.exchange.model;

public record ExchangeOption(String id, String label) {

    public ExchangeOption {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("id");
        }
    }
}
