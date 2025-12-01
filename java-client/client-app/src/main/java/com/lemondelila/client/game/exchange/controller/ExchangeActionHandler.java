package com.lemondelila.client.game.exchange.controller;

import com.lemondelila.client.game.exchange.model.ExchangePrompt;

public interface ExchangeActionHandler {
    void submitSelection(ExchangePrompt prompt, String cardId, String targetId);
}
