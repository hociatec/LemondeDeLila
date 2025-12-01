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
        int count = state.players().size() + state.bots().size();
        String names = Stream.concat(
                        state.players().stream().map(p -> p.username() == null ? "Joueur" : p.username()),
                        state.bots().stream().map(b -> b.name() == null ? "Bot" : b.name())
                )
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
}
