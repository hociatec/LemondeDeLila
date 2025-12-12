package com.lemondelila.client.game.history.service;

import com.lemondelila.client.game.room.model.TableState;

import java.util.Objects;
import java.util.stream.Stream;

/**
 * Centralise la narration li├®e aux tables (participants, confidentialit├®, etc.).
 */
public final class RoomNarrationService {

    public RoomSummary summarize(TableState state) {
        Objects.requireNonNull(state, "tableState");
        var unique = new java.util.LinkedHashMap<String, String>();
        state.players().forEach(p -> addParticipant(unique, p.id(), p.username(), "Joueur"));
        state.bots().forEach(b -> addParticipant(unique, b.id(), b.name(), "Bot"));
        int count = unique.size();
        String names = unique.values().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + ", " + b)
                .orElse("aucun participant");
        return new RoomSummary(count, names);
    }

    public String summarySentence(RoomSummary summary) {
        if (summary == null) {
            return "Aucun participant à la table.";
        }
        return summary.participantCount + " personnes assises à la table : " + summary.participantNames + ".";
    }

    public String privacyLabel(boolean isPrivate) {
        return isPrivate ? "Privée" : "Publique";
    }

    public String privacyMessage(boolean isPrivate) {
        return "Table " + (isPrivate ? "privée" : "publique") + ".";
    }

    public record RoomSummary(int participantCount, String participantNames) { }

    private static void addParticipant(java.util.Map<String, String> map, Integer id, String name, String fallback) {
        String label = (name == null || name.isBlank()) ? fallback : name;
        String key = id != null ? "id:" + id : "name:" + normalize(name);
        if (!map.containsKey(key)) {
            map.put(key, label);
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
