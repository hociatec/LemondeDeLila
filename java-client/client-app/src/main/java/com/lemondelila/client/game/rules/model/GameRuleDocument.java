package com.lemondelila.client.game.rules.model;

public record GameRuleDocument(String gameId, String content, long fetchedAtMillis) {
}
