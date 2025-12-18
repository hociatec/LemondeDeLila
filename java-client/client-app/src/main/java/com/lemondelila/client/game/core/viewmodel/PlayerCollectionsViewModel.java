package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class PlayerCollectionsViewModel {

    public record ResolvedView(int playerId, List<String> shopping, List<String> basket, List<String> inventory) {}

    public Optional<ResolvedView> resolve(JsonNode extras, Integer localUserId, String localUsername) {
        if (extras == null || !extras.isObject()) {
            return Optional.empty();
        }
        String localNameKey = normalizeName(localUsername);

        JsonNode playerViews = extras.get("playerViews");
        Optional<ResolvedView> fromPlayerViews = resolveFromArray(playerViews, localUserId, localNameKey);
        if (fromPlayerViews.isPresent()) {
            return fromPlayerViews;
        }

        JsonNode players = extras.get("players");
        Optional<ResolvedView> fromPlayers = resolveFromArray(players, localUserId, localNameKey);
        if (fromPlayers.isPresent()) {
            return fromPlayers;
        }

        JsonNode view = extras.get("currentPlayerView");
        if (view == null || view.isNull()) {
            view = extras.get("playerView");
        }
        Optional<ResolvedView> fromSingle = resolveFromObject(view);
        return fromSingle;
    }

    private Optional<ResolvedView> resolveFromArray(JsonNode array, Integer localUserId, String localNameKey) {
        if (array == null || !array.isArray() || array.isEmpty()) {
            return Optional.empty();
        }

        // 1) match by id
        if (localUserId != null) {
            for (JsonNode v : array) {
                if (v != null && v.isObject() && v.path("id").isInt() && v.get("id").asInt() == localUserId) {
                    return resolveFromObject(v);
                }
            }
        }

        // 2) match by username
        if (localNameKey != null && !localNameKey.isBlank()) {
            for (JsonNode v : array) {
                if (v == null || !v.isObject()) continue;
                String name = v.path("username").asText("");
                if (!name.isBlank() && normalizeName(name).equals(localNameKey)) {
                    return resolveFromObject(v);
                }
            }
        }

        // 3) first non-bot with id
        for (JsonNode v : array) {
            if (v == null || !v.isObject()) continue;
            boolean isBot = v.path("isBot").asBoolean(false);
            if (!isBot && v.path("id").isInt()) {
                return resolveFromObject(v);
            }
        }

        // 4) fallback to first
        return resolveFromObject(array.get(0));
    }

    private Optional<ResolvedView> resolveFromObject(JsonNode obj) {
        if (obj == null || !obj.isObject() || !obj.path("id").isInt()) {
            return Optional.empty();
        }
        int id = obj.get("id").asInt();
        List<String> shopping = toStringList(obj.get("shoppingList"));
        List<String> basket = toStringList(obj.get("basket"));
        List<String> inventory = toStringList(obj.get("inventory"));
        return Optional.of(new ResolvedView(id, shopping, basket, inventory));
    }

    private static List<String> toStringList(JsonNode node) {
        if (node == null || node.isNull()) return List.of();
        if (node.isArray()) {
            List<String> out = new ArrayList<>();
            for (JsonNode n : node) {
                if (n == null) continue;
                String s = n.asText("");
                if (!s.isBlank()) out.add(s);
            }
            return out;
        }
        String s = node.asText("");
        return s.isBlank() ? List.of() : List.of(s);
    }

    private static String normalizeName(String name) {
        if (name == null) return null;
        String trimmed = name.trim();
        if (trimmed.isBlank()) return null;
        String nfd = Normalizer.normalize(trimmed, Normalizer.Form.NFD);
        String noMarks = nfd.replaceAll("\\p{M}", "");
        return noMarks.toLowerCase(Locale.ROOT);
    }
}

