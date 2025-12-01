package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Fournit des helpers de mapping joueurs/bots partag├®s entre RoomMapper et les extras temps r├®el.
 */
public final class RoomParticipantsMapper {

    private RoomParticipantsMapper() { }

    public static List<PlayerState> mapPlayers(JsonNode node) {
        List<PlayerState> players = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(p -> players.add(new PlayerState(
                    p.path("id").isInt() ? p.get("id").asInt() : null,
                    p.path("username").asText("Joueur")
            )));
        }
        return players;
    }

    public static List<BotState> mapBots(JsonNode node) {
        List<BotState> bots = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(b -> bots.add(new BotState(
                    b.path("id").isInt() ? b.get("id").asInt() : null,
                    b.path("name").asText("Bot")
            )));
        }
        return bots;
    }

    public static void updateFromExtras(TableState tableState, Map<String, Object> extras) {
        if (tableState == null || extras == null || extras.isEmpty()) return;

        List<PlayerState> players = null;
        List<BotState> bots = new ArrayList<>(tableState.bots());

        Object playersNode = extras.get("players");
        if (playersNode instanceof JsonNode) {
            JsonNode node = (JsonNode) playersNode;
            if (node.isArray()) {
                players = new ArrayList<>();
                for (JsonNode p : node) {
                    Integer id = p.path("id").isInt() ? p.get("id").asInt() : null;
                    String name = p.path("username").asText("Joueur");
                    boolean isBot = p.path("isBot").asBoolean(false);
                    if (isBot) {
                        mergeBot(bots, new BotState(id, name));
                    } else {
                        players.add(new PlayerState(id, name));
                    }
                }
            }
        }

        Object botsNode = extras.get("bots");
        if (botsNode instanceof JsonNode) {
            JsonNode node = (JsonNode) botsNode;
            if (node.isArray()) {
                mapBots(node).forEach(bot -> mergeBot(bots, bot));
            }
        }

        if (players != null) {
            tableState.updatePlayers(players);
        }
        tableState.updateBots(deduplicateBots(bots));
    }

    private static List<BotState> deduplicateBots(List<BotState> bots) {
        List<BotState> unique = new ArrayList<>();
        for (BotState bot : bots) {
            if (bot == null) {
                continue;
            }
            boolean exists = unique.stream().anyMatch(existing -> {
                if (existing.id() != null && bot.id() != null) {
                    return Objects.equals(existing.id(), bot.id());
                }
                // prefer existing positive id when names collide
                if (normalize(existing.name()).equals(normalize(bot.name()))) {
                    return true;
                }
                return false;
            });
            if (!exists) {
                unique.add(bot);
            }
        }
        return unique;
    }

    private static void mergeBot(List<BotState> bots, BotState incoming) {
        if (incoming == null) {
            return;
        }
        String name = normalize(incoming.name());
        Integer id = incoming.id();
        for (int i = 0; i < bots.size(); i++) {
            BotState existing = bots.get(i);
            if (existing == null) {
                continue;
            }
            boolean sameId = existing.id() != null && id != null && Objects.equals(existing.id(), id);
            boolean sameName = normalize(existing.name()).equals(name);
            if (sameId || sameName) {
                // replace placeholder (id <= 0 or null) with a real id if available
                if ((existing.id() == null || existing.id() <= 0) && id != null && id > 0) {
                    bots.set(i, incoming);
                }
                return;
            }
        }
        bots.add(incoming);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
