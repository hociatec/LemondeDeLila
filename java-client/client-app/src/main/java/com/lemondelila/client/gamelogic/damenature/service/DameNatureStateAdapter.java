package com.lemondelila.client.gamelogic.damenature.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.user.model.ClientSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

public final class DameNatureStateAdapter {

    private final ClientSession session;

    public DameNatureStateAdapter(ClientSession session) {
        this.session = Objects.requireNonNull(session, "session");
    }

    public DameNatureViewState adapt(GenericGameState state) {
        if (state == null) {
            return DameNatureViewState.empty();
        }
        JsonNode playersNode = asNode(state.extras().get("players"));
        if (playersNode == null || !playersNode.isArray()) {
            return DameNatureViewState.empty();
        }
        Map<String, String> familyNames = buildFamilyNames(asNode(state.extras().get("catalog")));

        JsonNode metadataNode = asNode(state.extras().get("metadata"));
        int maxPollution = metadataNode != null && metadataNode.has("maxPollution")
                ? metadataNode.get("maxPollution").asInt(12)
                : 12;
        int familyGoal = metadataNode != null && metadataNode.has("familyGoal")
                ? metadataNode.get("familyGoal").asInt(4)
                : 4;

        int pollution = readInt(state.extras().get("pollution"));
        int deckRemaining = readDeckRemaining(asNode(state.extras().get("deck")));

        String username = session.authenticated()
                .map(ClientSession.AuthState::username)
                .orElse("");

        List<DameNatureViewState.OpponentView> opponents = new ArrayList<>();
        List<DameNatureViewState.CardView> hand = new ArrayList<>();
        List<String> completedFamilies = new ArrayList<>();
        DameNatureViewState.PlayerView localPlayer = null;

        for (JsonNode playerNode : playersNode) {
            String playerName = playerNode.path("username").asText("");
            int id = playerNode.path("id").asInt();
            boolean isLocal = !playerName.isBlank() && playerName.equalsIgnoreCase(username);
            if (isLocal) {
                localPlayer = new DameNatureViewState.PlayerView(id, playerName);
                JsonNode handNode = playerNode.path("hand");
                if (handNode.isArray()) {
                    handNode.forEach(cardNode -> {
                        String familyId = cardNode.path("familyId").asText("");
                        String familyName = cardNode.path("familyName").asText(familyNames.getOrDefault(familyId, ""));
                        String memberName = cardNode.path("memberName").asText("");
                        String role = cardNode.path("role").asText("");
                        String code = cardNode.path("code").asText(familyId + ":" + memberName);
                        hand.add(new DameNatureViewState.CardView(
                                code,
                                familyId,
                                familyName,
                                memberName,
                                role
                        ));
                    });
                }
                JsonNode books = playerNode.path("books");
                if (books.isArray()) {
                    books.forEach(book -> {
                        String familyId = book.asText("");
                        if (!familyId.isBlank()) {
                            completedFamilies.add(familyNames.getOrDefault(familyId, familyId));
                        }
                    });
                }
            } else {
                int handCount = playerNode.path("handCount").asInt(playerNode.path("hand").isArray()
                        ? playerNode.path("hand").size()
                        : 0);
                JsonNode books = playerNode.path("books");
                int familyCount = books.isArray() ? books.size() : 0;
                boolean bot = playerNode.path("isBot").asBoolean(false);
                opponents.add(new DameNatureViewState.OpponentView(
                        id,
                        playerName.isBlank() ? ("Joueur " + id) : playerName,
                        bot,
                        handCount,
                        familyCount
                ));
            }
        }

        return new DameNatureViewState(
                localPlayer,
                hand,
                completedFamilies,
                opponents,
                deckRemaining,
                pollution,
                maxPollution,
                familyGoal
        );
    }

    private static Map<String, String> buildFamilyNames(JsonNode catalogNode) {
        Map<String, String> names = new HashMap<>();
        if (catalogNode == null || !catalogNode.isObject()) {
            return names;
        }
        JsonNode families = catalogNode.path("families");
        if (!families.isArray()) {
            return names;
        }
        families.forEach(node -> {
            String id = node.path("id").asText("");
            String name = node.path("name").asText("");
            if (!id.isBlank() && !name.isBlank()) {
                names.put(id, name);
            }
        });
        return names;
    }

    private static JsonNode asNode(Object candidate) {
        if (candidate instanceof JsonNode node) {
            return node;
        }
        return null;
    }

    private static int readDeckRemaining(JsonNode deckNode) {
        if (deckNode == null) {
            return 0;
        }
        if (deckNode.has("remaining")) {
            return deckNode.get("remaining").asInt(0);
        }
        if (deckNode.isArray()) {
            return deckNode.size();
        }
        if (deckNode.isInt()) {
            return deckNode.asInt();
        }
        return 0;
    }

    private static int readInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof JsonNode node) {
            if (node.isNumber()) {
                return node.asInt();
            }
            if (node.isTextual()) {
                try {
                    return Integer.parseInt(node.asText());
                } catch (NumberFormatException ignored) {
                    return 0;
                }
            }
        }
        return 0;
    }
}
