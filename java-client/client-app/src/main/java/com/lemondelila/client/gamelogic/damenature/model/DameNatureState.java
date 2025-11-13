package com.lemondelila.client.gamelogic.damenature.model;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public record DameNatureState(
        String type,
        String status,
        int turnIndex,
        int round,
        int pollution,
        int maxPollution,
        Deck deck,
        List<Player> players,
        PendingQuiz pendingQuiz,
        List<LogEntry> log,
        Catalog catalog,
        Map<String, CardDefinition> cards
) {

    public record Deck(int remaining) {
    }

    public record PendingQuiz(String question, List<String> choices) {
        public boolean active() {
            return question != null && !question.isBlank() && choices != null && !choices.isEmpty();
        }
    }

    public record Player(
            int id,
            String username,
            int handCount,
            List<HandCard> hand,
            List<String> books
    ) {
        public boolean isSelf(String selfName) {
            return selfName != null && username != null && username.equalsIgnoreCase(selfName);
        }
    }

    public record HandCard(
            String code,
            String type,
            String familyId,
            String familyName,
            String memberName,
            String role
    ) {
        @Override
        public String toString() {
            if (familyName != null && memberName != null) {
                return familyName + " - " + memberName;
            }
            return memberName != null ? memberName : code;
        }
    }

    public record LogEntry(String message, String type) {
    }

    public record Catalog(List<Family> families, List<DangerCard> dangerCards) {
        public Optional<Family> findFamily(String id) {
            if (id == null || families == null) {
                return Optional.empty();
            }
            return families.stream().filter(f -> id.equalsIgnoreCase(f.id())).findFirst();
        }
    }

    public record Family(String id, String name, List<FamilyMember> members) {
        public Optional<FamilyMember> member(String memberId) {
            if (memberId == null || members == null) {
                return Optional.empty();
            }
            return members.stream().filter(m -> memberId.equalsIgnoreCase(m.id())).findFirst();
        }
    }

    public record FamilyMember(String id, String name, String role) {
    }

    public record DangerCard(String id, String name, int pollutionDelta) {
    }

    public record CardDefinition(
            String type,
            String familyId,
            String familyName,
            String memberId,
            String memberName,
            String role
    ) {
    }
}
