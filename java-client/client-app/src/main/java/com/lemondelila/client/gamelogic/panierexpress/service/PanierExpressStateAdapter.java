package com.lemondelila.client.gamelogic.panierexpress.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.exchange.model.ExchangeOption;
import com.lemondelila.client.game.exchange.model.ExchangePrompt;
import com.lemondelila.client.game.exchange.model.ExchangeTarget;
import com.lemondelila.client.user.model.ClientSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Adapte l'état brut GenericGameState vers des objets prêts à afficher
 * (échange, inventaire joueur).
 */
public final class PanierExpressStateAdapter {

    private final ClientSession session;

    public PanierExpressStateAdapter(ClientSession session) {
        this.session = Objects.requireNonNull(session, "session");
    }

    public ExchangePrompt mapExchangePrompt(GenericGameState state) {
        if (state == null || state.extras() == null) {
            return null;
        }
        Object raw = state.extras().get("pendingExchange");
        if (!(raw instanceof JsonNode node)) {
            return null;
        }
        String exchangeId = node.path("exchangeId").asText(null);
        if (exchangeId == null || exchangeId.isBlank()) {
            return null;
        }
        String stageText = node.path("stage").asText("select");
        ExchangePrompt.Stage stage = "target".equalsIgnoreCase(stageText)
                ? ExchangePrompt.Stage.TARGET
                : ExchangePrompt.Stage.SELECT;
        List<ExchangeOption> cards = new ArrayList<>();
        JsonNode cardsNode = node.path("cards");
        if (cardsNode.isArray()) {
            cardsNode.forEach(item -> {
                String id = item.path("id").asText("");
                String label = item.path("label").asText("");
                if (!id.isBlank()) {
                    cards.add(new ExchangeOption(id, label));
                }
            });
        }
        List<ExchangeTarget> targets = new ArrayList<>();
        JsonNode targetsNode = node.path("targets");
        if (targetsNode.isArray()) {
            targetsNode.forEach(item -> {
                String id = item.path("id").asText("");
                if (id.isBlank()) {
                    return;
                }
                String username = item.path("username").asText("");
                boolean bot = item.path("isBot").asBoolean(false);
                targets.add(new ExchangeTarget(id, username, bot));
            });
        }
        ExchangeTarget requestedBy = null;
        JsonNode requesterNode = node.path("requestedBy");
        if (requesterNode.isObject()) {
            String id = requesterNode.path("id").asText(null);
            String username = requesterNode.path("username").asText("");
            if (id != null) {
                requestedBy = new ExchangeTarget(id, username, requesterNode.path("isBot").asBoolean(false));
            }
        }
        String offer = node.path("offer").asText(null);
        String actingPlayerId = node.path("playerId").asText(null);
        JsonNode cardNode = node.path("card");
        String title = cardNode.path("title").asText("Echange");
        String description = cardNode.path("effect").asText(cardNode.path("description").asText(""));
        return new ExchangePrompt(exchangeId, stage, actingPlayerId, cards, targets, requestedBy, offer, title, description);
    }

    public PanierPlayerItems mapPlayerItems(GenericGameState state) {
        if (state == null || state.extras() == null) {
            return null;
        }
        Object raw = state.extras().get("players");
        if (!(raw instanceof JsonNode node) || !node.isArray()) {
            return null;
        }
        JsonNode local = findLocalPlayer(node);
        if (local == null) {
            return null;
        }
        List<String> basket = readStrings(local.path("basket"));
        List<String> inventory = readStrings(local.path("inventory"));
        if (!basket.isEmpty() && !inventory.isEmpty()) {
            inventory = subtract(basket, inventory);
        }
        List<String> shoppingList = readStrings(local.path("shoppingList"));
        return new PanierPlayerItems(
                local.path("username").asText("Vous"),
                basket,
                inventory,
                shoppingList
        );
    }

    private JsonNode findLocalPlayer(JsonNode players) {
        String username = session.authenticated()
                .map(ClientSession.AuthState::username)
                .orElse(null);
        if (username == null || username.isBlank()) {
            return null;
        }
        for (JsonNode player : players) {
            if (player.path("username").asText("").equalsIgnoreCase(username)) {
                return player;
            }
        }
        return null;
    }

    private static List<String> readStrings(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(item -> {
                String text = item.asText("").trim();
                if (!text.isEmpty()) {
                    values.add(text);
                }
            });
        }
        return values;
    }

    private static List<String> subtract(List<String> basket, List<String> inventory) {
        List<String> filtered = new ArrayList<>(inventory);
        for (String basketItem : basket) {
            removeFirstIgnoreCase(filtered, basketItem);
        }
        return filtered;
    }

    private static void removeFirstIgnoreCase(List<String> list, String value) {
        if (value == null) {
            return;
        }
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).equalsIgnoreCase(value)) {
                list.remove(i);
                return;
            }
        }
    }
}
