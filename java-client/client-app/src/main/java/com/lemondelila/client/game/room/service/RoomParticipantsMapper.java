package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.ArrayList;
import java.util.List;
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

    public static void updateFromPlayers(TableState tableState, JsonNode playersNode) {
        if (tableState == null || playersNode == null || !playersNode.isArray()) return;

        List<PlayerState> players = new ArrayList<>();
        List<BotState> bots = new ArrayList<>();
        List<Integer> order = new ArrayList<>();

        for (JsonNode p : playersNode) {
            Integer id = p.path("id").isInt() ? p.get("id").asInt() : null;
            String name = p.path("username").asText("Joueur");
            boolean isBot = p.path("isBot").asBoolean(false);
            if (isBot) {
                mergeBot(bots, new BotState(id, name));
            } else {
                players.add(new PlayerState(id, name));
            }
            if (id != null && order.stream().noneMatch(existing -> Objects.equals(existing, id))) {
                order.add(id);
            }
        }

        tableState.updatePlayers(deduplicatePlayers(players));
        tableState.updateBots(deduplicateBots(bots));
        tableState.updateParticipantOrder(order);
    }

    private static List<BotState> deduplicateBots(List<BotState> bots) {
        java.util.Map<Integer, BotState> byId = new java.util.HashMap<>();
        java.util.Map<String, BotState> byName = new java.util.HashMap<>();
        for (BotState bot : bots) {
            if (bot == null) continue;
            Integer id = bot.id();
            String nameKey = normalize(bot.name());
            if (id != null) {
                byId.put(id, bot); // id unique : on garde la dernière occurrence (id>0 prioritaire en mergeBot)
            } else if (!nameKey.isEmpty()) {
                // si pas d'id, on déduplique par nom seulement si aucun id n'existe déjà pour ce nom
                byName.putIfAbsent(nameKey, bot);
            }
        }
        List<BotState> unique = new ArrayList<>(byId.values());
        byName.forEach((k, v) -> {
            // n'ajouter que si aucun bot avec même nom et id dans byId
            boolean existsSameName = unique.stream().anyMatch(b -> normalize(b.name()).equals(k));
            if (!existsSameName) {
                unique.add(v);
            }
        });
        return unique;
    }

    private static void mergeBot(List<BotState> bots, BotState incoming) {
        if (incoming == null) {
            return;
        }
        Integer id = incoming.id();
        String nameKey = normalize(incoming.name());
        for (int i = 0; i < bots.size(); i++) {
            BotState existing = bots.get(i);
            if (existing == null) continue;
            boolean sameId = existing.id() != null && id != null && Objects.equals(existing.id(), id);
            boolean sameNameNoId = existing.id() == null && id == null && normalize(existing.name()).equals(nameKey);
            if (sameId || sameNameNoId) {
                // remplacer si le nouvel enregistrement est plus precis (id connu ou nom non vide)
                if ((existing.id() == null || existing.id() <= 0) && id != null && id > 0) {
                    bots.set(i, incoming);
                } else if ((existing.name() == null || existing.name().isBlank()) && incoming.name() != null) {
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

    private static List<PlayerState> deduplicatePlayers(List<PlayerState> players) {
        java.util.Map<Integer, PlayerState> byId = new java.util.HashMap<>();
        java.util.Map<String, PlayerState> byName = new java.util.HashMap<>();
        for (PlayerState p : players) {
            if (p == null) continue;
            Integer id = p.id();
            String nameKey = normalize(p.username());
            if (id != null) {
                byId.put(id, p);
            } else if (!nameKey.isEmpty()) {
                byName.putIfAbsent(nameKey, p);
            }
        }
        List<PlayerState> unique = new ArrayList<>(byId.values());
        byName.forEach((k, v) -> {
            boolean existsSameName = unique.stream().anyMatch(x -> normalize(x.username()).equals(k));
            if (!existsSameName) {
                unique.add(v);
            }
        });
        return unique;
    }
}

