package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.CollectionAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.ListAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.PositionAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.StatsAnnouncementFormatter;
import com.lemondelila.client.game.room.model.TableState;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class GameAnnouncementService {

    private final TableState tableState;
    private final Consumer<String> announcer;
    private final CollectionAnnouncementFormatter collectionAnnouncementFormatter = new CollectionAnnouncementFormatter();
    private final PositionAnnouncementFormatter positionAnnouncementFormatter = new PositionAnnouncementFormatter();
    private final ListAnnouncementFormatter listAnnouncementFormatter = new ListAnnouncementFormatter();
    private final StatsAnnouncementFormatter statsAnnouncementFormatter = new StatsAnnouncementFormatter();

    public GameAnnouncementService(TableState tableState, Consumer<String> announcer) {
        this.tableState = tableState;
        this.announcer = announcer;
    }

    public void announceCollection(String id, List<String> values) {
        announcer.accept(collectionAnnouncementFormatter.formatCollectionAnnouncement(id, values));
    }

    public void announcePosition(GenericGameState state) {
        Integer playerId = tableState == null ? null : tableState.currentPlayerId();
        announcePosition(state, playerId);
    }

    public void announcePosition(GenericGameState state, Integer playerId) {
        JsonNode boardNode = state == null ? null : state.board();
        int turn = resolveBoardLap(boardNode, playerId);
        String message = null;
        if (boardNode != null && boardNode.has("positions") && boardNode.get("positions").isObject() && playerId != null) {
            JsonNode pos = boardNode.get("positions").get(String.valueOf(playerId));
            if (pos != null && pos.isInt() && boardNode.has("tiles") && boardNode.get("tiles").isArray()) {
                int index = pos.asInt();
                int total = boardNode.get("tiles").size();
                message = positionAnnouncementFormatter.formatPosition(index, total, turn);
            }
        }
        if (message == null) {
            message = positionAnnouncementFormatter.formatPosition(-1, 0, turn);
        }
        announcer.accept(message);
    }

    public void announceHand(GenericGameState state) {
        List<String> hand = handLabels(state);
        announcer.accept(listAnnouncementFormatter.format(
                Internationalization.text("game.hand.title"),
                hand,
                resolveHandEmptyText(state)
        ));
    }

    public void announceHandReceived(GenericGameState state) {
        List<String> hand = handLabels(state);
        announcer.accept(listAnnouncementFormatter.format(
                Internationalization.text(resolveHandReceivedKey(state)),
                hand,
                resolveHandEmptyText(state)
        ));
    }

    public List<String> handLabels(GenericGameState state) {
        JsonNode extras = extrasOf(state);
        if (extras == null) {
            return List.of();
        }
        JsonNode handCards = extras.path("handCards");
        if (handCards != null && handCards.isArray()) {
            List<String> labels = new ArrayList<>();
            for (JsonNode card : handCards) {
                if (card == null || !card.isObject()) continue;
                String label = card.path("label").asText("");
                if (label == null || label.isBlank()) {
                    String familyId = card.path("familyId").asText("");
                    String memberId = card.path("memberId").asText("");
                    String left = familyId == null ? "" : familyId.trim();
                    String right = memberId == null ? "" : memberId.trim();
                    label = left.isBlank() && right.isBlank() ? "" : (left + ":" + right);
                }
                if (label != null && !label.isBlank()) {
                    labels.add(label.trim());
                }
            }
            return List.copyOf(labels);
        }
        Object handRaw = extras.get("hand");
        return toStringList(handRaw);
    }

    public void announceBooks(GenericGameState state) {
        JsonNode extras = extrasOf(state);
        Object booksRaw = extras != null ? extras.get("books") : null;
        List<String> books = toStringList(booksRaw);
        if (books.isEmpty()) {
            announcer.accept(Internationalization.text("game.books.none"));
            return;
        }
        announcer.accept(listAnnouncementFormatter.format(
                Internationalization.text("game.books.title"),
                books,
                Internationalization.text("game.books.none")
        ));
    }

    public void announceStats(GenericGameState state) {
        if (state == null || state.metadata() == null) {
            announcer.accept(Internationalization.text("game.stats.none"));
            return;
        }
        JsonNode node = state.metadata();
        if (!node.isObject()) {
            announcer.accept(Internationalization.text("game.stats.unavailable"));
            return;
        }
        int pollution = node.path("pollution").asInt(0);
        int maxPollution = node.path("maxPollution").asInt(0);
        int familyGoal = node.path("familyGoal").asInt(0);
        int books = 0;
        JsonNode players = state.players();
        if (players != null && players.isArray()) {
            for (JsonNode p : players) {
                books += p.path("books").isArray() ? p.get("books").size() : 0;
            }
        }
        announcer.accept(statsAnnouncementFormatter.format(pollution, maxPollution, books, familyGoal));
    }

    private static JsonNode extrasOf(GenericGameState state) {
        JsonNode extras = state == null ? null : state.extras();
        return extras != null && extras.isObject() ? extras : null;
    }

    private static int resolveBoardLap(JsonNode boardNode, Integer currentId) {
        // Préférence : valeur déjà prête côté serveur (tour affichable).
        if (boardNode != null && boardNode.isObject() && currentId != null) {
            JsonNode turnsNode = boardNode.get("turns");
            if (turnsNode != null && turnsNode.isObject()) {
                JsonNode turn = turnsNode.get(String.valueOf(currentId));
                if (turn != null && turn.isInt()) {
                    return Math.max(0, turn.asInt(0));
                }
            }
        }

        int lapCompleted = 0;
        if (boardNode != null && boardNode.isObject() && currentId != null) {
            JsonNode lapsNode = boardNode.get("laps");
            if (lapsNode != null && lapsNode.isObject()) {
                JsonNode lap = lapsNode.get(String.valueOf(currentId));
                if (lap != null && lap.isInt()) {
                    lapCompleted = lap.asInt(0);
                }
            }
        }
        // 0 laps complétés => tour de plateau 1 ; laps négatifs => tour 0 minimum.
        return Math.max(0, lapCompleted + 1);
    }

    private static String resolveHandEmptyText(GenericGameState state) {
        String key = "game.hand.empty";
        if ("dame-nature".equalsIgnoreCase(resolveGameType(state))) {
            key = "damenature.game.hand.empty";
        }
        return Internationalization.text(key);
    }

    private static String resolveHandReceivedKey(GenericGameState state) {
        if ("dame-nature".equalsIgnoreCase(resolveGameType(state))) {
            return "damenature.game.hand.received";
        }
        return "game.hand.title";
    }

    private static String resolveGameType(GenericGameState state) {
        JsonNode metadata = state == null ? null : state.metadata();
        if (metadata == null || !metadata.isObject()) {
            return "";
        }
        return metadata.path("gameType").asText("");
    }

    private static List<String> toStringList(Object raw) {
        if (raw == null) return List.of();
        if (raw instanceof List<?> list) {
            return list.stream()
                    .map(v -> v == null ? "" : v.toString())
                    .filter(s -> !s.isBlank())
                    .toList();
        }
        if (raw instanceof JsonNode node && node.isArray()) {
            ArrayList<String> vals = new ArrayList<>();
            node.forEach(n -> {
                if (n != null && !n.asText("").isBlank()) {
                    vals.add(n.asText(""));
                }
            });
            return vals;
        }
        String s = raw.toString();
        return s.isBlank() ? List.of() : List.of(s);
    }
}
