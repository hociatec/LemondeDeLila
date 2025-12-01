package com.lemondelila.client.game.exchange.controller;

import com.lemondelila.client.game.exchange.model.ExchangeCollection;
import com.lemondelila.client.game.exchange.model.ExchangePrompt;

import java.util.Objects;

public final class ExchangeController {

    private final ExchangeCollection collection;
    private final ExchangeActionHandler handler;
    private String pendingCard;
    private String pendingTarget;

    public ExchangeController(ExchangeCollection collection, ExchangeActionHandler handler) {
        this.collection = Objects.requireNonNull(collection, "collection");
        this.handler = Objects.requireNonNull(handler, "handler");
    }

    public ExchangeCollection collection() {
        return collection;
    }

    public void setPrompt(ExchangePrompt prompt) {
        collection.setPrompt(prompt);
        pendingCard = null;
        pendingTarget = null;
    }

    public void clearPrompt() {
        collection.clear();
        pendingCard = null;
        pendingTarget = null;
    }

    public void selectCard(String cardId) {
        pendingCard = cardId;
        submitIfReady();
    }

    public void selectTarget(String targetId) {
        pendingTarget = targetId;
        submitIfReady();
    }

    private void submitIfReady() {
        ExchangePrompt prompt = collection.prompt();
        if (prompt == null) {
            return;
        }
        switch (prompt.stage()) {
            case SELECT -> {
                if (pendingCard != null && pendingTarget != null) {
                    handler.submitSelection(prompt, pendingCard, pendingTarget);
                }
            }
            case TARGET -> {
                if (pendingCard != null) {
                    handler.submitSelection(prompt, pendingCard, prompt.actingPlayerId());
                }
            }
        }
    }
}
