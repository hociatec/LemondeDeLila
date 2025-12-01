package com.lemondelila.client.gamelogic.damenature.service;

import java.util.Collections;
import java.util.List;

public record DameNatureViewState(
        PlayerView localPlayer,
        List<CardView> hand,
        List<String> completedFamilies,
        List<OpponentView> opponents,
        int deckRemaining,
        int pollution,
        int maxPollution,
        int familyGoal
) {

    public static DameNatureViewState empty() {
        return new DameNatureViewState(null, List.of(), List.of(), List.of(), 0, 0, 12, 4);
    }

    public List<CardView> hand() {
        return hand == null ? List.of() : Collections.unmodifiableList(hand);
    }

    public List<String> completedFamilies() {
        return completedFamilies == null ? List.of() : Collections.unmodifiableList(completedFamilies);
    }

    public List<OpponentView> opponents() {
        return opponents == null ? List.of() : Collections.unmodifiableList(opponents);
    }

    public record PlayerView(int id, String username) {
        public boolean valid() {
            return id != 0 && username != null && !username.isBlank();
        }
    }

    public record CardView(String code,
                           String familyId,
                           String familyName,
                           String memberName,
                           String role) {

        public String label() {
            StringBuilder builder = new StringBuilder();
            if (familyName != null && !familyName.isBlank()) {
                builder.append(familyName);
            }
            if (memberName != null && !memberName.isBlank()) {
                if (builder.length() > 0) {
                    builder.append(" - ");
                }
                builder.append(memberName);
            }
            if (role != null && !role.isBlank()) {
                builder.append(" (").append(role).append(')');
            }
            return builder.length() == 0 ? code : builder.toString();
        }
    }

    public record OpponentView(int id,
                               String username,
                               boolean bot,
                               int handCount,
                               int familyCount) {
        public String label() {
            String base = username != null && !username.isBlank() ? username : "Adversaire";
            return String.format("%s%s - Cartes : %d - Familles : %d",
                    base,
                    bot ? " (bot)" : "",
                    Math.max(0, handCount),
                    Math.max(0, familyCount));
        }
    }
}
