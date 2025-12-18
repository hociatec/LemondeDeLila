package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;

public final class PendingViewModel {

    public record Result(
            String pendingLabel,
            boolean exchangePending,
            boolean resetExchangeNavigator,
            boolean clearInfoLabelIfNotQuiz
    ) {}

    public Result compute(JsonNode pendingNode,
                          boolean wasExchangePending,
                          boolean currentExchangePending,
                          boolean infoLabelStartsWithQuiz) {
        if (pendingNode == null || pendingNode.isNull()) {
            return new Result("", false, true, !infoLabelStartsWithQuiz);
        }
        if (!pendingNode.isObject()) {
            return new Result("", currentExchangePending, false, false);
        }

        String type = pendingNode.path("type").asText("");
        boolean exchange = "exchange".equalsIgnoreCase(type);
        boolean reset = !wasExchangePending && exchange;

        String text = describePending(pendingNode);
        if (text == null || text.isBlank()) {
            text = "";
        }
        return new Result(text, exchange, reset, false);
    }

    public String describePending(JsonNode pendingNode) {
        if (pendingNode == null || !pendingNode.isObject()) {
            return "";
        }
        String type = pendingNode.path("type").asText("");
        if ("exchange".equalsIgnoreCase(type)) {
            if (pendingNode.path("targetPlayerId").isInt()) {
                return "Échange en attente avec le joueur " + pendingNode.get("targetPlayerId").asInt();
            }
            return "Échange en attente";
        }
        if ("vote".equalsIgnoreCase(type) || "day_vote".equalsIgnoreCase(type)) {
            return "Vote en cours : choisissez une cible.";
        }
        if ("phase".equalsIgnoreCase(type)) {
            return "Phase en cours : " + pendingNode.path("name").asText("");
        }
        if ("quiz".equalsIgnoreCase(type)) {
            return null;
        }
        if (pendingNode.has("message")) {
            return pendingNode.get("message").asText("");
        }
        return "Action en attente...";
    }
}

