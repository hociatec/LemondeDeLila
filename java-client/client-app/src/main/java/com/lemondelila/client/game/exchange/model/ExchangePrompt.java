package com.lemondelila.client.game.exchange.model;

import java.util.List;
import java.util.Objects;

/**
 * Represents a pending exchange interaction for the client.
 */
public final class ExchangePrompt {

    public enum Stage {
        SELECT,
        TARGET
    }

    private final String exchangeId;
    private final Stage stage;
    private final String actingPlayerId;
    private final List<ExchangeOption> cards;
    private final List<ExchangeTarget> targets;
    private final ExchangeTarget requestedBy;
    private final String offer;
    private final String title;
    private final String description;

    public ExchangePrompt(String exchangeId,
                          Stage stage,
                          String actingPlayerId,
                          List<ExchangeOption> cards,
                          List<ExchangeTarget> targets,
                          ExchangeTarget requestedBy,
                          String offer,
                          String title,
                          String description) {
        this.exchangeId = Objects.requireNonNull(exchangeId, "exchangeId");
        this.stage = Objects.requireNonNull(stage, "stage");
        this.actingPlayerId = actingPlayerId;
        this.cards = cards == null ? List.of() : List.copyOf(cards);
        this.targets = targets == null ? List.of() : List.copyOf(targets);
        this.requestedBy = requestedBy;
        this.offer = offer;
        this.title = title;
        this.description = description;
    }

    public String exchangeId() {
        return exchangeId;
    }

    public Stage stage() {
        return stage;
    }

    public String actingPlayerId() {
        return actingPlayerId;
    }

    public List<ExchangeOption> cards() {
        return cards;
    }

    public List<ExchangeTarget> targets() {
        return targets;
    }

    public ExchangeTarget requestedBy() {
        return requestedBy;
    }

    public String offer() {
        return offer;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }
}
