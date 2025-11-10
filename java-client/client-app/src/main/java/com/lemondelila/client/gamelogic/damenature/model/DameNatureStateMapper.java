package com.lemondelila.client.gamelogic.damenature.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public final class DameNatureStateMapper {

    private DameNatureStateMapper() {
    }

    public static DameNatureState fromJson(JsonNode root) throws IOException {
        if (root == null || !root.isObject()) {
            throw new IOException("Etat Dame Nature invalide");
        }

        String type = root.path("type").asText("dame-nature");
        String status = root.path("status").asText("playing");
        int turnIndex = root.path("turnIndex").asInt(0);
        int round = root.path("round").asInt(1);
        int pollution = root.path("pollution").asInt(0);
        int maxPollution = root.path("metadata").path("maxPollution").asInt(12);

        DameNatureState.Deck deck = new DameNatureState.Deck(root.path("deck").path("remaining").asInt(0));

        List<DameNatureState.Player> players = new ArrayList<>();
        ArrayNode playersNode = root.withArray("players");
        for (JsonNode playerNode : playersNode) {
            int id = playerNode.path("id").asInt();
            String username = playerNode.path("username").asText("?");
            int handCount = playerNode.path("handCount").asInt(playerNode.withArray("hand").size());
            List<DameNatureState.HandCard> hand = new ArrayList<>();
            for (JsonNode cardNode : playerNode.withArray("hand")) {
                hand.add(new DameNatureState.HandCard(
                        cardNode.path("code").asText(),
                        cardNode.path("type").asText(),
                        nullIfBlank(cardNode.path("familyId").asText(null)),
                        nullIfBlank(cardNode.path("familyName").asText(null)),
                        nullIfBlank(cardNode.path("memberName").asText(null)),
                        nullIfBlank(cardNode.path("role").asText(null))
                ));
            }
            List<String> books = new ArrayList<>();
            for (JsonNode bookNode : playerNode.withArray("books")) {
                books.add(bookNode.asText());
            }
            players.add(new DameNatureState.Player(id, username, handCount, hand, books));
        }

        DameNatureState.PendingQuiz pendingQuiz = null;
        JsonNode quizNode = root.path("pendingQuiz");
        if (quizNode.isObject() && quizNode.path("question").isTextual()) {
            List<String> choices = new ArrayList<>();
            for (JsonNode choice : quizNode.withArray("choices")) {
                choices.add(choice.asText());
            }
            pendingQuiz = new DameNatureState.PendingQuiz(
                    quizNode.path("question").asText(),
                    choices
            );
        }

        List<DameNatureState.LogEntry> logEntries = new ArrayList<>();
        for (JsonNode logNode : root.withArray("log")) {
            logEntries.add(new DameNatureState.LogEntry(
                    logNode.path("message").asText(""),
                    logNode.path("type").asText("info")
            ));
        }

        DameNatureState.Catalog catalog = parseCatalog(root.path("catalog"));
        Map<String, DameNatureState.CardDefinition> cards = parseCardDefinitions(root.path("cards"));

        return new DameNatureState(
                type,
                status,
                turnIndex,
                round,
                pollution,
                maxPollution,
                deck,
                players,
                pendingQuiz,
                logEntries,
                catalog,
                cards
        );
    }

    private static DameNatureState.Catalog parseCatalog(JsonNode catalogNode) {
        List<DameNatureState.Family> families = new ArrayList<>();
        for (JsonNode familyNode : catalogNode.withArray("families")) {
            String familyId = familyNode.path("id").asText();
            String familyName = familyNode.path("name").asText(familyId);
            List<DameNatureState.FamilyMember> members = new ArrayList<>();
            for (JsonNode memberNode : familyNode.withArray("members")) {
                members.add(new DameNatureState.FamilyMember(
                        memberNode.path("id").asText(),
                        memberNode.path("name").asText(),
                        memberNode.path("role").asText()
                ));
            }
            families.add(new DameNatureState.Family(familyId, familyName, members));
        }

        List<DameNatureState.DangerCard> dangerCards = new ArrayList<>();
        for (JsonNode dangerNode : catalogNode.withArray("dangerCards")) {
            dangerCards.add(new DameNatureState.DangerCard(
                    dangerNode.path("id").asText(),
                    dangerNode.path("name").asText(),
                    dangerNode.path("pollutionDelta").asInt()
            ));
        }

        return new DameNatureState.Catalog(families, dangerCards);
    }

    private static Map<String, DameNatureState.CardDefinition> parseCardDefinitions(JsonNode node) {
        Map<String, DameNatureState.CardDefinition> map = new HashMap<>();
        if (node instanceof ObjectNode objectNode) {
            Iterator<Map.Entry<String, JsonNode>> fields = objectNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                JsonNode value = entry.getValue();
                map.put(entry.getKey(), new DameNatureState.CardDefinition(
                        value.path("type").asText(),
                        value.path("familyId").asText(null),
                        value.path("familyName").asText(null),
                        value.path("memberId").asText(null),
                        value.path("memberName").asText(null),
                        value.path("role").asText(null)
                ));
            }
        }
        return map;
    }

    private static String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
